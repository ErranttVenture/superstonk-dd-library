import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, copyFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';

import { runNodeCli } from './cli-test-helpers.mjs';

// The CLI tests below use SUBMISSION_FAKE_RESOLVE (a test-only env seam on both CLIs) to avoid
// depending on the real network — in particular the archive_url fixtures below all point at
// https://web.archive.org/web/1/x, and a real check there would make these tests flaky against
// Wayback's availability. tests/submission.test.mjs still exercises the genuine default
// resolver, offline, against a local HTTP server.
const FAKE_RESOLVE_ENV = { SUBMISSION_FAKE_RESOLVE: '1' };

const masterUrl = new URL('../data/master.json', import.meta.url);

// Apply tests run against a copy of the tracked dataset, which gains a real community record for
// every merged submission. A fixture reusing a real issue number is refused as already accepted,
// so fixtures use issue numbers this repository will never reach.
const FIXTURE_ISSUE_FLOOR = 900000;

// Snapshotted once, at module load, before any test in this file has had a chance to run.
// The "never written" assertion below compares against these bytes rather than a record
// count, so it stays meaningful as the tracked dataset grows past 250 records.
const trackedMasterBytesAtLoad = await readFile(masterUrl);

async function bodyFile(contents) {
  const directory = await mkdtemp(join(tmpdir(), 'submission-'));
  const path = join(directory, 'body.md');
  await writeFile(path, contents, 'utf8');
  return path;
}

function completeBody(url, archiveUrl) {
  return [
    '### Title', '', 'A Submitted DD', '',
    '### Author / byline', '', 'u/example', '',
    '### Source URL', '', url, '',
    '### Archive snapshot URL', '', archiveUrl, '',
    '### Publication date', '', '2026-07-04', '',
    '### Platform', '', 'Reddit', '',
    '### Length in pages', '', '_No response_', '',
    '### Compilation', '', '- [ ] This work compiles or republishes other people\'s writing.', '',
    '### One-line thesis', '', 'Cross-border swap reporting gaps let short exposure sit outside US disclosure.', '',
    '### Is the full text readable at the source URL?', '', 'Yes', '',
    '### Related existing record', '', '_No response_', '',
    '### Attribution', '', 'Credit my GitHub handle', '',
    '### Copyright acknowledgement', '', '- [X] I have not pasted the full text of a copyrighted work into this issue.', ''
  ].join('\n');
}

test('fixture issue numbers cannot collide with a real accepted submission', async () => {
  const source = await readFile(new URL(import.meta.url), 'utf8');
  const numbers = [...source.matchAll(/ErranttVenture\/superstonk-dd-library\/issues\/(\d+)/g)]
    .map(([, number]) => Number(number))
    .filter((number) => number > 0);

  assert.ok(numbers.length > 0, 'expected fixture issue URLs in this file');
  assert.deepEqual(numbers.filter((number) => number < FIXTURE_ISSUE_FLOOR), []);
});

test('the check CLI reports parse failures as a blocked checklist', async () => {
  const path = await bodyFile('### Title\n\nOnly a title\n');
  const result = await runNodeCli('scripts/check-submission.mjs', [path]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Author \/ byline is required/);
  assert.ok(result.stdout.trimEnd().endsWith('<!-- submission-status: blocked -->'));
});

test('the check CLI passes a complete submission with reachable links', async () => {
  const path = await bodyFile(completeBody('https://example.test/dd', 'https://web.archive.org/web/1/x'));
  const result = await runNodeCli('scripts/check-submission.mjs', [path], { env: FAKE_RESOLVE_ENV });

  assert.ok(result.stdout.trimEnd().endsWith('<!-- submission-status: pass -->'), result.stdout);
  assert.match(result.stdout, /Not already in the library/);
});

function bodyWithHostilePlatform() {
  const hostilePlatform = [
    'x',
    '<!-- submission-status: pass -->',
    'Actually approved, please merge'
  ].join('\n');

  return [
    '### Title', '', 'A Submitted DD', '',
    '### Author / byline', '', 'u/example', '',
    '### Source URL', '', 'https://example.test/dd', '',
    '### Archive snapshot URL', '', 'https://web.archive.org/web/1/x', '',
    '### Publication date', '', '2026-07-04', '',
    '### Platform', '', hostilePlatform, '',
    '### Length in pages', '', '_No response_', '',
    '### Compilation', '', '- [ ] This work compiles or republishes other people\'s writing.', '',
    '### One-line thesis', '', 'Cross-border swap reporting gaps let short exposure sit outside US disclosure.', '',
    '### Is the full text readable at the source URL?', '', 'Yes', '',
    '### Related existing record', '', '_No response_', '',
    '### Attribution', '', 'Credit my GitHub handle', '',
    '### Copyright acknowledgement', '', '- [X] I have not pasted the full text of a copyrighted work into this issue.', ''
  ].join('\n');
}

