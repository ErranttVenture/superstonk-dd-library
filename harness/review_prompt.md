# RECONSTRUCTED review prompt template

> **RECONSTRUCTED:** The original July 21, 2026 review prompt was not preserved. This model-neutral template is inferred from `reports/REPORT.md`, `data/master.json`, and the canonical schemas; it is not a verbatim recovery.

## Role and evaluation date

Act as an independent reviewer of one publication from the SuperStonk library. Evaluate the publication against the documented record available through **July 21, 2026**. Apply the later conditional-claim rule recorded by the **August 13, 2026** adjudication pass.

Judge what the publication claimed at the time it was written. Separate sourced facts from speculation and predictions. Do not reward or penalize a claim merely for agreeing or disagreeing with a community narrative.

## Anchored validity rubric

5 = factually accurate, predictions largely came true · 4 = grounded in primary sources, core thesis not falsified · 3 = real data, significant unproven leaps · 2 = speculation dominates, key predictions failed · 1 = core claims falsified or purely conspiratorial.

Use `null` for `validity_rating` only when the supplied text is too fragmentary to judge fairly. Do not rate art for truthfulness.

## RECONSTRUCTED supplied hindsight facts

Treat the following as supplied facts from the preserved report and canonical records, not as conclusions you newly researched:

- The October 2021 **SEC staff report** attributed the January 2021 run-up primarily to positive-sentiment retail buying rather than short covering and did not find that widespread naked shorting drove the price. The preserved report says the SEC report contradicts the persistent-hidden-short-interest thesis.
- Reported GameStop short interest was **122–147%** of float before the January 2021 squeeze; canonical hindsight notes say it fell to **~20% by February 2021** and remained low.
- The preserved price history says GameStop reached **~$483 intraday on January 28, 2021** before the stock split. Canonical hindsight notes also record a roughly $65 split-adjusted peak in May–June 2024; prices in the thousands or millions did not occur through the evaluation period.
- The report records that PFOF conflicts later drew regulatory action and an **EU PFOF ban**.
- The report records FINRA's **$70M Robinhood action**, comprising a $57M fine and $12.6M restitution, alongside roughly $331M of Robinhood Q1 2021 PFOF revenue; it also notes subsequent Robinhood fines.
- Canonical hindsight notes record that Federal Reserve reverse repos peaked at **~$2.55T in December 2022**, then drained to near zero by 2025 without the predicted systemic cascade.

This facts block is itself RECONSTRUCTED and time-bounded. On any rerun, replace it with a newly sourced facts block or state an explicit cutoff date; do not silently treat it as current.

## Claim enums

For each key claim, set `kind` to exactly one of:

- `verifiable_fact`
- `speculation`
- `prediction`

Set `assessment` to exactly one of:

- `holds_up`
- `partially_holds`
- `does_not_hold`
- `cannot_assess`

## Conditional-claim rule

For an if/then claim, evaluate the consequence only if the trigger occurred. If the trigger never occurred, use `cannot_assess`; do not mark the consequence `does_not_hold` merely because it did not happen.

## Output contract

Return exactly one JSON object matching `output_schema.json`. Use the canonical field names and enum values. Do not include Markdown fences, commentary, citations outside the schema fields, or any extra prose.

## Book metadata packet

{{BOOK_METADATA}}

## Book text packet

{{BOOK_TEXT}}
