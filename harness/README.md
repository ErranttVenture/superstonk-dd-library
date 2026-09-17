# Review harness

> **Recovered.** The original July 21, 2026 review workflow script was located intact and is preserved in full outside this repository; see [`PROVENANCE.md`](PROVENANCE.md) for exactly where and how. `rubric.md`, `review_prompt.md`, `output_schema.json`, and the calibration/verify prompt in `calibration.md` are now verbatim recoveries of that script's `RUBRIC`, `reviewPrompt()`, `SCHEMA`, `verifyPrompt()`, and `VERIFY_SCHEMA` — not reconstructions. What genuinely was not preserved is narrower: the per-book input packets and the raw verify-pass outputs (see `PROVENANCE.md` for the precise scope). `extract_bookcase.mjs` and `extract_book_text.mjs` remain reconstructed, unrelated to that script.

This directory documents and supports a reproducible, model-neutral version of the review workflow. It does not automatically perform the full 214-book review.

## Recorded five-stage July method

1. **Inventory.** Programmatically collect title, byline, page count, upload date, position, and source URL for all 250 books.
2. **Text extraction.** Extract ordered, per-page text for every publication that has a text layer.
3. **Standardized review.** Send each of 214 reviewable publications to identical low-cost AI agents (Claude Haiku) with the same anchored 1–5 rubric, hindsight facts, and schema-enforced output contract.
4. **Non-reviewable handling.** Keep metadata-only rows for 8 art books and 28 image-only publications. Summarize but leave unrated the 5 reviewed books whose text is too fragmentary for a fair judgment.
5. **Calibration.** Independently re-rate every ninth reviewed book with a stronger model, adjudicate the two two-point disagreements, and record the measured drift. The stronger model rated slightly higher on average (+0.27), while Claude Haiku under-credited articles whose predictions were accurate at the time of writing. The conditional-claim adjudication described in `calibration.md` was a later August 13, 2026 follow-up rather than a silent change to the July method.

## Component status

- `review_prompt.md` — **recovered verbatim** (`reviewPrompt()`, `HINDSIGHT`, the three type-specific blocks, `RULES`), with only the two dead scratchpad file paths swapped for placeholders. See the substitution note inside the file.
- `rubric.md` — **recovered verbatim** (`RUBRIC` — both the validity axis and the evidence-quality axis the earlier reconstruction dropped entirely).
- `output_schema.json` — **recovered verbatim** (`SCHEMA`, converted to JSON Schema with property names, order, and the required-fields list unchanged).
- `calibration.md` — **hybrid.** The calibration statistics and adjudication record are drawn directly from the immutable `reports/REPORT.md`, not reconstructed guesses, and carry over unchanged. `verifyPrompt()` and `VERIFY_SCHEMA`, the prompt and schema that produced that calibration sample, are now **recovered verbatim** alongside them.
- `hindsight.md` — **maintained.** The current versioned ground truth; new reviews assemble their facts block from it. Not a recovered artifact.
- [`prompt_versions.md`](prompt_versions.md) — **maintained.** Frozen p1 references and ACTIVE p2, its packet contract and passed calibration gate (2026-09-16, 10 books, partial text). New community DDs and dispute re-ratings use p2 in the calibrated runtime below.
- [`assemble_review.mjs`](assemble_review.mjs) — **maintained.** Builds hash-verified p2 packets from preserved community copies outside the repository, assembles p1/p2 prompts from the recovered sources and `prompt_versions.md`, prints the calibrated StructuredOutput schema (`--tool-schema`) and validates a saved review output (`--validate-output`); never invokes a model.
- `ERRATA.md` — **maintained.** The audit trail of challenges to the facts block; never sent to a reviewer.
- `extract_bookcase.mjs` — still reconstructs bookcase inventory extraction. Not part of the recovered review workflow script; no source has surfaced for it.
- `extract_book_text.mjs` — still reconstructs single-book and bounded-inventory page-text extraction. Same as above. As of September 2026, `fliphtml5.com` book pages sit behind a Cloudflare bot challenge and the `online.fliphtml5.com` reader has no text layer, so live fetches return no text; `--html <file>` parses a book page saved from a browser, and markers in the current `P:NN` format are accepted.
- This `README.md` and [`PROVENANCE.md`](PROVENANCE.md) are ordinary operating documentation, written against the recovered and still-reconstructed components above.

