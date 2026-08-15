# SuperStonk DD Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a fresh, public, auditable repository containing the original 250-record SuperStonk DD review, a strict schema, reconstructed evaluation materials, and dependency-free extraction tooling.

**Architecture:** Preserve the four original artifacts as immutable canonical inputs, place reconstructed tooling and methodology in an explicitly labeled harness, and validate the repository with Node’s built-in test runner plus a small local JSON Schema evaluator. Build and verify locally on `main`, then create the empty public GitHub repository and push the fresh history directly without a pull request.

**Tech Stack:** Git, GitHub CLI, Node.js 18+ built-ins (`fetch`, `node:test`, `fs`, `crypto`), JSON Schema Draft 2020-12, Markdown, YAML issue forms.

**Spec:** `docs/superpowers/specs/2026-08-14-superstonk-dd-library-design.md`

## Global Constraints

- The repository is `ErranttVenture/superstonk-dd-library`, public, with a fresh history and direct push to `main`; do not open a pull request.
- Local Git identity is `ErranttVenture <declercq.sean@gmail.com>`.
- Never modify or publish any website repository file; the supplied compact derivative is read-only comparison input.
- `data/master.json`, `data/library_review.csv`, `reports/REPORT.md`, and `reports/BOOKS.md` are byte-for-byte original copies.
- Every file reconstructed from the lost July 21, 2026 harness or prompt begins with an obvious `RECONSTRUCTED` label.
- Extraction scripts support Node.js 18+ and use no third-party runtime dependencies.
- Do not re-run the 214-agent review and do not include extracted FlipHTML5 book text.
- Public tracked files contain no private local paths, secrets, or references to unrelated local projects.
- MIT covers code and schema tooling; CC BY-SA 4.0 covers `data/` and `reports/`.
- Executable work follows red-green-refactor; each task ends with fresh verification and a logical commit.

---

### Task 1: Establish immutable source artifacts, licenses, and the test runner

**Files:**

- Create: `package.json`
- Create: `tests/repository.test.mjs`
- Create: `data/master.json`
- Create: `data/library_review.csv`
- Create: `reports/REPORT.md`
- Create: `reports/BOOKS.md`
- Create: `LICENSE`
- Create: `LICENSE-DATA`

**Interfaces:**

- Consumes: the four source files in the local source directory supplied for this task (kept outside the repository).
- Produces: `npm test` as the common verification entry point and immutable copies with fixed SHA-256 expectations.

- [ ] **Step 1: Add the package manifest and a failing immutable-artifact test**

Create `package.json` with no dependencies:

```json
{
  "name": "superstonk-dd-library",
  "version": "1.0.0",
  "private": true,
  "description": "Auditable data and reconstructed harness for the SuperStonk DD Library review",
  "type": "module",
  "engines": { "node": ">=18" },
  "scripts": {
    "test": "node --test",
    "validate": "node scripts/validate-repository.mjs"
  }
}
```

Create `tests/repository.test.mjs` using `node:test`, `assert/strict`, `fs/promises`, and `crypto`. The first test loops over this exact map and asserts each file exists and hashes to the expected lowercase digest:

```js
const originals = new Map([
  ['reports/REPORT.md', '53c777712e6ff985e1259da5ebe47aa05e499c81d5d0de9916eba9b17ff90cfa'],
  ['reports/BOOKS.md', '3b202e66b0e8587e84d63d9d1eb2cd8f525ffc1ed3d2589b3c38a33b4d56ffc0'],
  ['data/library_review.csv', '9efacc7816b8e24a44a97037fe39e375153a16ee26409cf619b565dc03e20ec1'],
  ['data/master.json', 'fb96f7d70a0abece7e1a3f1995d1df67eb3ea5b7134565115e68e5431ffccf13']
]);
```

Also assert `master.json` parses as an array of exactly 250 records whose `pos` values are 1 through 250.

- [ ] **Step 2: Run the test and verify the red state**

Run: `npm test`

Expected: FAIL because the four canonical files do not exist yet.

- [ ] **Step 3: Copy the four originals without text conversion**

Use PowerShell `Copy-Item -LiteralPath` from the four source paths to their exact destinations. Do not pipe their contents through a shell, formatter, or patch operation. Immediately run `Get-FileHash -Algorithm SHA256` on source and destination pairs and compare each pair.

