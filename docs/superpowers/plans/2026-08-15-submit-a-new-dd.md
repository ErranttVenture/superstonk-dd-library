# Submit a New DD to the Library — Implementation Plan

> **Superseded:** the shipped code on `feat/submit-a-new-dd` (`scripts/`, `.github/workflows/`, `data/schema.json`) supersedes this plan — its reference code was defective in six of eight tasks, and it still contains at least one claim the spec later retracted.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let community members submit due diligence the July 21, 2026 review never saw, through a mechanically-verified issue form that a maintainer accepts into `data/master.json` as an explicitly unrated record.

**Architecture:** A four-branch `anyOf` in `data/schema.json` admits community records at `pos` 251 and above without loosening the preserved 250. Three pure functions in `scripts/submission.mjs` (parse, check, build) hold all the logic; two thin CLIs wrap them; two GitHub Actions workflows wire the CLIs to issue events. A new `scripts/dataset-invariants.mjs` holds the growth rules so they can be unit-tested against synthetic datasets instead of the 1 MB real one.

**Tech Stack:** Node.js 18+, ES modules, zero runtime dependencies, `node --test` with `node:assert/strict`, hand-rolled JSON Schema validation in `scripts/schema-validator.mjs`, GitHub Actions.

## Global Constraints

- **Zero dependencies.** `package.json` has no `dependencies` or `devDependencies` and must not gain any. No ajv, no yaml parser, no `@actions/*` packages.
- **Node 18+, ESM.** `"type": "module"`. Use `import`, `node:` prefixed builtins, top-level `await` where the existing scripts do.
- **`data/original-master.json` is immutable.** SHA-256 `fb96f7d70a0abece7e1a3f1995d1df67eb3ea5b7134565115e68e5431ffccf13`, pinned in `tests/repository.test.mjs`. Never write to it.
- **`data/master.json` serializes as `JSON.stringify(records, null, 1) + '\n'`.** One-space indent. This round-trips the current file byte-for-byte; verified. Any other indent reformats all 250 records into an unreviewable diff.
- **`data/master.json` is `text eol=lf` in `.gitattributes`.** Never write CRLF. `tests/repository.test.mjs` fails on any CR byte.
- **The schema validator throws on unsupported keywords.** Supported: `$schema $id $comment $defs title description default $ref type required properties additionalProperties items enum const minimum maximum minItems uniqueItems pattern anyOf allOf`. Using `if`, `then`, `else`, `not`, `minLength`, or `format` anywhere in `data/schema.json` throws at validation time, failing every schema test.
- **`additionalProperties` must be boolean**, never a schema object.
- **The preserved 250 gain no new fields.** Not `source_corpus`, not `review_status`, not anything. Their byte-identity to the baseline is the provenance guarantee.
- **No source text is ever committed.** Not book text, not post text, not an excerpt beyond the one-line thesis.
- **Do not add a real community record to `data/master.json` in this plan.** Every community-record behavior is proven with fixtures. The dataset ships at 250 records and the pipeline is what ships.

---

## File Structure

**Create:**

| Path | Responsibility |
|---|---|
| `scripts/dataset-invariants.mjs` | Pure `checkDatasetInvariants(master, baseline)`. The growth rules, testable against synthetic arrays. |
| `scripts/submission.mjs` | Pure `parseSubmissionIssue`, `checkSubmission`, `buildPendingRecord`, `normalizeUrl`, plus the default `resolveUrl`. |
| `scripts/check-submission.mjs` | CLI: issue body file → markdown checklist on stdout, ending in a status marker comment. |
| `scripts/apply-submission.mjs` | CLI: issue body + issue URL + author → appends a pending record to `data/master.json`. |
| `.github/ISSUE_TEMPLATE/submit-dd.yml` | The submission form. Labels are the parser contract; ids are the web-form contract. |
| `.github/workflows/submission-check.yml` | On issue open/edit: run the check CLI, comment, label. |
| `.github/workflows/submission-open-pr.yml` | On maintainer `accepted` label: run the apply CLI, open a PR. |
| `tests/submission.test.mjs` | Unit tests for all of `scripts/submission.mjs`. |
| `tests/dataset-invariants.test.mjs` | Unit tests for the growth rules. |

**Modify:**

| Path | Change |
|---|---|
| `data/schema.json` | Two `anyOf` branches become four; new `$defs`; `pos` maximum relaxed. |
| `scripts/validate-repository.mjs` | Delegate sequence checking to `dataset-invariants.mjs`; new output lines. |
| `tests/schema.test.mjs` | Dynamic record counts; community-record cases. |
| `tests/repository.test.mjs` | Split master/baseline invariants; assert the new issue form and docs. |
| `CONTRIBUTING.md` | New "Submit a new DD" section. |
| `README.md` | Submission path, updated provenance, "pending means unrated". |
| `harness/README.md` | Reviewing a community record; `review_provenance`. |

---

## Task 1: Four-branch record schema

**Files:**
- Modify: `data/schema.json`
- Test: `tests/schema.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: the record shapes every later task builds and validates against. A community pending record has exactly these keys: `pos`, `title`, `byline`, `pages`, `uploaded`, `url`, `type`, `text_available`, `source_corpus`, `review_status`, `submission`, and optionally `summary` and `author_response`. `submission` has exactly `submitted_on`, `submitted_by`, `issue`, `archive_url`, `platform`.

- [x] **Step 1: Write the failing tests**

Append to `tests/schema.test.mjs`:

```javascript
const reviewFieldNames = [
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
  ...Object.fromEntries(reviewFieldNames.map((field) => [field, record[field]])),
  review_provenance: {
    model: 'claude-opus-5',
    evaluated_on: '2026-08-25',
    hindsight_cutoff: '2026-08-25',
    prompt_revision: 'harness/review_prompt.md@1ec62ef',
    reviewer: 'octocat'
  }
};

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
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/schema.test.mjs`
Expected: FAIL. The community records are rejected because `source_corpus` is an unknown property and `pos` exceeds the current maximum of 250.

- [x] **Step 3: Add the new `$defs`**

In `data/schema.json`, inside `$defs`, replace the `pos` definition and add the new definitions:

```json
    "pos": {
      "type": "integer",
      "minimum": 1
    },
    "originalPos": {
      "type": "integer",
      "minimum": 1,
      "maximum": 250
    },
    "communityPos": {
      "type": "integer",
      "minimum": 251
    },
    "date": {
      "type": "string",
      "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}$"
    },
    "pagesOrNull": {
      "anyOf": [
        { "$ref": "#/$defs/pages" },
        { "type": "null" }
      ]
    },
    "sourceCorpus": {
      "const": "community"
    },
    "unratedStatus": {
      "enum": ["pending", "unreviewable"]
    },
    "reviewedStatus": {
      "const": "reviewed"
    },
    "platform": {
      "enum": ["reddit", "fliphtml5", "substack", "pdf", "other"]
    },
    "submission": {
      "type": "object",
      "required": [
        "submitted_on",
        "submitted_by",
        "issue",
        "archive_url",
        "platform"
      ],
      "properties": {
        "submitted_on": { "$ref": "#/$defs/date" },
        "submitted_by": { "$ref": "#/$defs/string" },
        "issue": { "$ref": "#/$defs/url" },
        "archive_url": { "$ref": "#/$defs/url" },
        "platform": { "$ref": "#/$defs/platform" }
      },
      "additionalProperties": false
    },
    "reviewProvenance": {
      "type": "object",
      "required": [
        "model",
        "evaluated_on",
        "hindsight_cutoff",
        "prompt_revision",
        "reviewer"
      ],
      "properties": {
        "model": { "$ref": "#/$defs/string" },
        "evaluated_on": { "$ref": "#/$defs/date" },
        "hindsight_cutoff": { "$ref": "#/$defs/date" },
        "prompt_revision": { "$ref": "#/$defs/string" },
        "reviewer": { "$ref": "#/$defs/string" }
      },
      "additionalProperties": false
    },
```

Then point the existing `uploaded` definition at the shared date pattern so there is one date rule:

```json
    "uploaded": { "$ref": "#/$defs/date" },
```

- [x] **Step 4: Add the new properties to the top-level property block**

The top-level object has `additionalProperties: false`, so a property absent from its `properties` map is rejected before any branch is consulted. In `data/schema.json`, after the existing `"author_response"` entry in the **top-level** `properties` block, add:

```json
    "source_corpus": { "$ref": "#/$defs/sourceCorpus" },
    "review_status": {
      "enum": ["pending", "reviewed", "unreviewable"]
    },
    "submission": { "$ref": "#/$defs/submission" },
    "review_provenance": { "$ref": "#/$defs/reviewProvenance" }
```

- [x] **Step 5: Bound the two existing branches to the preserved range**

In both existing `anyOf` branches — the one titled `Metadata-only record` and the one titled `Reviewed record` — change the `pos` property from `{ "$ref": "#/$defs/pos" }` to:

```json
        "pos": { "$ref": "#/$defs/originalPos" },
