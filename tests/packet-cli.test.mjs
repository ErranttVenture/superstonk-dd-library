import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { digest } from '../scripts/preservation.mjs';
import { validateAgainstSchema } from '../scripts/schema-validator.mjs';
import { buildPacket } from '../harness/assemble_review.mjs';
import { runNodeCli } from './cli-test-helpers.mjs';

const bodyAfterSeparator = (text) => text.slice(text.indexOf('\n---\n') + 5);
const longestLine = (text) => Math.max(...text.split('\n').map((line) => line.replace(/\r$/, '').length));

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'dd-packet-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const root = join(directory, 'repo');
  await mkdir(root);
  for (const part of ['harness', 'scripts', 'data', 'submissions']) {
    await cp(new URL(`../${part}/`, import.meta.url), join(root, part), { recursive: true });
  }
  const master = JSON.parse(await readFile(join(root, 'data/master.json'), 'utf8'));
  const record = master.find((item) => item.pos === 251);
  const output = join(directory, '251.txt');
  const run = (path = output, extra = []) => runNodeCli(join(root, 'harness/assemble_review.mjs'), [
    '--pos', '251', '--packet-out', path, '--evaluated-on', '2026-09-17', ...extra
  ]);
  const save = () => writeFile(join(root, 'data/master.json'), JSON.stringify(master));
  return { directory, root, master, record, output, run, save };
}

test('packet CLI builds 251 with p2 metadata and the calibrated 500-character line wrap', async (t) => {
  const { root, record, output, run } = await fixture(t);
  const result = await run();
  assert.equal(result.status, 0, result.stderr);
  const packet = await readFile(output, 'utf8');
  const preserved = await readFile(join(root, record.submission.preserved_text.path), 'utf8');
  assert.match(packet, /^PAGES: n\/a$/m);
  assert.match(packet, /^PLATFORM: other$/m);
  assert.match(packet, /^TEXT COVERAGE: full text$/m);
  assert.match(packet, /^EVALUATED ON: 2026-09-17$/m);
  assert.ok(longestLine(bodyAfterSeparator(preserved)) > 500, 'fixture must exercise wrapping');
  assert.ok(longestLine(packet) <= 500, 'packet lines must fit the calibrated Read-safe width');
  assert.equal(packet, buildPacket(record, bodyAfterSeparator(preserved), { contract: 'p2', evaluatedOn: '2026-09-17' }));
});

test('packet CLI verifies hashes, requires a community preserved copy and a separator', async (t) => {
  const { root, record, output, run, save } = await fixture(t);
  const copy = structuredClone(record.submission.preserved_text);
  record.submission.preserved_text.sha256 = '0'.repeat(64);
  await save();
  let result = await run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /251.*SHA-256 mismatch/);
  delete record.submission.preserved_text;
  await save();
  result = await run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /251.*community.*preserved_text/);
  result = await runNodeCli(join(root, 'harness/assemble_review.mjs'), ['--pos', '1', '--packet-out', output, '--evaluated-on', '2026-09-17']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /1.*community.*preserved_text/);
  record.submission.preserved_text = copy;
  const bytes = Buffer.from('Attribution without a separator\n');
  copy.sha256 = digest(bytes);
  await writeFile(join(root, copy.path), bytes);
  await save();
  result = await run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /251.*separator/);
  await assert.rejects(readFile(output), { code: 'ENOENT' });
});

test('packet CLI uses the first separator, keeps CRLF and blank lines, and wraps long lines only at spaces', async (t) => {
  const { root, record, output, run, save } = await fixture(t);
  const paragraph = Array.from({ length: 700 }, (_, index) => `word${index}`).join(' ');
  const body = `\r\n${paragraph}\r\n---\r\nSecond section\r\n`;
  const bytes = Buffer.from(`Attribution\r\n---\r\n${body}`);
  await writeFile(join(root, record.submission.preserved_text.path), bytes);
  record.submission.preserved_text.sha256 = digest(bytes);
  await save();
  const result = await run();
  assert.equal(result.status, 0, result.stderr);
  const packetBody = bodyAfterSeparator(await readFile(output, 'utf8'));
  assert.ok(longestLine(packetBody) <= 500);
  const lines = packetBody.split('\r\n');
  assert.equal(lines[0], '', 'the blank line after the separator stays');
  assert.equal(lines[1].split('\n').join(' '), paragraph, 'wrapping only replaces spaces with line breaks');
  assert.deepEqual(lines.slice(2), ['---', 'Second section', '']);
});

