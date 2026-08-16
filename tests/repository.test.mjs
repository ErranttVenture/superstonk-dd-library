import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const originals = new Map([
  ['reports/REPORT.md', '53c777712e6ff985e1259da5ebe47aa05e499c81d5d0de9916eba9b17ff90cfa'],
  ['reports/BOOKS.md', '3b202e66b0e8587e84d63d9d1eb2cd8f525ffc1ed3d2589b3c38a33b4d56ffc0'],
  ['data/library_review.csv', '9efacc7816b8e24a44a97037fe39e375153a16ee26409cf619b565dc03e20ec1'],
  ['data/original-master.json', 'fb96f7d70a0abece7e1a3f1995d1df67eb3ea5b7134565115e68e5431ffccf13']
]);

const repositoryRoot = new URL('..', import.meta.url);
const attributePaths = [...originals.keys(), 'data/master.json'];
const gitEnvironment = {
  ...Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.toUpperCase().startsWith('GIT_'))
  ),
  LANG: 'C',
  LC_ALL: 'C'
};

async function resolveAttributes(cwd, env = gitEnvironment) {
  const { stdout } = await execFileAsync(
    'git',
    ['check-attr', 'text', 'eol', '--', ...attributePaths],
    { cwd, encoding: 'utf8', env }
  );
  return new Map(
    stdout.trim().split(/\r?\n/).map((line) => {
      const match = line.match(/^(.+): (text|eol): (.+)$/);
      assert.ok(match, `unexpected git check-attr output: ${line}`);
      return [`${match[1]}:${match[2]}`, match[3]];
    })
  );
}

function assertProvenanceAttributes(resolvedAttributes, source) {
  for (const relativePath of originals.keys()) {
    assert.equal(
      resolvedAttributes.get(`${relativePath}:text`),
      'unset',
      `${relativePath} must resolve text as unset from ${source}`
    );
    assert.equal(
      resolvedAttributes.get(`${relativePath}:eol`),
      'unspecified',
      `${relativePath} must not resolve an EOL conversion from ${source}`
    );
  }
  assert.equal(
    resolvedAttributes.get('data/master.json:text'),
    'set',
    `data/master.json must resolve text as set from ${source}`
  );
  assert.equal(
    resolvedAttributes.get('data/master.json:eol'),
    'lf',
    `data/master.json must resolve eol as lf from ${source}`
  );
}