- [ ] **Step 4: Add both licenses**

Create `LICENSE` from the standard MIT template with `Copyright (c) 2026 Sean De Clercq`.

Fetch the official English CC BY-SA 4.0 legal code from `https://creativecommons.org/licenses/by-sa/4.0/legalcode.txt`. Create `LICENSE-DATA` with this first line followed by a blank line and the complete fetched legal code:

```text
This license covers the data/ and reports/ directories.
```

Verify the legal-code body retains the `Attribution-ShareAlike 4.0 International` title and all eight numbered sections.

- [ ] **Step 5: Run the tests and hash comparison for the green state**

Run: `npm test`

Expected: PASS for immutable hashes and 250 sequential records.

Run source/destination SHA-256 comparison again and retain its output for the final handoff.

- [ ] **Step 6: Commit the artifact foundation**

```powershell
git add package.json tests/repository.test.mjs data/master.json data/library_review.csv reports/REPORT.md reports/BOOKS.md LICENSE LICENSE-DATA
git diff --cached --check
git commit -m "data: publish original review artifacts"
```

---

### Task 2: Add strict schemas and dependency-free validation

**Files:**

- Create: `data/schema.json`
- Create: `harness/output_schema.json`
- Create: `scripts/schema-validator.mjs`
- Create: `scripts/validate-repository.mjs`
- Create: `tests/schema.test.mjs`

**Interfaces:**

- Produces: `validateAgainstSchema(schema, value)` returning an array of `{ path, message }` errors.
- Produces: `validateMasterRecords(records, schema)` returning `{ valid, total, errors }`.
- Produces: `npm run validate`, which exits 0 only after reporting `Schema validation: 250/250 records valid`.

- [ ] **Step 1: Write failing schema tests**

Create `tests/schema.test.mjs` with these behaviors:

```js
test('all 250 canonical records satisfy the record schema', async () => {
  const records = JSON.parse(await readFile('data/master.json', 'utf8'));
  const schema = JSON.parse(await readFile('data/schema.json', 'utf8'));
  const result = validateMasterRecords(records, schema);
  assert.equal(result.total, 250);
  assert.deepEqual(result.errors, []);
});

test('record schema permits a string author_response', () => {
  const candidate = { ...record, author_response: 'The author disputes claim 2.' };
  assert.deepEqual(validateAgainstSchema(schema, candidate), []);
});

test('record schema rejects an unknown property and invalid claim assessment', () => {
  const candidate = structuredClone(record);
  candidate.untracked = true;
  candidate.key_claims[0].assessment = 'vibes';
  const messages = validateAgainstSchema(schema, candidate).map(({ message }) => message);
  assert(messages.some((message) => message.includes('unknown property')));
  assert(messages.some((message) => message.includes('enum')));
});
```

Add focused validator tests for required properties, nullable `validity_rating`, arrays, numeric bounds, local `$ref`, and `additionalProperties: false`.

- [ ] **Step 2: Run the schema tests and verify the red state**

Run: `node --test tests/schema.test.mjs`

Expected: FAIL because the schemas and validator modules do not exist.

- [ ] **Step 3: Implement the minimal JSON Schema evaluator**

Implement `scripts/schema-validator.mjs` for the exact keywords used by the repository schemas: local `$ref`, `type`, `required`, `properties`, `additionalProperties`, `items`, `enum`, `const`, `minimum`, `maximum`, `minItems`, `uniqueItems`, `pattern`, `anyOf`, and `allOf`.

Use this public interface:

```js
export function validateAgainstSchema(schema, value) {
  const errors = [];
  visit(schema, value, '$', schema, errors);
  return errors;
}

export function validateMasterRecords(records, recordSchema) {
  const errors = records.flatMap((record, index) =>
    validateAgainstSchema(recordSchema, record).map((error) => ({
      ...error,
      record: index + 1
    }))
  );
  return { valid: records.length - new Set(errors.map((error) => error.record)).size,
    total: records.length, errors };
}
```

Resolve local references only when they begin with `#/`; decode `~1` and `~0` per JSON Pointer. Throw a clear error for remote references or unsupported keywords used by these schemas.

- [ ] **Step 4: Write the canonical record schema from observed shapes**

