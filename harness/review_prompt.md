# Review prompt template

> **Recovered verbatim.** This is `reviewPrompt()` from the original review workflow script — the exact prompt every one of the 214 per-book Haiku agents received. See [`PROVENANCE.md`](PROVENANCE.md) for where it was recovered from. The prior version of this file was an inferred, model-neutral paraphrase; it dropped 9 of 15 hindsight facts (including every concession that a prediction was directionally right), invented hindsight numbers that don't match the original, and omitted the honesty-labeling half of the validity rubric entirely.

> **Versioning note.** The hindsight facts block below is **v1** — the frozen
> historical record of what the original 214 reviewers received. The current graded
> ground truth for any future review is [`hindsight.md`](hindsight.md); challenges and
> amendments are tracked in [`ERRATA.md`](ERRATA.md). Nothing in the verbatim blocks
> of this file is ever edited.

## Placeholder substitution

The original template hardcoded two scratchpad file paths that no longer exist, since the per-book input packets were not preserved:

- `${S}/packets/${pad}.txt` (the input packet the agent reads) → `{{BOOK_PACKET_PATH}}`
- `${S}/reviews/${pad}.json` (where the agent wrote its own JSON output) → `{{REVIEW_OUTPUT_PATH}}`

`${pad}` was `String(pos).padStart(3, '0')` — the book's position zero-padded to 3 digits (e.g. book 9 → `009`). Every other character below, including the literal `${p}` in "pos: set to ${p}." and the placement markers `${typeBlock}`/`${HINDSIGHT}`/`${RUBRIC}`, is preserved exactly as it appeared in the original template source. `${p}` is the book's plain (non-padded) position number.

## Prompt template (verbatim, with the substitution above)

```
You are one reviewer in a 214-book standardized review of the "SuperStonk Library" — a public FlipHTML5 bookcase of GameStop (GME) "due diligence" (DD) articles compiled from Reddit r/Superstonk, mostly 2020-2023. You review EXACTLY ONE book. Other agents review the others with this same rubric — follow it exactly so results are comparable.

STEP 1 — Read the file: {{BOOK_PACKET_PATH}}
It contains a metadata header (title, byline, official page count, upload date, text coverage note) followed by the book text labeled by page number. The TEXT COVERAGE line tells you if you have full text or a sample — factor that into 'confidence'.

${typeBlock}

${HINDSIGHT}

${RUBRIC}

RULES:
- Judge only what is in the packet text. Never invent content you did not see.
- key_claims: 3-8 of the book's most load-bearing claims. State each AS a claim ("Claims that..."). Classify kind (verifiable_fact / speculation / prediction) and assess against the hindsight facts (holds_up / partially_holds / does_not_hold / cannot_assess). Use notes to cite page numbers.
- summary: neutral, descriptive, 80-150 words. Describe what the book argues; do not editorialize there — your judgment belongs in ratings and rationale.
- validity_rating and evidence_quality: integers per the anchors. Do not grade on a curve; use the anchors literally.
- pos: set to ${p}.

STEP 2 — Using the Write tool, write your COMPLETE assessment object as JSON to: {{REVIEW_OUTPUT_PATH}} (this is REQUIRED, do it before returning).

STEP 3 — Return the same object via structured output.
```

`${RUBRIC}` is populated by both anchor scales recovered in [`rubric.md`](rubric.md) — not duplicated here to avoid drift between the two copies. `${typeBlock}` and `${HINDSIGHT}` are expanded verbatim below.

## Type-specific blocks (verbatim)

Exactly one of these three is substituted for `${typeBlock}`, based on how the book was pre-classified before review.

### Compilation (`t === 'c'`)

```
This book is PRE-CLASSIFIED AS A COMPILATION (multiple bundled articles/posts, possibly by multiple authors). You MUST: (a) set is_compilation=true unless the text clearly shows a single continuous work, (b) list the major constituent articles you can identify in constituents[] (up to 12, with authors where visible), (c) set quality_variance to 'uniform' or 'mixed', (d) make key_claims cover the collection's dominant claims across constituents, not just the first article, (e) rate validity for the collection as a whole.
```

### Periodical (`t === 'n'`)

```
This book is a PERIODICAL (community news digest). Set content_type=periodical_news. Rate validity as the factual accuracy of its reporting/summaries, not the strength of an argument. quality_variance='na' unless it bundles distinct articles of varying rigor.
```

### Original work (default — anything not pre-classified as `'c'` or `'n'`)

```
This book is pre-classified as a single original work. Set is_compilation=false unless the text clearly shows it is actually a bundle of separate posts; quality_variance='na' for single works.
```

## Hindsight facts block (verbatim)

This is the complete, unedited `HINDSIGHT` constant — all 15 bullets, supplied to every reviewer as the ground truth to assess claims/predictions against. It deliberately concedes where speculative claims turned out directionally right (inflation, Credit Suisse) alongside where they didn't, and states plainly that FTDs and naked shorting are real, documented phenomena — it is not a one-sided debunking brief.

```
VERIFIED HINDSIGHT FACTS (as of mid-2026 — treat as ground truth when assessing claims/predictions):
- No "MOASS" (Mother of All Short Squeezes) ever occurred. GME peaked at ~$483 intraday Jan 28, 2021 (pre-split; ~$120 split-adjusted); a May-June 2024 rally peaked ~$65. Prices of thousands or millions per share never happened.
- GameStop did a 4-for-1 stock split (via dividend) in July 2022.
- The SEC's October 2021 staff report on the January 2021 event concluded the run-up was driven mainly by positive-sentiment buying, NOT primarily by short covering, and found no evidence that widespread naked shorting drove the price.
- Reported short interest fell from ~122% of float (Jan 2021) to ~20% by Feb 2021 and stayed low. Claims of persistent hidden short interest of 100%-1000%+ of float were never substantiated by any regulator through 2026.
- Citadel was never margin-called into collapse; Citadel Securities remains a major market maker.
- Direct registration (DRS/Computershare) grew to ~75M shares (~25% of float) by mid-2023, then plateaued; GameStop stopped detailed DRS reporting in 2024. DRS did not trigger a squeeze.
- No systemic US market collapse occurred in 2021-22 as widely predicted. 2022 saw an orderly rate-hike-driven bear market. Inflation DID surge (CPI peak 9.1% June 2022) — inflation predictions were directionally right; dollar hyperinflation did not happen.
- The Fed reverse repo facility peaked ~$2.55T (Dec 2022) then drained to near zero by 2025 without crisis.
- Evergrande defaulted (Dec 2021) and was ordered liquidated (Jan 2024); no global cascade into US markets resulted.
- Credit Suisse did collapse (Mar 2023, UBS rescue) — claims of CS fragility were directionally right, though not via GME.
- Archegos (Mar 2021) was a real swaps blow-up and led to SEC swap-disclosure rule proposals.
- Payment for order flow (PFOF) conflicts of interest are real and documented; the EU banned PFOF (phase-out by 2026); Robinhood paid fines over order-flow practices.
- Fails-to-deliver (FTDs) and naked shorting are real, documented market phenomena historically, but the predicted GME FTD/T+21/T+35 "cycle" squeezes repeatedly failed to materialize on the predicted dates.
- GameStop: launched an NFT marketplace in 2022, shut it down in 2024; returned to profitability 2023-24; raised billions in 2024 share offerings; holds a large cash reserve and added bitcoin to its treasury in 2025. No bankruptcy; no price "moon".
- DTCC/NSCC/OCC continue operating normally; no "great reset" of the US financial system occurred.
```
