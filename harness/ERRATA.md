# Errata — hindsight facts block

**Provenance: MAINTAINED.** This file is not a recovered or reconstructed artifact —
it is a post-hoc maintained document; see the versioning note in
[`review_prompt.md`](review_prompt.md).

This file is the evidence trail for challenges to the hindsight facts block in
[`review_prompt.md`](review_prompt.md). The verbatim v1 block in that file is a frozen
historical record and is never edited. Accepted amendments become versioned bullets in
[`hindsight.md`](hindsight.md); rejected challenges are recorded here too — the trail
only means something if it includes the challenges that didn't survive scrutiny.

Entry format: date, bullet challenged, challenge, evidence, resolution.

---

## Entry 1 — 2023 banking failures fall outside the block's scope (ACCEPTED — amendment)

- **Date:** 2026-08-16
- **Raised in:** maintainer review discussion
- **Bullet challenged:** "No systemic US market collapse occurred in 2021-22 as widely
  predicted. 2022 saw an orderly rate-hike-driven bear market. …"
- **Challenge:** SVB was one of the largest bank collapses in US history and the
  government invoked a special intervention specifically to prevent contagion — the
  block reads as if nothing near-systemic ever happened.
- **Findings:**
  - The bullet stands *as worded*: SVB failed 2023-03-10, outside the bullet's 2021-22
    window, and via duration-mismatch bank run — not the naked-shorting/FTD cascade
    mechanism the reviewed corpus predicted.
  - But the block has a real scope gap: it is silent on the March–May 2023 stress, in
    which the rate shock produced the 2nd, 3rd, and 4th largest bank failures in US
    history (First Republic ~$229B, SVB ~$209B, Signature ~$110B; ~$549B combined —
    more than all 25 banks that failed in 2008). Containment required the FDIC's
    systemic risk exception (est. $16.7B of losses absorbed that uninsured depositors
    would otherwise have borne) and the Fed's Bank Term Funding Program (Mar 2023–Mar
    2024).
  - Grading consequence: a common corpus thesis — "the Fed is trapped; hiking will
    break something" — would be graded `does_not_hold` against v1 when it deserves
    `partially_holds`. Something did break; the break was contained, was not a
    short-seller/FTD/swap cascade, did not cascade systemically, and the Fed kept
    hiking through July 2023.
  - Caveat retained: the rate shock was necessary but not sufficient for SVB —
    hundreds of banks carried underwater bond portfolios; the failures combined that
    with extreme uninsured-deposit concentration and documented supervision lapses.
- **Resolution:** v1 bullet unchanged (correct as scoped). New bullet added in v2
  covering the 2023 banking stress, with grading guidance.
- **Sources:**
  - https://www.fdic.gov/news/press-releases/2023/pr23019.html
  - https://www.congress.gov/crs-product/IF12378
  - https://www.fdic.gov/news/speeches/2024/lessons-learned-us-regional-bank-failures-2023
  - https://www.americanbanker.com/list/dramatic-collapses-made-2023-the-biggest-year-ever-for-bank-failures
  - https://www.pbs.org/newshour/amp/economy/first-republic-bank-seized-sold-to-jpmorgan-chase-in-2nd-biggest-failure-in-u-s-history

## Entry 2 — "hyperinflation did not happen" lacks context (PARTIALLY ACCEPTED — context added, causal rewording rejected)

- **Date:** 2026-08-16
- **Raised in:** maintainer review discussion
- **Bullet challenged:** "… Inflation DID surge (CPI peak 9.1% June 2022) — inflation
  predictions were directionally right; dollar hyperinflation did not happen."
- **Challenge:** proposed rewording to "dollar hyperinflation did not happen *due to
  historic central bank intervention in raising rates quickly*" — i.e., the
  non-occurrence was contingent on intervention, which the flat wording obscures.
- **Findings:**
  - **Rejected as worded:** the proposed rewording is a counterfactual, not a
    verifiable fact — the block must contain only facts. It is also a weak
    counterfactual: hyperinflation historically requires fiscal dominance and
    monetized deficits amid collapsing currency confidence; the plausible no-hike
    counterfactual for a reserve-currency economy is entrenched 1970s-style
    inflation, not Weimar.
  - **Context accepted as fact:** containing the surge required the fastest Fed
    hiking cycle since the early 1980s (525bp in ~17 months, 0–0.25% → 5.25–5.50%,
    Mar 2022–Jul 2023), and the dollar *strengthened* to a 20-year high (DXY ~114,
    late Sept 2022) during the surge — direct evidence against the corpus's usual
    causal chain ("the Fed can't hike → must print forever → dollar dies"). The
    inflation call landed; the causal model behind it failed.
- **Resolution:** v1 bullet unchanged. Context bullet added in v2 with grading
  guidance: "inflation will surge" → `holds_up`; "the Fed can't/won't raise rates"
  and "dollar collapse/hyperinflation" → `does_not_hold`.
- **Sources:**
  - https://247wallst.com/investing/2022/09/27/federal-reserve-on-fastest-rate-hiking-cycle-since-the-early-1980s-report/
  - https://capital.com/en-int/analysis/dxy-forecast
