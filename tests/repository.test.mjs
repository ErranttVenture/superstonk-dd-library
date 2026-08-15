import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const originals = new Map([
  ['reports/REPORT.md', '53c777712e6ff985e1259da5ebe47aa05e499c81d5d0de9916eba9b17ff90cfa'],
  ['reports/BOOKS.md', '3b202e66b0e8587e84d63d9d1eb2cd8f525ffc1ed3d2589b3c38a33b4d56ffc0'],
  ['data/library_review.csv', '9efacc7816b8e24a44a97037fe39e375153a16ee26409cf619b565dc03e20ec1'],
  ['data/original-master.json', 'fb96f7d70a0abece7e1a3f1995d1df67eb3ea5b7134565115e68e5431ffccf13']
]);

test('marks exactly the immutable source artifacts as binary', async () => {
  const attributes = await readFile(new URL('../.gitattributes', import.meta.url), 'utf8');

  assert.deepEqual(attributes.trim().split(/\r?\n/), [
    'reports/REPORT.md -text',
    'reports/BOOKS.md -text',
    'data/library_review.csv -text',
    'data/original-master.json -text'
  ]);
});

test('preserves the immutable original artifacts and baseline record sequence', async () => {
  for (const [relativePath, expectedHash] of originals) {
    const file = new URL(`../${relativePath}`, import.meta.url);
    await access(file);
    const hash = createHash('sha256').update(await readFile(file)).digest('hex');
    assert.equal(hash, expectedHash, `${relativePath} must remain byte-for-byte identical`);
  }

  const baseline = JSON.parse(
    await readFile(new URL('../data/original-master.json', import.meta.url), 'utf8')
  );
  assert.ok(Array.isArray(baseline));
  assert.equal(baseline.length, 250);
  assert.deepEqual(
    baseline.map((record) => record.pos),
    Array.from({ length: 250 }, (_, index) => index + 1)
  );
});

test('keeps the evolving canonical master as a complete 250-record dataset', async () => {
  const master = JSON.parse(
    await readFile(new URL('../data/master.json', import.meta.url), 'utf8')
  );
  assert.ok(Array.isArray(master));
  assert.equal(master.length, 250);
  assert.deepEqual(
    master.map((record) => record.pos),
    Array.from({ length: 250 }, (_, index) => index + 1)
  );
});

test('reproduces the published calibration statistics from pre-adjudication ratings', async () => {
  const master = JSON.parse(
    await readFile(new URL('../data/master.json', import.meta.url), 'utf8')
  );
  const calibrationDocument = await readFile(
    new URL('../harness/calibration.md', import.meta.url),
    'utf8'
  );
  const sample = master.filter((record) => record.calibration);
  const historicalRatings = master
    .filter((record) => Object.hasOwn(record, 'validity_rating_original'))
    .map(({ pos, validity_rating_original }) => ({ pos, validity_rating_original }));
  const deltas = sample.map((record) =>
    record.calibration.validity -
      (record.validity_rating_original ?? record.validity_rating)
  );
  const statistics = {
    sampleSize: sample.length,
    exact: deltas.filter((delta) => delta === 0).length,
    withinOne: deltas.filter((delta) => Math.abs(delta) <= 1).length,
    meanDrift: Number(
      (deltas.reduce((sum, delta) => sum + delta, 0) / sample.length).toFixed(2)
    )
  };

  assert.deepEqual(statistics, {
    sampleSize: 22,
    exact: 12,
    withinOne: 20,
    meanDrift: 0.27
  });
  assert.deepEqual(historicalRatings, [
    { pos: 9, validity_rating_original: 2 },
    { pos: 54, validity_rating_original: 3 },
    { pos: 180, validity_rating_original: 2 }
  ]);
  assert.ok(calibrationDocument.includes(`${statistics.exact}/${statistics.sampleSize} exact`));
  assert.ok(calibrationDocument.includes(
    `${statistics.withinOne}/${statistics.sampleSize} within ±1`
  ));
  assert.ok(calibrationDocument.includes(`+${statistics.meanDrift.toFixed(2)}`));
});

test('labels every reconstructed harness file and preserves review anchors', async () => {
  const harnessDirectory = new URL('../harness/', import.meta.url);
  const entries = await readdir(harnessDirectory, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile());

  assert.ok(files.length > 0);
  for (const file of files) {
    const contents = await readFile(new URL(file.name, harnessDirectory), 'utf8');
    assert.match(contents, /RECONSTRUCTED/, `${file.name} must disclose reconstruction provenance`);
  }

  const rubric = await readFile(new URL('../harness/rubric.md', import.meta.url), 'utf8');
  assert.ok(rubric.includes(
    '5 = factually accurate, predictions largely came true · 4 = grounded in primary sources, core thesis not falsified · 3 = real data, significant unproven leaps · 2 = speculation dominates, key predictions failed · 1 = core claims falsified or purely conspiratorial.'
  ));
});

test('reconstructed review prompt includes the packet contract and cited hindsight facts', async () => {
  const prompt = await readFile(new URL('../harness/review_prompt.md', import.meta.url), 'utf8');

  for (const requiredText of [
    '{{BOOK_METADATA}}',
    '{{BOOK_TEXT}}',
    'output_schema.json',
    'SEC staff report',
    '122–147%',
    '~20% by February 2021',
    '~$483 intraday on January 28, 2021',
    'EU PFOF ban',
    '$70M Robinhood action',
    '~$2.55T in December 2022'
  ]) {
    assert.ok(prompt.includes(requiredText), `review_prompt.md must contain ${requiredText}`);
  }
});