## Node 18+ commands

Run inventory extraction against the recorded FlipHTML5 bookcase:

```powershell
node harness/extract_bookcase.mjs
```

Optionally pass another bookcase URL as the first argument. The JSON inventory is written to standard output.

Extract one publication using its canonical `url` from `data/master.json`:

```powershell
node harness/extract_book_text.mjs "https://online.fliphtml5.com/lvrgy/zzmw/"
```

The command writes a JSON object containing the source URL, `textAvailable`, and ordered page objects.

Extract every HTTP(S) `url` in a JSON-array inventory:

```powershell
node harness/extract_book_text.mjs --inventory data/master.json
```

Set an explicit concurrency from 1 through 8 when needed:

```powershell
node harness/extract_book_text.mjs --inventory data/master.json --concurrency 2
```

Inventory extraction defaults to four concurrent requests and never exceeds the selected bound. It makes one request per input item, preserves every input object and its order in the pretty-printed result array, and adds either `textAvailable` plus `pages` or an `error` message. One failed item does not stop the others: the complete array is still written to standard output, then the process exits with status 1 if any item failed. A fully successful batch exits with status 0. Keep any extracted text outside this repository.

Inventory mode only extracts text. It does not invoke a model, review a book, or perform the 214-book evaluation.

## Run a p2 review