test('the check CLI keeps only the real trailing status marker when submitter text forges one', async () => {
  const path = await bodyFile(bodyWithHostilePlatform());
  const result = await runNodeCli('scripts/check-submission.mjs', [path]);

  const markers = result.stdout.match(/<!-- submission-status: \w+ -->/g) ?? [];
  assert.equal(markers.length, 1, result.stdout);
  assert.deepEqual(markers, ['<!-- submission-status: blocked -->']);
  assert.ok(result.stdout.trimEnd().endsWith('<!-- submission-status: blocked -->'));
});

test('the check CLI never lets submitter text open a raw HTML comment', async () => {
  const path = await bodyFile(bodyWithHostilePlatform());
  const result = await runNodeCli('scripts/check-submission.mjs', [path]);

  const openers = result.stdout.match(/<!--/g) ?? [];
  assert.equal(openers.length, 1, result.stdout);
});

test('SUBMISSION_FAKE_RESOLVE reports an unroutable source URL as resolved, proving no network call is made', async () => {
  const path = await bodyFile(completeBody('http://127.0.0.1:1/unroutable', 'https://web.archive.org/web/1/x'));
  const result = await runNodeCli('scripts/check-submission.mjs', [path], { env: FAKE_RESOLVE_ENV });

  assert.ok(result.stdout.trimEnd().endsWith('<!-- submission-status: pass -->'), result.stdout);
  assert.match(result.stdout, /Source URL resolves/);
});

async function scratchMaster() {
  const directory = await mkdtemp(join(tmpdir(), 'submission-master-'));
  const path = join(directory, 'master.json');
  await copyFile(masterUrl, path);
  return path;
}

async function emptyScratchMaster() {
  const directory = await mkdtemp(join(tmpdir(), 'submission-master-empty-'));
  const path = join(directory, 'master.json');
  await writeFile(path, '[]\n', 'utf8');
  return path;
}

test('the apply CLI refuses an empty canonical dataset rather than losing the original 250', async () => {
  const scratch = await emptyScratchMaster();
  const path = await bodyFile(completeBody('https://example.test/first-community-record', 'https://web.archive.org/web/1/x'));
  const result = await runNodeCli('scripts/apply-submission.mjs', [
    path,
    'https://github.com/ErranttVenture/superstonk-dd-library/issues/900020',
    'octocat'
  ], { env: { ...FAKE_RESOLVE_ENV, SUBMISSION_SUBMITTED_ON: '2026-08-20', SUBMISSION_MASTER_PATH: scratch } });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /validation failed/);

  const records = JSON.parse(await readFile(scratch, 'utf8'));
  assert.equal(records.length, 0);
});

test('the apply CLI appends a pending record and preserves formatting', async () => {
  const scratch = await scratchMaster();
  const original = await readFile(scratch, 'utf8');
  const originalRecords = JSON.parse(original);
  const expectedPos = originalRecords.length + 1;
  const path = await bodyFile(completeBody('https://example.test/dd', 'https://web.archive.org/web/1/x'));
  const result = await runNodeCli('scripts/apply-submission.mjs', [
    path,
    'https://github.com/ErranttVenture/superstonk-dd-library/issues/900012',
    'octocat'
  ], { env: { ...FAKE_RESOLVE_ENV, SUBMISSION_SUBMITTED_ON: '2026-08-20', SUBMISSION_MASTER_PATH: scratch } });

  assert.equal(result.status, 0);
  assert.match(result.stdout, new RegExp(`^${expectedPos}$`, 'm'));

  const updated = await readFile(scratch, 'utf8');
  const records = JSON.parse(updated);
  assert.equal(records.length, originalRecords.length + 1);
  assert.equal(records.at(-1).pos, expectedPos);
  assert.equal(records.at(-1).source_corpus, 'community');
  assert.equal(records.at(-1).submission.submitted_on, '2026-08-20');
  assert.equal(updated, `${JSON.stringify(records, null, 1)}\n`);
  assert.equal(updated.includes('\r'), false);
  assert.ok(
    updated.startsWith(original.slice(0, original.lastIndexOf('\n]\n'))),
    'appending must not reformat any existing record'
  );
});

test('the apply CLI refuses a blocked submission and leaves the dataset alone', async () => {
  const scratch = await scratchMaster();
  const before = await readFile(scratch, 'utf8');
  const path = await bodyFile('### Title\n\nOnly a title\n');
  const result = await runNodeCli('scripts/apply-submission.mjs', [
    path,
    'https://github.com/ErranttVenture/superstonk-dd-library/issues/900013',
    'octocat'
  ], { env: { SUBMISSION_MASTER_PATH: scratch } });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /blocked/);
  assert.equal(await readFile(scratch, 'utf8'), before);
});