test('reconstructed calibration records the original checks and adjudications', async () => {
  const calibration = await readFile(new URL('../harness/calibration.md', import.meta.url), 'utf8');

  for (const requiredText of [
    '12/22 exact',
    '20/22 within ±1',
    '+0.27',
    '#9',
    '#180',
    '#54',
    'ADJUDICATED'
  ]) {
    assert.ok(calibration.includes(requiredText), `calibration.md must contain ${requiredText}`);
  }
});

test('preserves the direction and subject of the documented calibration bias', async () => {
  for (const relativePath of ['harness/README.md', 'harness/calibration.md']) {
    const contents = await readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

    assert.match(
      contents,
      /(?:[Tt]he stronger model rated slightly higher on average \(\+0\.27\)|[Mm]ean drift was (?:\*\*)?\+0\.27(?:\*\*)?: the stronger model rated slightly higher on average)/,
      `${relativePath} must state that the stronger model rated +0.27 higher`
    );
    assert.ok(
      contents.includes(
        'Claude Haiku under-credited articles whose predictions were accurate at the time of writing.'
      ),
      `${relativePath} must attribute accurate-at-writing under-crediting to Claude Haiku`
    );
  }
});

test('stores the CC BY-SA legal code without altering its trailing whitespace', async () => {
  const dataLicense = (await readFile(new URL('../LICENSE-DATA', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');

  assert.ok(dataLicense.startsWith('This license covers the data/ and reports/ directories.\n\n'));
  assert.match(dataLicense, /Attribution-ShareAlike 4\.0 International/);
  assert.equal((dataLicense.match(/^Section [1-8] -- /gm) ?? []).length, 8);
  assert.match(dataLicense, /creativecommons\.org\.\n$/);
});

test('publishes the community landing page in the required order', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  const detailsStart = readme.indexOf('<details>');
  const startHere = readme.indexOf('## Start here');

  assert.ok(detailsStart >= 0, 'README.md must contain a methodology details block');
  assert.ok(detailsStart < startHere, 'methodology details must precede Start here');
  assert.equal((readme.match(/<details>/g) ?? []).length, 1);
  assert.equal((readme.match(/<\/details>/g) ?? []).length, 1);

  for (const requiredText of [
    '250 books',
    '6,821 pages',
    'AI-assisted',
    'human-directed',
    'community audit layer',
    'primary-source',
    'source-characterization accuracy',
    'educational value',
    'u/writerofjots',
    'u/humdingler',
    'MIT',
    'CC BY-SA 4.0',
    'RECONSTRUCTED',
    'July 21, 2026',
    'August 13, 2026',
    'FlipHTML5 book text',
    'data/master.json'
  ]) {
    assert.ok(readme.includes(requiredText), `README.md must contain ${requiredText}`);
  }

  for (const row of [
    '| 4 — Mostly accurate / directionally right | 11 | 5% |',
    '| 3 — Mixed: real data, unproven leaps | 25 | 12% |',
    '| 2 — Speculation-dominated / failed predictions | 166 | 79% |',
    '| 1 — Falsified or conspiratorial | 7 | 3% |'
  ]) {
    assert.ok(readme.includes(row), `README.md must preserve distribution row: ${row}`);
  }
});

test('documents the governed dispute and right-of-reply workflow', async () => {
  const contributing = await readFile(new URL('../CONTRIBUTING.md', import.meta.url), 'utf8');

  for (const requiredText of [
    'book',
    'dispute',
    'evidence',
    'proposed_change',
    'author_response',
    'ADJUDICATED',
    'primary-source',
    'maintainer review',
    'No drive-by rating edits',
    'CC BY-SA 4.0'
  ]) {
    assert.ok(contributing.includes(requiredText), `CONTRIBUTING.md must contain ${requiredText}`);
  }
});

test('assigns exact repository ownership', async () => {
  const codeowners = (await readFile(new URL('../CODEOWNERS', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
  assert.equal(codeowners, '* @ErranttVenture\n');
});

test('ships structurally valid concise issue forms with required fields', async () => {
  const forms = new Map([
    ['dispute-rating.yml', ['book', 'dispute', 'evidence', 'proposed_change']],
    ['correction.yml', ['location', 'correction', 'evidence']]
  ]);

  for (const [filename, requiredIds] of forms) {
    const form = (
      await readFile(new URL(`../.github/ISSUE_TEMPLATE/${filename}`, import.meta.url), 'utf8')
    ).replace(/\r\n/g, '\n');
    assert.match(form, /^name: .+/m, `${filename} must declare a name`);
    assert.match(form, /^description: .+/m, `${filename} must declare a description`);
    assert.match(form, /^body:\s*$/m, `${filename} must declare a body`);
    assert.doesNotMatch(form, /^assignees:/m, `${filename} must not declare assignees`);
    assert.doesNotMatch(form, /^blank_issues_enabled:/m, `${filename} must not configure blank issues`);

    for (const id of requiredIds) {
      const fieldStart = form.indexOf(`  - id: ${id}\n`);
      assert.ok(fieldStart >= 0, `${filename} must contain field id ${id}`);
      const nextField = form.indexOf('\n  - ', fieldStart + 1);
      const field = form.slice(fieldStart, nextField < 0 ? undefined : nextField);
      assert.match(
        field,
        /\n    validations:\n      required: true(?:\n|$)/,
        `${filename} field ${id} must be required`
      );
    }
  }
});