test('resolves tracked and repository provenance attributes', async (t) => {
  let isInsideWorkTree = false;
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['rev-parse', '--is-inside-work-tree'],
      { cwd: repositoryRoot, encoding: 'utf8', env: gitEnvironment }
    );
    isInsideWorkTree = stdout.trim() === 'true';
  } catch (error) {
    const gitIsUnavailable = error.code === 'ENOENT';
    const isNotRepositoryError = /not a git repository/i.test(error.stderr ?? '');
    let repositoryMetadataExists = false;
    try {
      await access(new URL('../.git', import.meta.url));
      repositoryMetadataExists = true;
    } catch (metadataError) {
      if (metadataError.code !== 'ENOENT') {
        throw metadataError;
      }
    }
    if (!gitIsUnavailable && !(isNotRepositoryError && !repositoryMetadataExists)) {
      throw error;
    }
  }

  if (!isInsideWorkTree) {
    assert.ok(!process.env.CI, 'CI must run this suite inside a git work tree');
    t.skip('no git work tree (source archive); attribute resolution cannot be verified here');
    return;
  }

  await execFileAsync(
    'git',
    ['ls-files', '--error-unmatch', '--', '.gitattributes'],
    { cwd: repositoryRoot, encoding: 'utf8', env: gitEnvironment }
  );

  // Git can publish the rules from three places: the commit a fresh clone receives, the
  // index a plain `git commit` would publish, and the working copy staged next. Each must
  // carry the guarantee on its own, or an edit to one is propped up by the other two.
  const showAttributes = async (revision) => (
    await execFileAsync(
      'git',
      ['show', `${revision}:.gitattributes`],
      { cwd: repositoryRoot, encoding: 'utf8', env: gitEnvironment }
    )
  ).stdout;
  const attributeSources = [
    { description: 'the committed .gitattributes alone', contents: await showAttributes('HEAD') },
    { description: 'the staged .gitattributes alone', contents: await showAttributes('') },
    {
      description: 'the working-tree .gitattributes alone',
      contents: await readFile(new URL('../.gitattributes', import.meta.url), 'utf8')
    }
  ];

  const scratch = await mkdtemp(join(tmpdir(), 'superstonk-attributes-'));
  try {
    const emptyConfig = join(scratch, 'empty.gitconfig');
    const emptyTemplate = join(scratch, 'empty-template');
    await writeFile(emptyConfig, '');
    await mkdir(emptyTemplate);
    const hermeticEnvironment = {
      ...gitEnvironment,
      HOME: scratch,
      USERPROFILE: scratch,
      XDG_CONFIG_HOME: scratch,
      GIT_CONFIG_GLOBAL: emptyConfig,
      GIT_CONFIG_SYSTEM: emptyConfig,
      GIT_ATTR_NOSYSTEM: '1'
    };
    await execFileAsync('git', ['init', '--quiet', `--template=${emptyTemplate}`], {
      cwd: scratch,
      encoding: 'utf8',
      env: hermeticEnvironment
    });

    for (const { description, contents } of attributeSources) {
      await writeFile(join(scratch, '.gitattributes'), contents);
      assertProvenanceAttributes(
        await resolveAttributes(scratch, hermeticEnvironment),
        description
      );
    }

    assertProvenanceAttributes(
      await resolveAttributes(repositoryRoot),
      'this repository'
    );
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test('data/master.json checks out with LF line endings on every platform', async () => {
  const bytes = await readFile(new URL('../data/master.json', import.meta.url));

  assert.equal(
    bytes.includes(0x0d),
    false,
    'data/master.json must contain no CR bytes; check .gitattributes eol=lf'
  );
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
  const calibrationDocuments = await Promise.all([
    {
      relativePath: 'harness/calibration.md',
      claims: ['exact', 'withinOne', 'meanDrift'],
      statesDriftDirection: true
    },
    {
      relativePath: 'README.md',
      claims: ['exact', 'withinOne', 'meanDrift'],
      statesDriftDirection: true
    },
    {
      relativePath: 'harness/README.md',
      claims: ['meanDrift'],
      statesDriftDirection: true
    }
  ].map(async ({ relativePath, claims, statesDriftDirection }) => ({
    relativePath,
    claims,
    statesDriftDirection,
    contents: await readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8')
  })));
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
  const publishedClaims = {
    exact: `${statistics.exact}/${statistics.sampleSize} exact`,
    withinOne: `${statistics.withinOne}/${statistics.sampleSize} within ±1`,
    meanDrift: `${statistics.meanDrift < 0 ? '' : '+'}${statistics.meanDrift.toFixed(2)}`
  };
  const driftDirection = statistics.meanDrift < 0 ? 'lower' : 'higher';
  const escapedMeanDrift = publishedClaims.meanDrift.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const driftClaim = new RegExp(
    `(?:[Tt]he stronger model rated slightly ${driftDirection} on average \\(${escapedMeanDrift}\\)|` +
    `[Mm]ean drift was (?:\\*\\*)?${escapedMeanDrift}(?:\\*\\*)?: the stronger model rated slightly ${driftDirection} on average)`
  );
  for (const { relativePath, claims, statesDriftDirection, contents } of calibrationDocuments) {
    for (const claim of claims) {
      assert.ok(
        Object.hasOwn(publishedClaims, claim),
        `unknown calibration claim '${claim}' listed for ${relativePath}`
      );
      assert.ok(
        contents.includes(publishedClaims[claim]),
        `${relativePath} must report ${publishedClaims[claim]}`
      );
    }
    if (statesDriftDirection) {
      assert.match(
        contents,
        driftClaim,
        `${relativePath} must state that the stronger model rated slightly ${driftDirection} on average by ${publishedClaims.meanDrift}`
      );
    }
  }
});

test('labels every harness file with either a reconstruction or a verbatim-recovery disclosure', async () => {
  const harnessDirectory = new URL('../harness/', import.meta.url);
  // Files not listed here are unrecognised, not exempt: they still have to declare their own
  // provenance (see the default branch below), so a new harness file can't silently ship unlabelled.
  // 'maintained' is for post-hoc maintained documents (neither reconstructed nor recovered).
  const provenance = new Map([
    ['extract_bookcase.mjs', 'reconstructed'],
    ['extract_book_text.mjs', 'reconstructed'],
    ['rubric.md', 'recovered'],
    ['review_prompt.md', 'recovered'],
    ['output_schema.json', 'recovered'],
    ['calibration.md', 'recovered'],
    ['ERRATA.md', 'maintained'],
    ['hindsight.md', 'maintained']
  ]);

  const entries = await readdir(harnessDirectory, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  assert.ok(files.length >= provenance.size, 'harness/ must contain at least the known provenance-mapped files');

  for (const file of files) {
    const contents = await readFile(new URL(file, harnessDirectory), 'utf8');
    const declaresReconstructed = /RECONSTRUCTED/.test(contents);
    const declaresRecovered = /recovered verbatim/i.test(contents);
    const status = provenance.get(file);

    if (status === 'reconstructed') {
      assert.ok(declaresReconstructed, `${file} must disclose reconstruction provenance`);
    } else if (status === 'recovered') {
      assert.ok(!declaresReconstructed, `${file} is verbatim-recovered and must not claim reconstruction`);
      assert.ok(declaresRecovered, `${file} is verbatim-recovered and must say so`);
    } else if (status === 'maintained') {
      assert.ok(!declaresReconstructed, `${file} is a maintained document and must not claim reconstruction`);
      assert.ok(
        /Provenance: MAINTAINED/.test(contents),
        `${file} is a maintained document and must carry a "Provenance: MAINTAINED" disclosure`
      );
    } else {
      assert.ok(
        declaresReconstructed || declaresRecovered,
        `${file} is not in the known harness provenance map and must declare itself RECONSTRUCTED or recovered verbatim so it cannot silently skip labeling`
      );
    }
  }

  const rubric = await readFile(new URL('rubric.md', harnessDirectory), 'utf8');
  assert.ok(rubric.includes(
    '5 = factually accurate, predictions largely came true · 4 = grounded in primary sources, core thesis not falsified · 3 = real data, significant unproven leaps · 2 = speculation dominates, key predictions failed · 1 = core claims falsified or purely conspiratorial.'
  ));
});

test('recovered review prompt includes the real packet contract and every hindsight fact', async () => {
  const prompt = await readFile(new URL('../harness/review_prompt.md', import.meta.url), 'utf8');

  for (const requiredText of [
    '{{BOOK_PACKET_PATH}}',
    '{{REVIEW_OUTPUT_PATH}}',
    // one distinctive phrase per hindsight bullet, in original order — the reconstruction this
    // replaces kept 6 of these 15 and dropped every "directionally right" concession
    'No "MOASS" (Mother of All Short Squeezes) ever occurred',
    'GameStop did a 4-for-1 stock split (via dividend) in July 2022',
    "The SEC's October 2021 staff report",
    '~122% of float (Jan 2021) to ~20% by Feb 2021',
    'Citadel was never margin-called into collapse',
    'Direct registration (DRS/Computershare) grew to ~75M shares',
    'inflation predictions were directionally right',
    'The Fed reverse repo facility peaked ~$2.55T (Dec 2022)',
    'Evergrande defaulted (Dec 2021)',
    'claims of CS fragility were directionally right',
    'Archegos (Mar 2021) was a real swaps blow-up',
    'the EU banned PFOF (phase-out by 2026)',
    'Fails-to-deliver (FTDs) and naked shorting are real, documented market phenomena historically',
    'launched an NFT marketplace in 2022',
    'DTCC/NSCC/OCC continue operating normally'
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