```

Leave everything else in those two branches untouched. They list no community properties, and their `additionalProperties: false` is what rejects community fields on a preserved record.

- [x] **Step 6: Add the two community branches**

Append these two objects to the top-level `anyOf` array, after the `Reviewed record` branch:

```json
    {
      "title": "Community unrated record",
      "type": "object",
      "required": [
        "pos",
        "title",
        "byline",
        "pages",
        "uploaded",
        "url",
        "type",
        "text_available",
        "source_corpus",
        "review_status",
        "submission"
      ],
      "properties": {
        "pos": { "$ref": "#/$defs/communityPos" },
        "title": { "$ref": "#/$defs/string" },
        "byline": { "$ref": "#/$defs/string" },
        "pages": { "$ref": "#/$defs/pagesOrNull" },
        "uploaded": { "$ref": "#/$defs/uploaded" },
        "url": { "$ref": "#/$defs/url" },
        "type": { "$ref": "#/$defs/recordType" },
        "text_available": { "$ref": "#/$defs/boolean" },
        "source_corpus": { "$ref": "#/$defs/sourceCorpus" },
        "review_status": { "$ref": "#/$defs/unratedStatus" },
        "submission": { "$ref": "#/$defs/submission" },
        "summary": { "$ref": "#/$defs/string" },
        "author_response": { "$ref": "#/$defs/string" }
      },
      "additionalProperties": false
    },
    {
      "title": "Community reviewed record",
      "type": "object",
      "required": [
        "pos",
        "title",
        "byline",
        "pages",
        "uploaded",
        "url",
        "type",
        "text_available",
        "source_corpus",
        "review_status",
        "submission",
        "review_provenance",
        "is_compilation",
        "content_type",
        "summary",
        "key_claims",
        "constituents",
        "evidence_quality",
        "speculation_level",
        "validity_rating",
        "rating_reconciled",
        "validity_rationale",
        "quality_variance",
        "confidence",
        "topics"
      ],
      "properties": {
        "pos": { "$ref": "#/$defs/communityPos" },
        "title": { "$ref": "#/$defs/string" },
        "byline": { "$ref": "#/$defs/string" },
        "pages": { "$ref": "#/$defs/pagesOrNull" },
        "uploaded": { "$ref": "#/$defs/uploaded" },
        "url": { "$ref": "#/$defs/url" },
        "type": { "$ref": "#/$defs/recordType" },
        "text_available": { "$ref": "#/$defs/boolean" },
        "source_corpus": { "$ref": "#/$defs/sourceCorpus" },
        "review_status": { "$ref": "#/$defs/reviewedStatus" },
        "submission": { "$ref": "#/$defs/submission" },
        "review_provenance": { "$ref": "#/$defs/reviewProvenance" },
        "is_compilation": { "$ref": "#/$defs/boolean" },
        "content_type": { "$ref": "#/$defs/contentType" },
        "summary": { "$ref": "#/$defs/string" },
        "key_claims": { "$ref": "#/$defs/keyClaims" },
        "constituents": { "$ref": "#/$defs/constituents" },
        "evidence_quality": { "$ref": "#/$defs/rating" },
        "speculation_level": { "$ref": "#/$defs/speculationLevel" },
        "validity_rating": { "$ref": "#/$defs/nullableRating" },
        "validity_rating_original": { "$ref": "#/$defs/rating" },
        "rating_reconciled": { "$ref": "#/$defs/boolean" },
        "validity_rationale": { "$ref": "#/$defs/string" },
        "quality_variance": { "$ref": "#/$defs/qualityVariance" },
        "confidence": { "$ref": "#/$defs/confidence" },
        "topics": { "$ref": "#/$defs/topics" },
        "calibration": { "$ref": "#/$defs/calibration" },
        "insufficient_text": { "$ref": "#/$defs/boolean" },
        "author_response": { "$ref": "#/$defs/string" }
      },
      "additionalProperties": false
    }
```

- [x] **Step 7: Run the full test suite**

Run: `npm test`
Expected: PASS, including all pre-existing tests. The 250 preserved records still validate because their branches are unchanged apart from a `pos` bound they already satisfy.

- [x] **Step 8: Run repository validation**

Run: `npm run validate`
Expected: exit 0, `Schema validation: 250/250 records valid`.

- [x] **Step 9: Commit**

```bash
git add data/schema.json tests/schema.test.mjs && git commit -m "feat: admit community records in the canonical schema"
```

---

## Task 2: Dataset growth invariants

**Files:**
- Create: `scripts/dataset-invariants.mjs`
- Modify: `scripts/validate-repository.mjs`
- Test: `tests/dataset-invariants.test.mjs`, `tests/repository.test.mjs:61-71`, `tests/schema.test.mjs:57-65`

**Interfaces:**
- Consumes: Task 1's record shapes.
- Produces: `checkDatasetInvariants(master, baseline)` returning `{ ok: boolean, errors: string[], preserved: number, community: number }`. Task 6's apply CLI relies on community records being contiguous from 251.

- [x] **Step 1: Write the failing test**

Create `tests/dataset-invariants.test.mjs`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';

import { checkDatasetInvariants } from '../scripts/dataset-invariants.mjs';

const baseline = Array.from({ length: 250 }, (_, index) => ({
  pos: index + 1,
  title: `Book ${index + 1}`
}));
const community = (pos) => ({ pos, title: `Submission ${pos}`, source_corpus: 'community' });

test('accepts the preserved dataset with no community records', () => {
  const result = checkDatasetInvariants(baseline, baseline);

  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
  assert.equal(result.preserved, 250);
  assert.equal(result.community, 0);
});

test('accepts a contiguous community block', () => {
  const master = [...baseline, community(251), community(252)];
  const result = checkDatasetInvariants(master, baseline);

  assert.deepEqual(result.errors, []);
  assert.equal(result.community, 2);
});

test('allows a governed edit to a preserved record', () => {
  const master = structuredClone(baseline);
  master[8].validity_rating_original = 2;

  assert.deepEqual(checkDatasetInvariants(master, baseline).errors, []);
});

test('rejects a community record occupying a preserved slot', () => {
  const master = structuredClone(baseline);
  master[41].source_corpus = 'community';

  const result = checkDatasetInvariants(master, baseline);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /preserved record 42 must not carry source_corpus/);
});

test('rejects a reordered preserved block', () => {
  const master = structuredClone(baseline);
  [master[3], master[4]] = [master[4], master[3]];

  const result = checkDatasetInvariants(master, baseline);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /preserved positions must run 1–250 in order/);
});

test('rejects a dropped preserved record', () => {
  const result = checkDatasetInvariants(baseline.slice(0, 249), baseline);

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /must retain all 250 preserved records/);
});

test('rejects a gap in the community block', () => {
  const result = checkDatasetInvariants([...baseline, community(251), community(253)], baseline);

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /community record at index 251 must have pos 252/);
});

test('rejects a duplicate position', () => {
  const result = checkDatasetInvariants([...baseline, community(251), community(251)], baseline);

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /duplicate pos 251/);
});

test('rejects a baseline that is not exactly 1-250', () => {
  const short = baseline.slice(0, 249);

  assert.match(
    checkDatasetInvariants(short, short).errors.join('\n'),
    /baseline must contain exactly 250 records/
  );
});

test('accepts the real dataset as it stands today', async () => {
  const { readFile } = await import('node:fs/promises');
  const realMaster = JSON.parse(
    await readFile(new URL('../data/master.json', import.meta.url), 'utf8')
  );
  const realBaseline = JSON.parse(
    await readFile(new URL('../data/original-master.json', import.meta.url), 'utf8')
  );

  assert.deepEqual(checkDatasetInvariants(realMaster, realBaseline).errors, []);
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `node --test tests/dataset-invariants.test.mjs`
Expected: FAIL with `Cannot find module .../scripts/dataset-invariants.mjs`.

- [x] **Step 3: Write the implementation**

Create `scripts/dataset-invariants.mjs`:

```javascript
const PRESERVED_COUNT = 250;

export function checkDatasetInvariants(master, baseline) {
  const errors = [];

  if (baseline.length !== PRESERVED_COUNT) {
    errors.push(`baseline must contain exactly ${PRESERVED_COUNT} records`);
  } else if (!baseline.every((record, index) => record.pos === index + 1)) {
    errors.push('baseline positions must run 1–250 in order');
  }

  if (master.length < PRESERVED_COUNT) {
    errors.push(`canonical dataset must retain all ${PRESERVED_COUNT} preserved records`);
  } else {
    const preserved = master.slice(0, PRESERVED_COUNT);
    if (!preserved.every((record, index) => record.pos === index + 1)) {
      errors.push('preserved positions must run 1–250 in order');
    }
    for (const [index, record] of preserved.entries()) {
      if (Object.hasOwn(record, 'source_corpus')) {
        errors.push(`preserved record ${index + 1} must not carry source_corpus`);
      }
    }

    master.slice(PRESERVED_COUNT).forEach((record, offset) => {
      const expected = PRESERVED_COUNT + offset + 1;
      if (record.pos !== expected) {
        errors.push(
          `community record at index ${PRESERVED_COUNT + offset} must have pos ${expected}`
        );
      }
    });
  }

  const seen = new Set();
  for (const record of master) {
    if (seen.has(record.pos)) {
      errors.push(`duplicate pos ${record.pos}`);
    }
    seen.add(record.pos);
  }

  return {
    ok: errors.length === 0,
    errors,
    preserved: Math.min(master.length, PRESERVED_COUNT),
    community: Math.max(master.length - PRESERVED_COUNT, 0)
  };
}
```

- [x] **Step 4: Run the test to verify it passes**

Run: `node --test tests/dataset-invariants.test.mjs`
Expected: PASS, 8 tests.

- [x] **Step 5: Rewrite the repository validator**

Replace the whole body of `scripts/validate-repository.mjs`:

```javascript
import { readFile } from 'node:fs/promises';

import { validateMasterRecords } from './schema-validator.mjs';
import { checkDatasetInvariants } from './dataset-invariants.mjs';

const schema = JSON.parse(
  await readFile(new URL('../data/schema.json', import.meta.url), 'utf8')
);
const master = JSON.parse(
  await readFile(new URL('../data/master.json', import.meta.url), 'utf8')
);
const baseline = JSON.parse(
  await readFile(new URL('../data/original-master.json', import.meta.url), 'utf8')
);

let invalid = false;
for (const { name, outputPrefix, records } of [
  { name: 'current', outputPrefix: '', records: master },
  { name: 'original baseline', outputPrefix: 'Original baseline ', records: baseline }
]) {
  const result = validateMasterRecords(records, schema);
  for (const error of result.errors) {
    console.error(`${name} record ${error.record} ${error.path}: ${error.message}`);
  }
  const schemaLabel = outputPrefix === '' ? 'Schema' : `${outputPrefix}schema`;
  console.log(`${schemaLabel} validation: ${result.valid}/${result.total} records valid`);
  invalid ||= result.errors.length > 0;
}

