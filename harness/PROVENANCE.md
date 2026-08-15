# Provenance of the recovered harness

This records exactly where the harness/ files recovered in this change came from, so this cannot get re-labeled "not preserved" again.

## Source

The original July 21, 2026 review workflow — the actual script that ran all 214 per-book review agents plus the calibration verify pass — was located intact on the machine that originally ran it, outside this repository, at:

```
C:/Users/seany/.claude/projects/C--Users-seany-Documents-AI-Production/c410275b-ebe1-4f1d-b82a-0cba3c10e712/workflows/scripts/superstonk-dd-review-wf_4d8e7c67-f83.js
```

170 lines. It is a plain JavaScript workflow script (`meta`, then top-level `const` declarations and two prompt-builder functions, then the `pipeline()` call that dispatched the actual agents). Nothing about it was ambiguous or required interpretation — every constant and function referenced below was extracted by evaluating the source directly, not by reading and retyping it.

Per-book raw agent transcripts from the actual run are preserved as a side effect of how the workflow runtime logs its work, in the same project folder:

```
C:/Users/seany/.claude/projects/C--Users-seany-Documents-AI-Production/c410275b-ebe1-4f1d-b82a-0cba3c10e712/subagents/workflows/wf_4d8e7c67-f83/*.jsonl
```

## What was recovered verbatim from the workflow script

- `HINDSIGHT` — the 15-bullet supplied-facts block, expanded verbatim into [`review_prompt.md`](review_prompt.md).
- `RUBRIC` — both anchor scales (validity and evidence quality), verbatim into [`rubric.md`](rubric.md).
- `SCHEMA` — the per-book structured-output contract, converted to JSON Schema in [`output_schema.json`](output_schema.json) with property names, order, and the required-fields list unchanged.
- `reviewPrompt(p, t)` — the prompt-builder function, including its three type-specific blocks (compilation / periodical / original) and its `RULES:` section, reassembled into [`review_prompt.md`](review_prompt.md).
- `verifyPrompt(p, t)` and `VERIFY_SCHEMA` — the independent calibration-pass prompt and its output schema, into [`calibration.md`](calibration.md).

Two scratchpad file paths inside `reviewPrompt()`/`verifyPrompt()` (`${S}/packets/${pad}.txt`, `${S}/reviews/${pad}.json`, `${S}/verify/${pad}.json`) pointed at a temp directory that no longer exists on any machine. Those paths — and only those paths — were replaced with `{{BOOK_PACKET_PATH}}`, `{{REVIEW_OUTPUT_PATH}}`, and `{{VERIFY_OUTPUT_PATH}}` placeholders. Every other character of the prompt text is unchanged from the source; see the substitution notes in [`review_prompt.md`](review_prompt.md) and [`calibration.md`](calibration.md) for exactly what that means for the one remaining `${p}` interpolation.

## What is genuinely still not preserved

This is now narrow, not the whole harness:

- **The per-book input packets** (`packets/NNN.txt` — the extracted FlipHTML5 book text each reviewer read). These were scratchpad working files, not committed anywhere, and the underlying book text is third-party copyrighted material this repository was never going to redistribute regardless.
- **The raw verify-pass outputs** (`verify/NNN.json` — the full per-book JSON the calibration reviewer wrote, including its `rationale` text). Only the numeric essence of these — the `calibration.validity`/`calibration.evidence_quality` values already present on the relevant `data/master.json` records — survived into the committed dataset; the original JSON files and their rationale text did not.

The main per-book review outputs (`reviews/NNN.json`) are not separately available either, but nothing about them is actually lost: their content is exactly what the immutable [`data/original-master.json`](../data/original-master.json) already stores per record (`summary`, `key_claims`, `validity_rating`, etc.) — that dataset *is* the reviews, already committed.

## Extraction method

Extraction was mechanical, not transcriptive: a short Node script evaluated the relevant `const`/`function` declarations from the source file directly (`new Function(...)`, with the scratchpad-path constant swapped for a marker string first) and wrote the resulting exact strings straight to these files. `reviewPrompt()` was additionally called for all three book types (`'c'`, `'n'`, and neither) and the three outputs were diffed against each other to confirm the only differences were the type block, the position number, and the file paths — i.e. that no other part of the template varies. This avoided any manual retyping of the prompt text, which is where transcription errors (a dropped em dash, a re-ordered clause) would otherwise creep in.
