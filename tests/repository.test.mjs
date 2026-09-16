import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

import { checkDatasetInvariants } from '../scripts/dataset-invariants.mjs';

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

test('keeps the preserved 250 intact and any community block contiguous', async () => {
  const master = JSON.parse(
    await readFile(new URL('../data/master.json', import.meta.url), 'utf8')
  );
  const baseline = JSON.parse(
    await readFile(new URL('../data/original-master.json', import.meta.url), 'utf8')
  );

  assert.ok(Array.isArray(master));
  assert.ok(master.length >= 250);

  const invariants = checkDatasetInvariants(master, baseline);
  assert.deepEqual(invariants.errors, []);
  assert.equal(invariants.preserved, 250);

  for (const record of master.slice(250)) {
    assert.equal(record.source_corpus, 'community');
  }
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
    ['hindsight.md', 'maintained'],
    ['prompt_versions.md', 'maintained'],
    ['assemble_review.mjs', 'maintained']
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
    'CC BY-SA 4.0',
    'Submit a new DD',
    'pending',
    'unrated',
    'archive',
    'market-structure',
    'submit-dd.yml'
  ]) {
    assert.ok(contributing.includes(requiredText), `CONTRIBUTING.md must contain ${requiredText}`);
  }
});

test('documents the submission bar, lifecycle and unrated meaning', async () => {
  const contributing = await readFile(new URL('../CONTRIBUTING.md', import.meta.url), 'utf8');
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  const harness = await readFile(new URL('../harness/README.md', import.meta.url), 'utf8');

  for (const checkId of [
    'url_resolves',
    'archive_present',
    'no_duplicate',
    'byline_present',
    'published_valid',
    'thesis_present',
    'copyright_ack'
  ]) {
    assert.ok(contributing.includes(checkId), `CONTRIBUTING.md must publish the ${checkId} check`);
  }

  for (const requiredText of [
    'Quality, plausibility',
    'is not a gate',
    'pos 251',
    'rebase'
  ]) {
    assert.ok(contributing.includes(requiredText), `CONTRIBUTING.md must contain ${requiredText}`);
  }

  assert.ok(
    readme.includes('Pending means unrated, not rated zero'),
    'README.md must state that pending is not a failing rating'
  );
  assert.ok(readme.includes('Submit a new DD'), 'README.md must link the submission path');
  assert.ok(
    readme.includes('data/original-master.json'),
    'README.md must keep pointing at the immutable baseline'
  );
  assert.ok(
    harness.includes('review_provenance'),
    'harness/README.md must require review provenance on community reviews'
  );
});