const baselineSequenceComplete = baseline.length === 250 &&
  baseline.every((record, index) => record.pos === index + 1);
if (baselineSequenceComplete) {
  console.log('Original baseline position sequence: 1–250 complete');
} else {
  console.error('Original baseline position sequence: expected exactly 1–250');
}

const invariants = checkDatasetInvariants(master, baseline);
for (const error of invariants.errors) {
  console.error(`Canonical dataset: ${error}`);
}
if (invariants.ok) {
  console.log(
    `Canonical dataset: ${invariants.preserved} preserved + ${invariants.community} community records`
  );
}

if (invalid || !baselineSequenceComplete || !invariants.ok) {
  process.exitCode = 1;
}
```

- [x] **Step 6: Update the two tests that hard-code 250**

In `tests/schema.test.mjs`, replace the CLI test at lines 57-65 with:

```javascript
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
```

In `tests/repository.test.mjs`, replace the test at lines 61-71 with:

```javascript
test('keeps the preserved 250 intact and any community block contiguous', async () => {
  const master = JSON.parse(
    await readFile(new URL('../data/master.json', import.meta.url), 'utf8')
  );
  const baseline = JSON.parse(
    await readFile(new URL('../data/original-master.json', import.meta.url), 'utf8')
  );

  assert.ok(Array.isArray(master));
  assert.ok(master.length >= 250);

  const invariants = checkDatasetInvariants(master, baseline);
  assert.deepEqual(invariants.errors, []);
  assert.equal(invariants.preserved, 250);

  for (const record of master.slice(250)) {
    assert.equal(record.source_corpus, 'community');
  }
});
```

Add the import at the top of `tests/repository.test.mjs`, after the existing `node:crypto` import:

```javascript
import { checkDatasetInvariants } from '../scripts/dataset-invariants.mjs';
```

- [x] **Step 7: Run the full suite and validation**

Run: `npm test && npm run validate`
Expected: both PASS. Validator prints `Canonical dataset: 250 preserved + 0 community records`.

- [x] **Step 8: Commit**

```bash
git add scripts/dataset-invariants.mjs scripts/validate-repository.mjs tests/dataset-invariants.test.mjs tests/repository.test.mjs tests/schema.test.mjs && git commit -m "feat: split preserved and community dataset invariants"
```

---

## Task 3: Issue form and parser

**Files:**
- Create: `.github/ISSUE_TEMPLATE/submit-dd.yml`, `scripts/submission.mjs`
- Test: `tests/submission.test.mjs`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `parseSubmissionIssue(body)` returning `{ payload, errors }`. `errors` is an array of `{ field, message }`. `payload` has `title`, `byline`, `url`, `archive_url`, `published`, `platform`, `length`, `compilation`, `thesis`, `text_available`, `related`, `attribution`, `acknowledged`. Tasks 4, 5 and 6 consume `payload` unchanged.

**Critical context:** GitHub renders a submitted issue form as `### Label` headings followed by the value. The field `id` never appears in the body. The parser therefore keys off **labels**; the ids exist for the phase-two prefilled-URL contract. Unanswered optional fields render as the literal `_No response_`.

- [x] **Step 1: Write the issue form**

Create `.github/ISSUE_TEMPLATE/submit-dd.yml`:

```yaml
name: Submit a new DD
description: Nominate due diligence the original review never covered.
title: "[Submission]: "
labels:
  - submission
body:
  - type: markdown
    attributes:
      value: |
        Two contracts run through this form. `parseSubmissionIssue` matches on the **labels** below, and the website submission form builds a prefilled link from the field **ids**. Renaming either is a breaking change.

        Do not paste the full text of the work. Link to it.
  - id: title
    type: input
    attributes:
      label: Title
      description: The title of the work as published.
    validations:
      required: true
  - id: byline
    type: input
    attributes:
      label: Author / byline
      description: Who wrote it. Pseudonyms and handles are fine.
    validations:
      required: true
  - id: url
    type: input
    attributes:
      label: Source URL
      description: A durable link to the work itself.
    validations:
      required: true
  - id: archive_url
    type: input
    attributes:
      label: Archive snapshot URL
      description: A web.archive.org or archive.today snapshot, so the record survives deletion.
    validations:
      required: true
  - id: published
    type: input
    attributes:
      label: Publication date
      description: ISO format, YYYY-MM-DD.
    validations:
      required: true
  - id: platform
    type: dropdown
    attributes:
      label: Platform
      options:
        - Reddit
        - FlipHTML5
        - Substack
        - Hosted PDF
        - Other
    validations:
      required: true
  - id: length
    type: input
    attributes:
      label: Length in pages
      description: Leave blank for a post or any source without pages.
  - id: compilation
    type: checkboxes
    attributes:
      label: Compilation
      options:
        - label: This work compiles or republishes other people's writing.
  - id: thesis
    type: textarea
    attributes:
      label: One-line thesis
      description: What does this work argue, in one sentence? At least 40 characters.
    validations:
      required: true
  - id: text_available
    type: dropdown
    attributes:
      label: Is the full text readable at the source URL?
      options:
        - Yes
        - "No"
    validations:
      required: true
  - id: related
    type: input
    attributes:
      label: Related existing record
      description: If this overlaps a record already in the library, name its number.
  - id: attribution
    type: dropdown
    attributes:
      label: Attribution
      options:
        - Credit my GitHub handle
        - Submit anonymously
    validations:
      required: true
  - id: acknowledgement
    type: checkboxes
    attributes:
      label: Copyright acknowledgement
      options:
        - label: I have not pasted the full text of a copyrighted work into this issue.
          required: true
```

- [x] **Step 2: Write the failing parser tests**

Create `tests/submission.test.mjs`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';

import { parseSubmissionIssue } from '../scripts/submission.mjs';

const completeBody = [
  '### Title', '', 'Swaps and the Offshore Bid', '',
  '### Author / byline', '', 'u/example', '',
  '### Source URL', '', 'https://www.reddit.com/r/Superstonk/comments/abc123/swaps/', '',
  '### Archive snapshot URL', '', 'https://web.archive.org/web/20260801000000/https://www.reddit.com/r/Superstonk/comments/abc123/swaps/', '',
  '### Publication date', '', '2026-07-04', '',
  '### Platform', '', 'Reddit', '',
  '### Length in pages', '', '_No response_', '',
  '### Compilation', '', '- [ ] This work compiles or republishes other people\'s writing.', '',
  '### One-line thesis', '', 'Cross-border swap reporting gaps let short exposure sit outside US disclosure.', '',
  '### Is the full text readable at the source URL?', '', 'Yes', '',
  '### Related existing record', '', '_No response_', '',
  '### Attribution', '', 'Credit my GitHub handle', '',
  '### Copyright acknowledgement', '', '- [X] I have not pasted the full text of a copyrighted work into this issue.', ''
].join('\n');

test('parses a complete submission body', () => {
  const { payload, errors } = parseSubmissionIssue(completeBody);

  assert.deepEqual(errors, []);
  assert.deepEqual(payload, {
    title: 'Swaps and the Offshore Bid',
    byline: 'u/example',
    url: 'https://www.reddit.com/r/Superstonk/comments/abc123/swaps/',
    archive_url: 'https://web.archive.org/web/20260801000000/https://www.reddit.com/r/Superstonk/comments/abc123/swaps/',
    published: '2026-07-04',
    platform: 'reddit',
    length: null,
    compilation: false,
    thesis: 'Cross-border swap reporting gaps let short exposure sit outside US disclosure.',
    text_available: true,
    related: null,
    attribution: 'handle',
    acknowledged: true
  });
});

test('reads pages, compilation, anonymity and unreadable text', () => {
  const body = completeBody
    .replace('### Length in pages\n\n_No response_', '### Length in pages\n\n42')
    .replace('- [ ] This work compiles', '- [X] This work compiles')
    .replace('Credit my GitHub handle', 'Submit anonymously')
    .replace('### Is the full text readable at the source URL?\n\nYes', '### Is the full text readable at the source URL?\n\nNo');
  const { payload, errors } = parseSubmissionIssue(body);

  assert.deepEqual(errors, []);
  assert.equal(payload.length, 42);
  assert.equal(payload.compilation, true);
  assert.equal(payload.attribution, 'anonymous');
  assert.equal(payload.text_available, false);
});

test('reports every missing required field at once', () => {
  const { errors } = parseSubmissionIssue('### Title\n\nOnly a title\n');
  const missing = errors.map(({ field }) => field);

  assert.deepEqual(missing, [
    'byline',
    'url',
    'archive_url',
    'published',
    'platform',
    'thesis',
    'text_available',
    'attribution',
    'acknowledgement'
  ]);
});

test('treats _No response_ in a required field as missing', () => {
  const body = completeBody.replace('### Author / byline\n\nu/example', '### Author / byline\n\n_No response_');

  assert.deepEqual(
    parseSubmissionIssue(body).errors.map(({ field }) => field),
    ['byline']
  );
});

test('rejects an unticked copyright acknowledgement', () => {
  const body = completeBody.replace(
    '- [X] I have not pasted',
    '- [ ] I have not pasted'
  );

  assert.deepEqual(
    parseSubmissionIssue(body).errors.map(({ field }) => field),
    ['acknowledgement']
  );
});

test('rejects an unrecognised platform and a non-numeric length', () => {
  const body = completeBody
    .replace('### Platform\n\nReddit', '### Platform\n\nMySpace')
    .replace('### Length in pages\n\n_No response_', '### Length in pages\n\nquite long');
  const fields = parseSubmissionIssue(body).errors.map(({ field }) => field);

  assert.deepEqual(fields, ['platform', 'length']);
});

test('trims whitespace, tolerates CRLF, and preserves unicode', () => {
  const body = completeBody
    .replace('Swaps and the Offshore Bid', '  Swaps, Ürsprung & the Offshore Bid  ')
    .replace(/\n/g, '\r\n');
  const { payload, errors } = parseSubmissionIssue(body);

  assert.deepEqual(errors, []);
  assert.equal(payload.title, 'Swaps, Ürsprung & the Offshore Bid');
});