test('packet CLI reports a missing output directory outside the repository clearly', async (t) => {
  const { directory, run } = await fixture(t);
  const result = await run(join(directory, 'missing', 'packet.txt'));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Packet output directory does not exist/);
  assert.doesNotMatch(result.stderr, /ENOENT/);
});

test('CLI prints the calibrated StructuredOutput schema and validates a review output', async (t) => {
  const { directory, root } = await fixture(t);
  const cli = join(root, 'harness/assemble_review.mjs');
  const schema = JSON.parse(await readFile(join(root, 'harness/output_schema.json'), 'utf8'));

  const printed = await runNodeCli(cli, ['--tool-schema']);
  assert.equal(printed.status, 0, printed.stderr);
  const { $schema, $id, $comment, title, ...calibrated } = schema;
  assert.deepEqual(JSON.parse(printed.stdout), calibrated);

  const valid = join(directory, 'valid.json');
  await cp(new URL('../harness/calibration-runs/p2/candidate/009-r1.json', import.meta.url), valid);
  const passed = await runNodeCli(cli, ['--pos', '9', '--validate-output', valid]);
  assert.equal(passed.status, 0, passed.stderr);
  assert.match(passed.stdout, /valid/i);

  const wrongPosition = await runNodeCli(cli, ['--pos', '18', '--validate-output', valid]);
  assert.equal(wrongPosition.status, 1);
  assert.match(wrongPosition.stderr, /pos 9.*18/);

  const invalid = join(directory, 'invalid.json');
  const output = JSON.parse(await readFile(valid, 'utf8'));
  delete output.summary;
  assert.notDeepEqual(validateAgainstSchema(schema, output), []);
  await writeFile(invalid, JSON.stringify(output));
  const failed = await runNodeCli(cli, ['--pos', '9', '--validate-output', invalid]);
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /summary/);
});

test('packet CLI rejects repository paths, including a directory alias, and never replaces output', async (t) => {
  const { directory, root, output, run } = await fixture(t);
  for (const path of [join(root, 'packet.txt'), join(root, 'missing', 'packet.txt')]) {
    const result = await run(path);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /outside the repository/);
    await assert.rejects(readFile(path), { code: 'ENOENT' });
  }
  const alias = join(directory, 'alias');
  await symlink(root, alias, 'junction');
  const result = await run(join(alias, 'packet.txt'));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /outside the repository/);
  await writeFile(output, 'Keep existing output');
  assert.equal((await run()).status, 1);
  assert.equal(await readFile(output, 'utf8'), 'Keep existing output');
});

test('packet CLI refuses malformed evaluation dates and mixed CLI modes', async (t) => {
  const { root, output } = await fixture(t);
  for (const date of ['2026-2-01', '2026-02-30']) {
    const result = await runNodeCli(join(root, 'harness/assemble_review.mjs'), ['--pos', '251', '--packet-out', output, '--evaluated-on', date]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /evaluated-on.*YYYY-MM-DD/);
  }
  const result = await runNodeCli(join(root, 'harness/assemble_review.mjs'), ['--pos', '251', '--packet-out', output,
    '--evaluated-on', '2026-09-17', '--prompt', 'p1']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage:/);
});

test('repository validation CLI enforces provenance on an unreviewable community record', async (t) => {
  const { root, record, save } = await fixture(t);
  record.review_status = 'unreviewable';
  record.summary = 'Not enough readable text for a fair review.';
  await save();
  const result = await runNodeCli(join(root, 'scripts/validate-repository.mjs'));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /pos 251.*review_provenance/);
  record.review_provenance = { model: 'claude-haiku-4-5-20251001', evaluated_on: '2026-09-17',
    hindsight_version: 'v2', prompt_revision: 'p2', reviewer: 'QA maintainer' };
  await save();
  const fixed = await runNodeCli(join(root, 'scripts/validate-repository.mjs'));
  assert.equal(fixed.status, 0, fixed.stderr);
});
