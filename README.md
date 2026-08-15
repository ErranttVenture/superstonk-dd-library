# SuperStonk DD Library Review

This repository publishes an independent review of 250 books and 6,821 pages from the SuperStonk Library so readers can inspect what held up, what did not, and why. It is an **AI-assisted**, **human-directed** community audit layer—not a verdict machine—and is designed to make the evidence, uncertainty, and review process open to challenge.

<details>
<summary>Methodology</summary>

The July 21, 2026 review used one consistent five-step method:

1. **Inventory:** collect title, byline, page count, upload date, position, and source URL for all 250 books.
2. **Text extraction:** extract ordered page text wherever a publication had a usable text layer.
3. **Standardized review:** send each of 214 reviewable publications to identical low-cost AI agents using the same anchored 1–5 rubric, hindsight-fact packet, and structured output contract.
4. **Non-reviewable handling:** retain metadata for art and image-only publications, and leave fragmentary-text books unrated rather than force a judgment.
5. **Calibration and adjudication:** re-rate every ninth reviewed book with a stronger model, adjudicate the two two-point disagreements, and preserve the later conditional-claim review.

The rating anchors run from 5 (factually accurate; predictions largely came true) through 1 (core claims falsified or purely conspiratorial). Calibration produced 12/22 exact matches and 20/22 within ±1; the stronger model rated slightly higher on average (+0.27). The recorded bias was that Claude Haiku under-credited articles whose predictions were accurate at the time of writing. Disagreements at #9 and #180 were adjudicated in favor of the stronger model, and an August 13, 2026 conditional-claim pass corrected claims whose trigger condition never occurred. Adjudicated records retain an `ADJUDICATED` note.

Read the [full preserved report](reports/REPORT.md) for results and the [review harness documentation](harness/README.md) for the reconstructed workflow, rubric, calibration notes, prompt, and output contract.

</details>

## Start here

The strongest place to begin is the market-structure cluster by u/dlauer. These six pieces are grounded in documented mechanics and regulatory history:

- [#53 — Dark Pools, Price Discovery, and Short Selling/Marking](https://online.fliphtml5.com/lvrgy/bmee/)
- [#54 — FINRA Series by dlauer](https://online.fliphtml5.com/lvrgy/glgr/)
- [#55 — On Glitches / Odd Lots](https://online.fliphtml5.com/lvrgy/wqzl/)
- [#56 — Citadel's Lawsuit Against the SEC Over IEX's D-Limit Order Type](https://online.fliphtml5.com/lvrgy/izbt/)
- [#57 — Order Routing Inducements](https://online.fliphtml5.com/lvrgy/vzem/)
- [#58 — Self Regulation, Complexity and Market Structure](https://online.fliphtml5.com/lvrgy/fdie/)

Two other useful entry points are [#9 — GME DD: One DD To Rule Them All](https://online.fliphtml5.com/lvrgy/zzmw/), an early pre-squeeze thesis whose central timing and price-direction calls were largely vindicated, and [#40 — Swapping Regulations for Offshore Risk](https://online.fliphtml5.com/lvrgy/ongz/), a source-grounded account of cross-border swaps regulation.

The original review's validity distribution is:

| Validity | Books | Share of reviewed |
|---|---:|---:|
| 4 — Mostly accurate / directionally right | 11 | 5% |
| 3 — Mixed: real data, unproven leaps | 25 | 12% |
| 2 — Speculation-dominated / failed predictions | 166 | 79% |
| 1 — Falsified or conspiratorial | 7 | 3% |

For every other rating, open the matching record in [`data/master.json`](data/master.json) and follow its `url` field to the primary-source publication before evaluating the review. The full narrative findings remain in [`reports/REPORT.md`](reports/REPORT.md).

## What a rating means — and does not mean

A validity rating measures whether a book's factual claims, predictions, and central thesis held up against the documented record. A 4 means primary-source grounding supports the core thesis and hindsight has not falsified it; a 2 means speculation or failed predictions dominate. The full anchors are in the [rubric](harness/rubric.md).

It does **not** rate the author, the community, writing quality, originality, or usefulness to a reader. It also does not yet separately score source-characterization accuracy or a book's educational value despite a weak predictive thesis.

Community feedback identified two explicit roadmap axes:

- **Source-characterization accuracy**, credited to u/writerofjots: audit whether the review represents what each cited source actually says, independently of whether the book's thesis held up.
- **Educational value**, credited to u/humdingler: assess whether a work clearly teaches useful concepts even when some conclusions are speculative or later falsified.

These future dimensions should supplement the preserved validity assessment, not silently rewrite it.

## Dispute a rating

Disagreement is part of the audit. Read the [contribution and right-of-reply policy](CONTRIBUTING.md), then [open a rating dispute](https://github.com/ErranttVenture/superstonk-dd-library/issues/new?template=dispute-rating.yml) with the book, disputed assessment, primary-source evidence, and proposed change. Authors have an unconditional right of reply through the canonical `author_response` field whether or not a rating changes.

## Re-run the evaluation

The [`harness/`](harness/README.md) directory documents how to inventory the bookcase, extract one publication or a bounded JSON inventory, construct the review packet, validate model output, and record a rerun with another model. Model invocation is deliberately provider-neutral, and the full 214-book review is not launched automatically.

## Licensing

Executable code and tooling are available under the [MIT License](LICENSE). The immutable baseline, evolving canonical review data, flat export, and reports are available under [CC BY-SA 4.0](LICENSE-DATA), so published adaptations remain available under the same terms.

The original FlipHTML5 book text is excluded from this repository. Those publications remain the work of their authors; they are neither relicensed nor redistributed here. Canonical records contain source URLs so readers can inspect the publications at their original locations.

## Provenance

Four immutable original artifacts—[`reports/REPORT.md`](reports/REPORT.md), [`reports/BOOKS.md`](reports/BOOKS.md), [`data/library_review.csv`](data/library_review.csv), and [`data/original-master.json`](data/original-master.json)—preserve the July 21, 2026 review with the August 13, 2026 conditional-claim adjudication incorporated. The baseline JSON is hash-locked and must never change.

[`data/master.json`](data/master.json) is the evolving canonical current dataset for consumers, raw-data links, accepted disputes, corrections, and author replies. At initial publication it is byte-for-byte identical to `data/original-master.json`; future governed adjudications may change only `master.json` while the baseline continues to prove the launch state.

The temporary scripts and frozen prompt used for the original run were not preserved. Every replacement under [`harness/`](harness/README.md) is prominently labeled **RECONSTRUCTED**: it is a faithful working reconstruction based on the original report and canonical data, not a recovered original.