test('ignores unrecognised headings without failing', () => {
  const { errors } = parseSubmissionIssue(`${completeBody}\n### Random extra section\n\nnoise\n`);

  assert.deepEqual(errors, []);
});
```

- [x] **Step 3: Run the test to verify it fails**

Run: `node --test tests/submission.test.mjs`
Expected: FAIL with `Cannot find module .../scripts/submission.mjs`.

- [x] **Step 4: Write the parser**

Create `scripts/submission.mjs`:

```javascript
const NO_RESPONSE = '_No response_';

const FIELDS = new Map([
  ['Title', { field: 'title', kind: 'text', required: true }],
  ['Author / byline', { field: 'byline', kind: 'text', required: true }],
  ['Source URL', { field: 'url', kind: 'text', required: true }],
  ['Archive snapshot URL', { field: 'archive_url', kind: 'text', required: true }],
  ['Publication date', { field: 'published', kind: 'text', required: true }],
  ['Platform', { field: 'platform', kind: 'platform', required: true }],
  ['Length in pages', { field: 'length', kind: 'pages', required: false }],
  ['Compilation', { field: 'compilation', kind: 'checkbox', required: false }],
  ['One-line thesis', { field: 'thesis', kind: 'text', required: true }],
  ['Is the full text readable at the source URL?', { field: 'text_available', kind: 'yesno', required: true }],
  ['Related existing record', { field: 'related', kind: 'text', required: false }],
  ['Attribution', { field: 'attribution', kind: 'attribution', required: true }],
  ['Copyright acknowledgement', { field: 'acknowledgement', kind: 'checkbox', required: true }]
]);

const PLATFORMS = new Map([
  ['Reddit', 'reddit'],
  ['FlipHTML5', 'fliphtml5'],
  ['Substack', 'substack'],
  ['Hosted PDF', 'pdf'],
  ['Other', 'other']
]);

const ATTRIBUTIONS = new Map([
  ['Credit my GitHub handle', 'handle'],
  ['Submit anonymously', 'anonymous']
]);

function splitSections(body) {
  const sections = new Map();
  let heading = null;
  let lines = [];

  for (const rawLine of body.replace(/\r\n/g, '\n').split('\n')) {
    const match = /^###\s+(.*)$/.exec(rawLine);
    if (match) {
      if (heading !== null) {
        sections.set(heading, lines.join('\n').trim());
      }
      heading = match[1].trim();
      lines = [];
    } else if (heading !== null) {
      lines.push(rawLine);
    }
  }
  if (heading !== null) {
    sections.set(heading, lines.join('\n').trim());
  }
  return sections;
}

export function parseSubmissionIssue(body) {
  const sections = splitSections(body ?? '');
  const payload = {};
  const errors = [];

  for (const [label, { field, kind, required }] of FIELDS) {
    const raw = sections.get(label) ?? '';
    const value = raw === NO_RESPONSE ? '' : raw;

    if (kind === 'checkbox') {
      const ticked = /^-\s*\[[xX]\]/m.test(value);
      if (field === 'acknowledgement') {
        if (!ticked) {
          errors.push({ field, message: 'The copyright acknowledgement must be ticked.' });
        }
        payload.acknowledged = ticked;
      } else {
        payload[field] = ticked;
      }
      continue;
    }

    if (value === '') {
      if (required) {
        errors.push({ field, message: `${label} is required.` });
      } else {
        payload[field] = null;
      }
      continue;
    }

    if (kind === 'platform') {
      const mapped = PLATFORMS.get(value);
      if (mapped === undefined) {
        errors.push({ field, message: `"${value}" is not one of the listed platforms.` });
      } else {
        payload[field] = mapped;
      }
    } else if (kind === 'attribution') {
      const mapped = ATTRIBUTIONS.get(value);
      if (mapped === undefined) {
        errors.push({ field, message: `"${value}" is not one of the listed attribution options.` });
      } else {
        payload[field] = mapped;
      }
    } else if (kind === 'yesno') {
      if (!/^(yes|no)$/i.test(value)) {
        errors.push({ field, message: `"${value}" must be Yes or No.` });
      } else {
        payload[field] = /^yes$/i.test(value);
      }
    } else if (kind === 'pages') {
      if (!/^[0-9]+$/.test(value)) {
        errors.push({ field, message: `"${value}" is not a whole number of pages.` });
      } else {
        payload[field] = Number(value);
      }
    } else {
      payload[field] = value;
    }
  }

  return { payload, errors };
}
```

- [x] **Step 5: Run the tests to verify they pass**

Run: `node --test tests/submission.test.mjs`
Expected: PASS, 8 tests.

- [x] **Step 6: Assert the form ships with its required fields**

In `tests/repository.test.mjs`, extend the `forms` Map inside the existing `ships structurally valid concise issue forms with required fields` test:

```javascript
  const forms = new Map([
    ['dispute-rating.yml', ['book', 'dispute', 'evidence', 'proposed_change']],
    ['correction.yml', ['location', 'correction', 'evidence']],
    ['submit-dd.yml', ['title', 'byline', 'url', 'archive_url', 'published', 'platform', 'thesis', 'text_available', 'attribution']]
  ]);
```

Then add a test below it that pins the labels the parser depends on:

```javascript
test('submission form labels match the parser contract', async () => {
  const form = await readFile(
    new URL('../.github/ISSUE_TEMPLATE/submit-dd.yml', import.meta.url),
    'utf8'
  );

  for (const label of [
    'Title',
    'Author / byline',
    'Source URL',
    'Archive snapshot URL',
    'Publication date',
    'Platform',
    'Length in pages',
    'Compilation',
    'One-line thesis',
    'Is the full text readable at the source URL?',
    'Related existing record',
    'Attribution',
    'Copyright acknowledgement'
  ]) {
    assert.ok(
      form.includes(`label: ${label}`) || form.includes(`label: "${label}"`),
      `submit-dd.yml must keep the label "${label}" that parseSubmissionIssue matches on`
    );
  }
});
```

- [x] **Step 7: Run the full suite**

Run: `npm test`
Expected: PASS.

- [x] **Step 8: Commit**

```bash
git add .github/ISSUE_TEMPLATE/submit-dd.yml scripts/submission.mjs tests/submission.test.mjs tests/repository.test.mjs && git commit -m "feat: add the DD submission form and its parser"
```

---

## Task 4: The mechanical bar

**Files:**
- Modify: `scripts/submission.mjs`
- Test: `tests/submission.test.mjs`

**Interfaces:**
- Consumes: `payload` from Task 3.
- Produces: `normalizeUrl(url)` returning a comparable string; `resolveUrl(url)` returning a promise of `'ok' | 'missing' | 'unknown'`; `checkSubmission(payload, { resolveUrl, dataset, now })` — `now` is an epoch-millisecond number defaulting to `Date.now()`, injected so the future-date rule is testable without depending on the machine clock — returning a promise of `{ status, checks }` where `status` is `'pass' | 'blocked' | 'incomplete'` and each check is `{ id, status, message }` with a check status of `'pass' | 'fail' | 'warn' | 'unknown'`. Check ids, in order: `url_resolves`, `archive_present`, `no_duplicate`, `byline_present`, `published_valid`, `thesis_present`, `copyright_ack`, `title_byline_near_match`.

- [x] **Step 1: Write the failing tests**

Append to `tests/submission.test.mjs`:

```javascript
import { checkSubmission, normalizeUrl } from '../scripts/submission.mjs';

const validPayload = {
  title: 'Swaps and the Offshore Bid',
  byline: 'u/example',
  url: 'https://www.reddit.com/r/Superstonk/comments/abc123/swaps/',
  archive_url: 'https://web.archive.org/web/20260801000000/https://example.test/dd',
  published: '2026-07-04',
  platform: 'reddit',
  length: null,
  compilation: false,
  thesis: 'Cross-border swap reporting gaps let short exposure sit outside US disclosure.',
  text_available: true,
  related: null,
  attribution: 'handle',
  acknowledged: true
};
const allOk = async () => 'ok';
const byId = (checks) => new Map(checks.map((check) => [check.id, check]));

test('normalizeUrl folds case, trailing slash and tracking parameters', () => {
  assert.equal(
    normalizeUrl('HTTPS://Example.TEST/DD/?utm_source=x&si=9&fbclid=1'),
    normalizeUrl('https://example.test/DD')
  );
  assert.equal(
    normalizeUrl('http://example.test/dd'),
    normalizeUrl('https://example.test/dd')
  );
  assert.notEqual(
    normalizeUrl('https://reddit.com/r/x/comments/1/a/?context=3'),
    normalizeUrl('https://reddit.com/r/x/comments/1/a/')
  );
});

test('a complete submission against an empty dataset passes', async () => {
  const { status, checks } = await checkSubmission(validPayload, {
    resolveUrl: allOk,
    dataset: []
  });

  assert.equal(status, 'pass');
  assert.deepEqual(checks.filter((check) => check.status !== 'pass'), []);
});

test('a dead source URL blocks the submission', async () => {
  const { status, checks } = await checkSubmission(validPayload, {
    resolveUrl: async (url) => url === validPayload.url ? 'missing' : 'ok',
    dataset: []
  });

  assert.equal(status, 'blocked');
  assert.equal(byId(checks).get('url_resolves').status, 'fail');
});

test('an unreachable host is incomplete, not blocked', async () => {
  const { status, checks } = await checkSubmission(validPayload, {
    resolveUrl: async () => 'unknown',
    dataset: []
  });

  assert.equal(status, 'incomplete');
  assert.equal(byId(checks).get('url_resolves').status, 'unknown');
});

test('a non-archival snapshot host blocks the submission', async () => {
  const { status, checks } = await checkSubmission(
    { ...validPayload, archive_url: 'https://example.test/my-own-copy' },
    { resolveUrl: allOk, dataset: [] }
  );

  assert.equal(status, 'blocked');
  assert.equal(byId(checks).get('archive_present').status, 'fail');
});

