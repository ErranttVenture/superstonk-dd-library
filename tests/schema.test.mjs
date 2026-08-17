import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  validateAgainstSchema,
  validateMasterRecords
} from '../scripts/schema-validator.mjs';
import { runNodeCli } from './cli-test-helpers.mjs';

const records = JSON.parse(
  await readFile(new URL('../data/master.json', import.meta.url), 'utf8')
);
const originalRecords = JSON.parse(
  await readFile(new URL('../data/original-master.json', import.meta.url), 'utf8')
);
const schema = JSON.parse(
  await readFile(new URL('../data/schema.json', import.meta.url), 'utf8')
);
const outputSchema = JSON.parse(
  await readFile(new URL('../harness/output_schema.json', import.meta.url), 'utf8')
);
const record = records.find((candidate) => candidate.validity_rating !== null);
const metadataRecord = records.find((candidate) => !Object.hasOwn(candidate, 'summary'));
const requiredReviewedFields = [
  'is_compilation',
  'content_type',
  'summary',
  'key_claims',
  'constituents',
  'evidence_quality',
  'speculation_level',
  'validity_rating',
  'rating_reconciled',
  'validity_rationale',
  'quality_variance',
  'confidence',
  'topics'
];

test('all canonical records satisfy the record schema', () => {
  const result = validateMasterRecords(records, schema);

  assert.ok(result.total >= 250);
  assert.equal(result.valid, result.total);
  assert.deepEqual(result.errors, []);
});

test('all 250 immutable baseline records satisfy the record schema', () => {
  const result = validateMasterRecords(originalRecords, schema);

  assert.equal(result.total, 250);
  assert.equal(result.valid, 250);
  assert.deepEqual(result.errors, []);
});

test('repository validation CLI checks both current and original master datasets', async () => {
  const result = await runNodeCli('scripts/validate-repository.mjs');

  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  assert.ok(result.stdout.includes(
    `Schema validation: ${records.length}/${records.length} records valid`
  ));
  assert.match(result.stdout, /Original baseline schema validation: 250\/250 records valid/);
  assert.match(result.stdout, /Original baseline position sequence: 1–250 complete/);
  assert.match(result.stdout, /Canonical dataset: 250 preserved \+ \d+ community records/);
});

test('record schema permits a string author_response on metadata and reviewed records', () => {
  for (const candidate of [metadataRecord, record]) {
    assert.deepEqual(validateAgainstSchema(schema, {
      ...candidate,
      author_response: 'The author disputes claim 2.'
    }), []);
  }
});

test('metadata-only records cannot contain an isolated review field', () => {
  const candidate = { ...metadataRecord, summary: 'An incomplete review.' };

  assert.notDeepEqual(validateAgainstSchema(schema, candidate), []);
});

for (const field of requiredReviewedFields) {
  test(`reviewed records require ${field}`, () => {
    const candidate = structuredClone(record);
    delete candidate[field];

    assert.notDeepEqual(validateAgainstSchema(schema, candidate), []);
  });
}

test('record schema rejects an unknown property and invalid claim assessment', () => {
  const candidate = structuredClone(record);
  candidate.untracked = true;
  candidate.key_claims[0].assessment = 'vibes';

  const messages = validateAgainstSchema(schema, candidate).map(({ message }) => message);
  assert(messages.some((message) => message.includes('unknown property')));
  assert(messages.some((message) => message.includes('enum')));
});

test('record schema rejects a missing inventory title', () => {
  const candidate = structuredClone(record);
  delete candidate.title;

  const errors = validateAgainstSchema(schema, candidate);
  assert(errors.some(({ path, message }) =>
    path === '$' && message.includes('required property "title"')));
});

test('record schema permits a null validity_rating', () => {
  const candidate = { ...record, validity_rating: null };

  assert.deepEqual(validateAgainstSchema(schema, candidate), []);
});

test('record schema permits a pre-adjudication validity rating on reviewed records', () => {
  const candidate = { ...record, validity_rating_original: 2 };

  assert.deepEqual(validateAgainstSchema(schema, candidate), []);
});

