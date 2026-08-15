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

test('all 250 canonical records satisfy the record schema', () => {
  const result = validateMasterRecords(records, schema);

  assert.equal(result.total, 250);
  assert.equal(result.valid, 250);
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
  assert.match(result.stdout, /Schema validation: 250\/250 records valid/);
  assert.match(result.stdout, /Original baseline schema validation: 250\/250 records valid/);
  assert.match(result.stdout, /Original baseline position sequence: 1–250 complete/);
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

test('array validation rejects too few, duplicate, and wrongly typed items', () => {
  const arraySchema = {
    type: 'array',
    minItems: 2,
    uniqueItems: true,
    items: { type: 'string' }
  };

  assert.deepEqual(validateAgainstSchema(arraySchema, ['only']), [
    { path: '$', message: 'must contain at least 2 items' }
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

test('reconstructed output schema accepts a canonical review-stage payload', () => {
  const reviewFields = [
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
  const review = Object.fromEntries(reviewFields.map((field) => [field, record[field]]));

  assert.equal(
    outputSchema.$comment,
    'RECONSTRUCTED — inferred from the original master.json records; this is not the preserved July 21, 2026 output schema.'
  );
  assert.deepEqual(validateAgainstSchema(outputSchema, review), []);
});