Create Draft 2020-12 `data/schema.json` for one record, not the outer array. Require the seven inventory fields on every record: `pos`, `title`, `byline`, `pages`, `uploaded`, `url`, `type`, and `text_available`. Model reviewed fields as optional because 36 metadata-only rows omit them.

Use these exact enums and bounds:

- `type`: `compilation`, `original`, `art`, `periodical`.
- `content_type`: `periodical_news`, `wealth_advice`, `market_dd`, `other`, `guide_howto`, `macro_analysis`, `psychology_opinion`.
- Claim `kind`: `verifiable_fact`, `speculation`, `prediction`.
- Claim `assessment`: `holds_up`, `partially_holds`, `does_not_hold`, `cannot_assess`.
- `speculation_level`: `low`, `medium`, `high`.
- `quality_variance`: `uniform`, `mixed`, `na`.
- `confidence`: `low`, `medium`, `high`.
- `evidence_quality`, `validity_rating`, and calibration ratings: integers from 1 through 5; `validity_rating` also permits `null`.

Define all 23 observed record properties plus optional `author_response`, set `additionalProperties: false` at every object boundary, require all four claim fields, all three constituent fields, and both calibration fields.

- [ ] **Step 5: Create the reconstructed review output schema**

Create `harness/output_schema.json` with an opening JSON property named `$comment` containing `RECONSTRUCTED — inferred from the original master.json records; this is not the preserved July 21, 2026 output schema.`

Require the review-stage fields `summary`, `key_claims`, `constituents`, `evidence_quality`, `speculation_level`, `validity_rating`, `rating_reconciled`, `validity_rationale`, `quality_variance`, `confidence`, and `topics`. Reuse the exact definitions and enums from `data/schema.json` by duplicating them so the file is independently usable by model APIs.

- [ ] **Step 6: Implement the repository validator CLI**

`scripts/validate-repository.mjs` reads both JSON files, validates all records, prints each failure as `record <n> <path>: <message>`, prints the summary line, and sets `process.exitCode = 1` on any error.

It also checks positions are exactly 1–250 and prints:

```text
Schema validation: 250/250 records valid
Position sequence: 1–250 complete
```

- [ ] **Step 7: Run schema tests and validation for the green state**

Run: `node --test tests/schema.test.mjs`

Expected: all focused tests PASS.

Run: `npm run validate`

Expected: exit 0 with `Schema validation: 250/250 records valid`.

- [ ] **Step 8: Commit schemas and validation**

```powershell
git add data/schema.json harness/output_schema.json scripts/schema-validator.mjs scripts/validate-repository.mjs tests/schema.test.mjs
git diff --cached --check
git commit -m "feat: validate canonical review records"
```

---

### Task 3: Reconstruct and test bookcase inventory extraction

**Files:**

- Create: `tests/fixtures/bookcase-direct.html`
- Create: `tests/fixtures/bookcase-encoded.html`
- Create: `tests/harness-bookcase.test.mjs`
- Create: `harness/extract_bookcase.mjs`

**Interfaces:**

- Produces: `extractBookData(html)` returning the raw embedded array.
- Produces: `normalizeBook(raw, index)` returning `{ pos, title, byline, pages, uploaded, url }`.
- Produces: `fetchBookcase(url, fetchImpl = fetch)` returning normalized records.
- CLI: `node harness/extract_bookcase.mjs [url]`, JSON to stdout and diagnostics to stderr.

- [ ] **Step 1: Add representative fixtures and failing parser tests**

The direct fixture contains a script assignment with two records:

```html
<script>var bookData = [{"title":"Alpha","userName":"abc","bookId":"one","pages":12,"publishTime":"2021-07-20"},{"title":"Beta","userName":"def","bookId":"two","pages":6,"publishTime":"2021-07-21"}];</script>
```

The encoded fixture contains the same JSON as a quoted JavaScript string assigned to `bookData`. Tests assert both return two raw records, nested brackets inside titles do not terminate scanning, malformed JSON throws `Unable to parse embedded bookData`, and normalization creates canonical FlipHTML5 URLs.

Add a fetch-injection test that supplies a fake function returning `{ ok: true, text: async () => fixture }` and proves only one request occurs.