test('accepts every recognised archival host', async () => {
  for (const host of ['web.archive.org', 'archive.today', 'archive.ph', 'archive.is']) {
    const { checks } = await checkSubmission(
      { ...validPayload, archive_url: `https://${host}/snapshot/1` },
      { resolveUrl: allOk, dataset: [] }
    );

    assert.equal(byId(checks).get('archive_present').status, 'pass', host);
  }
});

test('a URL already in the dataset blocks the submission despite cosmetic differences', async () => {
  const dataset = [{ pos: 1, title: 'Other', byline: 'someone', url: 'http://WWW.reddit.com/r/Superstonk/comments/abc123/swaps?utm_source=share' }];
  const { status, checks } = await checkSubmission(validPayload, { resolveUrl: allOk, dataset });

  assert.equal(status, 'blocked');
  assert.match(byId(checks).get('no_duplicate').message, /already in the library at #1/);
});

test('a matching title and byline warns without blocking', async () => {
  const dataset = [{
    pos: 7,
    title: 'swaps and the OFFSHORE bid',
    byline: 'U/Example',
    url: 'https://example.test/somewhere-else'
  }];
  const { status, checks } = await checkSubmission(validPayload, { resolveUrl: allOk, dataset });

  assert.equal(status, 'pass');
  assert.equal(byId(checks).get('title_byline_near_match').status, 'warn');
});

test('an empty byline, bad date, future date, short thesis and missing acknowledgement each block', async () => {
  const cases = [
    ['byline_present', { byline: '   ' }],
    ['published_valid', { published: '04/07/2026' }],
    ['published_valid', { published: '2999-01-01' }],
    ['thesis_present', { thesis: 'Too short.' }],
    ['copyright_ack', { acknowledged: false }]
  ];

  for (const [id, override] of cases) {
    const { status, checks } = await checkSubmission(
      { ...validPayload, ...override },
      { resolveUrl: allOk, dataset: [] }
    );

    assert.equal(status, 'blocked', id);
    assert.equal(byId(checks).get(id).status, 'fail', id);
  }
});

test('the future-date rule reads the injected clock, not the machine clock', async () => {
  const options = { resolveUrl: allOk, dataset: [], now: Date.parse('2026-07-01T00:00:00Z') };
  const before = await checkSubmission(validPayload, options);
  const after = await checkSubmission({ ...validPayload, published: '2026-06-01' }, options);

  assert.equal(byId(before.checks).get('published_valid').status, 'fail');
  assert.equal(byId(after.checks).get('published_valid').status, 'pass');
});

test('a failure outranks an unknown in the overall status', async () => {
  const { status } = await checkSubmission(
    { ...validPayload, acknowledged: false },
    { resolveUrl: async () => 'unknown', dataset: [] }
  );

  assert.equal(status, 'blocked');
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/submission.test.mjs`
Expected: FAIL with `checkSubmission is not a function`.

- [x] **Step 3: Write the implementation**

Append to `scripts/submission.mjs`:

```javascript
const ARCHIVAL_HOSTS = new Set([
  'web.archive.org',
  'archive.today',
  'archive.ph',
  'archive.is'
]);
const TRACKING_PARAMETERS = new Set(['ref', 'ref_source', 'share_id', 'si', 'fbclid']);
const MINIMUM_THESIS_LENGTH = 40;
const RESOLVE_TIMEOUT_MS = 10_000;

export function normalizeUrl(value) {
  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    return value.trim().toLowerCase();
  }

  parsed.protocol = 'https:';
  parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
  parsed.hash = '';
  parsed.pathname = parsed.pathname.replace(/\/+$/, '');

  for (const key of [...parsed.searchParams.keys()]) {
    if (key.startsWith('utm_') || TRACKING_PARAMETERS.has(key)) {
      parsed.searchParams.delete(key);
    }
  }
  parsed.searchParams.sort();

  return parsed.toString().toLowerCase();
}

export async function resolveUrl(url) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const response = await fetch(url, {
        method,
        redirect: 'follow',
        signal: AbortSignal.timeout(RESOLVE_TIMEOUT_MS)
      });
      if (response.ok) {
        return 'ok';
      }
      if (response.status >= 400 && response.status < 500 && method === 'GET') {
        return 'missing';
      }
      if (response.status >= 500) {
        return 'unknown';
      }
    } catch {
      if (method === 'GET') {
        return 'unknown';
      }
    }
  }
  return 'unknown';
}

function fold(value) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function checkSubmission(payload, { resolveUrl: resolve, dataset, now = Date.now() }) {
  const checks = [];
  const add = (id, status, message) => checks.push({ id, status, message });

  const sourceState = await resolve(payload.url);
  add(
    'url_resolves',
    sourceState === 'ok' ? 'pass' : sourceState === 'missing' ? 'fail' : 'unknown',
    sourceState === 'ok'
      ? 'Source URL resolves.'
      : sourceState === 'missing'
        ? 'Source URL did not resolve.'
        : 'Source URL could not be reached at check time; this is not a rejection.'
  );

  let archiveHost = null;
  try {
    archiveHost = new URL(payload.archive_url).hostname.toLowerCase();
  } catch {
    archiveHost = null;
  }
  if (archiveHost === null || !ARCHIVAL_HOSTS.has(archiveHost)) {
    add(
      'archive_present',
      'fail',
      `Archive snapshot must be hosted at ${[...ARCHIVAL_HOSTS].join(', ')}.`
    );
  } else {
    const archiveState = await resolve(payload.archive_url);
    add(
      'archive_present',
      archiveState === 'ok' ? 'pass' : archiveState === 'missing' ? 'fail' : 'unknown',
      archiveState === 'ok'
        ? 'Archive snapshot resolves.'
        : archiveState === 'missing'
          ? 'Archive snapshot did not resolve.'
          : 'Archive snapshot could not be reached at check time; this is not a rejection.'
    );
  }

  const normalized = normalizeUrl(payload.url);
  const duplicate = dataset.find((entry) => normalizeUrl(entry.url) === normalized);
  add(
    'no_duplicate',
    duplicate ? 'fail' : 'pass',
    duplicate
      ? `That URL is already in the library at #${duplicate.pos}.`
      : 'Not already in the library.'
  );

  const hasByline = payload.byline.trim() !== '';
  add(
    'byline_present',
    hasByline ? 'pass' : 'fail',
    hasByline ? 'Author identified.' : 'An author or handle is required. Pseudonyms are fine.'
  );

  const wellFormedDate = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(payload.published);
  const parsedDate = wellFormedDate ? new Date(`${payload.published}T00:00:00Z`) : null;
  const validDate = parsedDate !== null &&
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.getTime() <= now;
  add(
    'published_valid',
    validDate ? 'pass' : 'fail',
    validDate
      ? 'Publication date is valid.'
      : 'Publication date must be a real past date in YYYY-MM-DD format.'
  );

  const longEnough = payload.thesis.trim().length >= MINIMUM_THESIS_LENGTH;
  add(
    'thesis_present',
    longEnough ? 'pass' : 'fail',
    longEnough
      ? 'Thesis stated.'
      : `State the thesis in at least ${MINIMUM_THESIS_LENGTH} characters.`
  );

  add(
    'copyright_ack',
    payload.acknowledged ? 'pass' : 'fail',
    payload.acknowledged
      ? 'Copyright acknowledgement given.'
      : 'The copyright acknowledgement must be ticked.'
  );

  const nearMatch = dataset.find((entry) =>
    fold(entry.title) === fold(payload.title) && fold(entry.byline) === fold(payload.byline));
  add(
    'title_byline_near_match',
    nearMatch ? 'warn' : 'pass',
    nearMatch
      ? `Same title and byline as #${nearMatch.pos}. Not a blocker, but confirm this is a distinct work.`
      : 'No title and byline collision.'
  );

  const status = checks.some((check) => check.status === 'fail')
    ? 'blocked'
    : checks.some((check) => check.status === 'unknown')
      ? 'incomplete'
      : 'pass';

  return { status, checks };
}
```

- [x] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/submission.test.mjs`
Expected: PASS.

- [x] **Step 5: Test the default resolver against a local server**

Append to `tests/submission.test.mjs`, adding `withHttpServer` to the existing imports from `./cli-test-helpers.mjs` (add the import line if the file does not have one yet):

```javascript
import { withHttpServer } from './cli-test-helpers.mjs';
import { resolveUrl } from '../scripts/submission.mjs';

test('the default resolver maps 2xx, 4xx and 5xx to ok, missing and unknown', async () => {
  await withHttpServer((request, response) => {
    const status = request.url === '/ok' ? 200 : request.url === '/gone' ? 404 : 503;
    response.writeHead(status);
    response.end();
  }, async (origin) => {
    assert.equal(await resolveUrl(`${origin}/ok`), 'ok');
    assert.equal(await resolveUrl(`${origin}/gone`), 'missing');
    assert.equal(await resolveUrl(`${origin}/broken`), 'unknown');
  });
});

test('the default resolver reports an unreachable host as unknown', async () => {
  assert.equal(await resolveUrl('http://127.0.0.1:1/nothing'), 'unknown');
});
```

- [x] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add scripts/submission.mjs tests/submission.test.mjs && git commit -m "feat: verify submissions against the published bar"
```

---

## Task 5: Pending record construction

**Files:**
- Modify: `scripts/submission.mjs`
- Test: `tests/submission.test.mjs`

**Interfaces:**
- Consumes: `payload` from Task 3, the record shape from Task 1, and the `validPayload` fixture that Task 4 already defined in `tests/submission.test.mjs`. Do not redefine it; the tests below reference it directly.
- Produces: `buildPendingRecord(payload, { nextPos, submittedOn, issue, author })` returning a community pending record. Task 6's apply CLI is its only caller.

- [x] **Step 1: Write the failing tests**

Append to `tests/submission.test.mjs`:

```javascript
import { readFile } from 'node:fs/promises';
import { buildPendingRecord } from '../scripts/submission.mjs';
import { validateAgainstSchema } from '../scripts/schema-validator.mjs';