test('metadata-only records reject a pre-adjudication validity rating', () => {
  const candidate = { ...metadataRecord, validity_rating_original: 2 };

  assert.notDeepEqual(validateAgainstSchema(schema, candidate), []);
});

test('array validation rejects too few, too many, duplicate, and wrongly typed items', () => {
  const arraySchema = {
    type: 'array',
    minItems: 2,
    maxItems: 3,
    uniqueItems: true,
    items: { type: 'string' }
  };

  assert.deepEqual(validateAgainstSchema(arraySchema, ['only']), [
    { path: '$', message: 'must contain at least 2 items' }
  ]);
  assert.deepEqual(validateAgainstSchema(arraySchema, ['a', 'b', 'c', 'd']), [
    { path: '$', message: 'must contain at most 3 items' }
  ]);
  assert.deepEqual(validateAgainstSchema(arraySchema, ['same', 'same']), [
    { path: '$', message: 'must contain unique items' }
  ]);
  assert.deepEqual(validateAgainstSchema(arraySchema, ['fine', 7]), [
    { path: '$[1]', message: 'must be of type string' }
  ]);
});

test('integer validation rejects fractional and out-of-range ratings', () => {
  const ratingSchema = { type: 'integer', minimum: 1, maximum: 5 };

  assert.deepEqual(validateAgainstSchema(ratingSchema, 2.5), [
    { path: '$', message: 'must be of type integer' }
  ]);
  assert.deepEqual(validateAgainstSchema(ratingSchema, 0), [
    { path: '$', message: 'must be greater than or equal to 1' }
  ]);
  assert.deepEqual(validateAgainstSchema(ratingSchema, 6), [
    { path: '$', message: 'must be less than or equal to 5' }
  ]);
});

test('local refs decode JSON Pointer escapes and enforce referenced schemas', () => {
  const refSchema = {
    $defs: {
      'rating/value': { type: 'integer', minimum: 1 },
      'tilde~name': { const: 'resolved' }
    },
    allOf: [
      { $ref: '#/$defs/rating~1value' },
      { maximum: 5 }
    ]
  };

  assert.deepEqual(validateAgainstSchema(refSchema, 3), []);
  assert.deepEqual(validateAgainstSchema(refSchema, 0), [
    { path: '$', message: 'must be greater than or equal to 1' }
  ]);
  assert.deepEqual(
    validateAgainstSchema({
      $defs: refSchema.$defs,
      $ref: '#/$defs/tilde~0name'
    }, 'wrong'),
    [{ path: '$', message: 'must equal the const value' }]
  );
});

test('additionalProperties false rejects an extra nested claim field', () => {
  const candidate = structuredClone(record);
  candidate.key_claims[0].citation_guess = 'page 12';

  assert(validateAgainstSchema(schema, candidate).some(({ path, message }) =>
    path === '$.key_claims[0].citation_guess' &&
    message === 'unknown property "citation_guess"'));
});

test('anyOf, allOf, const, and pattern reject malformed identifiers', () => {
  const identifierSchema = {
    allOf: [
      { type: 'string' },
      {
        anyOf: [
          { const: 'manual' },
          { pattern: '^DD-[0-9]+$' }
        ]
      }
    ]
  };

  assert.deepEqual(validateAgainstSchema(identifierSchema, 'DD-42'), []);
  assert.deepEqual(validateAgainstSchema(identifierSchema, 'dd-42'), [
    { path: '$', message: 'must match at least one schema in anyOf' }
  ]);
});

test('schema annotations are no-ops but unknown validation keywords throw', () => {
  const annotatedSchema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://example.test/schema',
    $comment: 'documentation',
    title: 'Example',
    description: 'An annotated string',
    default: 'fallback',
    type: 'string'
  };

  assert.deepEqual(validateAgainstSchema(annotatedSchema, 'value'), []);
  assert.throws(
    () => validateAgainstSchema({ type: 'string', minLength: 1 }, 'value'),
    /unsupported schema keyword "minLength"/
  );
});