- [ ] **Step 2: Run parser tests and verify the red state**

Run: `node --test tests/harness-bookcase.test.mjs`

Expected: FAIL because `harness/extract_bookcase.mjs` is absent.

- [ ] **Step 3: Implement balanced extraction and normalization**

Begin the script with:

```js
// RECONSTRUCTED — the original July 21, 2026 extraction script was not preserved.
```

Locate `bookData` followed by `:` or `=`, skip whitespace, then parse either a quoted JavaScript string or a balanced JSON array/object. The balanced scanner must track quote state, backslash escapes, and bracket depth. Accept a containing object only when one of its values is an array; reject ambiguous objects with more than one candidate array.

Normalize field aliases observed in the live payload without guessing absent values. Validate title, user/slug identifiers, page count, and upload date. Preserve the source order and assign one-based `pos`.

- [ ] **Step 4: Add CLI argument and failure behavior**

Default the URL to `https://fliphtml5.com/bookcase/kosyg`. On non-2xx responses throw `Bookcase request failed: HTTP <status>`. Emit pretty JSON plus a newline on success. Print only the error message to stderr and set exit code 1 on failure.

- [ ] **Step 5: Run tests for the green state**

Run: `node --test tests/harness-bookcase.test.mjs`

Expected: all fixture, malformed-input, and single-fetch tests PASS.

- [ ] **Step 6: Commit the inventory extractor**

```powershell
git add tests/fixtures/bookcase-direct.html tests/fixtures/bookcase-encoded.html tests/harness-bookcase.test.mjs harness/extract_bookcase.mjs
git diff --cached --check
git commit -m "feat: reconstruct bookcase inventory extraction"
```

---

### Task 4: Reconstruct and test SEO text extraction

**Files:**

- Create: `tests/fixtures/book-text.html`
- Create: `tests/fixtures/book-no-text.html`
- Create: `tests/harness-text.test.mjs`
- Create: `harness/extract_book_text.mjs`

**Interfaces:**

- Produces: `extractPageText(html)` returning `{ textAvailable, pages }` where each page is `{ page, text }`.
- Produces: `fetchBookText(url, fetchImpl = fetch)` returning `{ url, textAvailable, pages }`.
- CLI: `node harness/extract_book_text.mjs <url>`, JSON to stdout.

- [ ] **Step 1: Add fixtures and failing text-parser tests**

The text fixture contains out-of-order whitespace, two `flip-basic-num` markers, nested tags, `<br>`, `&amp;`, `&quot;`, `&#39;`, and `&#x2014;`. Assert ordered output exactly:

```js
{
  textAvailable: true,
  pages: [
    { page: 1, text: 'First line & second line' },
    { page: 2, text: 'Quoted “claim” — checked' }
  ]
}
```

The no-text fixture contains ordinary navigation paragraphs but no `flip-basic-num` marker; assert `{ textAvailable: false, pages: [] }`. Add tests for repeated page markers, empty page paragraphs, missing CLI URL, and HTTP 404.

- [ ] **Step 2: Run text tests and verify the red state**

Run: `node --test tests/harness-text.test.mjs`

Expected: FAIL because the text extractor is absent.

- [ ] **Step 3: Implement ordered marker/paragraph parsing**

Begin with the same `RECONSTRUCTED` header as the inventory script. Parse the static HTML without a DOM dependency by finding each element whose class list contains `flip-basic-num`, reading its numeric content, and taking the associated following `<p>` block. Strip tags after converting `<br>` and block endings to spaces, decode numeric and the five basic named HTML entities, normalize internal whitespace, and preserve page order.

Reject nonnumeric page markers. For duplicate page numbers, concatenate nonempty text in source order with `\n` so no extracted source text is silently discarded.

- [ ] **Step 4: Implement fetch and CLI behavior**

Validate input with `new URL()` and require `http:` or `https:`. On fetch failure use `Book request failed: HTTP <status>`. The CLI requires exactly one URL, emits pretty JSON, and never writes extracted text to tracked repository files.

- [ ] **Step 5: Run tests for the green state**

Run: `node --test tests/harness-text.test.mjs`

Expected: all parser, entity, empty-text, duplicate-page, CLI, and HTTP tests PASS.

- [ ] **Step 6: Commit the text extractor**

