import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const originals = new Map([
  ['reports/REPORT.md', '53c777712e6ff985e1259da5ebe47aa05e499c81d5d0de9916eba9b17ff90cfa'],
  ['reports/BOOKS.md', '3b202e66b0e8587e84d63d9d1eb2cd8f525ffc1ed3d2589b3c38a33b4d56ffc0'],
  ['data/library_review.csv', '9efacc7816b8e24a44a97037fe39e375153a16ee26409cf619b565dc03e20ec1'],
  ['data/master.json', 'fb96f7d70a0abece7e1a3f1995d1df67eb3ea5b7134565115e68e5431ffccf13']
]);

test('marks exactly the immutable source artifacts as binary', async () => {
  const attributes = await readFile(new URL('../.gitattributes', import.meta.url), 'utf8');

  assert.deepEqual(attributes.trim().split(/\r?\n/), [
    'reports/REPORT.md -text',
    'reports/BOOKS.md -text',
    'data/library_review.csv -text',
    'data/master.json -text'
  ]);
});

test('preserves the original review artifacts and master record sequence', async () => {
  for (const [relativePath, expectedHash] of originals) {
    const file = new URL(`../${relativePath}`, import.meta.url);
    await access(file);
    const hash = createHash('sha256').update(await readFile(file)).digest('hex');
    assert.equal(hash, expectedHash, `${relativePath} must remain byte-for-byte identical`);
  }

  const master = JSON.parse(await readFile(new URL('../data/master.json', import.meta.url), 'utf8'));
  assert.ok(Array.isArray(master));
  assert.equal(master.length, 250);
  assert.deepEqual(master.map((record) => record.pos), Array.from({ length: 250 }, (_, index) => index + 1));
});

test('stores the CC BY-SA legal code without altering its trailing whitespace', async () => {
  const dataLicense = (await readFile(new URL('../LICENSE-DATA', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');

  assert.ok(dataLicense.startsWith('This license covers the data/ and reports/ directories.\n\n'));
  assert.match(dataLicense, /Attribution-ShareAlike 4\.0 International/);
  assert.equal((dataLicense.match(/^Section [1-8] -- /gm) ?? []).length, 8);
  assert.match(dataLicense, /creativecommons\.org\.\n$/);
});
