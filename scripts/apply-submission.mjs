import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';
import { randomUUID } from 'node:crypto';

import {
  parseSubmissionIssue,
  checkSubmission,
  buildPendingRecord,
  resolveUrl,
  renderSubmitterText
} from './submission.mjs';

const FIRST_COMMUNITY_POSITION = 251;

function nextPosition(existingRecords) {
  if (existingRecords.length === 0) {
    return FIRST_COMMUNITY_POSITION;
  }
  return Math.max(FIRST_COMMUNITY_POSITION, Math.max(...existingRecords.map(({ pos }) => pos)) + 1);
}

const [bodyPath, issue, author] = process.argv.slice(2);
if (!bodyPath || !issue || !author) {
  console.error('usage: node scripts/apply-submission.mjs <issue-body-file> <issue-url> <author>');
  process.exit(2);
}

const masterPath = process.env.SUBMISSION_MASTER_PATH
  ?? fileURLToPath(new URL('../data/master.json', import.meta.url));

// Test-only seam: set SUBMISSION_FAKE_RESOLVE to substitute a resolver that never touches the
// network, so tests aren't at the mercy of a real remote host's availability. Workflows must
// never set this; the default path always uses the real resolver.
const resolve = process.env.SUBMISSION_FAKE_RESOLVE
  ? async () => 'ok'
  : resolveUrl;

const body = await readFile(bodyPath, 'utf8');
const { payload, errors } = parseSubmissionIssue(body);
if (errors.length > 0) {
  for (const error of errors) {
    console.error(`${renderSubmitterText(error.field)}: ${renderSubmitterText(error.message)}`);
  }
  console.error('Submission is blocked and was not applied.');
  process.exit(1);
}

const records = JSON.parse(await readFile(masterPath, 'utf8'));
const { status, checks } = await checkSubmission(payload, { resolveUrl: resolve, dataset: records });
if (status === 'blocked') {
  for (const check of checks.filter((candidate) => candidate.status === 'fail')) {
    console.error(`${renderSubmitterText(check.id)}: ${renderSubmitterText(check.message)}`);
  }
  console.error('Submission is blocked and was not applied.');
  process.exit(1);
}

const record = buildPendingRecord(payload, {
  nextPos: nextPosition(records),
  submittedOn: process.env.SUBMISSION_SUBMITTED_ON ?? new Date().toISOString().slice(0, 10),
  issue,
  author
});

records.push(record);

// Write to a temp file in the same directory as the target, then rename() over it, so a
// killed-mid-write process (CI cancellation, timeout) can never leave a truncated dataset on
// disk. Same-directory placement matters: a cross-device rename is not atomic.
const serialized = `${JSON.stringify(records, null, 1)}\n`;
const tempPath = join(dirname(masterPath), `${basename(masterPath)}.${randomUUID()}.tmp`);
try {
  await writeFile(tempPath, serialized, 'utf8');
  await rename(tempPath, masterPath);
} catch (error) {
  await unlink(tempPath).catch(() => {});
  throw error;
}

console.log(String(record.pos));
