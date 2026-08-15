# SuperStonk DD Library Repository Design

## Objective

Create a new public GitHub repository named `superstonk-dd-library` under `ErranttVenture`. The repository publishes the original SuperStonk DD Library review artifacts, a clear methodology, and a runnable reconstruction of the analysis harness so community members can audit ratings, dispute individual assessments, and re-run the evaluation with other models.

This repository is standalone. It must not contain code, history, configuration, or private implementation details from any website repository.

## Scope

The repository will contain:

- Four byte-for-byte original artifacts: `master.json`, `library_review.csv`, `REPORT.md`, and `BOOKS.md`.
- A JSON Schema for the canonical `master.json` record structure, including an optional `author_response` string.
- A dependency-free Node.js 18+ reconstruction of the inventory and text-extraction stages.
- A reconstructed review prompt, output schema, rubric, calibration notes, and harness documentation.
- Repository documentation, separate code and data licenses, contribution rules, CODEOWNERS, and two concise issue forms.
- Automated checks that validate record shape, source-copy integrity, reconstructed-file labels, repository layout, and extraction behavior.

The repository will not contain extracted FlipHTML5 book text, website code, the compact website data derivative, secrets, or a re-run of the 214-agent review.

## Provenance Model

The four supplied review artifacts are originals from the July 21, 2026 run, with the August 13, 2026 conditional-claim adjudication incorporated. They will be copied without normalization or reformatting and verified with SHA-256 hashes before publication.

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
    harness.test.mjs
    repository.test.mjs
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

`data/master.json` is the canonical record set. `data/library_review.csv` is the flat export. The two report files preserve the original prose and catalog. No generated file may overwrite or rewrite these artifacts.

`data/schema.json` will use JSON Schema Draft 2020-12 and describe the actual union of record shapes observed across all 250 records. It will reject undocumented properties while accurately representing optional and nullable fields. The optional `author_response` string is permitted for future right-of-reply additions without being inserted into existing records.

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

Issue forms will collect the minimum structured information required for rating disputes and factual corrections. `CODEOWNERS` will assign all paths to `@ErranttVenture`. Data changes will require maintainer review and the dispute workflow.

## Licensing

The standard MIT license, copyright 2026 Sean De Clercq, will cover code and schema tooling. The complete CC BY-SA 4.0 legal code, prefaced by a one-line scope statement, will cover `data/` and `reports/`.

The split is intentional: permissive reuse is appropriate for executable tooling, while share-alike keeps community revisions to the published review data open. Original FlipHTML5 publications remain their authors’ work and are not relicensed or redistributed.

## Testing and Verification

Implementation will follow red-green-refactor for executable behavior. Tests will use Node’s built-in test runner and local HTML fixtures.

The verification command will check:

1. Required files and directories exist.
2. All 250 canonical records validate against `data/schema.json`.
3. Original copies match the recorded source SHA-256 hashes.
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

Publication occurs only after all requested files are present, hashes prove the four originals are unchanged, schema validation reports 250 of 250 records, reconstructed provenance is unambiguous, automated tests pass, a live extraction attempt is documented truthfully, and the tracked tree contains no secrets or unrelated project references.

The handoff will include the repository URL, source hashes, validation and test results, live extractor status, and the account-permission checklist for branch protection, CODEOWNERS confirmation, Reddit follow-ups, and the separate future decision about website data consumption.