p2 is ACTIVE for new community DDs and dispute re-ratings. Its calibrated runtime is a Claude Code workflow subagent created with `agent()` and `model: 'haiku'` (Claude Haiku 4.5). A review run anywhere else is not p2-calibrated. See [`prompt_versions.md`, "Runtime"](prompt_versions.md#runtime) for the runtime and transcript-audit requirements. Model invocation stays outside this repository.

Check the work's publication date against the current hindsight version before review. The current block is **v2**, dated **2026-08-16**. A newer work needs a newer facts version first, through [`hindsight.md`](hindsight.md) and [`ERRATA.md`](ERRATA.md); never silently replace the block or send the ERRATA audit trail to the reviewer. The assembler refuses a work published after its selected facts date.

1. **Build the packet.** Select the canonical record and an evaluation date. For a community record with `submission.preserved_text`, run from the repository root (replace the angle-bracket placeholders):

   ```text
   node harness/assemble_review.mjs --pos <n> --packet-out <absolute path> --evaluated-on <YYYY-MM-DD>
   ```

   Use a new file in an existing directory outside the repository, such as a temporary directory. The CLI verifies the copy's canonical path and SHA-256, removes the attribution through the first `---` line, and wraps the remaining Markdown body at spaces into lines of at most 500 characters, the same wrap the calibration packets used, so the reviewer's Read tool never truncates a line. Wrapping changes only line breaks. It refuses an internal output path, a missing output directory, an existing output file, a missing preserved copy or a hash mismatch.

   A preserved copy longer than 400,000 characters has no single-text packet: split it into ordered page objects at section boundaries and use `buildPacket(record, pages, { contract: 'p2', evaluatedOn })`, which keeps whole pages up to the limit and reports the rest as a sample.

   For a preserved July book re-rated through a dispute, live FlipHTML5 fetches return no text (see Component status), so save the book page from a browser and run `node harness/extract_book_text.mjs --html <saved page>`. Pass its pages to `buildPacket(record, pages, { contract: 'p2', evaluatedOn })` and write the packet outside this repository; the coverage line lists every contiguous page range, including gaps. Community records without a preserved copy use the manual capture path below.

2. **Assemble the prompt.** Use the same absolute packet path:

   ```text
   node harness/assemble_review.mjs --pos <n> --prompt p2 --hindsight v2 --packet <absolute path>
   ```

   Standard output is the assembled prompt. The assembler selects the type block from the canonical record and expands the unchanged rubric and current hindsight facts. Keep the prompt, packet and run metadata outside the repository.

3. **Run the calibrated workflow subagent.** Give the assembled prompt as its task, use `model: 'haiku'`, and set its structured-output schema to the calibrated tool schema printed by `node harness/assemble_review.mjs --tool-schema`: `output_schema.json` without its `$schema`, `$id`, `$comment` and `title` annotation keywords, exactly as the calibration run used it. It reads the packet with its Read tool and returns through StructuredOutput. Save the returned JSON and audit the transcript for the reported model (`claude-haiku-4-5-20251001`), complete packet reads, API request IDs and unexpected tool use. Record evaluation date, packet coverage, prompt and hindsight versions, runtime settings and any limitations; temperature and `max_tokens` are unavailable in this runtime. Do not treat a different runtime or model as p2-calibrated.

4. **Validate the returned result.** From the repository root, in any shell:

   ```text
   node harness/assemble_review.mjs --pos <n> --validate-output <absolute result.json path>
   ```

   It checks the saved JSON against the full `output_schema.json` with `validateAgainstSchema` from `scripts/schema-validator.mjs`, confirms that its `pos` matches the selected record, and exits nonzero with each error otherwise. Keep failed output out of the dataset; a schema-valid response alone does not establish that the text supports a fair rating.

5. **Map the reviewed result into the canonical record.** Copy every `output_schema.json` field except `pos`. Set `constituents` to `[]` when the output omits it, and set `rating_reconciled: false`. Set `review_status: "reviewed"` only on a community record; preserved records (pos 1–250) carry no `review_status`. Add `review_provenance` with `model: "claude-haiku-4-5-20251001"`, `evaluated_on` (the actual evaluation date, matching the packet), `hindsight_version: "v2"`, `prompt_revision: "p2"`, and `reviewer` (the responsible maintainer). Keep canonical metadata and the submission unchanged. A dispute re-rating of a preserved record (pos 1–250) instead sets top-level `hindsight_version` to the same version; preserve the original assessment in an `ADJUDICATED` note as [CONTRIBUTING.md](../CONTRIBUTING.md#review-and-accepted-changes) requires. Do not backfill the original 250.

   **Website first.** The justthebros importer validates every record against its vendored copy of `data/schema.json` (`scripts/vendor/dd-schema.json` in that repository) and stops the site build on a mismatch. The first unreviewable community record or preserved dispute re-rating adds fields that the vendored copy must allow, so merge the matching justthebros schema update before merging such a record.

   When a community work's text cannot support a fair rating, use `review_status: "unreviewable"`, explain why in `summary`, add no rating fields, and still add `review_provenance`. This is the unrated mapping; do not copy a forced rating from the model or fabricate a schema-valid model response. If this is a pure maintainer adjudication rather than a model review, use `review_provenance.model: "maintainer-adjudication"` as CONTRIBUTING specifies. Run `npm test` and `npm run validate` before submitting the maintainer review PR.

p1 with v1 is reserved for deliberately reproducing the July run; its recovered Write step and output-path substitution remain part of that historical procedure. Activation performs no reviews: record 251 remains pending for a later PR.

## Current live status

On 2026-08-15, `node harness/extract_bookcase.mjs https://fliphtml5.com/bookcase/kosyg` completed successfully with exit status 0 and returned valid JSON containing 250 inventory records.

## Reviewing a community submission

Community records at position 251 and above enter the dataset with `review_status: "pending"` and no rating. Their first rating is a maintainer-run review PR using ACTIVE p2 and the current hindsight version, following [Run a p2 review](#run-a-p2-review). It needs neither a rating-dispute issue nor a correction issue. The July rubric and output schema remain unchanged.

Text comes from the preserved copy when one exists. If the record has `submission.preserved_text`, use the hash-verified packet CLI above. Otherwise capture it by hand: `extract_book_text.mjs` understands FlipHTML5 only, so for a Reddit post, a Substack essay, or a hosted PDF, capture the text manually, keep it outside this repository, and record how and when it was captured. Use `buildPacket(record, text, { contract: 'p2', evaluatedOn })` for full captured text, or ordered page objects for a labeled sample, then continue at prompt assembly. The preserved-copy CLI deliberately refuses this case.

Both `reviewed` and `unreviewable` community records require `review_provenance`, using the mapping above. `npm run validate` rejects missing provenance, provenance on a pending record, a `prompt_revision` other than a review version (p1 or an unregistered version, on community records and dispute re-ratings alike), publication dates later than the stamped hindsight version, changed preserved assessments without provenance and top-level hindsight stamps, and conflicting hindsight fields. `scripts/review-versions.mjs` holds the versions and cutoff dates it checks. The current stamps are p2, v2 and `claude-haiku-4-5-20251001`; p1 was never calibrated for community works.