const recordSchema = JSON.parse(
  await readFile(new URL('../data/schema.json', import.meta.url), 'utf8')
);
const buildOptions = {
  nextPos: 251,
  submittedOn: '2026-08-20',
  issue: 'https://github.com/ErranttVenture/superstonk-dd-library/issues/12',
  author: 'octocat'
};

test('builds a schema-valid pending record from a payload', () => {
  const built = buildPendingRecord(validPayload, buildOptions);

  assert.deepEqual(validateAgainstSchema(recordSchema, built), []);
  assert.deepEqual(built, {
    pos: 251,
    title: 'Swaps and the Offshore Bid',
    byline: 'u/example',
    pages: null,
    uploaded: '2026-07-04',
    url: 'https://www.reddit.com/r/Superstonk/comments/abc123/swaps/',
    type: 'original',
    text_available: true,
    source_corpus: 'community',
    review_status: 'pending',
    submission: {
      submitted_on: '2026-08-20',
      submitted_by: 'octocat',
      issue: 'https://github.com/ErranttVenture/superstonk-dd-library/issues/12',
      archive_url: 'https://web.archive.org/web/20260801000000/https://example.test/dd',
      platform: 'reddit'
    }
  });
});

test('carries pages, compilation type and anonymity into the record', () => {
  const built = buildPendingRecord(
    { ...validPayload, length: 42, compilation: true, attribution: 'anonymous', text_available: false },
    buildOptions
  );

  assert.deepEqual(validateAgainstSchema(recordSchema, built), []);
  assert.equal(built.pages, 42);
  assert.equal(built.type, 'compilation');
  assert.equal(built.text_available, false);
  assert.equal(built.submission.submitted_by, 'anonymous');
});

test('does not store the thesis or the related-record note', () => {
  const built = buildPendingRecord({ ...validPayload, related: '#40' }, buildOptions);

  assert.equal(Object.hasOwn(built, 'summary'), false);
  assert.equal(JSON.stringify(built).includes('Cross-border swap'), false);
});

