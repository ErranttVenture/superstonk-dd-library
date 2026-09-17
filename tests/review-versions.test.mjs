import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { HINDSIGHT_CUTOFFS, REVIEW_PROMPT_VERSIONS, hindsightCutoff } from '../scripts/review-versions.mjs';
import { hindsightBlock } from '../harness/assemble_review.mjs';

const versions = (await readFile(new URL('../harness/prompt_versions.md', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');

test('hindsight cutoffs match the dated facts headings and the recorded v1 date', () => {
  for (const version of Object.keys(HINDSIGHT_CUTOFFS)) {
    assert.ok(hindsightBlock(version), `${version} must be an assembled hindsight version`);
  }
  assert.equal(/as of (\d{4}-\d{2}-\d{2})/.exec(hindsightBlock('v2').split('\n')[0])?.[1], HINDSIGHT_CUTOFFS.v2);
  assert.match(hindsightBlock('v1').split('\n')[0], /as of mid-2026/);
  assert.match(versions, new RegExp(`"as of mid-2026" as\\s+${HINDSIGHT_CUTOFFS.v1}`));
  assert.equal(hindsightCutoff('v2'), '2026-08-16');
  assert.throws(() => hindsightCutoff('v9'), /Unknown hindsight version: v9/);
});

test('review prompt versions include every ACTIVE registry version and never p1', () => {
  const active = [...versions.matchAll(/^\| (p\d+) \| ACTIVE \|/gm)].map((match) => match[1]);

  assert.ok(active.length > 0, 'the registry must mark an ACTIVE prompt version');
  for (const version of active) {
    assert.ok(REVIEW_PROMPT_VERSIONS.includes(version), `${version} is ACTIVE in prompt_versions.md`);
  }
  assert.ok(!REVIEW_PROMPT_VERSIONS.includes('p1'));
});