```powershell
git add tests/fixtures/book-text.html tests/fixtures/book-no-text.html tests/harness-text.test.mjs harness/extract_book_text.mjs
git diff --cached --check
git commit -m "feat: reconstruct book text extraction"
```

---

### Task 5: Reconstruct the review materials and harness documentation

**Files:**

- Modify: `tests/repository.test.mjs`
- Create: `harness/README.md`
- Create: `harness/review_prompt.md`
- Create: `harness/rubric.md`
- Create: `harness/calibration.md`

**Interfaces:**

- Consumes: original methodology and facts from `reports/REPORT.md` plus the canonical field names in `data/master.json`.
- Produces: a model-neutral prompt template with `{{BOOK_METADATA}}` and `{{BOOK_TEXT}}` slots and instructions to emit JSON matching `harness/output_schema.json`.

- [ ] **Step 1: Add failing provenance and content tests**

Extend `tests/repository.test.mjs` to assert every file under the reconstructed harness contains the case-sensitive word `RECONSTRUCTED`. Add assertions that:

- `rubric.md` includes all five anchors from `REPORT.md` in the same wording.
- `review_prompt.md` contains both packet slots, references `output_schema.json`, and includes the SEC staff report, short-interest trajectory, price history, EU PFOF ban, Robinhood enforcement, and reverse-repo facts.
- `calibration.md` contains `12/22 exact`, `20/22 within ±1`, `+0.27`, `#9`, `#180`, `#54`, and `ADJUDICATED`.

- [ ] **Step 2: Run the repository test and verify the red state**

Run: `node --test tests/repository.test.mjs`

Expected: FAIL because the reconstructed Markdown files do not exist.

- [ ] **Step 3: Create the anchored rubric and calibration record**

`harness/rubric.md` opens with the reconstruction disclaimer and reproduces this exact line from the original report:

```text
5 = factually accurate, predictions largely came true · 4 = grounded in primary sources, core thesis not falsified · 3 = real data, significant unproven leaps · 2 = speculation dominates, key predictions failed · 1 = core claims falsified or purely conspiratorial.
```

Expand each anchor only with explanation traceable to the report. `harness/calibration.md` documents every requested calibration and conditional-claim number, the known under-crediting bias, and the rule that a conditional consequence is `cannot_assess` when its trigger never occurred.

- [ ] **Step 4: Create the reconstructed prompt template**

Structure `review_prompt.md` in this order:

1. Reconstruction disclaimer.
2. Role and evaluation date.
3. Anchored rubric.
4. Reconstructed hindsight facts, each phrased as a supplied fact rather than a newly researched conclusion.
5. Claim-kind and assessment enums.
6. Conditional-claim rule.
7. Output instruction referencing the schema and forbidding extra prose.
8. `{{BOOK_METADATA}}` and `{{BOOK_TEXT}}` packet slots.

State that the facts block is itself reconstructed and must be replaced or time-bounded when another evaluator re-runs the review.

- [ ] **Step 5: Document end-to-end harness use**

`harness/README.md` describes the five-stage July method, labels every shipped component as reconstructed, gives Node 18+ commands for inventory and one-book extraction, explains how to insert another model between prompt and output schema, and explicitly says the full 214-book run is not performed automatically.

Include a `Current live status` section whose value will be filled with the observed integration result in Task 7, using either a successful record count or an exact failure category and date.

- [ ] **Step 6: Run content tests for the green state**

Run: `node --test tests/repository.test.mjs`

Expected: reconstructed provenance and required-content assertions PASS.

- [ ] **Step 7: Commit reconstructed review materials**

```powershell
git add tests/repository.test.mjs harness/README.md harness/review_prompt.md harness/rubric.md harness/calibration.md
git diff --cached --check
git commit -m "docs: reconstruct review methodology"
```

---

### Task 6: Add community-facing README, contribution policy, and issue forms

**Files:**

- Modify: `tests/repository.test.mjs`
- Create: `README.md`
- Create: `CONTRIBUTING.md`
- Create: `CODEOWNERS`
- Create: `.github/ISSUE_TEMPLATE/dispute-rating.yml`
- Create: `.github/ISSUE_TEMPLATE/correction.yml`

**Interfaces:**

