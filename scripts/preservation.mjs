import * as fs from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const ISSUE = /^https:\/\/github\.com\/ErranttVenture\/superstonk-dd-library\/issues\/([1-9][0-9]*)$/;
const COPY = /^submissions\/[1-9][0-9]*\/dd\.md$/;
export const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function issueNumber(issue) {
  const number = ISSUE.exec(issue)?.[1];
  if (!number) throw new Error('A canonical issue URL is required: https://github.com/ErranttVenture/superstonk-dd-library/issues/<positive-number>');
  return number;
}

// Plain text attribution is escaped independently from the untouched submitted body.
const credit = (value) => String(value).replace(/[\r\n]+/g, ' ').replace(/[&<>]/g,
  (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[character]);

export function preserveSubmission(payload, issue) {
  if (!payload.full_text?.trim()) return null;
  if (payload.full_text_permission !== true) throw new Error('Full text permission is required.');
  const path = `submissions/${issueNumber(issue)}/dd.md`;
  const bytes = Buffer.from([
    '# Preserved community submission', '',
    `Title: ${credit(payload.title)}`, '', `Author: ${credit(payload.byline)}`, '',
    `Original source: ${credit(payload.url)}`, '', `Submission issue: ${issue}`, '',
    'Permission declaration: The submitter confirmed they are the author or have permission to preserve and publicly display this text with attribution.', '',
    'Copyright remains with the original rights holder. This copy is outside LICENSE-DATA; no new license is granted for the work.', '',
    '---', '', payload.full_text
  ].join('\n'), 'utf8');
  return { path, bytes, sha256: digest(bytes) };
}

async function assertRegularPath(root, path, io = fs) {
  let current = root;
  for (const part of path.split('/')) {
    current = join(current, part);
    const stat = await io.lstat(current);
    if (stat.isSymbolicLink()) throw new Error('Preserved paths must not contain symbolic links.');
  }
  if (!(await io.stat(current)).isFile()) throw new Error('Preserved text must be a regular file.');
}

export async function validatePreservedFiles(records, root) {
  const errors = [];
  for (const record of records) {
    const copy = record.submission?.preserved_text;
    if (!copy) continue;
    try {
      if (!COPY.test(copy.path) || copy.path !== `submissions/${issueNumber(record.submission.issue)}/dd.md`) {
        throw new Error('Preserved path must match its canonical submission issue.');
      }
      await assertRegularPath(root, copy.path);
      if (digest(await fs.readFile(join(root, copy.path))) !== copy.sha256) throw new Error('Preserved text SHA-256 mismatch.');
    } catch (error) {
      errors.push(`Record ${record.pos}: ${error.code === 'ENOENT' ? 'Preserved text file is missing.' : error.message}`);
    }
  }
  return errors;
}

// Acquire the lock before checking the original bytes: concurrent acceptances may not
// replace a newer master with a stale read. A hard link atomically publishes a complete
// temp copy without overwriting any destination (including on Windows/Node 18).
// Publish the copy first, then atomically replace master. On a caught failure roll back
// only our own copy. A hard kill can leave an orphan/lock, never a dangling master link.
export async function writeAcceptance({ root, masterPath, original, serialized, preserved, io = fs }) {
  const lockPath = `${masterPath}.lock`;
  const lock = await io.open(lockPath, 'wx');
  const tempPath = join(dirname(masterPath), `${basename(masterPath)}.${randomUUID()}.tmp`);
  let copyPath, copyTemp, copyDirectory;
  let copied = false;
  let directoryCreated = false;
  let committed = false;
  try {
    if (await io.readFile(masterPath, 'utf8') !== original) throw new Error('Dataset changed during validation; retry acceptance.');
    if (preserved) {
      if (!COPY.test(preserved.path)) throw new Error('Invalid preserved text path.');
      const parent = join(root, 'submissions');
      await io.mkdir(parent, { recursive: true });
      if ((await io.lstat(parent)).isSymbolicLink()) throw new Error('Submissions must not be a symbolic link.');
      copyPath = join(root, preserved.path);
      copyDirectory = dirname(copyPath);
      // An existing issue directory is evidence of a previous preservation attempt.
      // Refuse it rather than replacing or silently adopting an existing copy.
      await io.mkdir(copyDirectory);
      directoryCreated = true;
      copyTemp = join(copyDirectory, `${randomUUID()}.tmp`);
      await io.writeFile(copyTemp, preserved.bytes, { flag: 'wx' });
      await io.link(copyTemp, copyPath);
      copied = true;
      await io.unlink(copyTemp);
    }
    await io.writeFile(tempPath, serialized, { encoding: 'utf8', flag: 'wx' });
    await io.rename(tempPath, masterPath);
    committed = true;
  } finally {
    await io.unlink(tempPath).catch(() => {});
    if (copyTemp) await io.unlink(copyTemp).catch(() => {});
    if (!committed && copied) await io.unlink(copyPath);
    if (!committed && directoryCreated) await io.rmdir(copyDirectory);
    await lock.close();
    await io.unlink(lockPath);
  }
}