test('trims surrounding whitespace out of stored strings', () => {
  const built = buildPendingRecord(
    { ...validPayload, title: '  Padded Title  ', byline: '  u/padded  ' },
    buildOptions
  );

  assert.equal(built.title, 'Padded Title');
  assert.equal(built.byline, 'u/padded');
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/submission.test.mjs`
Expected: FAIL with `buildPendingRecord is not a function`.

- [x] **Step 3: Write the implementation**

Append to `scripts/submission.mjs`:

```javascript
export function buildPendingRecord(payload, { nextPos, submittedOn, issue, author }) {
  return {
    pos: nextPos,
    title: payload.title.trim(),
    byline: payload.byline.trim(),
    pages: payload.length,
    uploaded: payload.published,
    url: payload.url.trim(),
    type: payload.compilation ? 'compilation' : 'original',
    text_available: payload.text_available,
    source_corpus: 'community',
    review_status: 'pending',
    submission: {
      submitted_on: submittedOn,
      submitted_by: payload.attribution === 'anonymous' ? 'anonymous' : author,
      issue,
      archive_url: payload.archive_url.trim(),
      platform: payload.platform
    }
  };
}
```

- [x] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/submission.test.mjs`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add scripts/submission.mjs tests/submission.test.mjs && git commit -m "feat: build pending records from accepted submissions"
```

---

## Task 6: The two command-line entry points

**Files:**
- Create: `scripts/check-submission.mjs`, `scripts/apply-submission.mjs`
- Test: `tests/submission-cli.test.mjs`

**Interfaces:**
- Consumes: everything from Tasks 1–5.
- Produces: `node scripts/check-submission.mjs <body-file>` writing a markdown comment to stdout whose final line is `<!-- submission-status: pass|blocked|incomplete -->`, exiting 0 unless it crashes. `node scripts/apply-submission.mjs <body-file> <issue-url> <author>` appending to `data/master.json` and writing the new `pos` to stdout, exiting 1 with a reason on stderr when the submission is blocked. Task 7's workflows are the only callers.

**Both CLIs honour a `SUBMISSION_MASTER_PATH` environment override for the dataset location.** This exists so the tests never write to the tracked `data/master.json`: a test that mutates a 1 MB committed file and restores it in a hook leaves the repository dirty whenever it crashes mid-run. The workflows do not set the variable and operate on the real file.

- [x] **Step 1: Write the failing tests**

Create `tests/submission-cli.test.mjs`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runNodeCli, withHttpServer } from './cli-test-helpers.mjs';

const masterUrl = new URL('../data/master.json', import.meta.url);

async function bodyFile(contents) {
  const directory = await mkdtemp(join(tmpdir(), 'submission-'));
  const path = join(directory, 'body.md');
  await writeFile(path, contents, 'utf8');
  return path;
}

function completeBody(url, archiveUrl) {
  return [
    '### Title', '', 'A Submitted DD', '',
    '### Author / byline', '', 'u/example', '',
    '### Source URL', '', url, '',
    '### Archive snapshot URL', '', archiveUrl, '',
    '### Publication date', '', '2026-07-04', '',
    '### Platform', '', 'Reddit', '',
    '### Length in pages', '', '_No response_', '',
    '### Compilation', '', '- [ ] This work compiles or republishes other people\'s writing.', '',
    '### One-line thesis', '', 'Cross-border swap reporting gaps let short exposure sit outside US disclosure.', '',
    '### Is the full text readable at the source URL?', '', 'Yes', '',
    '### Related existing record', '', '_No response_', '',
    '### Attribution', '', 'Credit my GitHub handle', '',
    '### Copyright acknowledgement', '', '- [X] I have not pasted the full text of a copyrighted work into this issue.', ''
  ].join('\n');
}

test('the check CLI reports parse failures as a blocked checklist', async () => {
  const path = await bodyFile('### Title\n\nOnly a title\n');
  const result = await runNodeCli('scripts/check-submission.mjs', [path]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Author \/ byline is required/);
  assert.ok(result.stdout.trimEnd().endsWith('<!-- submission-status: blocked -->'));
});

test('the check CLI passes a complete submission with reachable links', async () => {
  await withHttpServer((request, response) => {
    response.writeHead(200);
    response.end();
  }, async (origin) => {
    const path = await bodyFile(completeBody(`${origin}/dd`, 'https://web.archive.org/web/1/x'));
    const result = await runNodeCli('scripts/check-submission.mjs', [path]);

    assert.ok(
      result.stdout.trimEnd().endsWith('<!-- submission-status: incomplete -->') ||
      result.stdout.trimEnd().endsWith('<!-- submission-status: pass -->'),
      result.stdout
    );
    assert.match(result.stdout, /Not already in the library/);
  });
});

async function scratchMaster() {
  const directory = await mkdtemp(join(tmpdir(), 'submission-master-'));
  const path = join(directory, 'master.json');
  await copyFile(masterUrl, path);
  return path;
}

test('the apply CLI appends a pending record and preserves formatting', async () => {
  const scratch = await scratchMaster();
  const original = await readFile(scratch, 'utf8');
  const path = await bodyFile(completeBody('https://example.test/dd', 'https://web.archive.org/web/1/x'));
  const result = await runNodeCli('scripts/apply-submission.mjs', [
    path,
    'https://github.com/ErranttVenture/superstonk-dd-library/issues/12',
    'octocat'
  ], { env: { SUBMISSION_SUBMITTED_ON: '2026-08-20', SUBMISSION_MASTER_PATH: scratch } });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /^251$/m);

  const updated = await readFile(scratch, 'utf8');
  const records = JSON.parse(updated);
  assert.equal(records.length, 251);
  assert.equal(records[250].pos, 251);
  assert.equal(records[250].source_corpus, 'community');
  assert.equal(records[250].submission.submitted_on, '2026-08-20');
  assert.equal(updated, `${JSON.stringify(records, null, 1)}\n`);
  assert.equal(updated.includes('\r'), false);
  assert.ok(
    updated.startsWith(original.slice(0, original.lastIndexOf('\n]\n'))),
    'appending must not reformat any existing record'
  );
});

test('the apply CLI refuses a blocked submission and leaves the dataset alone', async () => {
  const scratch = await scratchMaster();
  const before = await readFile(scratch, 'utf8');
  const path = await bodyFile('### Title\n\nOnly a title\n');
  const result = await runNodeCli('scripts/apply-submission.mjs', [
    path,
    'https://github.com/ErranttVenture/superstonk-dd-library/issues/13',
    'octocat'
  ], { env: { SUBMISSION_MASTER_PATH: scratch } });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /blocked/);
  assert.equal(await readFile(scratch, 'utf8'), before);
});

test('the tracked dataset is never written by these tests', async () => {
  const records = JSON.parse(await readFile(masterUrl, 'utf8'));

  assert.equal(records.length, 250);
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/submission-cli.test.mjs`
Expected: FAIL. Both CLIs are missing, so the runs exit non-zero with `Cannot find module`.

- [x] **Step 3: Write the check CLI**

Create `scripts/check-submission.mjs`:

```javascript
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { parseSubmissionIssue, checkSubmission, resolveUrl } from './submission.mjs';

const masterUrl = process.env.SUBMISSION_MASTER_PATH
  ? pathToFileURL(process.env.SUBMISSION_MASTER_PATH)
  : new URL('../data/master.json', import.meta.url);

const [bodyPath] = process.argv.slice(2);
if (!bodyPath) {
  console.error('usage: node scripts/check-submission.mjs <issue-body-file>');
  process.exit(2);
}

const body = await readFile(bodyPath, 'utf8');
const { payload, errors } = parseSubmissionIssue(body);
const lines = ['### Submission checks', ''];
let status = 'blocked';

if (errors.length > 0) {
  lines.push('This submission could not be read. Edit the issue to fix the following, and these checks will run again.', '');
  for (const error of errors) {
    lines.push(`- ❌ **${error.field}** — ${error.message}`);
  }
} else {
  const dataset = JSON.parse(await readFile(masterUrl, 'utf8'));
  const result = await checkSubmission(payload, { resolveUrl, dataset });
  status = result.status;

  const icons = { pass: '✅', fail: '❌', warn: '⚠️', unknown: '❔' };
  for (const check of result.checks) {
    lines.push(`- ${icons[check.status]} **${check.id}** — ${check.message}`);
  }
  lines.push('');
  lines.push({
    pass: 'All mechanical checks pass. A maintainer still decides whether this is market-structure or DD content at all.',
    blocked: 'One or more mechanical checks failed. Edit the issue to fix them and the checks will run again.',
    incomplete: 'A link could not be reached at check time. That is not a rejection; a maintainer can accept anyway.'
  }[status]);
  lines.push('');
  lines.push('Acceptance adds an **unrated** record. It is not a rating.');
}

lines.push('');
lines.push(`<!-- submission-status: ${status} -->`);
console.log(lines.join('\n'));
```

- [x] **Step 4: Write the apply CLI**

Create `scripts/apply-submission.mjs`:

```javascript
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import {
  parseSubmissionIssue,
  checkSubmission,
  buildPendingRecord,
  resolveUrl
} from './submission.mjs';

const [bodyPath, issue, author] = process.argv.slice(2);
if (!bodyPath || !issue || !author) {
  console.error('usage: node scripts/apply-submission.mjs <issue-body-file> <issue-url> <author>');
  process.exit(2);
}

const masterUrl = process.env.SUBMISSION_MASTER_PATH
  ? pathToFileURL(process.env.SUBMISSION_MASTER_PATH)
  : new URL('../data/master.json', import.meta.url);
const body = await readFile(bodyPath, 'utf8');
const { payload, errors } = parseSubmissionIssue(body);
if (errors.length > 0) {
  for (const error of errors) {
    console.error(`${error.field}: ${error.message}`);
  }
  console.error('Submission is blocked and was not applied.');
  process.exit(1);
}

const records = JSON.parse(await readFile(masterUrl, 'utf8'));
const { status, checks } = await checkSubmission(payload, { resolveUrl, dataset: records });
if (status === 'blocked') {
  for (const check of checks.filter((candidate) => candidate.status === 'fail')) {
    console.error(`${check.id}: ${check.message}`);
  }
  console.error('Submission is blocked and was not applied.');
  process.exit(1);
}

const record = buildPendingRecord(payload, {
  nextPos: Math.max(...records.map(({ pos }) => pos)) + 1,
  submittedOn: process.env.SUBMISSION_SUBMITTED_ON ?? new Date().toISOString().slice(0, 10),
  issue,
  author
});

records.push(record);
await writeFile(masterUrl, `${JSON.stringify(records, null, 1)}\n`, 'utf8');
console.log(String(record.pos));
```

- [x] **Step 5: Run the tests to verify they pass**

Run: `node --test tests/submission-cli.test.mjs`
Expected: PASS, 4 tests. If the "check CLI passes a complete submission" test reports `blocked` rather than `pass` or `incomplete`, read the printed checklist — it names the failing check. That test allows either `pass` or `incomplete` because the archive URL it uses is a real external host that may be unreachable from the test machine.

- [x] **Step 6: Confirm the tracked dataset was never touched**

Run: `git diff --stat data/master.json`
Expected: no output. The tests operate on temp-directory copies via `SUBMISSION_MASTER_PATH`. Any diff here means a CLI ignored the override — fix that, do not just `git checkout` the file.

- [x] **Step 7: Run the full suite**

Run: `npm test && npm run validate`
Expected: both PASS.

- [x] **Step 8: Commit**

```bash
git add scripts/check-submission.mjs scripts/apply-submission.mjs tests/submission-cli.test.mjs && git commit -m "feat: add submission check and apply commands"
```

---

## Task 7: GitHub Actions workflows

**Files:**
- Create: `.github/workflows/submission-check.yml`, `.github/workflows/submission-open-pr.yml`
- Test: `tests/repository.test.mjs`

**Interfaces:**
- Consumes: both CLIs from Task 6.
- Produces: no code interface. The `accepted`, `submission:passing`, `submission:failing`, and `submission:unverified` labels must exist in the repository.

**Security note:** `submission-check.yml` runs on issue text written by anyone. It must never interpolate issue body text into a shell command. Both workflows pass the body through an environment variable and a file, never through `${{ }}` inside `run:`.

- [x] **Step 1: Write the check workflow**

Create `.github/workflows/submission-check.yml`:

```yaml
name: Submission checks

on:
  issues:
    types: [opened, edited]

permissions:
  issues: write

jobs:
  check:
    if: contains(github.event.issue.labels.*.name, 'submission')
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: 20
      - name: Write the issue body to a file
        env:
          ISSUE_BODY: ${{ github.event.issue.body }}
        run: printf '%s' "$ISSUE_BODY" > "$RUNNER_TEMP/body.md"
      - name: Run the mechanical checks
        run: node scripts/check-submission.mjs "$RUNNER_TEMP/body.md" > "$RUNNER_TEMP/comment.md"
      - name: Comment the checklist
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ISSUE_NUMBER: ${{ github.event.issue.number }}
        run: gh issue comment "$ISSUE_NUMBER" --body-file "$RUNNER_TEMP/comment.md"
      - name: Apply the status label
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ISSUE_NUMBER: ${{ github.event.issue.number }}
        run: |
          status=$(sed -n 's/.*<!-- submission-status: \(.*\) -->.*/\1/p' "$RUNNER_TEMP/comment.md")
          case "$status" in
            pass) label='submission:passing' ;;
            incomplete) label='submission:unverified' ;;
            *) label='submission:failing' ;;
          esac
          gh issue edit "$ISSUE_NUMBER" \
            --remove-label 'submission:passing' \
            --remove-label 'submission:failing' \
            --remove-label 'submission:unverified' || true
          gh issue edit "$ISSUE_NUMBER" --add-label "$label"
```

- [x] **Step 2: Write the pull request workflow**

Create `.github/workflows/submission-open-pr.yml`:

```yaml
name: Open submission pull request

on:
  issues:
    types: [labeled]

permissions:
  contents: write
  pull-requests: write
  issues: write

jobs:
  open-pull-request:
    if: >
      github.event.label.name == 'accepted' &&
      contains(github.event.issue.labels.*.name, 'submission')
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: 20
      - name: Require a maintainer to have applied the label
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ACTOR: ${{ github.actor }}
        run: |
          permission=$(gh api "repos/${GITHUB_REPOSITORY}/collaborators/${ACTOR}/permission" --jq '.permission')
          case "$permission" in
            admin|write) echo "Accepted by $ACTOR ($permission)." ;;
            *) echo "::error::$ACTOR lacks write access; refusing to open a pull request." ; exit 1 ;;
          esac
      - name: Write the issue body to a file
        env:
          ISSUE_BODY: ${{ github.event.issue.body }}
        run: printf '%s' "$ISSUE_BODY" > "$RUNNER_TEMP/body.md"
      - name: Append the pending record
        env:
          ISSUE_URL: ${{ github.event.issue.html_url }}
          ISSUE_AUTHOR: ${{ github.event.issue.user.login }}
        run: |
          pos=$(node scripts/apply-submission.mjs "$RUNNER_TEMP/body.md" "$ISSUE_URL" "$ISSUE_AUTHOR")
          echo "POS=$pos" >> "$GITHUB_ENV"
      - name: Validate the result
        run: npm test && npm run validate
      - name: Open the pull request
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ISSUE_NUMBER: ${{ github.event.issue.number }}
        run: |
          branch="submission/${ISSUE_NUMBER}"
          git config user.name 'github-actions[bot]'
          git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
          git checkout -b "$branch"
          git add data/master.json
          git commit -m "data: add pending community record #${POS} (closes #${ISSUE_NUMBER})"
          git push --set-upstream origin "$branch"
          gh pr create \
            --title "Add pending community record #${POS}" \
            --body "Adds an unrated community record from #${ISSUE_NUMBER}. Accepting this does not rate the work." \
            --base main
```

**Why the permission is queried rather than read from the event:** the `labeled` event exposes `author_association` for the *issue author*, not for whoever applied the label. Those are different people in every case that matters — the whole point of the guard is that a submitter cannot self-accept. `github.actor` is the labeler, and their permission has to be fetched from the collaborators API.

- [x] **Step 3: Assert the workflows ship with their safety properties**

Append to `tests/repository.test.mjs`:

```javascript
test('submission workflows pin actions, scope permissions and avoid body interpolation', async () => {
  const workflows = new Map([
    ['submission-check.yml', 'issues: write'],
    ['submission-open-pr.yml', 'contents: write']
  ]);

  for (const [filename, requiredPermission] of workflows) {
    const workflow = await readFile(
      new URL(`../.github/workflows/${filename}`, import.meta.url),
      'utf8'
    );

    assert.ok(workflow.includes(requiredPermission), `${filename} must declare ${requiredPermission}`);
    assert.match(workflow, /uses: actions\/checkout@[0-9a-f]{40}/, `${filename} must pin checkout by SHA`);
    assert.match(workflow, /uses: actions\/setup-node@[0-9a-f]{40}/, `${filename} must pin setup-node by SHA`);
    assert.ok(
      workflow.includes('ISSUE_BODY: ${{ github.event.issue.body }}'),
      `${filename} must pass the issue body through an environment variable`
    );
    assert.doesNotMatch(
      workflow,
      /run:[^\n]*\$\{\{\s*github\.event\.issue\.body/,
      `${filename} must never interpolate the issue body into a run step`
    );
  }

  const openPr = await readFile(
    new URL('../.github/workflows/submission-open-pr.yml', import.meta.url),
    'utf8'
  );
  assert.match(openPr, /collaborators\/\$\{ACTOR\}\/permission/);
  assert.ok(openPr.includes("github.event.label.name == 'accepted'"));
});
```

- [x] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Create the five labels**

> **The only step of this plan not completed.** It mutates the public repository and needs an authenticated maintainer session, so no agent ran it. Until a maintainer does, both workflows are inert: `submission-check.yml` comments its checklist and then fails at `gh issue edit --add-label`, and the `accepted` gate never fires. The same commands are published in CONTRIBUTING.md under "Maintainer setup".

Run, once, against the real repository:

```bash
gh label create submission --color 0E8A16 --description "A new-DD submission" --repo ErranttVenture/superstonk-dd-library
```

```bash
gh label create accepted --color 5319E7 --description "Maintainer accepted a submission into the pending queue" --repo ErranttVenture/superstonk-dd-library
```

```bash
gh label create submission:passing --color C2E0C6 --description "All mechanical checks pass" --repo ErranttVenture/superstonk-dd-library
```

```bash
gh label create submission:failing --color E99695 --description "A mechanical check failed" --repo ErranttVenture/superstonk-dd-library
```

```bash
gh label create submission:unverified --color FEF2C0 --description "A link could not be reached at check time" --repo ErranttVenture/superstonk-dd-library
```

- [x] **Step 6: Commit**

```bash
git add .github/workflows/submission-check.yml .github/workflows/submission-open-pr.yml tests/repository.test.mjs && git commit -m "ci: check submissions and open maintainer-gated pull requests"
```

---

## Task 8: Documentation

**Files:**
- Modify: `CONTRIBUTING.md`, `README.md`, `harness/README.md`
- Test: `tests/repository.test.mjs`

**Interfaces:**
- Consumes: the bar from Task 4, the lifecycle from Tasks 5–7.
- Produces: nothing consumed by code.

- [x] **Step 1: Write the failing documentation tests**

In `tests/repository.test.mjs`, extend the existing `documents the governed dispute and right-of-reply workflow` test's list with these entries:

```javascript
    'Submit a new DD',
    'pending',
    'unrated',
    'archive',
    'market-structure',
    'submit-dd.yml'
```

Then append a new test:

```javascript
test('documents the submission bar, lifecycle and unrated meaning', async () => {
  const contributing = await readFile(new URL('../CONTRIBUTING.md', import.meta.url), 'utf8');
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  const harness = await readFile(new URL('../harness/README.md', import.meta.url), 'utf8');

  for (const checkId of [
    'url_resolves',
    'archive_present',
    'no_duplicate',
    'byline_present',
    'published_valid',
    'thesis_present',
    'copyright_ack'
  ]) {
    assert.ok(contributing.includes(checkId), `CONTRIBUTING.md must publish the ${checkId} check`);
  }

  for (const requiredText of [
    'Quality, plausibility',
    'is not a gate',
    'pos 251',
    'rebase'
  ]) {
    assert.ok(contributing.includes(requiredText), `CONTRIBUTING.md must contain ${requiredText}`);
  }

  assert.ok(
    readme.includes('Pending means unrated, not rated zero'),
    'README.md must state that pending is not a failing rating'
  );
  assert.ok(readme.includes('Submit a new DD'), 'README.md must link the submission path');
  assert.ok(
    readme.includes('data/original-master.json'),
    'README.md must keep pointing at the immutable baseline'
  );
  assert.ok(
    harness.includes('review_provenance'),
    'harness/README.md must require review provenance on community reviews'
  );
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `node --test tests/repository.test.mjs`
Expected: FAIL with `CONTRIBUTING.md must publish the url_resolves check`.

- [x] **Step 3: Add the CONTRIBUTING section**

Insert into `CONTRIBUTING.md`, after the `## Dispute a rating` section and before `## Review and accepted changes`:

```markdown
## Submit a new DD

The original review covered one FlipHTML5 bookcase as it stood on July 21, 2026. Use the [submission form](https://github.com/ErranttVenture/superstonk-dd-library/issues/new?template=submit-dd.yml) to nominate due diligence it never saw: a Reddit post, a Substack essay, a FlipHTML5 publication, a hosted PDF, or an independent researcher's page. Any work with a durable public URL is eligible.

Do not paste the full text of the work anywhere in the issue or the repository. Link to it. This is the same rule that keeps the original FlipHTML5 book text out of this repository.

### What is checked

An automated comment runs these checks on every submission and re-runs them whenever you edit the issue:

- `url_resolves` — the source URL is `http(s)` and resolves.
- `archive_present` — an `archive_url` snapshot at `web.archive.org`, `archive.today`, `archive.ph`, or `archive.is` resolves, so the record survives deletion.
- `no_duplicate` — the normalized URL is not already in `data/master.json`. Normalization folds scheme, `www.`, trailing slashes, and the tracking parameters `utm_*`, `ref`, `ref_source`, `share_id`, `si`, and `fbclid`.
- `byline_present` — an author is named. Pseudonyms and handles are fine.
- `published_valid` — the publication date is a real past date in `YYYY-MM-DD` form.
- `thesis_present` — a one-line thesis of at least forty characters.
- `copyright_ack` — the acknowledgement is ticked.

A matching title and byline against an existing record produces a warning, not a rejection, because compilations and reposts legitimately share titles. A link that cannot be reached at check time is reported as unverified rather than failed; an unreachable host is not evidence of a dead link, and a maintainer may accept anyway.

Quality, plausibility, credibility, and whether anyone finds the thesis absurd **is not a gate**. That judgment belongs to the rating, in public, against the [rubric](harness/rubric.md). Filtering at intake would move it somewhere unaccountable.

Maintainers apply exactly one discretionary test: is this market-structure or due-diligence content at all. That is the sole subjective gate.

### What acceptance means

A maintainer applies the `accepted` label, which opens a pull request adding a record at `pos 251` or above with `source_corpus: "community"` and `review_status: "pending"`.

**A pending record is unrated. It is not rated zero, and acceptance is not endorsement.** Rating it is a separate governed step: a later pull request runs the [harness](harness/README.md) against the work, records `review_provenance`, and sets `review_status` to `reviewed` or, where the text cannot support a fair judgment, `unreviewable`. Once a rating exists, challenge it through the dispute path above. The unconditional author right of reply applies to community records exactly as it does to the original 250.

If two submissions are accepted at once, both pull requests may claim the same position and the second will fail validation. Rebase it; the position is reassigned from the merged state.
```

- [x] **Step 4: Update the README**

In `README.md`, replace the `## Dispute a rating` section heading and body with:

```markdown
## Submit a new DD

The library is not limited to the original bookcase. [Submit a new DD](https://github.com/ErranttVenture/superstonk-dd-library/issues/new?template=submit-dd.yml) — a Reddit post, a Substack essay, a FlipHTML5 publication, or a hosted PDF — and an automated comment will check it against the [published bar](CONTRIBUTING.md) within minutes.

Accepted submissions enter the dataset at position 251 and above with `source_corpus: "community"` and `review_status: "pending"`. **Pending means unrated, not rated zero.** Acceptance says the work is in scope and durably linked; it says nothing about whether the work is any good. Rating is a separate step that records which model produced the rating, on what date, against which hindsight cutoff.

## Dispute a rating

Disagreement is part of the audit. Read the [contribution and right-of-reply policy](CONTRIBUTING.md), then [open a rating dispute](https://github.com/ErranttVenture/superstonk-dd-library/issues/new?template=dispute-rating.yml) with the book, disputed assessment, primary-source evidence, and proposed change. Authors have an unconditional right of reply through the canonical `author_response` field whether or not a rating changes.
```

Then, in the `## Provenance` section, replace the paragraph beginning `` `data/master.json` is the evolving canonical current dataset `` with:

```markdown
[`data/master.json`](data/master.json) is the evolving canonical current dataset for consumers, raw-data links, accepted disputes, corrections, and author replies. Positions 1 through 250 are the July 21, 2026 review and remain byte-identical to the baseline; automated validation fails if any of them changes. Positions 251 and above are community submissions accepted after launch, each carrying `source_corpus: "community"`, so the two are never confused. `data/original-master.json` continues to prove the launch state on its own.
```

- [x] **Step 5: Update the harness README**

Append to `harness/README.md`:

```markdown
## Reviewing a community submission

Community records at position 251 and above enter the dataset with `review_status: "pending"` and no rating. Promoting one to `reviewed` uses the same rubric, packet, and output contract as the original run, with two differences.

Text capture is manual for any source that is not a FlipHTML5 publication. `extract_book_text.mjs` understands FlipHTML5 only. For a Reddit post, a Substack essay, or a hosted PDF, capture the text by hand, keep it outside this repository, and record how and when it was captured.

Every community review must populate `review_provenance` with `model`, `evaluated_on`, `hindsight_cutoff`, `prompt_revision`, and `reviewer`. Unlike the original run, community reviews accumulate across models and dates, and a rating without that block cannot be reproduced or fairly compared. Where the captured text cannot support a fair judgment, set `review_status` to `unreviewable` and record why in `summary` rather than forcing a rating.
```

- [x] **Step 6: Run the full suite and validation**

Run: `npm test && npm run validate`
Expected: both PASS.

- [x] **Step 7: Commit**

```bash
git add CONTRIBUTING.md README.md harness/README.md tests/repository.test.mjs && git commit -m "docs: publish the submission bar and unrated-pending meaning"
```

---

## Final verification

- [x] **Step 1: Confirm the dataset is untouched**

Run: `git diff --stat main -- data/`
Expected: no output. This plan ships the pipeline, not any community record.

- [x] **Step 2: Confirm no dependencies were added**

Run: `git diff main -- package.json`
Expected: no output, or a scripts-only change.

- [x] **Step 3: Run everything CI runs**

Run: `npm test && npm run validate`
Expected: PASS, and the validator prints `Canonical dataset: 250 preserved + 0 community records`.

- [x] **Step 4: Dry-run the check CLI against a hand-written body**

Write a submission body naming a real Reddit DD with a real archive.org snapshot, then run:

```bash
node scripts/check-submission.mjs /tmp/body.md
```

Expected: a checklist ending in `<!-- submission-status: pass -->`. This is the only step that exercises the real network path end to end.
