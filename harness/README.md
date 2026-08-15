# RECONSTRUCTED review harness

> **RECONSTRUCTED:** The original July 21, 2026 harness was not preserved. Every component shipped here is a reconstruction from the preserved report and canonical data, not a verbatim recovery.

This directory documents and supports a reproducible, model-neutral version of the review workflow. It does not automatically perform the full 214-book review.

## Recorded five-stage July method

1. **Inventory.** Programmatically collect title, byline, page count, upload date, position, and source URL for all 250 books.
2. **Text extraction.** Extract ordered, per-page text for every publication that has a text layer.
3. **Standardized review.** Send each of 214 reviewable publications to identical low-cost AI agents (Claude Haiku) with the same anchored 1–5 rubric, hindsight facts, and schema-enforced output contract.
4. **Non-reviewable handling.** Keep metadata-only rows for 8 art books and 28 image-only publications. Summarize but leave unrated the 5 reviewed books whose text is too fragmentary for a fair judgment.
5. **Calibration.** Independently re-rate every ninth reviewed book with a stronger model, adjudicate the two two-point disagreements, and record the measured drift. The stronger model rated slightly higher on average (+0.27), while Claude Haiku under-credited articles whose predictions were accurate at the time of writing. The conditional-claim adjudication described in `calibration.md` was a later August 13, 2026 follow-up rather than a silent change to the July method.

## RECONSTRUCTED components

- `extract_bookcase.mjs` reconstructs bookcase inventory extraction.
- `extract_book_text.mjs` reconstructs one-book page-text extraction.
- `review_prompt.md` reconstructs a model-neutral review packet.
- `rubric.md` reconstructs the report's anchored validity scale.
- `calibration.md` reconstructs the reported calibration and adjudication record.
- `output_schema.json` reconstructs the review-stage JSON contract from canonical records.
- This `README.md` is reconstructed operating documentation.

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

The command writes a JSON object containing the source URL, `textAvailable`, and ordered page objects. It performs one-book extraction only.

## Insert a review model

1. Select one canonical record from `data/master.json`. Put its inventory metadata into `{{BOOK_METADATA}}` in `review_prompt.md`.
2. Run the one-book extractor and put its ordered page text into `{{BOOK_TEXT}}`.
3. Send the completed prompt to the model of your choice. Where supported, configure the model API for structured output using `output_schema.json`.
4. Require the response to be only the JSON object, then validate it against `output_schema.json` before mapping review fields back into a canonical record.
5. Record the model, evaluation date, hindsight cutoff, prompt revision, and any adjudication. A rerun must replace or explicitly time-bound the reconstructed hindsight facts.

Model invocation is intentionally not bundled because providers expose different APIs and credentials. The repository does not launch or batch a model and does not automatically perform the full 214-book run.

## Current live status

On 2026-08-15, `node harness/extract_bookcase.mjs https://fliphtml5.com/bookcase/kosyg` completed successfully with exit status 0 and returned valid JSON containing 250 inventory records.
