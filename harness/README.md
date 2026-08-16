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
- `extract_bookcase.mjs` — still reconstructs bookcase inventory extraction. Not part of the recovered review workflow script; no source has surfaced for it.
- `extract_book_text.mjs` — still reconstructs single-book and bounded-inventory page-text extraction. Same as above.
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

## Insert a review model

The recovered `review_prompt.md` template expects the book as a **file the model reads**, not text pasted into the prompt — that is how the original run actually worked (each agent had a `Read` tool and was pointed at a packet file).

1. Select one canonical record from `data/master.json` for its metadata (title, byline, official page count, upload date), and decide its type: pre-classified compilation (`'c'`), periodical (`'n'`), or original work (default).
2. Run the one-book extractor to get its ordered page text, then assemble a packet file: a metadata header (title, byline, official page count, upload date, and a text-coverage note — full text or a sample) followed by the page-labeled book text. This is exactly what `review_prompt.md`'s STEP 1 describes reading.
3. Point `{{BOOK_PACKET_PATH}}` in `review_prompt.md` at that packet file, and substitute in the one type-specific block matching step 1's classification. Send the completed prompt to the model of your choice. Where supported, configure the model API for structured output using `output_schema.json`.
4. Require the response to be only the JSON object, then validate it against `output_schema.json` before mapping review fields back into a canonical record. (`{{REVIEW_OUTPUT_PATH}}` in the template only mattered for the original agent runtime's own `Write`-tool step — a direct API call can just capture the structured response and skip it.)
5. Record the model, evaluation date, hindsight cutoff, prompt revision, and any adjudication. The recovered `HINDSIGHT` block is dated "as of mid-2026" internally; a rerun with a later cutoff must replace it with a newly sourced facts block rather than silently treating it as current.

Model invocation is intentionally not bundled because providers expose different APIs and credentials. The repository does not launch or batch a model and does not automatically perform the full 214-book run.

## Current live status

On 2026-08-15, `node harness/extract_bookcase.mjs https://fliphtml5.com/bookcase/kosyg` completed successfully with exit status 0 and returned valid JSON containing 250 inventory records.
