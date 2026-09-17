// Review version facts that dataset validation needs without parsing harness documents.
// tests/review-versions.test.mjs keeps this table in step with harness/hindsight.md and
// harness/prompt_versions.md.

// Each hindsight version's "as of" date. v1's heading says "mid-2026";
// prompt_versions.md fixes it at the July run date.
export const HINDSIGHT_CUTOFFS = Object.freeze({ v1: '2026-07-21', v2: '2026-08-16' });

// Prompt versions that may stamp a community review or dispute re-rating: every version that
// is or was ACTIVE. p1 was never calibrated for those works.
export const REVIEW_PROMPT_VERSIONS = Object.freeze(['p2']);

export function hindsightCutoff(version) {
  if (!Object.hasOwn(HINDSIGHT_CUTOFFS, version)) {
    throw new Error(`Unknown hindsight version: ${version}`);
  }
  return HINDSIGHT_CUTOFFS[version];
}
