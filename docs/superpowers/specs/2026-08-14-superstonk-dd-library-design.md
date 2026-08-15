# SuperStonk DD Library Repository Design

## Objective

Create a new public GitHub repository named `superstonk-dd-library` under `ErranttVenture`. The repository publishes the original SuperStonk DD Library review artifacts, a clear methodology, and a runnable reconstruction of the analysis harness so community members can audit ratings, dispute individual assessments, and re-run the evaluation with other models.

This repository is standalone. It must not contain code, history, configuration, or private implementation details from any website repository.

## Scope

The repository will contain:

- Four byte-for-byte immutable original artifacts: `original-master.json`, `library_review.csv`, `REPORT.md`, and `BOOKS.md`.
- An evolving canonical `master.json`, byte-identical to `original-master.json` at launch and updated only through the governed dispute, correction, and right-of-reply workflows.
- A JSON Schema for the canonical `master.json` record structure, including an optional `author_response` string.
- A dependency-free Node.js 18+ reconstruction of the inventory and text-extraction stages.
- A reconstructed review prompt, output schema, rubric, calibration notes, and harness documentation.
- Repository documentation, separate code and data licenses, contribution rules, CODEOWNERS, and two concise issue forms.
- Automated checks that validate record shape, source-copy integrity, reconstructed-file labels, repository layout, and extraction behavior.

The repository will not contain extracted FlipHTML5 book text, website code, the compact website data derivative, secrets, or a re-run of the 214-agent review.

## Provenance Model

The supplied master review artifact, flat export, and two reports are originals from the July 21, 2026 run, with the August 13, 2026 conditional-claim adjudication incorporated. The master artifact will be preserved without normalization as `data/original-master.json`; the other three originals will likewise be copied without rewriting. All four immutable files will be verified with SHA-256 hashes before publication.

`data/master.json` is a separate canonical current copy. At launch it is byte-identical to `data/original-master.json`. It is deliberately not permanently hash-locked because accepted disputes, corrections, and unconditional author replies update the current dataset. Downstream consumers and raw-data links always use `data/master.json`; the baseline exists only to prove the original launch state.

The original temporary harness scripts and frozen prompt were not preserved. Every replacement harness file will therefore carry an obvious `RECONSTRUCTED` label in its file header or opening prose. The top-level README and harness README will explain that the replacements are faithful working reconstructions based on the method documented in the original report, not recovered originals.

The compact derivative supplied for comparison will be read only. A drift check may be reported during verification, but that derivative will not be copied, modified, named as a dependency, or mentioned through a local path in the public repository.

## Repository Structure

```text
superstonk-dd-library/
  README.md
  LICENSE
  LICENSE-DATA
  CONTRIBUTING.md
  CODEOWNERS
  package.json
  data/
    master.json
    original-master.json
    library_review.csv
    schema.json
  reports/
    REPORT.md
    BOOKS.md
  harness/
    README.md
    extract_bookcase.mjs
    extract_book_text.mjs
    review_prompt.md
    rubric.md
    output_schema.json
    calibration.md
  scripts/
    validate-repository.mjs
  tests/
    fixtures/
    cli-test-helpers.mjs
    harness-bookcase.test.mjs
    harness-text.test.mjs
    repository.test.mjs
    schema.test.mjs
  .github/
    ISSUE_TEMPLATE/
      dispute-rating.yml
      correction.yml
  docs/superpowers/
    specs/
      2026-08-14-superstonk-dd-library-design.md
    plans/
      2026-08-14-superstonk-dd-library.md
```

`package.json`, `scripts/`, and `tests/` are small verification additions beyond the requested minimum layout. They provide a one-command, dependency-free audit and make the reconstructed code testable without adding third-party packages.

## Architecture

### Original data layer

`data/original-master.json` is the immutable baseline snapshot. `data/library_review.csv` is the immutable flat export, and the two report files preserve the original prose and catalog. No generated file or contribution may overwrite or rewrite those four originals.

`data/master.json` is the evolving canonical current record set. Consumers continue to use it, and accepted governance changes update it while preserving the historical assessment in `ADJUDICATED` notes where applicable. It is schema-validated and must retain 250 records, but it is not permanently hash-locked or permanently required to equal the baseline.

`data/schema.json` will use JSON Schema Draft 2020-12 and describe the actual union of record shapes observed across all 250 records. It will reject review fields on metadata-only rows and incomplete core review payloads while retaining the observed optional calibration and insufficient-text fields plus nullable validity ratings. Reviewed records may carry an optional integer `validity_rating_original` when adjudication changed the initial rating; calibration statistics compare against that historical value and otherwise fall back to `validity_rating`. The optional `author_response` string is permitted in either branch for future right-of-reply additions without being inserted into existing records.

### Reconstructed extraction layer

