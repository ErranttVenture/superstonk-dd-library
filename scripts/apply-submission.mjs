import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { issueNumber, preserveSubmission, validatePreservedFiles, writeAcceptance } from './preservation.mjs';
import { validateMasterRecords } from './schema-validator.mjs';
import { checkDatasetInvariants } from './dataset-invariants.mjs';

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
const root = process.env.SUBMISSION_ROOT ?? fileURLToPath(new URL('../', import.meta.url));
issueNumber(issue);

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

const original = await readFile(masterPath, 'utf8');
const records = JSON.parse(original);
if (records.some((record) => record.submission?.issue === issue)) {
  throw new Error('This issue is already accepted; no files were changed.');
}
const { status, checks } = await checkSubmission(payload, { resolveUrl: resolve, dataset: records });
if (status === 'blocked') {
  for (const check of checks.filter((candidate) => candidate.status === 'fail')) {
    console.error(`${renderSubmitterText(check.id)}: ${renderSubmitterText(check.message)}`);
  }
  console.error('Submission is blocked and was not applied.');
  process.exit(1);
}

const preserved = preserveSubmission(payload, issue);
const record = buildPendingRecord(payload, {
  nextPos: nextPosition(records),
  submittedOn: process.env.SUBMISSION_SUBMITTED_ON ?? new Date().toISOString().slice(0, 10),
  issue,
  author,
  preservedText: preserved ? { path: preserved.path, sha256: preserved.sha256 } : undefined
});

const existingCopyErrors = await validatePreservedFiles(records, root);
records.push(record);
const schema = JSON.parse(await readFile(new URL('../data/schema.json', import.meta.url), 'utf8'));
const validation = validateMasterRecords(records, schema);
const baseline = JSON.parse(await readFile(new URL('../data/original-master.json', import.meta.url), 'utf8'));
if (validation.errors.length || existingCopyErrors.length || !checkDatasetInvariants(records, baseline).ok) {
  throw new Error('Repository validation failed; no submission files were written.');
}

// Write to a temp file in the same directory as the target, then rename() over it, so a
// killed-mid-write process (CI cancellation, timeout) can never leave a truncated dataset on
// disk. Same-directory placement matters: a cross-device rename is not atomic.
const serialized = `${JSON.stringify(records, null, 1)}\n`;
await writeAcceptance({ root, masterPath, original, serialized, preserved });

console.log(String(record.pos));
