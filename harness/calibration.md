# RECONSTRUCTED calibration and adjudication record

> **RECONSTRUCTED:** The original July 21, 2026 calibration materials were not preserved. This record is reconstructed from `reports/REPORT.md`; it is not a verbatim recovery.

## Calibration sample

Every ninth reviewed book was independently re-rated by a stronger model, producing a 22-book sample. Agreement was **12/22 exact** and **20/22 within ±1** validity point. Mean drift was **+0.27**: the stronger model rated slightly higher on average.

These statistics compare `calibration.validity` with `validity_rating_original` where an adjudication changed the low-cost model's rating, and with `validity_rating` otherwise. The three preserved pre-adjudication ratings are #9 = 2, #54 = 3, and #180 = 2. This produces 12 exact matches, 20 differences within one point, and a total stronger-minus-original delta of 6 across 22 records (`6 / 22 = 0.2727…`, reported as +0.27). `validity_rating` remains the current post-adjudication value.

The two two-point disagreements, **#9** and **#180**, were adjudicated in favor of the stronger model. In both cases, Claude Haiku under-credited articles whose predictions were accurate at the time of writing. The resulting known bias is modest under-crediting by Claude Haiku, the low-cost rater; borderline ratings of 2 should therefore be treated as possible 3s rather than automatically changed.

## Conditional-claim adjudication

The August 13, 2026 follow-up reviewed every conditional-flavored claim. If the trigger in an if/then claim never occurred, the absent consequence does not falsify the claim; its assessment is `cannot_assess`, not `does_not_hold`.

That pass corrected 12 assessments: 10 became `cannot_assess`, and 2 moved upward because their trigger had occurred. Three notes were sharpened. One book rating changed: **#54**, the dlauer FINRA series, moved from 3 to 4 to match its calibration re-rating. Corrected claims carry an **ADJUDICATED** note so the preserved assessment history remains visible.

These figures document the original report's checks. They do not establish new calibration results for future model runs.