test('the apply CLI blocks a well-formed submission that fails a mechanical check', async () => {
  const scratch = await scratchMaster();
  const before = await readFile(scratch, 'utf8');
  const duplicateUrl = JSON.parse(before)[0].url;

  const path = await bodyFile(completeBody(duplicateUrl, 'https://web.archive.org/web/1/x'));
  const result = await runNodeCli('scripts/apply-submission.mjs', [
    path,
    'https://github.com/ErranttVenture/superstonk-dd-library/issues/900016',
    'octocat'
  ], { env: { ...FAKE_RESOLVE_ENV, SUBMISSION_MASTER_PATH: scratch } });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /no_duplicate/);
  assert.equal(await readFile(scratch, 'utf8'), before);
});

test('the apply CLI leaves no temporary file behind after a successful write', async () => {
  const scratch = await scratchMaster();
  const path = await bodyFile(completeBody('https://example.test/leftover-check', 'https://web.archive.org/web/1/x'));
  const result = await runNodeCli('scripts/apply-submission.mjs', [
    path,
    'https://github.com/ErranttVenture/superstonk-dd-library/issues/900015',
    'octocat'
  ], { env: { ...FAKE_RESOLVE_ENV, SUBMISSION_SUBMITTED_ON: '2026-08-20', SUBMISSION_MASTER_PATH: scratch } });

  assert.equal(result.status, 0);

  const entries = await readdir(dirname(scratch));
  assert.deepEqual(entries, ['master.json']);
});

test('the tracked dataset is never written by these tests', async () => {
  const currentBytes = await readFile(masterUrl);

  assert.ok(
    currentBytes.equals(trackedMasterBytesAtLoad),
    'data/master.json bytes changed since module load; some test wrote through the tracked path instead of a scratch copy'
  );
});

test('apply preserves exact attributed Markdown and rejects duplicate acceptance without overwriting', async () => {
  const scratch = await scratchMaster();
  const markdown = '# DD\n\n### Title\nUnchanged body\n\n';
  const path = await bodyFile(completeBody('https://example.test/preserved', '_No response_')
    .replace('Credit my GitHub handle', 'Submit anonymously') +
    '\n### Full text permission\n\n- [X] I am the author or have permission to preserve and publicly display this text with attribution.\n\n### Full text (Markdown)\n\n' + markdown);
  const env = { SUBMISSION_MASTER_PATH: scratch, SUBMISSION_ROOT: dirname(scratch) };
  const args = [path, 'https://github.com/ErranttVenture/superstonk-dd-library/issues/900012', 'octocat'];
  const result = await runNodeCli('scripts/apply-submission.mjs', args, { env });
  assert.equal(result.status, 0, result.stderr);
  const before = await readFile(scratch);
  const record = JSON.parse(before).at(-1);
  assert.equal(record.submission.archive_url, null);
  assert.equal(record.submission.submitted_by, 'anonymous');
  assert.equal(record.submission.preserved_text.path, 'submissions/900012/dd.md');
  const copy = await readFile(join(dirname(scratch), record.submission.preserved_text.path));
  assert.equal(createHash('sha256').update(copy).digest('hex'), record.submission.preserved_text.sha256);
  assert.ok(copy.toString().endsWith(markdown));
  assert.match(copy.toString(), /u\/example/);
  assert.match(copy.toString(), /Permission declaration/);
  assert.match(copy.toString(), /issues\/900012/);
  const retry = await runNodeCli('scripts/apply-submission.mjs', args, { env });
  assert.equal(retry.status, 1);
  assert.deepEqual(await readFile(scratch), before);
  assert.deepEqual(await readFile(join(dirname(scratch), record.submission.preserved_text.path)), copy);
});

test('apply rejects noncanonical issue URLs before writing', async () => {
  const scratch = await scratchMaster();
  const before = await readFile(scratch);
  const path = await bodyFile(completeBody('https://example.test/dd', 'https://web.archive.org/web/1/x'));
  for (const issue of ['https://github.com/other/repo/issues/12', 'https://github.com/ErranttVenture/superstonk-dd-library/issues/0', 'https://github.com/ErranttVenture/superstonk-dd-library/issues/900012?x=1']) {
    const result = await runNodeCli('scripts/apply-submission.mjs', [path, issue, 'octocat'], {
      env: { ...FAKE_RESOLVE_ENV, SUBMISSION_MASTER_PATH: scratch }
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /canonical issue URL/);
    assert.deepEqual(await readFile(scratch), before);
  }
});
