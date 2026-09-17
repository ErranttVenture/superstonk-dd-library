**Provenance: MAINTAINED.** This version registry is a maintained document, not a
recovered artifact. The p1 sources remain frozen; the complete calibrated p2
prompt is recorded below.

# Review prompts — versioned instructions

## Versions and status

| Version | Status | Text and scope |
|---|---|---|
| p1 | FROZEN | [`review_prompt.md`](review_prompt.md), including its three type blocks, plus the verify prompt in [`calibration.md`](calibration.md), incorporated by reference and not duplicated here. Historical July reproduction. |
| p2 | ACTIVE | The full text below. Active for new community DDs and dispute re-ratings since [#17](https://github.com/ErranttVenture/superstonk-dd-library/pull/17) merged. The calibration gate passed on 2026-09-16 (10-book calibration on partial text); see the [Activation record](#activation-record). |

p2 is **ACTIVE** for new community DDs (pos 251 onward) and dispute re-ratings.
Use the calibrated runtime below with the current hindsight version; see
[`README.md`, "Run a p2 review"](README.md#run-a-p2-review). p1 stays **FROZEN**
and is used only for deliberate reproduction of the July run.

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
TEXT COVERAGE: <full text | sample: pages A-B[, C-D, ...] of N>
---
<text>
```

Original records: the text is the page text from `harness/extract_book_text.mjs`, with each page preceded by `[page N]`.

Community records with a preserved copy: the text is everything after the first line consisting only of `---` in `submissions/<issue>/dd.md`. Keep the Markdown headings; they serve as section labels.

Sampled coverage lists every contiguous range of included pages (for example, `sample: pages 3-13, 15-35, 37-56 of 58`), so pages missing inside the range stay visible.

Text limit: use the full text up to 400,000 characters. Past that, include whole pages up to the limit and mark the coverage as a sample.

Line width: wrap text at spaces into lines of at most 500 characters, so the reviewer's Read tool never truncates a line. Wrapping changes only line breaks; a single token longer than 500 characters is split. [`assemble_review.mjs`](assemble_review.mjs) builds packets to this contract, including community packets from preserved copies (`--packet-out`).

Never commit packets. They contain third-party text.

## Assembling a p2 review

These instructions define p2 assembly for new community DDs and dispute re-ratings,
and document the calibration assembly that preceded activation.
Model invocation remains outside the repository, per [`README.md`](README.md).

Check hindsight dating first. If the work's PUBLISHED date is later than the
hindsight block's "as of" date, do not review it yet. Publish a new hindsight
version through [`hindsight.md`](hindsight.md) and [`ERRATA.md`](ERRATA.md):
re-date the heading only after confirming the existing facts still hold, and add
amendments where the work's claims need them. Then assemble with that version.
For the calibration gate, treat v1's "as of mid-2026" as 2026-07-21, the July run
date; every calibration book predates it. `assemble_review.mjs` enforces this check
and refuses to assemble a prompt for a work published after the selected cutoff.

1. Build the packet using the contract above and keep it outside the repository, at
   an absolute path. Use the preserved community copy when it exists. Replace
   `{{BOOK_PACKET_PATH}}` with that absolute path and run the assembled prompt in the
   calibrated runtime described under "Runtime" below, where the reviewer reads the
   packet with its Read tool, as the July reviewers did.
   [`assemble_review.mjs`](assemble_review.mjs) assembles prompts and packets.
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
must come from a real model response in the calibrated runtime. If that runtime is
unavailable, skip the run, leave p2 **CANDIDATE**, open a draft PR, and make no
routing changes.

### Runtime

p2 is calibrated, and therefore run, in one runtime: a Claude Code workflow subagent
created with `agent()` and `model: 'haiku'` (Claude Haiku 4.5). The assembled prompt is
the subagent's task. The subagent reads the packet at its absolute path with its Read
tool, as the July reviewers did, and returns its assessment through the StructuredOutput
tool, which enforces `output_schema.json`. It inherits the session's default reasoning
effort. Temperature and `max_tokens` cannot be set, so run metadata records them as
unavailable. Subagent transcripts record API request IDs, and run metadata keeps them
per attempt. (Corrected after the run: this paragraph first said request IDs were not
exposed.) The subagent also has the
runtime's other tools: a post-run transcript audit records each run's tool calls,
whether it read the whole packet and the model its transcript reports, and flags any
tool use beyond reading the packet and, for the control, its Write step. A review run
in another runtime is not p2-calibrated.

### Protocol amendment (2026-09-16, recorded before any run)

The 22-book protocol could not run as designed. `fliphtml5.com` book pages sit behind
a Cloudflare bot challenge, the `online.fliphtml5.com` reader serves page images
without a text layer, and page markers changed format to `P:NN`. A maintainer saved
the book pages from a browser; `extractPageText` (which now accepts `P:NN`) parses
them. The saved pages omit each book's first two pages and last one to three pages,
seven books carry only one-line page previews, and #117 was not saved. The gate
therefore runs on the 10 books with substantive text:

**9, 18, 36, 45, 54, 63, 72, 81, 99, 108**

Excluded before the run: #27, #90, #126, #135, #144, #153 and #162 (page previews
only), #117 (not saved), and #171, #180, #189 and #198 (not saved). Every packet's
TEXT COVERAGE is a sample. This is a weaker gate than the 22-book design; a pass is
recorded as a 10-book calibration on partial text.

### Sample, inputs and calls

- Use the 10 books above. Do not substitute other records. Parse each saved page
  once. Both arms receive the same parsed page text, coverage, type classification,
  frozen rubric and hindsight **v1**, in the runtime above.
- **Control (C):** assemble p1 verbatim from `review_prompt.md`. Its packet header
  (`TITLE`, `BYLINE`, `OFFICIAL PAGE COUNT`, `UPLOAD DATE`, `TEXT COVERAGE`) is
  reconstructed from p1's description, because the July packets were not preserved;
  record that limitation in `run.json`. Substitute `{{REVIEW_OUTPUT_PATH}}` with an
  absolute path outside the repository and leave p1's STEP 2 and STEP 3 verbatim.
  The subagent's Write tool can execute that step, as in July; record whether each
  control run wrote the file. Removing that step is one of p2's intended context
  changes, so its effect belongs to the measured T − C delta.
- **Candidate (T):** assemble the exact p2 review prompt above with the p2 packet
  contract. Record the extraction date, evaluation date and per-book coverage.
- Validate every StructuredOutput response with `validateAgainstSchema`. Retry a
  failed or invalid run once; if still invalid, record the failure and exclude that
  book from both arms. Record retries, failures, exclusions and run counts. Do not
  replace an invalid output with an invented or manually repaired assessment.
- Run **3 reviews per book per arm**: **60 planned runs** for 10 books, excluding
  retries. Compute each book's median `validity_rating` and median
  `evidence_quality` separately within each arm. A book is matched only when both
  arms have three validated runs. The gate needs at least 9 matched books.

### Storage and reproducibility

Commit only model JSON and run metadata under `harness/calibration-runs/p2/`:

- `control/NNN-rK.json` and `candidate/NNN-rK.json`, with three-digit positions and
  run numbers 1–3;
- `run.json`: runtime, the model each transcript reports, effort, the StructuredOutput
  mechanism, unavailable parameters, API request IDs per attempt, run dates, hindsight v1, prompt versions, packet
  formats and delivery, the text source and extraction date, per-book coverage, prompt
  and packet SHA-256 digests, failures, retries, exclusions, control Write-step
  outcomes and the transcript audit.

Do not commit packets, extracted text, credentials or model invocation code.
Calibration and later reviews assemble prompts and packets with
[`assemble_review.mjs`](assemble_review.mjs). Keep production routing gated on
successful calibration.

### Pass criteria

All comparisons below use matched books and per-arm, per-book medians, with signed
delta **T − C**. Activation requires all four conditions, amended for the 10-book
sample (the 22-book design required at least 20 of 22 within one point and at most
two books two or more points apart):

| Measure | Required result |
|---|---|
| Mean validity delta | Within ±0.30, inclusive |
| Books with validity difference at most 1 | At least 90% of matched books (9 of 10) |
| Books with validity difference at least 2 | At most 1, with a written adjudication citing packet pages in the activation record |
| Mean evidence-quality delta | Within ±0.30, inclusive |

Report, without gating, **C vs July**, **T vs July** (validity and evidence quality),
and the counts and proportions of each `key_claims` assessment for each arm. Compute
every report-only figure from retained matched books only, so both arms cover the
same retained books and run counts: exactly three validated runs per book. Reviews
can list different numbers of claims, so each arm's `key_claims` proportions use
that arm's total assessed claims as the denominator; report those totals beside the
proportions. Valid responses from excluded books are reported separately, listed per
book and arm, and never pooled into these figures. Identify the preserved July
rating fields used in those comparisons; do not silently mix pre-adjudication
ratings with the preserved adjudicated values described in
[`calibration.md`](calibration.md).

If the gate fails, revise p2 at most **two** times, changing only framing, packet
wording or time-rule wording. Never change rubric anchors, RULES semantics or
type-block semantics to chase the numbers. Retain each attempt's text diff, results
and linked run artifacts in the activation record; do not overwrite earlier run
evidence. If still failing, stop with p2 CANDIDATE, a draft PR and no routing changes.

## Changelog

| Version | Date | Change | Rationale | Calibration link |
|---|---|---|---|---|
| p1 | 2026-07-21 (original run) | Frozen review and verify prompts incorporated by reference | Preserve the recovered July instructions | [July calibration](calibration.md) |
| p2 | 2026-09-16 | Initial candidate: living-catalog framing, packet contract, explicit time rules and JSON-only return | Support community DDs and dispute re-ratings on the same rating scale, subject to calibration | [Activation record](#activation-record) — passed 2026-09-16 (10 books, partial text) |
| p2 | On merge of #17 | Activation: route new community DDs and dispute re-ratings to p2; add provenance checks and preserved-copy packet CLI | Apply the passed calibration in its calibrated runtime, retaining original ratings | [#17](https://github.com/ErranttVenture/superstonk-dd-library/pull/17); [calibration record](#activation-record) |

## Activation record

**Verdict: PASSED — 10-book calibration on partial text.**

**Activated:** when [#17](https://github.com/ErranttVenture/superstonk-dd-library/pull/17) merged; its merge commit records the date.

An earlier attempt on 2026-09-16 could not run because no Anthropic API access was
available. The gate then ran on 2026-09-16 under the protocol amendment above, which
was committed in `cd6b59c` before any review. Runtime: Claude Code workflow subagents
(run `wf_47a3c97b-b71`); every transcript reports `claude-haiku-4-5-20251001`. Model
output is in `calibration-runs/p2/control/` and `calibration-runs/p2/candidate/`;
metadata, per-run audit and per-book figures are in
[`run.json`](calibration-runs/p2/run.json).

| Measure | Result | Required | Outcome |
|---|---|---|---|
| Matched books | 10 of 10 | At least 9 | Pass |
| Mean T − C validity | +0.00 | Within ±0.30 | Pass |
| Validity differences at most 1 | 10/10 | At least 90% of matched books | Pass |
| Validity differences of 2 or more | None | At most 1 | Pass |
| Mean T − C evidence quality | +0.20 | Within ±0.30 | Pass |

Per-book runs and medians (C = p1 control, T = p2 candidate):

| Book | Validity C | Validity T | Δ | Evidence C | Evidence T | Δ |
|---|---|---|---|---|---|---|
| 9 | 2, 2, 2 → 2 | 2, 2, 2 → 2 | 0 | 3, 3, 3 → 3 | 3, 3, 3 → 3 | 0 |
| 18 | 3, 3, 3 → 3 | 2, 2, 2 → 2 | -1 | 3, 4, 3 → 3 | 3, 3, 3 → 3 | 0 |
| 36 | 2, 2, 2 → 2 | 3, 2, 3 → 3 | +1 | 3, 3, 3 → 3 | 3, 3, 3 → 3 | 0 |
| 45 | 3, 2, 2 → 2 | 2, 3, 2 → 2 | 0 | 3, 3, 4 → 3 | 4, 3, 2 → 3 | 0 |
| 54 | 4, 3, 4 → 4 | 3, 4, 3 → 3 | -1 | 4, 4, 4 → 4 | 4, 4, 3 → 4 | 0 |
| 63 | 2, 2, 2 → 2 | 2, 2, 2 → 2 | 0 | 3, 2, 2 → 2 | 2, 3, 2 → 2 | 0 |
| 72 | 2, 2, 2 → 2 | 2, 2, 2 → 2 | 0 | 2, 2, 2 → 2 | 2, 2, 2 → 2 | 0 |
| 81 | 2, 2, 2 → 2 | 2, 2, 2 → 2 | 0 | 2, 2, 2 → 2 | 2, 3, 3 → 3 | +1 |
| 99 | 2, 2, 2 → 2 | 2, 2, 2 → 2 | 0 | 3, 3, 3 → 3 | 3, 3, 3 → 3 | 0 |
| 108 | 2, 2, 2 → 2 | 2, 3, 3 → 3 | +1 | 3, 2, 2 → 2 | 3, 3, 3 → 3 | +1 |

Report only, over the retained matched books:

- **C vs July:** mean validity +0.20, 8/10 exact, 10/10 within one point; mean evidence quality -0.10.
- **T vs July:** mean validity +0.20, 8/10 exact, 10/10 within one point; mean evidence quality +0.10.
- July fields: `validity_rating_original` where present (the pre-adjudication Haiku rating for #9 and #54), otherwise `validity_rating`; evidence quality uses `evidence_quality`.
- **key_claims, C:** 213 claims: holds_up 15.5% (33), partially_holds 23.0% (49), does_not_hold 42.7% (91), cannot_assess 18.8% (40).
- **key_claims, T:** 207 claims: holds_up 18.8% (39), partially_holds 29.0% (60), does_not_hold 41.5% (86), cannot_assess 10.6% (22).
- Proportions divide by each arm's own assessed claims. No book was excluded, so there are no excluded-book responses to report.

**Run audit.** All 60 runs returned schema-valid structured output without a workflow retry, and no book was excluded. All 60 transcript prompts match the assembled prompts, all 60 runs read the whole packet, all 30 control runs executed p1's Write step, and no run used any other tool. In 29 runs (8 control, 21 candidate), the StructuredOutput tool rejected the first submission on schema grounds, most often for more than six `topics` (24 runs). Each run resubmitted, and the accepted submission is the stored output. No revision rounds and no adjudications were needed.

**Limits.** Read these before relying on the pass:

- The sample is 10 books with partial text, below the 22-book design.
- Every subagent received the runtime's standard injected context, including the maintainer's auto-memory index, which mentions the DD library, the July review and p2's candidate status. It was identical in both arms, but the runtime description recorded before the run did not mention it.
- Temperature and `max_tokens` cannot be observed in this runtime. `run.json` keeps every attempt's API request IDs (189 across the 60 runs); the first version of the run metadata wrongly recorded them as unavailable.
- Coverage headers for #45, #99 and #108 gave only the first and last included page, not the pages missing inside that range (#45: 2; #99: 14, 36; #108: 6, 33, 34, 39, 57, 58). Both arms saw identical headers, so the T − C comparison is unaffected, but those reviewers were not told about the gaps. `assemble_review.mjs` now lists every contiguous range, and `run.json` records the missing pages.
- The evidence-quality delta of +0.20 is within the limit, not far from it.
- Candidate runs needed a schema resubmission more often (21 vs 8). Every final output was valid, but first-try conformance was worse.
- Candidate runs marked fewer claims `cannot_assess` (10.6% vs 18.8%). Watch this in activated reviews.

**Activation changes.** p2 is ACTIVE for new community DDs and dispute re-ratings. `README.md` and `CONTRIBUTING.md` route those reviews through the calibrated runtime, schema validation and explicit record mapping. Repository validation enforces provenance, review prompt versions and hindsight stamps from `scripts/review-versions.mjs`; the assembler CLI builds hash-verified community packets outside the repository with the calibrated line wrap, prints the calibrated StructuredOutput schema and validates review output. The justthebros importer's vendored schema must accept the new optional provenance fields before the first unreviewable community record or dispute re-rating merges. Activation changes no original ratings, record 251, hindsight facts or calibration artifacts, and runs no reviews.