- Produces: a rendered GitHub landing page, a right-of-reply dispute workflow, and valid GitHub issue forms.

- [ ] **Step 1: Add failing documentation-structure tests**

Extend `tests/repository.test.mjs` to assert:

- `README.md` places `<details>` before `## Start here`, and has one matching `</details>`.
- README mentions `250 books`, `6,821 pages`, `AI-assisted`, `human-directed`, `community audit layer`, primary sources, both roadmap axes, both licenses, reconstruction provenance, July 21 and August 13 dates, and excluded FlipHTML5 texts.
- The validity distribution rows and counts are present exactly: 4→11, 3→25, 2→166, 1→7.
- `CONTRIBUTING.md` contains `author_response`, `ADJUDICATED`, primary-source standard, maintainer review, and no drive-by rating edits.
- `CODEOWNERS` is exactly `* @ErranttVenture` plus a newline.
- Each issue form parses as structurally valid YAML using a conservative line-based assertion for `name`, `description`, `body`, required field identifiers, and `validations: required: true`; no third-party YAML parser is introduced.

- [ ] **Step 2: Run documentation tests and verify the red state**

Run: `node --test tests/repository.test.mjs`

Expected: FAIL because community-facing files do not exist.

- [ ] **Step 3: Write the README in the required order**

Use this section order:

1. Title and one-paragraph statement of purpose.
2. `<details><summary>Methodology</summary>` with the five-step method, anchors, calibration, bias, adjudication, and links to `harness/` and `reports/REPORT.md`.
3. `## Start here` with #53–58, #9, #40, and the original distribution table.
4. `## What a rating means — and does not mean` with source-characterization accuracy and educational value as community-feedback roadmap items, crediting u/writerofjots and u/humdingler.
5. `## Dispute a rating` linking to `CONTRIBUTING.md` and the issue form.
6. `## Re-run the evaluation` linking to the harness.
7. `## Licensing` explaining the MIT/CC BY-SA split and excluded book text.
8. `## Provenance` distinguishing original artifacts from reconstructed files and giving both dates.

Every rating entry point links to the canonical record’s `url` field or instructs readers to use that primary-source link in `data/master.json`.

- [ ] **Step 4: Write contribution and right-of-reply rules**

Explain the exact dispute issue fields, primary-source evidence standard, accepted-change process, preservation of original assessments inside `ADJUDICATED` notes, and the author’s unconditional `author_response` right of reply. Explain re-running the harness with another model and the CC BY-SA expectation that published same-rubric re-ratings are shared back.

State: all PRs require maintainer review; data changes come only through accepted disputes; drive-by rating edits are closed.

- [ ] **Step 5: Add CODEOWNERS and short issue forms**

`dispute-rating.yml` contains required fields with ids `book`, `dispute`, `evidence`, and `proposed_change`. `correction.yml` contains required fields with ids `location`, `correction`, and `evidence`. Both set `blank_issues_enabled` nowhere because they are individual forms, use no assignees, and keep descriptions concise.

- [ ] **Step 6: Run documentation tests and inspect Markdown structure**

Run: `node --test tests/repository.test.mjs`

Expected: all documentation, ordering, governance, and issue-form assertions PASS.

Run: `rg -n "<details>|</details>|^## " README.md` and visually confirm balanced tags and required order.

- [ ] **Step 7: Commit community governance and landing documentation**

```powershell
git add tests/repository.test.mjs README.md CONTRIBUTING.md CODEOWNERS .github/ISSUE_TEMPLATE/dispute-rating.yml .github/ISSUE_TEMPLATE/correction.yml
git diff --cached --check
git commit -m "docs: add community audit workflow"
```

---

### Task 7: Live integration, drift audit, independent review, and publication

**Files:**

- Modify: `harness/README.md`
- Modify only if verification exposes defects: files already introduced by Tasks 1–6.

**Interfaces:**

- Consumes: live `https://fliphtml5.com/bookcase/kosyg`, canonical `data/master.json`, and the supplied read-only compact derivative.
- Produces: verified Git history pushed to `https://github.com/ErranttVenture/superstonk-dd-library` on `main`.

- [ ] **Step 1: Attempt the live bookcase extraction once**

Run:

