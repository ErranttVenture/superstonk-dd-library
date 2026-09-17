import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { assemblePrompt, buildPacket, hindsightBlock, hindsightCutoff } from '../harness/assemble_review.mjs';
import { runNodeCli } from './cli-test-helpers.mjs';

const read = async (path) => (await readFile(new URL(path, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
const block = (text, opening) => [...text.matchAll(/```\n([\s\S]*?)\n```/g)]
  .map((match) => match[1])
  .find((candidate) => candidate.startsWith(opening));

const reviewPrompt = await read('../harness/review_prompt.md');
const versions = await read('../harness/prompt_versions.md');
const rubric = block(await read('../harness/rubric.md'), 'VALIDITY RATING ANCHORS');
const v1 = block(reviewPrompt, 'VERIFIED HINDSIGHT FACTS (as of mid-2026');
const original = {
  pos: 9,
  title: 'A Book',
  byline: 'u/x',
  pages: 4,
  uploaded: '2021-11-05',
  url: 'https://online.fliphtml5.com/lvrgy/zzmw/',
  type: 'original',
  text_available: true
};

test('p1 assembly reproduces the recovered template with only its documented substitutions', () => {
  const template = block(reviewPrompt, 'You are one reviewer in a 214-book');
  const values = {
    '{{BOOK_PACKET_PATH}}': '/p/009.txt',
    '{{REVIEW_OUTPUT_PATH}}': '/r/009.json',
    '${typeBlock}': block(reviewPrompt, 'This book is pre-classified as a single original work'),
    '${HINDSIGHT}': v1,
    '${RUBRIC}': rubric,
    '${p}': '9'
  };
  const expected = template.replace(
    /\{\{BOOK_PACKET_PATH\}\}|\{\{REVIEW_OUTPUT_PATH\}\}|\$\{typeBlock\}|\$\{HINDSIGHT\}|\$\{RUBRIC\}|\$\{p\}/g,
    (placeholder) => values[placeholder]
  );

  assert.equal(
    assemblePrompt({ promptVersion: 'p1', hindsightVersion: 'v1', record: original, packetPath: '/p/009.txt', outputPath: '/r/009.json' }),
    expected
  );
});

test('p2 assembly uses the pinned candidate, work type blocks and no leftover placeholders', () => {
  const prompt = assemblePrompt({
    promptVersion: 'p2',
    hindsightVersion: 'v1',
    record: { ...original, pos: 54, type: 'compilation' },
    packetPath: '/p/054.txt'
  });

  assert.ok(prompt.startsWith('You are one reviewer for the DD Library,'));
  assert.ok(prompt.includes(block(versions, 'This work is PRE-CLASSIFIED AS A COMPILATION')));
  assert.ok(prompt.includes('Read the file: /p/054.txt'));
  assert.ok(prompt.includes('- pos: set to 54.'));
  assert.ok(prompt.includes(v1) && prompt.includes(rubric));
  assert.doesNotMatch(prompt, /\$\{|\{\{/);
  assert.ok(
    assemblePrompt({ promptVersion: 'p2', hindsightVersion: 'v1', record: { ...original, type: 'periodical' }, packetPath: '/p' })
      .includes(block(versions, 'This work is a PERIODICAL'))
  );
});

test('hindsight v2 is the re-dated heading, the 15 v1 bullets, then the v2 fact bullets without meta-labels', () => {
  const lines = hindsightBlock('v2').split('\n');

  assert.equal(v1.split('\n').length, 16);
  assert.equal(lines[0], 'VERIFIED HINDSIGHT FACTS (as of 2026-08-16 — treat as ground truth when assessing claims/predictions):');
  assert.deepEqual(lines.slice(1, 16), v1.split('\n').slice(1));
  assert.equal(lines.length, 18);
  assert.match(lines[16], /^- 2023 banking stress: The 2022 rate shock .*`does_not_hold`\.$/);
  assert.match(lines[17], /^- Inflation containment context: .*`does_not_hold`\.$/);
  assert.doesNotMatch(hindsightBlock('v2'), /Amends|ERRATA/);
  assert.equal(hindsightBlock('v1'), v1);
});

test('verify prompts expand their own placeholders, including p2 time rules', () => {
  const p1 = assemblePrompt({ promptVersion: 'p1', hindsightVersion: 'v1', record: original, packetPath: '/p/009.txt', outputPath: '/v/009.json', kind: 'verify' });
  const p2 = assemblePrompt({ promptVersion: 'p2', hindsightVersion: 'v2', record: original, packetPath: '/p/009.txt', kind: 'verify' });

  assert.ok(p1.startsWith('Calibration check for a standardized 214-book review.'));
  assert.ok(p1.includes('/v/009.json'));
  assert.ok(p2.includes('TIME RULES:\n- The hindsight facts are current as of their heading.'));
  assert.ok(p2.includes(hindsightBlock('v2')));
  assert.doesNotMatch(p2, /\$\{|\{\{|This work is/);
});

test('assembly inserts values literally and rejects unknown versions or a missing p1 output path', () => {
  const literal = assemblePrompt({ promptVersion: 'p2', hindsightVersion: 'v1', record: original, packetPath: "/p/$&$'.txt" });

  assert.ok(literal.includes("Read the file: /p/$&$'.txt"));
  assert.throws(() => assemblePrompt({ promptVersion: 'p3', hindsightVersion: 'v1', record: original, packetPath: '/p' }), /Unknown prompt version/);
  assert.throws(() => assemblePrompt({ promptVersion: 'p2', hindsightVersion: 'v9', record: original, packetPath: '/p' }), /Unknown hindsight version/);
  assert.throws(() => assemblePrompt({ promptVersion: 'p1', hindsightVersion: 'v1', record: original, packetPath: '/p' }), /output path/);
});

test('assembly rejects a work published after the selected hindsight cutoff', () => {
  const late = { ...original, uploaded: '2026-09-01' };

  assert.equal(hindsightCutoff('v1'), '2026-07-21');
  assert.equal(hindsightCutoff('v2'), '2026-08-16');
  for (const kind of ['review', 'verify']) {
    assert.throws(
      () => assemblePrompt({ promptVersion: 'p2', hindsightVersion: 'v2', record: late, packetPath: '/p', kind }),
      /published 2026-09-01, after the v2 hindsight cutoff 2026-08-16/
    );
  }
  assert.throws(
    () => assemblePrompt({ promptVersion: 'p2', hindsightVersion: 'v1', record: { ...original, uploaded: '2026-07-22' }, packetPath: '/p' }),
    /after the v1 hindsight cutoff 2026-07-21/
  );
  assert.throws(
    () => assemblePrompt({ promptVersion: 'p1', hindsightVersion: 'v1', record: { ...original, uploaded: '2026-07-22' }, packetPath: '/p', outputPath: '/o' }),
    /hindsight cutoff/
  );
  assert.throws(
    () => assemblePrompt({ promptVersion: 'p2', hindsightVersion: 'v2', record: { ...original, uploaded: undefined }, packetPath: '/p' }),
    /publication date/
  );
  assert.ok(assemblePrompt({ promptVersion: 'p2', hindsightVersion: 'v1', record: { ...original, uploaded: '2026-07-21' }, packetPath: '/p' }));
  assert.ok(assemblePrompt({ promptVersion: 'p2', hindsightVersion: 'v2', record: { ...original, uploaded: '2026-08-16' }, packetPath: '/p', kind: 'verify' }));
});

test('sampled coverage lists every contiguous page range so internal gaps are visible', () => {
  const sparse = [3, 4, 6, 8, 9].map((page) => ({ page, text: `Page ${page}` }));
  const range = (first, last) => Array.from({ length: last - first + 1 }, (_, index) => ({ page: first + index, text: 'x' }));

  assert.match(buildPacket({ ...original, pages: 10 }, sparse, { contract: 'p1' }), /\nTEXT COVERAGE: sample: pages 3-4, 6, 8-9 of 10\n/);
  assert.match(
    buildPacket({ ...original, pages: 58 }, [...range(3, 13), ...range(15, 35), ...range(37, 56)], { contract: 'p2', evaluatedOn: '2026-09-16' }),
    /\nTEXT COVERAGE: sample: pages 3-13, 15-35, 37-56 of 58\n/
  );
});

test('p2 packets label pages, wrap long lines at whitespace and disclose sampled coverage', () => {
  const words = Array.from({ length: 300 }, (_, index) => `word${index}`).join(' ');
  const packet = buildPacket(original, [{ page: 3, text: words }, { page: 4, text: 'Short' }], { contract: 'p2', evaluatedOn: '2026-09-16' });
  const [header, body] = packet.split('\n---\n');

  assert.equal(header, [
    'TITLE: A Book',
    'BYLINE: u/x',
    'PLATFORM: FlipHTML5',
    'PUBLISHED: 2021-11-05',
    'PAGES: 4',
    'EVALUATED ON: 2026-09-16',
    'TEXT COVERAGE: sample: pages 3-4 of 4'
  ].join('\n'));
  assert.ok(body.startsWith('[page 3]\n'));
  assert.ok(body.split('\n').every((line) => line.length <= 500));
  assert.equal(body.split('\n\n[page 4]\n')[0].replace('[page 3]\n', '').split('\n').join(' '), words);
  assert.ok(body.endsWith('\n\n[page 4]\nShort'));
  assert.throws(() => buildPacket(original, [{ page: 1, text: 'x' }], { contract: 'p2' }), /evaluatedOn/);
});

test('p1 packets reconstruct the July header and report full text when every page is present', () => {
  const pages = [1, 2, 3, 4].map((page) => ({ page, text: `Page ${page}` }));

  assert.ok(buildPacket(original, pages, { contract: 'p1' }).startsWith(
    'TITLE: A Book\nBYLINE: u/x\nOFFICIAL PAGE COUNT: 4\nUPLOAD DATE: 2021-11-05\nTEXT COVERAGE: full text\n---\n[page 1]\nPage 1\n\n[page 2]'
  ));
});

test('community packets use the preserved text with the submission platform and no page count', () => {
  const community = { ...original, pos: 251, pages: null, uploaded: '2026-07-11', source_corpus: 'community', submission: { platform: 'other' } };

  assert.equal(
    buildPacket(community, '# Heading\n\nBody', { contract: 'p2', evaluatedOn: '2026-09-16' }),
    'TITLE: A Book\nBYLINE: u/x\nPLATFORM: other\nPUBLISHED: 2026-07-11\nPAGES: n/a\nEVALUATED ON: 2026-09-16\nTEXT COVERAGE: full text\n---\n# Heading\n\nBody'
  );
});

test('packets keep whole pages within the character limit and mark the rest as a sample', () => {
  const pages = [1, 2, 3].map((page) => ({ page, text: 'x'.repeat(10) }));
  const packet = buildPacket({ ...original, pages: 3 }, pages, { contract: 'p1', maxChars: 25 });

  assert.match(packet, /TEXT COVERAGE: sample: pages 1-2 of 3/);
  assert.doesNotMatch(packet, /\[page 3\]/);
});

test('the CLI prints the assembled prompt for a canonical position', async () => {
  const result = await runNodeCli('harness/assemble_review.mjs', ['--pos', '9', '--prompt', 'p2', '--hindsight', 'v1', '--packet', '/p/009.txt']);
  const master = JSON.parse(await read('../data/master.json'));

  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    result.stdout,
    `${assemblePrompt({ promptVersion: 'p2', hindsightVersion: 'v1', record: master.find((record) => record.pos === 9), packetPath: '/p/009.txt' })}\n`
  );

  const invalid = await runNodeCli('harness/assemble_review.mjs', ['--pos', '9']);
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /Usage/);
});
