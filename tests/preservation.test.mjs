import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('transaction rolls back copy and temporary files if master replacement fails', async () => {
  const { writeAcceptance } = await import('../scripts/preservation.mjs');
  const root = await fs.mkdtemp(join(tmpdir(), 'preservation-'));
  const masterPath = join(root, 'master.json');
  await fs.writeFile(masterPath, 'original');
  await assert.rejects(writeAcceptance({ root, masterPath, original: 'original', serialized: 'updated',
    preserved: { path: 'submissions/12/dd.md', bytes: Buffer.from('copy') },
    io: { ...fs, rename: async () => { throw new Error('simulated rename failure'); } }
  }), /simulated rename failure/);
  assert.equal(await fs.readFile(masterPath, 'utf8'), 'original');
  await assert.rejects(fs.stat(join(root, 'submissions/12/dd.md')), { code: 'ENOENT' });
  assert.deepEqual((await fs.readdir(root)).sort(), ['master.json', 'submissions']);
  assert.deepEqual(await fs.readdir(join(root, 'submissions')), []);
});

test('transaction never overwrites existing copy or commits master after copy write fails', async () => {
  const { writeAcceptance } = await import('../scripts/preservation.mjs');
  for (const failure of ['existing', 'write']) {
    const root = await fs.mkdtemp(join(tmpdir(), 'preservation-'));
    const masterPath = join(root, 'master.json');
    await fs.writeFile(masterPath, 'original');
    const copyPath = join(root, 'submissions/12/dd.md');
    if (failure === 'existing') {
      await fs.mkdir(join(root, 'submissions/12'), { recursive: true });
      await fs.writeFile(copyPath, 'existing');
    }
    const io = failure === 'write' ? { ...fs, writeFile: async () => { throw new Error('simulated write failure'); } } : fs;
    await assert.rejects(writeAcceptance({ root, masterPath, original: 'original', serialized: 'updated',
      preserved: { path: 'submissions/12/dd.md', bytes: Buffer.from('copy') }, io }));
    assert.equal(await fs.readFile(masterPath, 'utf8'), 'original');
    if (failure === 'existing') assert.equal(await fs.readFile(copyPath, 'utf8'), 'existing');
    else await assert.rejects(fs.stat(copyPath), { code: 'ENOENT' });
  }
});

test('repository preservation validation detects unsafe path, missing file, wrong issue and byte corruption', async () => {
  const { validatePreservedFiles, digest } = await import('../scripts/preservation.mjs');
  const root = await fs.mkdtemp(join(tmpdir(), 'preservation-'));
  const bytes = Buffer.from('attributed copy\n');
  await fs.mkdir(join(root, 'submissions/12'), { recursive: true });
  await fs.writeFile(join(root, 'submissions/12/dd.md'), bytes);
  const makeRecord = (path, sha256 = digest(bytes), issue = 'https://github.com/ErranttVenture/superstonk-dd-library/issues/12') => ({
    pos: 251, submission: { issue, preserved_text: { path, sha256 } }
  });
  assert.deepEqual(await validatePreservedFiles([makeRecord('submissions/12/dd.md')], root), []);
  for (const record of [makeRecord('../dd.md'), makeRecord('submissions/13/dd.md'),
    makeRecord('submissions/12/dd.md', 'a'.repeat(64)), makeRecord('submissions/12/dd.md', digest(bytes), 'https://github.com/x/y/issues/12')]) {
    assert.ok((await validatePreservedFiles([record], root)).length > 0);
  }
  await fs.unlink(join(root, 'submissions/12/dd.md'));
  assert.ok((await validatePreservedFiles([makeRecord('submissions/12/dd.md')], root)).length > 0);
});

test('stale master and an existing lock are left intact', async () => {
  const { writeAcceptance } = await import('../scripts/preservation.mjs');
  const root = await fs.mkdtemp(join(tmpdir(), 'preservation-'));
  const masterPath = join(root, 'master.json');
  await fs.writeFile(masterPath, 'newer');
  const options = { root, masterPath, original: 'older', serialized: 'stale update' };
  await assert.rejects(writeAcceptance(options), /changed during validation/);
  assert.equal(await fs.readFile(masterPath, 'utf8'), 'newer');
  await fs.writeFile(`${masterPath}.lock`, 'another process');
  await assert.rejects(writeAcceptance(options), { code: 'EEXIST' });
  assert.equal(await fs.readFile(`${masterPath}.lock`, 'utf8'), 'another process');
});
