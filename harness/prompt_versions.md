**Provenance: MAINTAINED.** This version registry is a maintained document, not a
recovered artifact. The p1 sources remain frozen; the complete p2 calibration
candidate is recorded below.

# Review prompts — versioned instructions

## Versions and status

| Version | Status | Text and scope |
|---|---|---|
| p1 | FROZEN | [`review_prompt.md`](review_prompt.md), including its three type blocks, plus the verify prompt in [`calibration.md`](calibration.md), incorporated by reference and not duplicated here. Historical July reproduction. |
| p2 | CANDIDATE | The full text below. Intended for new community DDs and dispute re-ratings only, after the calibration gate passes. See the [Activation record](#activation-record). |

p2 becomes **ACTIVE** only after the gate below passes and its measured results
and calibration run are linked here. Until then, this document does not route
current reviews to p2. There is no active living prompt yet.

Once a version is superseded, retain its full text here and mark it **FROZEN**;
never silently replace it. p1 remains incorporated by reference to its frozen
sources. Log candidate revision attempts, their exact diffs and results in the
activation record before changing the candidate text.

The original 250 retain their July ratings. This change does not re-rate or edit
any record in `data/master.json`, including pending community record 251.
Future dispute re-ratings require their own review and provenance. The rubric
anchors, output schema, type-block semantics and RULES semantics are unchanged.
The context changes are the corpus framing, packet contract, explicit time rules
and removal of the original agent-runtime output-writing step.

## p2 review prompt

This is the exact initial calibration candidate. `${RUBRIC}` refers to the frozen
anchor text in [`rubric.md`](rubric.md); do not duplicate or edit the anchors here.

```
You are one reviewer for the DD Library, a public, continuously updated catalog of "due diligence" (DD) research on market structure, GameStop (GME), and related topics. It includes the original SuperStonk Library (mostly r/Superstonk posts from 2020-2023) and newer works submitted by the community. You review EXACTLY ONE work. Every work in the library is rated with this same rubric — follow it exactly so results are comparable across works and years.

STEP 1 — Read the file: {{BOOK_PACKET_PATH}}
It contains a metadata header (title, byline, platform, publication date, page count or "n/a", evaluation date, text coverage note) followed by the work's text labeled by page number or by section. The TEXT COVERAGE line tells you if you have full text or a sample — factor that into 'confidence'.

${typeBlock}

${HINDSIGHT}

${RUBRIC}

TIME RULES:
- The hindsight facts are current as of their heading. The work was published on the PUBLISHED date in the packet header.
- A prediction whose deadline or trigger has not arrived by the hindsight date, or a claim about events after that date, is cannot_assess. It counts neither for nor against validity_rating.
- An if/then claim whose trigger never occurred is cannot_assess, not does_not_hold.
- If most load-bearing claims are cannot_assess, rate validity_rating on the factual claims, the accuracy of the market mechanics described, and whether speculation is labeled, and lower 'confidence'.

RULES:
- Judge only what is in the packet text. Never invent content you did not see.
- key_claims: 3-8 of the work's most load-bearing claims. State each AS a claim ("Claims that..."). Classify kind (verifiable_fact / speculation / prediction) and assess against the hindsight facts (holds_up / partially_holds / does_not_hold / cannot_assess). Use notes to cite page numbers or section headings.
- summary: neutral, descriptive, 80-150 words. Describe what the work argues; do not editorialize there — your judgment belongs in ratings and rationale.
- validity_rating and evidence_quality: integers per the anchors. Do not grade on a curve; use the anchors literally.
- pos: set to ${p}.

Return your COMPLETE assessment object as JSON matching the output schema, and nothing else.
```

## p2 verify prompt

```
Calibration check for the DD Library. Independently rate ONE work — do NOT look at any existing review files; form your own judgment.
Read the file: {{BOOK_PACKET_PATH}} (metadata header + page- or section-labeled text).
${HINDSIGHT}
${RUBRIC}
${TIME_RULES}
Rate validity_rating and evidence_quality per the anchors, with a 2-3 sentence rationale. Set pos=${p}. Return the JSON object only, matching the verify schema.
```

`${TIME_RULES}` expands to the TIME RULES block above, word for word. The verify pass uses `VERIFY_SCHEMA` from [`calibration.md`](calibration.md), unchanged.

## p2 type blocks

Use p1's three blocks from [`review_prompt.md`](review_prompt.md) with exactly one edit: replace the word "book" with "work". Make no other change.

Substitute exactly one block for `${typeBlock}`, using the work's pre-classification.

### Compilation (`t === 'c'`)

```
This work is PRE-CLASSIFIED AS A COMPILATION (multiple bundled articles/posts, possibly by multiple authors). You MUST: (a) set is_compilation=true unless the text clearly shows a single continuous work, (b) list the major constituent articles you can identify in constituents[] (up to 12, with authors where visible), (c) set quality_variance to 'uniform' or 'mixed', (d) make key_claims cover the collection's dominant claims across constituents, not just the first article, (e) rate validity for the collection as a whole.
```

### Periodical (`t === 'n'`)

```
This work is a PERIODICAL (community news digest). Set content_type=periodical_news. Rate validity as the factual accuracy of its reporting/summaries, not the strength of an argument. quality_variance='na' unless it bundles distinct articles of varying rigor.
```

### Original work (default — anything not pre-classified as `'c'` or `'n'`)

```
This work is pre-classified as a single original work. Set is_compilation=false unless the text clearly shows it is actually a bundle of separate posts; quality_variance='na' for single works.
```

## p2 packet contract

```
TITLE: <title>
BYLINE: <byline>
PLATFORM: <FlipHTML5 for original records; the submission platform for community records>
PUBLISHED: <YYYY-MM-DD; original records use their `uploaded` date>
PAGES: <integer, or n/a>
EVALUATED ON: <YYYY-MM-DD>
TEXT COVERAGE: <full text | sample: pages A-B of N>
---
<text>
```

Original records: the text is the page text from `harness/extract_book_text.mjs`, with each page preceded by `[page N]`.

Community records with a preserved copy: the text is everything after the first line consisting only of `---` in `submissions/<issue>/dd.md`. Keep the Markdown headings; they serve as section labels.

Text limit: use the full text up to 400,000 characters. Past that, include whole pages up to the limit and mark the coverage as a sample.

Never commit packets. They contain third-party text.

## Assembling a p2 review

These instructions define candidate assembly for calibration and, **after
activation**, new community DDs and dispute re-ratings. They do not activate p2.
Model invocation remains outside the repository, per [`README.md`](README.md).

Check hindsight dating first. If the work's PUBLISHED date is later than the
hindsight block's "as of" date, do not review it yet. Publish a new hindsight
version through [`hindsight.md`](hindsight.md) and [`ERRATA.md`](ERRATA.md):
re-date the heading only after confirming the existing facts still hold, and add
amendments where the work's claims need them. Then assemble with that version.
For the calibration gate, treat v1's "as of mid-2026" as 2026-07-21, the July run
date; every calibration book predates it.

1. Build the packet using the contract above and keep it outside the repository.
   Use the preserved community copy when it exists. Deliver the packet and prompt
   together in one user message with two text blocks, in this order: the line
   `FILE: packets/NNN.txt` followed by the complete packet, then the assembled
   prompt. Replace `{{BOOK_PACKET_PATH}}` with that same `packets/NNN.txt` label,
   where `NNN` is the three-digit position. Provide no tools, other than the single
   forced output tool if that is how the API enforces structured output. Enforce the
   output schema through that structured-output mechanism and record which mechanism
   was used.
2. Expand `${typeBlock}` with exactly one p2 block. Set `${p}` to `record.pos`, a
   plain integer, not a zero-padded filename. The verify prompt has no type block.
3. Expand `${RUBRIC}` with the complete verbatim anchor block from
   [`rubric.md`](rubric.md), including both validity and evidence quality.
4. Expand `${HINDSIGHT}` with the current hindsight version, assembled exactly as
   [`hindsight.md`, "Assembling the block for a review"](hindsight.md#assembling-the-block-for-a-review)
   instructs. Do not include `ERRATA.md` or change any facts. The calibration gate is
   the one exception: both arms use the frozen **v1** block in
   [`review_prompt.md`](review_prompt.md), including its heading, so that prompt
   context is the only treatment.
5. For a verify pass, expand `${TIME_RULES}` with `TIME RULES:` and its four bullets
   from the review prompt, word for word. Use the same hindsight version as the
   review being verified. Use the unchanged `VERIFY_SCHEMA` in
   [`calibration.md`](calibration.md#verify_schema-verbatim). The activation gate
   below instead uses **full reviews in both arms**, with `output_schema.json`.
6. Enforce [`output_schema.json`](output_schema.json) for a review and validate the
   returned object with `validateAgainstSchema` from
   [`scripts/schema-validator.mjs`](../scripts/schema-validator.mjs). Neither
   recovered output schema gains provenance fields.
7. Stamp every future canonical review with `review_provenance`: `model`,
   `evaluated_on`, `hindsight_version`, `prompt_revision` and `reviewer`. Set
   `prompt_revision` to the prompt version: `p2`, or `p1` for deliberate historical
   reproduction, and never a file or commit reference; `data/schema.json` enforces
   `^p[0-9]+$`. Set `hindsight_version` to the version the review was assembled with:
   the current hindsight version for current reviews, and `v1` in calibration run
   metadata. Store version stamps alongside raw model output in run metadata, not
   inside the frozen output object. For a future re-rating of a
   preserved record, also set top-level `hindsight_version`; when both hindsight
   fields are present, they must match. Do not backfill the original records or
   write calibration results into the dataset.

## Calibration gate

Never fabricate, simulate or hand-write model outputs. Every stored model output
must come from a real Anthropic API response. If that API is unavailable, skip the
run, leave p2 **CANDIDATE**, open a draft PR, and make no routing changes.

### Sample, inputs and calls

- Select the records in `data/master.json` that carry a `calibration` object:
  **9, 18, 27, 36, 45, 54, 63, 72, 81, 90, 99, 108, 117, 126, 135, 144, 153,
  162, 171, 180, 189, 198**. Do not substitute other records. If extraction fails,
  report each failure and exclude that book.
- Extract each book once. Both arms receive the same selected page text, coverage,
  type classification, frozen rubric and hindsight **v1**, delivered identically as
  in step 1 of "Assembling a p2 review", with the same structured-output mechanism
  and no other tools.
- **Control (C):** assemble p1 verbatim from `review_prompt.md`. Reconstruct its
  packet header with `TITLE`, `BYLINE`, `OFFICIAL PAGE COUNT`, `UPLOAD DATE` and
  `TEXT COVERAGE`, followed by page-labeled text. **This header is a reconstruction:
  the July packets were not preserved.** Record that limitation in `run.json`.
  Substitute `{{REVIEW_OUTPUT_PATH}}` with `reviews/NNN.json` and leave p1's STEP 2
  and STEP 3 verbatim. With no Write tool available, the model cannot execute that
  step; record it in `run.json` as a control-only limitation. Removing that step is
  one of p2's intended context changes, so its effect belongs to the measured T − C
  delta.
- **Candidate (T):** assemble the exact p2 review prompt above with the p2 packet
  contract. Record the extraction date, evaluation date and per-book coverage.
- Use **`claude-haiku-4-5-20251001`**, identical parameters for every call and the
  **API default temperature** (omit the temperature parameter; record that choice).
  Select and record one `max_tokens` value before running and retain it across both
  arms and retries. No parameter values have been used in the unrun gate below.
- Force structured output with `output_schema.json`, then validate every response
  with `validateAgainstSchema`. Retry an invalid response once; if still invalid,
  record the failure and exclude that book from both arms. Record retries, failures,
  exclusions and actual API call counts. Do not replace an invalid output with an
  invented or manually repaired assessment.
- Run **3 reviews per book per arm**: **132 planned calls** for 22 books, excluding
  retries. Compute each book's median `validity_rating` and median
  `evidence_quality` separately within each arm. A book is matched only when both
  arms have three validated runs. Extraction and response exclusions share one
  floor: the gate needs at least 18 matched books.

### Storage and reproducibility

Commit only model JSON and run metadata under `harness/calibration-runs/p2/`:

- `control/NNN-rK.json` and `candidate/NNN-rK.json`, with three-digit positions and
  run numbers 1–3;
- `run.json`: model ID, `max_tokens`, API-default temperature, other parameters,
  structured-output mechanism, run dates, hindsight v1, prompt versions, packet
  formats and delivery, extraction date, per-book coverage, failures, retries,
  exclusions, the control-only Write-step limitation and API request IDs where
  available.

Do not commit packets, extracted text, credentials or model invocation code.
The model-neutral `harness/assemble_review.mjs` is deferred in this candidate-only
PR. Prepare it for the calibration run so that calibration and later reviews use
the same assembly; unknown prompt or hindsight versions must throw. Its required
interfaces are `buildPacket(record, text, { contract, evaluatedOn })` and
`assemblePrompt({ promptVersion, hindsightVersion, record, packetPath, kind })`,
with a CLI that prints the assembled prompt for a position. Keep production routing
gated on successful calibration.

### Pass criteria

All comparisons below use matched books and per-arm, per-book medians, with signed
delta **T − C**. Activation requires all four conditions:

| Measure | Required result |
|---|---|
| Mean validity delta | Within ±0.30, inclusive |
| Books with validity difference at most 1 | At least 20 of 22; at least 91% if fewer books ran |
| Books with validity difference at least 2 | At most 2, each with a written adjudication citing packet pages in the activation record |
| Mean evidence-quality delta | Within ±0.30, inclusive |

Report, without gating, **C vs July**, **T vs July** (validity and evidence quality),
and the counts and proportions of each `key_claims` assessment for each arm across
all valid runs. Identify the preserved July rating fields used in those comparisons;
do not silently mix pre-adjudication ratings with the preserved adjudicated values
described in [`calibration.md`](calibration.md).

If the gate fails, revise p2 at most **two** times, changing only framing, packet
wording or time-rule wording. Never change rubric anchors, RULES semantics or
type-block semantics to chase the numbers. Retain each attempt's text diff, results
and linked run artifacts in the activation record; do not overwrite earlier run
evidence. If still failing, stop with p2 CANDIDATE, a draft PR and no routing changes.

## Changelog

| Version | Date | Change | Rationale | Calibration link |
|---|---|---|---|---|
| p1 | 2026-07-21 (original run) | Frozen review and verify prompts incorporated by reference | Preserve the recovered July instructions | [July calibration](calibration.md) |
| p2 | 2026-09-16 | Initial candidate: living-catalog framing, packet contract, explicit time rules and JSON-only return | Support community DDs and dispute re-ratings on the same rating scale, subject to calibration | [Activation record](#activation-record) — not run |

## Activation record

**Verdict: NOT RUN — p2 remains CANDIDATE.**

On 2026-09-16, no Anthropic API credential was available in the execution environment
and no Anthropic API connector was available. Calibration was skipped under the
specified fallback. No API request was attempted and no model output was created.
There is no calibration run to link; no `run.json` or model JSON is represented as
having been produced.

| Measure | Result | Gate or reporting role |
|---|---|---|
| Matched books with completed triplets | 0 of 22 planned | No measured medians |
| Mean T − C validity | N/A — not run | Must be within ±0.30 |
| T vs C validity differences at most 1 | N/A — not run | At least 20/22 (91% for a reduced sample) |
| T vs C validity differences at least 2 | N/A — not run | At most 2, each adjudicated with packet pages |
| Mean T − C evidence quality | N/A — not run | Must be within ±0.30 |
| C vs July validity and evidence quality | N/A — not run | Report only |
| T vs July validity and evidence quality | N/A — not run | Report only |
| C key_claims assessment distribution | N/A — not run | Report only |
| T key_claims assessment distribution | N/A — not run | Report only |

API calls: **0** (132 planned before retries). Extractions attempted: **0**.
Extraction failures: **none observed; extraction was not attempted**. API or response
validation failures: **none observed; no requests were made**. Model, `max_tokens`,
temperature and API request IDs actually used: **N/A**. Revision rounds: **0**;
candidate text diffs: **none**. No adjudications are claimed.

**Maintainer work remaining:** run the gate with authenticated Anthropic API access
and the shared model-neutral assembler, commit the real outputs and run metadata,
fill in the results and any required page-cited adjudications, and link the run here.
Only after a pass, mark p2 ACTIVE and complete the gated schema, invariants, version
stamping, assembler CLI tests and README/CONTRIBUTING routing changes. The original
ratings, record 251, hindsight facts and current review routing remain unchanged
in this draft.