test('remote refs throw instead of being silently ignored', () => {
  assert.throws(
    () => validateAgainstSchema({ $ref: 'https://example.test/schema' }, 'value'),
    /only local schema references are supported/
  );
});

test('local refs cannot resolve inherited Object prototype properties', () => {
  assert.throws(
    () => validateAgainstSchema({ $defs: {}, $ref: '#/$defs/toString' }, 'value'),
    /local schema reference not found: #\/\x24defs\/toString/
  );
  assert.throws(
    () => validateAgainstSchema({ $ref: '#/constructor' }, 'value'),
    /local schema reference not found: #\/constructor/
  );
});

test('schema-valued additionalProperties is rejected instead of bypassing preflight', () => {
  assert.throws(
    () => validateAgainstSchema({
      type: 'object',
      additionalProperties: { minLength: 1 }
    }, { unexpected: '' }),
    /schema-valued additionalProperties is unsupported/
  );
});

test('recovered output schema accepts a canonical review-stage payload', () => {
  // The real per-book AI schema never had `rating_reconciled` (an adjudication field added
  // later, downstream of the AI output) and always required pos/is_compilation/content_type —
  // the reconstruction this replaces had exactly that backwards.
  const reviewFields = [
    'pos',
    'is_compilation',
    'content_type',
    'summary',
    'key_claims',
    'constituents',
    'evidence_quality',
    'speculation_level',
    'validity_rating',
    'validity_rationale',
    'quality_variance',
    'confidence',
    'topics'
  ];
  const review = Object.fromEntries(reviewFields.map((field) => [field, record[field]]));

  assert.equal(
    outputSchema.$comment,
    'Recovered verbatim from the original per-book AI review output schema (the SCHEMA constant in the original workflow script). See PROVENANCE.md. Structured-output enforced per book by the review agent runtime — every field below the top level matches the original property order and names exactly.'
  );
  assert.deepEqual(outputSchema.required, [
    'pos',
    'is_compilation',
    'content_type',
    'summary',
    'key_claims',
    'evidence_quality',
    'speculation_level',
    'validity_rating',
    'validity_rationale',
    'quality_variance',
    'confidence',
    'topics'
  ]);
  assert.ok(
    !outputSchema.required.includes('rating_reconciled') && !outputSchema.required.includes('constituents'),
    'the real per-book schema never required rating_reconciled or constituents'
  );
  assert.deepEqual(validateAgainstSchema(outputSchema, review), []);
});

const communitySubmission = {
  submitted_on: '2026-08-20',
  submitted_by: 'octocat',
  issue: 'https://github.com/ErranttVenture/superstonk-dd-library/issues/12',
  archive_url: 'https://web.archive.org/web/20260820000000/https://example.test/dd',
  platform: 'reddit'
};
const communityPending = {
  pos: 251,
  title: 'A submitted DD',
  byline: 'u/example',
  pages: null,
  uploaded: '2026-08-01',
  url: 'https://example.test/dd',
  type: 'original',
  text_available: true,
  source_corpus: 'community',
  review_status: 'pending',
  submission: communitySubmission
};
const communityReviewed = {
  ...communityPending,
  review_status: 'reviewed',
  ...Object.fromEntries(requiredReviewedFields.map((field) => [field, record[field]])),
  review_provenance: {
    model: 'claude-opus-5',
    evaluated_on: '2026-08-25',
    hindsight_version: 'v2',
    prompt_revision: 'harness/review_prompt.md@1ec62ef',
    reviewer: 'octocat'
  }
};

test('review provenance stamps a hindsight version, not a retired cutoff date', () => {
  const withCutoff = structuredClone(communityReviewed);
  delete withCutoff.review_provenance.hindsight_version;
  withCutoff.review_provenance.hindsight_cutoff = '2026-08-25';

  assert.notDeepEqual(validateAgainstSchema(schema, withCutoff), []);

  const withoutVersion = structuredClone(communityReviewed);
  delete withoutVersion.review_provenance.hindsight_version;

  assert.notDeepEqual(validateAgainstSchema(schema, withoutVersion), []);
});