`extract_bookcase.mjs` will fetch the public FlipHTML5 bookcase once, locate the embedded `bookData` representation defensively, parse its 250-item metadata collection, normalize only the harness output shape, and emit JSON. Parsing will be separated from network I/O so fixtures can test multiple embed forms and malformed input.

`extract_book_text.mjs` will fetch an individual public SEO page, extract ordered `flip-basic-num` and paragraph text pairs, decode relevant HTML entities, and emit a structured text packet. It will distinguish a valid page with no extractable text from a fetch or parse failure. It will support one URL or a JSON inventory as input while keeping request concurrency conservative.

Both scripts will use only Node built-ins and expose importable parsing functions plus CLI entry points. Network errors will produce concise diagnostics and a nonzero exit code. Live bookcase behavior will be tested once and documented honestly whether it succeeds, is blocked, or reveals a changed embed format.

### Reconstructed review layer

`review_prompt.md` will preserve the documented structure: anchored 1–5 validity rubric, reconstructed post-2021 hindsight facts, schema-only output instruction, and a book-text packet slot. It will not claim verbatim fidelity. The hindsight block will include only facts cited in the original report, such as the SEC October 2021 staff report conclusions, reported short-interest trajectory, split-adjusted price history, EU PFOF ban, Robinhood enforcement, and reverse-repo peak and drain.

`rubric.md` will reproduce the anchored validity wording from `REPORT.md`. `output_schema.json` will describe the review-shaped fields present in `master.json`, including key-claim `kind` and `assessment` enums. `calibration.md` will record the 22-book calibration results, the two adjudicated disagreements, known low-cost-model bias, and the August conditional-claim pass.

### Community governance layer

The README will lead with methodology in a collapsible `<details>` block, then a curated starting list and the report’s validity distribution. It will clearly distinguish claim validity from source-characterization accuracy and educational value, with both gaps listed as roadmap items. It will explain provenance, licensing, disputes, primary-source links, and why FlipHTML5 book text is excluded.

`CONTRIBUTING.md` will make rating disputes the primary contribution path. Overturning evidence must be a filing, regulator report, or contemporaneous primary record. Accepted changes preserve the original assessment visibly in an `ADJUDICATED` note. Authors always receive an `author_response` field regardless of the outcome of their requested rating change.

Issue forms will collect the minimum structured information required for rating disputes and factual corrections. `CODEOWNERS` will assign all paths to `@ErranttVenture`. Data changes require maintainer review plus an accepted dispute or correction issue; rating, claim-assessment, and rationale changes specifically require the dispute workflow. The immutable baseline is never changed.

## Licensing

The standard MIT license, copyright 2026 Sean De Clercq, will cover code and schema tooling. The complete CC BY-SA 4.0 legal code, prefaced by a one-line scope statement, will cover `data/` and `reports/`.

The split is intentional: permissive reuse is appropriate for executable tooling, while share-alike keeps community revisions to the published review data open. Original FlipHTML5 publications remain their authors’ work and are not relicensed or redistributed.

## Testing and Verification

Implementation will follow red-green-refactor for executable behavior. Tests will use Node’s built-in test runner and local HTML fixtures.

The verification command will check:

1. Required files and directories exist.
2. All 250 canonical current records and all 250 immutable baseline records validate against `data/schema.json`.
3. The immutable baseline, CSV, and reports match the recorded source SHA-256 hashes; launch verification separately proves current `master.json` is initially byte-identical to the baseline.
4. Every reconstructed harness artifact contains a `RECONSTRUCTED` label.
5. Extractors correctly parse representative and malformed fixtures.
6. README ordering, `<details>` pairing, licensing statements, provenance language, and excluded-text notice are present.
7. No likely secrets, private local paths, or references to unrelated projects are tracked.
8. Git history begins in this repository and contains logical commits only.

The live bookcase test is an integration check, not a deterministic unit test. Its result will be recorded in `harness/README.md`; a remote block or upstream markup change will not be disguised as success.

## Commit and Publication Strategy

Work will be committed directly on local `main` in logical units:

1. Design and implementation plan.
2. Original artifacts and dual licensing.
3. Schemas and validation checks.
4. Reconstructed extraction harness and tests.
5. Reconstructed review materials and methodology documentation.
6. Community governance files and final README.
7. Verification corrections, if required.

After independent review and fresh full verification, GitHub CLI will create `ErranttVenture/superstonk-dd-library` as a public repository from this fresh local history and push `main` directly. No pull request will be opened. Force-push will not be used.

## Acceptance Conditions

Publication occurs only after all requested files are present, hashes prove the four immutable originals are unchanged, schema validation reports 250 of 250 records for both the baseline and current master, initial byte identity is verified separately, reconstructed provenance is unambiguous, automated tests pass, a live extraction attempt is documented truthfully, and the tracked tree contains no secrets or unrelated project references.

The handoff will include the repository URL, source hashes, validation and test results, live extractor status, and the account-permission checklist for branch protection, CODEOWNERS confirmation, Reddit follow-ups, and the separate future decision about website data consumption.