test('assigns exact repository ownership', async () => {
  const codeowners = (await readFile(new URL('../CODEOWNERS', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
  assert.equal(codeowners, '* @ErranttVenture\n');
});

test('ships structurally valid concise issue forms with required fields', async () => {
  const forms = new Map([
    ['dispute-rating.yml', ['book', 'dispute', 'evidence', 'proposed_change']],
    ['correction.yml', ['location', 'correction', 'evidence']],
    ['submit-dd.yml', ['title', 'byline', 'url', 'published', 'platform', 'thesis', 'text_available', 'attribution']]
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

test('submission form puts optional full text last after permission and permits a blank archive', async () => {
  const form = (await readFile(new URL('../.github/ISSUE_TEMPLATE/submit-dd.yml', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
  const fields = form.split(/\n  - id: /).slice(1);
  assert.ok(fields.at(-1).startsWith('full_text\n'));
  assert.ok(fields.at(-2).startsWith('full_text_permission\n'));
  assert.match(fields.at(-2), /author or have permission.*preserve and publicly display.*attribution/);
  assert.doesNotMatch(fields.find((field) => field.startsWith('archive_url\n')), /required: true/);
  assert.match(fields.at(-1), /label: Full text \(Markdown\)/);
});

test('publication waits for validation and isolates eligible data triggers from unrelated pushes', async () => {
  const ci = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.match(ci, /publication-changes:[\s\S]*needs: validate/);
  assert.match(ci, /fetch-depth: 0/);
  assert.match(ci, /needs: \[validate, publication-changes\]/);
  assert.match(ci, /needs.publication-changes.outputs.publish == 'true'/);
  assert.match(ci, /github.repository == 'ErranttVenture\/superstonk-dd-library'/);
  assert.match(ci, /cancel-in-progress: false/);
  assert.match(ci, /JUSTTHEBROS_DEPLOY_HOOK_URL/);
  assert.match(ci, /Publication skipped.*configure JUSTTHEBROS_DEPLOY_HOOK_URL/);
  assert.doesNotMatch(ci, /contents: write|pull_request_target/);
  const acceptance = await readFile(new URL('../.github/workflows/submission-open-pr.yml', import.meta.url), 'utf8');
  assert.match(acceptance, /github.event.issue.state == 'open'/);
  assert.match(acceptance, /\.state == "open"/);
  assert.match(acceptance, /git add -- "submissions\/\$\{ISSUE_NUMBER\}\/dd.md"/);
});

test('submission form labels match the parser contract', async () => {
  const form = await readFile(
    new URL('../.github/ISSUE_TEMPLATE/submit-dd.yml', import.meta.url),
    'utf8'
  );

  for (const label of [
    'Title',
    'Author / byline',
    'Source URL',
    'Archive snapshot URL',
    'Publication date',
    'Platform',
    'Length in pages',
    'Compilation',
    'One-line thesis',
    'Is the full text readable at the source URL?',
    'Related existing record',
    'Attribution',
    'Copyright acknowledgement'
  ]) {
    assert.ok(
      form.includes(`label: ${label}`) || form.includes(`label: "${label}"`),
      `submit-dd.yml must keep the label "${label}" that parseSubmissionIssue matches on`
    );
  }
});

test('no issue-form option is a bare YAML 1.1 boolean', async () => {
  // GitHub parses issue forms as YAML 1.1, where bare Yes/No/On/Off/Y/N are booleans, and its
  // form validator rejects boolean options outright: the template then fails validation and
  // disappears from the New Issue chooser. A form nobody can open takes every downstream
  // workflow with it, so this is a total-failure mode hiding behind a missing pair of quotes.
  const booleanish = /^\s*-\s*(?:y|n|yes|no|true|false|on|off)\s*$/i;

  for (const filename of ['submit-dd.yml', 'dispute-rating.yml', 'correction.yml']) {
    const form = (await readFile(
      new URL(`../.github/ISSUE_TEMPLATE/${filename}`, import.meta.url),
      'utf8'
    )).replace(/\r\n/g, '\n');

    for (const [index, line] of form.split('\n').entries()) {
      assert.doesNotMatch(
        line,
        booleanish,
        `${filename}:${index + 1} — "${line.trim()}" is a YAML 1.1 boolean; quote it`
      );
    }
  }
});

test('submission workflows pin actions, scope permissions and avoid body interpolation', async () => {
  const workflows = new Map([
    ['submission-check.yml', 'issues: write'],
    ['submission-open-pr.yml', 'contents: write']
  ]);

  for (const [filename, requiredPermission] of workflows) {
    const workflow = (await readFile(
      new URL(`../.github/workflows/${filename}`, import.meta.url),
      'utf8'
    )).replace(/\r\n/g, '\n');

    assert.ok(workflow.includes(requiredPermission), `${filename} must declare ${requiredPermission}`);
    assert.match(workflow, /uses: actions\/checkout@[0-9a-f]{40}/, `${filename} must pin checkout by SHA`);
    assert.match(workflow, /uses: actions\/setup-node@[0-9a-f]{40}/, `${filename} must pin setup-node by SHA`);
    assert.ok(
      workflow.includes('ISSUE_BODY: ${{ github.event.issue.body }}'),
      `${filename} must pass the issue body through an environment variable`
    );
    assert.doesNotMatch(
      workflow,
      /run:[^\n]*\$\{\{\s*github\.event\.issue\.body/,
      `${filename} must never interpolate the issue body into a run step`
    );
  }

  const openPr = (await readFile(
    new URL('../.github/workflows/submission-open-pr.yml', import.meta.url),
    'utf8'
  )).replace(/\r\n/g, '\n');
  assert.match(openPr, /collaborators\/\$\{ACTOR\}\/permission/);
  assert.ok(openPr.includes("github.event.label.name == 'accepted'"));
});

test('submission publishing uses only the job token after authorization without persisting checkout credentials', async () => {
  const openPr = (await readFile(
    new URL('../.github/workflows/submission-open-pr.yml', import.meta.url),
    'utf8'
  )).replace(/\r\n/g, '\n');

  assert.doesNotMatch(openPr, /SUBMISSION_PR_TOKEN|secrets\./);
  assert.doesNotMatch(openPr, /^\s+token:/m, 'checkout must use its default job token');
  const guardIndex = openPr.indexOf('- name: Require a maintainer to have applied the label');
  const checkoutIndex = openPr.indexOf('- uses: actions/checkout@');
  const inspectIndex = openPr.indexOf('- name: Inspect existing submission');
  const appendIndex = openPr.indexOf('- name: Append the pending record');
  const validateIndex = openPr.indexOf('- name: Validate the result');
  const publishIndex = openPr.indexOf('- name: Open the pull request');
  for (const index of [guardIndex, checkoutIndex, inspectIndex, appendIndex, validateIndex, publishIndex]) {
    assert.ok(index >= 0, 'the expected authorization, preparation and publishing steps must exist');
  }
  assert.ok(guardIndex < checkoutIndex && checkoutIndex < inspectIndex);
  assert.ok(inspectIndex < appendIndex && appendIndex < validateIndex && validateIndex < publishIndex);
  assert.match(openPr.slice(checkoutIndex, inspectIndex), /persist-credentials: false/);
  assert.doesNotMatch(openPr.slice(appendIndex, publishIndex), /GH_TOKEN|github\.token/);
  const publish = openPr.slice(publishIndex);
  assert.ok(publish.includes('GH_TOKEN: ${{ github.token }}'));
  assert.ok(publish.indexOf('gh auth setup-git --hostname github.com') >= 0);
  assert.ok(publish.indexOf('gh auth setup-git --hostname github.com') < publish.indexOf('git push'));
  assert.doesNotMatch(publish, /git push[^\n]*--force/);
});

test('submission retries distinguish existing PRs from branches left by failed PR creation', async () => {
  const openPr = (await readFile(
    new URL('../.github/workflows/submission-open-pr.yml', import.meta.url),
    'utf8'
  )).replace(/\r\n/g, '\n');

  assert.ok(openPr.includes('group: submission-pr-${{ github.event.issue.number }}'));
  assert.match(openPr, /cancel-in-progress: false/);
  const inspect = openPr.slice(openPr.indexOf('- name: Inspect existing submission'), openPr.indexOf('- name: Write the issue body'));
  assert.match(inspect, /gh api --method GET/);
  assert.ok(inspect.includes('-f head="${GITHUB_REPOSITORY_OWNER}:$branch"'));
  assert.ok(inspect.includes('-f base=main -f state=all'));
  assert.match(inspect, /pr=\$\(gh api[\s\S]*?\)\n/);
  assert.ok(inspect.includes('echo "pr_exists=true" >> "$GITHUB_OUTPUT"'));
  assert.ok(inspect.includes('remote=$(git ls-remote --heads origin "refs/heads/$branch")'));
  assert.doesNotMatch(inspect, /\|\| true|2>\s*\/dev\/null|if (?:git|gh) /, 'lookup failures must fail the step');

  for (const step of ['Write the issue body to a file', 'Append the pending record', 'Validate the result']) {
    assert.ok(openPr.includes(`- name: ${step}\n        if: steps.submission.outputs.pr_exists != 'true' && steps.submission.outputs.branch_exists != 'true'`));
  }
  const publish = openPr.slice(openPr.indexOf('- name: Open the pull request'));
  assert.match(publish, /if: steps\.submission\.outputs\.pr_exists != 'true'\n/);
  assert.match(publish, /if \[ "\$BRANCH_EXISTS" != true \]; then\n[\s\S]*?git push[^\n]*\n\s+fi\n\s+gh pr create/);
  assert.ok(publish.includes('--head "$branch"'));
  assert.ok(publish.includes('${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}'));
  assert.match(publish, /Automated/);
  assert.match(publish, /sign/);
});

test('submission acceptance tests the unmodified checkout and only validates data after appending', async () => {
  const openPr = (await readFile(
    new URL('../.github/workflows/submission-open-pr.yml', import.meta.url),
    'utf8'
  )).replace(/\r\n/g, '\n');
  const inspectIndex = openPr.indexOf('- name: Inspect existing submission');
  const testIndex = openPr.indexOf('- name: Test the unmodified checkout');
  const appendIndex = openPr.indexOf('- name: Append the pending record');
  const validateIndex = openPr.indexOf('- name: Validate the result');

  assert.ok(testIndex >= 0, 'the suite must run as its own step');
  assert.ok(inspectIndex < testIndex && testIndex < appendIndex);
  assert.ok(openPr.includes("- name: Test the unmodified checkout\n        if: steps.submission.outputs.pr_exists != 'true' && steps.submission.outputs.branch_exists != 'true'\n        run: npm test\n"));
  // The suite copies data/master.json; running it after the append lets fixtures collide with the new record.
  assert.doesNotMatch(openPr.slice(appendIndex), /npm test/);
  assert.match(openPr.slice(validateIndex), /run: npm run validate\n/);
});

test('CI and submission event filters keep publication from recursively starting submissions', async () => {
  const readWorkflow = async (name) => (await readFile(
    new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8'
  )).replace(/\r\n/g, '\n');
  const ci = await readWorkflow('ci.yml');
  assert.match(ci, /\non:\n  pull_request:\n  push:\n    branches:\n      - main\n\npermissions:/);
  assert.match(ci, /persist-credentials: false/);
  assert.match(await readWorkflow('submission-check.yml'), /\non:\n  issues:\n    types: \[opened, edited\]\n\npermissions:/);
  assert.match(await readWorkflow('submission-open-pr.yml'), /\non:\n  issues:\n    types: \[labeled\]\n\npermissions:/);
});

test('maintainer instructions cover job-token PR creation, manual CI, signing and partial retries', async () => {
  const contributing = await readFile(new URL('../CONTRIBUTING.md', import.meta.url), 'utf8');
  assert.match(contributing, /Allow GitHub Actions to create and approve pull requests/);
  assert.match(contributing, /Approve workflows to run/);
  assert.match(contributing, /close and reopen/i);
  assert.match(contributing, /git commit --amend --no-edit --reset-author -S/);
  assert.match(contributing, /git push --force-with-lease/);
  assert.match(contributing, /branch exists but no pull request/i);
  assert.doesNotMatch(contributing, /missing \(or its token has expired\)|never start workflow runs/);
});

test('routes forward reviews through the versioned hindsight machinery', async () => {
  const hindsight = await readFile(new URL('../harness/hindsight.md', import.meta.url), 'utf8');
  const harnessReadme = await readFile(new URL('../harness/README.md', import.meta.url), 'utf8');
  const contributing = await readFile(new URL('../CONTRIBUTING.md', import.meta.url), 'utf8');
  const calibration = await readFile(new URL('../harness/calibration.md', import.meta.url), 'utf8');
  const reviewPrompt = await readFile(new URL('../harness/review_prompt.md', import.meta.url), 'utf8');

  assert.ok(
    hindsight.includes('## Assembling the block for a review'),
    'hindsight.md must document how to assemble the block'
  );
  assert.ok(hindsight.includes('hindsight_version'), 'hindsight.md must name the hindsight_version stamp');
  assert.ok(
    harnessReadme.includes('hindsight version'),
    'harness/README.md must tell operators to record a hindsight version'
  );
  assert.ok(
    !harnessReadme.includes('hindsight cutoff'),
    'harness/README.md must not reference the retired hindsight-cutoff wording'
  );
  assert.ok(
    !contributing.includes('hindsight cutoff'),
    'CONTRIBUTING.md must not reference the retired hindsight-cutoff wording'
  );
  assert.ok(
    calibration.includes('Assembling the block for a review'),
    'calibration.md must point verify passes at the hindsight.md assembly section'
  );
  assert.ok(
    reviewPrompt.includes('hindsight.md'),
    'review_prompt.md must point at hindsight.md for assembling future reviews'
  );
});

function fencedBlock(text, opening) {
  return [...text.replace(/\r\n/g, '\n').matchAll(/```\n([\s\S]*?)\n```/g)]
    .map((match) => match[1])
    .find((block) => block.startsWith(opening));
}

test('p2 removes historical corpus framing and runtime steps while preserving p1', async () => {
  const versions = await readFile(new URL('../harness/prompt_versions.md', import.meta.url), 'utf8');
  const p1 = await readFile(new URL('../harness/review_prompt.md', import.meta.url), 'utf8');
  const review = fencedBlock(versions, 'You are one reviewer for the DD Library');
  const verify = fencedBlock(versions, 'Calibration check for the DD Library');

  assert.ok(versions.startsWith('**Provenance: MAINTAINED.**'));
  assert.ok(review && verify, 'prompt_versions.md must carry the p2 review and verify prompts');
  for (const block of [review, verify]) {
    assert.doesNotMatch(block, /214-book|FlipHTML5 bookcase|Using the Write tool/);
  }
  assert.match(p1, /214-book/);
  assert.match(p1, /FlipHTML5 bookcase/);
  assert.match(p1, /Using the Write tool/);
  assert.match(review, /Return your COMPLETE assessment object as JSON matching the output schema, and nothing else\.$/);
});

test('p2 review prompt is pinned to the recorded candidate text', async () => {
  const versions = await readFile(new URL('../harness/prompt_versions.md', import.meta.url), 'utf8');
  const review = fencedBlock(versions, 'You are one reviewer for the DD Library');

  // Sections stay separated by blank lines, as in p1, so expanded placeholders never run together.
  for (const marker of ['STEP 1 —', '${typeBlock}', '${HINDSIGHT}', '${RUBRIC}', 'TIME RULES:', 'RULES:', 'Return your COMPLETE']) {
    assert.ok(review.includes(`\n\n${marker}`), `p2 must separate ${marker} from the preceding section with a blank line`);
  }
  // Any change to the candidate is a logged revision round in prompt_versions.md; update this digest only with one.
  assert.equal(createHash('sha256').update(review).digest('hex'), '994dd322e89c203b9931073b4de72b01124b637e0ec575ed528a3f4d82ef36cf');
});

test('p2 calibration records its amended protocol and runtime before any run', async () => {
  const versions = (await readFile(new URL('../harness/prompt_versions.md', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');

  assert.match(versions, /### Protocol amendment \(2026-09-16, recorded before any run\)/);
  assert.match(versions, /\*\*9, 18, 36, 45, 54, 63, 72, 81, 99, 108\*\*/);
  assert.match(versions, /`model: 'haiku'`/);
  assert.match(versions, /StructuredOutput\s+tool/);
  assert.match(versions, /Read\s+tool/);
  assert.match(versions, /at least 9 matched books/);
  assert.match(versions, /\| Books with validity difference at most 1 \| At least 90% of matched books \(9 of 10\) \|/);
  assert.match(versions, /\| Books with validity difference at least 2 \| At most 1,/);
  assert.match(versions, /lines of at most 500 characters/);
  assert.doesNotMatch(versions, /real Anthropic API response|FILE: packets\/NNN\.txt|132 planned calls|Provide no tools/);
});

test('p2 calibration fixes packet delivery, hindsight dating and failure exclusion', async () => {
  const versions = (await readFile(new URL('../harness/prompt_versions.md', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');

  assert.match(versions, /PUBLISHED date is later than the\s+hindsight block's "as of" date/);
  assert.match(versions, /"as of mid-2026" as\s+2026-07-21/);
  assert.match(versions, /exclude\s+that\s+book\s+from\s+both\s+arms/);
  assert.doesNotMatch(versions, /leave the gate incomplete/);
  // Report-only figures share the gate's denominator: an excluded book's surviving runs never skew one arm.
  assert.match(versions, /retained\s+matched\s+books\s+only/);
  assert.match(versions, /excluded\s+books\s+are\s+reported\s+separately/);
  assert.doesNotMatch(versions, /across\s+all\s+valid\s+runs/);
  // Reviews list 3-8 claims each, so arms share books and run counts but not a claim denominator.
  assert.match(versions, /same\s+retained\s+books\s+and\s+run\s+counts/);
  assert.match(versions, /that\s+arm's\s+total\s+assessed\s+claims/);
  assert.doesNotMatch(versions, /share\s+one\s+denominator/);
  assert.match(versions, /current hindsight version/);
  assert.doesNotMatch(versions, /two v2 fact bullets|15 unchanged v1 bullets/);
  assert.match(versions, /never a file or commit reference/);
  const issuePaths = versions.match(/submissions\/<issue>\/dd\.md/g) ?? [];
  const codeIssuePaths = versions.match(/`submissions\/<issue>\/dd\.md`/g) ?? [];
  assert.ok(issuePaths.length > 0);
  assert.equal(codeIssuePaths.length, issuePaths.length, 'an <issue> placeholder outside a code span is stripped when GitHub renders');
});

test('p1 pointer notes sit beside what they describe and community reviews use preserved copies', async () => {
  const p1 = (await readFile(new URL('../harness/review_prompt.md', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
  const calibration = (await readFile(new URL('../harness/calibration.md', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
  const readme = (await readFile(new URL('../harness/README.md', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');

  const p1Note = p1.indexOf('> **Prompt versions.**');
  assert.ok(p1Note >= 0 && p1Note < p1.indexOf('## Placeholder substitution'), 'the p1 note belongs with the versioning note');
  const calibrationNote = calibration.indexOf('> **Prompt versions.**');
  assert.ok(calibrationNote > calibration.indexOf('## Independent verify pass'), 'the calibration note belongs with the verify prompt');

  const community = readme.slice(readme.indexOf('## Reviewing a community submission'));
  assert.match(community, /submission\.preserved_text/);
  assert.doesNotMatch(community, /Text capture is manual for any source that is not a FlipHTML5 publication\./);
});

test('p2 preserves all three type blocks with only book changed to work', async () => {
  const versions = await readFile(new URL('../harness/prompt_versions.md', import.meta.url), 'utf8');
  const p1 = await readFile(new URL('../harness/review_prompt.md', import.meta.url), 'utf8');
  const typeBlocks = (text) => [...text.replace(/\r\n/g, '\n').matchAll(/```\n(This (?:book|work)[\s\S]*?)\n```/g)]
    .map((match) => match[1]);
  const originalBlocks = typeBlocks(p1);

  assert.equal(originalBlocks.length, 3);
  assert.deepEqual(typeBlocks(versions), originalBlocks.map((block) => block.replace(/\bbook\b/g, 'work')));
});

test('p2 stays a candidate with a disclosed unrun calibration gate', async () => {
  const versions = await readFile(new URL('../harness/prompt_versions.md', import.meta.url), 'utf8');

  assert.match(versions, /\| p1 \| FROZEN \|/);
  assert.match(versions, /\| p2 \| CANDIDATE \|/);
  assert.match(versions, /\*\*Verdict: NOT RUN — p2 remains CANDIDATE\.\*\*/);
  assert.match(versions, /API calls: \*\*0\*\*/);
  assert.match(versions, /\[Activation record\]\(#activation-record\)/);
});