test('review provenance rejects a hindsight version that is not vN', () => {
  for (const value of ['2026-08-25', 'version2', 'v', 'V2', '2']) {
    const candidate = structuredClone(communityReviewed);
    candidate.review_provenance.hindsight_version = value;

    assert.notDeepEqual(validateAgainstSchema(schema, candidate), [], value);
  }

  for (const value of ['v1', 'v2', 'v10']) {
    const candidate = structuredClone(communityReviewed);
    candidate.review_provenance.hindsight_version = value;

    assert.deepEqual(validateAgainstSchema(schema, candidate), [], value);
  }
});

test('reviewed records may carry an optional top-level hindsight_version stamp', () => {
  assert.deepEqual(validateAgainstSchema(schema, { ...record, hindsight_version: 'v2' }), []);
  assert.deepEqual(
    validateAgainstSchema(schema, { ...communityReviewed, hindsight_version: 'v2' }),
    []
  );
  assert.notDeepEqual(
    validateAgainstSchema(schema, { ...record, hindsight_version: '2026-08-25' }),
    []
  );
  assert.notDeepEqual(
    validateAgainstSchema(schema, { ...metadataRecord, hindsight_version: 'v2' }),
    []
  );
});

test('record schema accepts community pending and reviewed records', () => {
  assert.deepEqual(validateAgainstSchema(schema, communityPending), []);
  assert.deepEqual(validateAgainstSchema(schema, communityReviewed), []);
});

test('record schema accepts an unreviewable community record with a summary', () => {
  const candidate = {
    ...communityPending,
    review_status: 'unreviewable',
    summary: 'Image-only submission with no readable text layer.'
  };

  assert.deepEqual(validateAgainstSchema(schema, candidate), []);
});

test('record schema rejects community fields on a preserved record', () => {
  for (const extra of [
    { source_corpus: 'community' },
    { review_status: 'pending' },
    { submission: communitySubmission }
  ]) {
    assert.notDeepEqual(validateAgainstSchema(schema, { ...metadataRecord, ...extra }), []);
    assert.notDeepEqual(validateAgainstSchema(schema, { ...record, ...extra }), []);
  }
});

test('record schema rejects a community record missing its community fields', () => {
  for (const field of ['source_corpus', 'review_status', 'submission']) {
    const candidate = structuredClone(communityPending);
    delete candidate[field];

    assert.notDeepEqual(validateAgainstSchema(schema, candidate), []);
  }
});

test('record schema requires review_provenance only on community reviewed records', () => {
  const withoutProvenance = structuredClone(communityReviewed);
  delete withoutProvenance.review_provenance;

  assert.notDeepEqual(validateAgainstSchema(schema, withoutProvenance), []);
  assert.deepEqual(validateAgainstSchema(schema, communityPending), []);
});

test('record schema rejects a mismatched review_status', () => {
  assert.notDeepEqual(
    validateAgainstSchema(schema, { ...communityPending, review_status: 'reviewed' }),
    []
  );
  assert.notDeepEqual(
    validateAgainstSchema(schema, { ...communityReviewed, review_status: 'pending' }),
    []
  );
});

test('record schema rejects any source_corpus value other than community', () => {
  assert.notDeepEqual(
    validateAgainstSchema(schema, { ...communityPending, source_corpus: 'original_250' }),
    []
  );
});

test('record schema confines null pages and pos 251 to their own branches', () => {
  assert.notDeepEqual(validateAgainstSchema(schema, { ...metadataRecord, pages: null }), []);
  assert.notDeepEqual(validateAgainstSchema(schema, { ...communityPending, pos: 250 }), []);
  assert.deepEqual(validateAgainstSchema(schema, { ...communityPending, pages: 14 }), []);
});

test('record schema rejects an unknown property inside submission', () => {
  const candidate = structuredClone(communityPending);
  candidate.submission.referrer = 'twitter';

  assert.notDeepEqual(validateAgainstSchema(schema, candidate), []);
});