```powershell
node harness/extract_bookcase.mjs https://fliphtml5.com/bookcase/kosyg > $env:TEMP\superstonk-bookcase-live.json
```

If successful, parse the temporary JSON and record its item count and test date. If blocked or changed, capture the HTTP status or parser error exactly. Update `harness/README.md` `Current live status` with that observed result. Do not weaken unit tests to manufacture a success.

- [ ] **Step 2: Compare the compact derivative read-only**

Run a temporary Node comparison keyed by canonical `pos` against compact `p`. Verify both contain 250 positions, map compact fields to canonical fields (`p→pos`, `t→title`, `a→byline`, `pg→pages`, `d→uploaded`, `ty→type`, `v→validity_rating`, `e→evidence_quality`, `s→speculation_level`, `cf→confidence`, `qv→quality_variance`, `ic→is_compilation`, `it→insufficient_text`, `tx→text_available`, `rec→rating_reconciled`, `url→url`, `sum→summary`, `rat→validity_rationale`), and compare compact claim/constituent tuples to their canonical objects.

Print only counts and position/field names for drift; never modify either input. Retain the drift summary for the final response without adding a local path or unrelated project name to tracked files.

- [ ] **Step 3: Run the full local verification suite**

Run:

```powershell
npm test
npm run validate
git diff --check
git status -sb
git log --oneline --decorate
```

Then run hash comparisons for all four source/destination pairs and require exact matches.

- [ ] **Step 4: Scan the tracked tree for secrets and forbidden references**

Run `git ls-files` and inspect every tracked path. Use `rg` over tracked text files for Windows drive prefixes, the website project name, `gho_`, `github_pat_`, `BEGIN .*PRIVATE KEY`, `api[_-]?key`, and `password`. Review matches contextually; license prose and generic documentation terms are acceptable, credentials and local paths are not.

Run `git rev-list --max-parents=0 HEAD` and require exactly one root commit. Verify no remote exists before publication.

- [ ] **Step 5: Request independent code and requirements review**

Dispatch the required code-review worker with the approved spec, this plan, root commit, and current `HEAD`. Ask it to check every acceptance criterion, executable safety, schema accuracy, reconstructed labels, license split, README rendering, and absence of unrelated project references.

Fix every Critical or Important finding with a failing regression test first where executable behavior changes. Re-run the full suite after fixes and commit corrections as `fix: address publication review` only if changes were necessary.

- [ ] **Step 6: Commit the observed live status**

```powershell
git add harness/README.md
git diff --cached --check
git commit -m "docs: record live extractor status"
```

Skip this commit only if the live status was already committed with the exact current observation.

- [ ] **Step 7: Perform fresh pre-push verification**

Run `npm test`, `npm run validate`, the four hash comparisons, secret/forbidden-reference scan, `git diff --check`, and `git status -sb` again in the same working state that will be pushed. Require a clean worktree and zero failures.

- [ ] **Step 8: Create the public repository and push main directly**

Confirm `gh auth status` shows active account `ErranttVenture` and `gh repo view ErranttVenture/superstonk-dd-library` still reports not found. Then run from the repository root:

```powershell
gh repo create ErranttVenture/superstonk-dd-library --public --source . --remote origin --push --description "Auditable ratings, methodology, and reconstructed harness for the SuperStonk DD Library review"
```

Do not create a branch, pull request, tag, release, or branch-protection rule. Verify the remote URL, default branch `main`, public visibility, pushed `HEAD` SHA, and repository URL with `gh repo view`.

- [ ] **Step 9: Deliver the handoff**

Report the repository URL, final commit SHA, logical commit list, four SHA-256 values, schema result `250/250`, test counts, live extraction status, and compact-derivative drift count.

Include this account-permission checklist verbatim in substance:

- Protect `main`: require pull-request review and block force pushes through Settings → Branches or the branch-protection API.
- Confirm `CODEOWNERS` correctly names `@ErranttVenture`.
- Reply to u/stonkdongo with the contributor repository; u/zeprofesor and u/mtgac with prompt/harness/rubric transparency; u/imposter22 with the raw `data/master.json` URL; and u/vigg1__ with an invitation to file the first synthetic-short dispute-rating issue.
- Decide separately whether the website should consume this repository’s `data/master.json` at build time instead of a vendored derivative; do not make that change in this task.
