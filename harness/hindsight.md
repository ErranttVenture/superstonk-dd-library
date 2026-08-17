# Hindsight facts — versioned ground truth

**Provenance: MAINTAINED.** This file is not a recovered or reconstructed artifact —
it is a post-hoc maintained document; see the versioning note in
[`review_prompt.md`](review_prompt.md).

The hindsight facts block is the ground truth reviewers grade DD claims and predictions
against. It is versioned:

- **v1 (frozen)** — the 15 bullets recovered verbatim in
  [`review_prompt.md`](review_prompt.md) ("Hindsight facts block"). Never edited; it is
  the historical record of what the original 214 review agents received. All 214
  original reviews were graded against v1. Not duplicated here — same anti-drift rule
  the harness uses for the rubric.
- **v2 (current, as of 2026-08-16)** — v1's 15 bullets incorporated by reference,
  unchanged, plus the amendments below, assembled under a heading re-dated from v1's
  "as of mid-2026" to "as of 2026-08-16" (versioning metadata, not a factual amendment).
  Every amendment traces to an entry in [`ERRATA.md`](ERRATA.md).

**Version stamp rule:** every future review (new book, or re-review of an existing one)
MUST record which hindsight version it was graded against. v1-graded and v2-graded
scores are not directly comparable where an amendment is load-bearing for a book's
claims; never mix them silently.

`data/schema.json` now carries the stamp: a canonical reviewed record may set an optional
top-level `hindsight_version` (pattern `^v[0-9]+$`), and a community record's
`review_provenance` block requires one. `output_schema.json` deliberately does **not** gain
the field — it is recovered verbatim from the original per-book AI review schema, and adding
to it would forfeit that provenance. A run's per-book AI output therefore still carries the
version in the run's own metadata or notes; the canonical record is where it persists.

The 214 original reviews are covered globally by the v1 statement above; do not backfill
per-record markers.

Accepted amendments never retroactively change recorded scores. A v1-graded record
changes only through the existing dispute/adjudication path — where ERRATA entries are
citable evidence — or through a recorded v2 re-review.

**Scope rule:** a bullet earns its place only if some claim in the corpus needs it to
be graded fairly. This file is not a rolling macro commentary.

## Assembling the block for a review

`ERRATA.md` is the audit trail — it is never included in a reviewer's prompt. Reviewers
receive only the assembled facts block. To run a v2-graded review, expand the
`${HINDSIGHT}` placeholder — it appears in both [`review_prompt.md`](review_prompt.md)'s
review prompt and [`calibration.md`](calibration.md)'s verify prompt — with, in order:

1. The heading line `VERIFIED HINDSIGHT FACTS (as of 2026-08-16 — treat as ground truth
   when assessing claims/predictions):`
2. The 15 v1 bullets, copied verbatim and unchanged from the "Hindsight facts block" in
   [`review_prompt.md`](review_prompt.md) (the fence's first line is the v1 heading,
   which step 1 replaces — copy the 15 bullets only).
3. The fact bullets under "v2 amendments" below — not their maintainer meta-labels —
   appended verbatim, including their grading guidance.

Record `hindsight_version: v2` alongside the model, evaluation date, and prompt revision
(see the harness [`README.md`](README.md), "Insert a review model", step 5). A review
assembled any other way must not be recorded as v2-graded.

A verify/calibration pass must expand the same assembled version as the reviews it
re-rates — never mix versions between a review and its verification — and because the
recovered `VERIFY_SCHEMA` has no version field, that version is recorded alongside the
verify outputs.

## v2 amendments

Only the fact bullets below are reviewer-facing; the meta-label above each one is
maintainer provenance and is never appended.

*Amends the scope of the 2021-22 "no systemic collapse" bullet; ERRATA entry 1.*

- 2023 banking stress: The 2022 rate shock produced the 2nd, 3rd, and 4th largest bank
  failures in US history in March–May 2023 (First Republic ~$229B, Silicon Valley Bank
  ~$209B, Signature ~$110B; ~$549B combined, exceeding all 25 bank failures of 2008
  combined). These were duration-mismatch bank runs — not short-seller, FTD, or swap
  cascades — contained via the FDIC systemic risk exception (est. $16.7B absorbed) and
  the Fed's Bank Term Funding Program (Mar 2023–Mar 2024). No broader collapse
  followed; the Fed kept hiking through July 2023. Grading: claims that rate hikes
  would "break something" → `partially_holds`; claims the break would cascade into
  systemic collapse or a GME squeeze → `does_not_hold`.

*Amends the inflation/hyperinflation bullet; ERRATA entry 2.*

- Inflation containment context: Containing the 2021-22 inflation surge required the
  fastest Fed hiking cycle since the early 1980s (525bp in ~17 months, 0–0.25% →
  5.25–5.50%); the dollar strengthened to a 20-year high (DXY ~114, Sept 2022) rather
  than debasing. Grading: "inflation will surge" → `holds_up`; "the Fed can't/won't
  raise rates" and "dollar collapse/hyperinflation" → `does_not_hold`.

## Changelog

| Version | Date | Change | Errata |
|---|---|---|---|
| v1 | (original run) | 15 bullets, recovered verbatim in `review_prompt.md` | — |
| v2 | 2026-08-16 | Added 2023 banking stress bullet; added inflation-containment context bullet; re-dated block heading "as of mid-2026" → "as of 2026-08-16" | Entries 1, 2 (heading re-date: editorial, no errata) |
