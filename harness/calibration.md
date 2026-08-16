# Calibration and adjudication record

> The statistics and adjudication record below are drawn directly from [`reports/REPORT.md`](../reports/REPORT.md) (line 10) — one of the four immutable original artifacts, not a guess — so they carry over unchanged. What genuinely was not preserved and had to be recovered is the *prompt and schema* used to produce the calibration sample in the first place: `verifyPrompt()` and `VERIFY_SCHEMA`, recovered verbatim below. See [`PROVENANCE.md`](PROVENANCE.md).

## Calibration sample

Every ninth reviewed book was independently re-rated by a stronger model, producing a 22-book sample. Agreement was **12/22 exact** and **20/22 within ±1** validity point. Mean drift was **+0.27**: the stronger model rated slightly higher on average.

These statistics compare `calibration.validity` with `validity_rating_original` where an adjudication changed the low-cost model's rating, and with `validity_rating` otherwise. The three preserved pre-adjudication ratings are #9 = 2, #54 = 3, and #180 = 2. This produces 12 exact matches, 20 differences within one point, and a total stronger-minus-original delta of 6 across 22 records (`6 / 22 = 0.2727…`, reported as +0.27). `validity_rating` remains the current post-adjudication value.

The two two-point disagreements, **#9** and **#180**, were adjudicated in favor of the stronger model. In both cases, Claude Haiku under-credited articles whose predictions were accurate at the time of writing. The resulting known bias is modest under-crediting by Claude Haiku, the low-cost rater; borderline ratings of 2 should therefore be treated as possible 3s rather than automatically changed.

## Conditional-claim adjudication

The August 13, 2026 follow-up reviewed every conditional-flavored claim. If the trigger in an if/then claim never occurred, the absent consequence does not falsify the claim; its assessment is `cannot_assess`, not `does_not_hold`.

That pass corrected 12 assessments: 10 became `cannot_assess`, and 2 moved upward because their trigger had occurred. Three notes were sharpened. One book rating changed: **#54**, the dlauer FINRA series, moved from 3 to 4 to match its calibration re-rating. Corrected claims carry an **ADJUDICATED** note so the preserved assessment history remains visible.

These figures document the original report's checks. They do not establish new calibration results for future model runs.

## Independent verify pass — prompt and schema (recovered verbatim)

Every ninth reviewed book (`b.p % 9 === 0`) was independently re-rated using a separate prompt, `verifyPrompt()`, run by the session's stronger model rather than the low-cost per-book reviewer. The reviewer was explicitly told not to consult the existing review, to avoid anchoring on it. This is what produced the 22-book calibration sample described above.

### verifyPrompt() (verbatim)

The same two path placeholders from [`review_prompt.md`](review_prompt.md) apply here, plus one new one for the verify-stage output: `${S}/verify/${pad}.json` → `{{VERIFY_OUTPUT_PATH}}`. `${HINDSIGHT}` and `${RUBRIC}` are the same constants expanded verbatim in [`review_prompt.md`](review_prompt.md) and [`rubric.md`](rubric.md) — not duplicated a third time here.

```
Calibration check for a standardized 214-book review. Independently rate ONE book — do NOT look at any existing review files; form your own judgment.

Read the file: {{BOOK_PACKET_PATH}} (metadata header + page-labeled text).

${HINDSIGHT}

${RUBRIC}

Rate validity_rating and evidence_quality per the anchors, with a 2-3 sentence rationale. Set pos=${p}. Write your JSON to {{VERIFY_OUTPUT_PATH}} using the Write tool, then return it via structured output.
```

### VERIFY_SCHEMA (verbatim)

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "pos",
    "validity_rating",
    "evidence_quality",
    "rationale"
  ],
  "properties": {
    "pos": {
      "type": "integer"
    },
    "validity_rating": {
      "type": "integer",
      "minimum": 1,
      "maximum": 5
    },
    "evidence_quality": {
      "type": "integer",
      "minimum": 1,
      "maximum": 5
    },
    "rationale": {
      "type": "string"
    }
  }
}
```

Note this is a smaller, separate schema from [`output_schema.json`](output_schema.json) — the verify pass only ever produced `pos`, `validity_rating`, `evidence_quality`, and a short `rationale`, not a full review object.
