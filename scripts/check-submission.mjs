import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { parseSubmissionIssue, checkSubmission, resolveUrl, renderSubmitterText } from './submission.mjs';

const masterUrl = process.env.SUBMISSION_MASTER_PATH
  ? pathToFileURL(process.env.SUBMISSION_MASTER_PATH)
  : new URL('../data/master.json', import.meta.url);

// Test-only seam: set SUBMISSION_FAKE_RESOLVE to substitute a resolver that never touches the
// network, so tests aren't at the mercy of a real remote host's availability. Workflows must
// never set this; the default path always uses the real resolver.
const resolve = process.env.SUBMISSION_FAKE_RESOLVE
  ? async () => 'ok'
  : resolveUrl;

const [bodyPath] = process.argv.slice(2);
if (!bodyPath) {
  console.error('usage: node scripts/check-submission.mjs <issue-body-file>');
  process.exit(2);
}

const body = await readFile(bodyPath, 'utf8');
const { payload, errors } = parseSubmissionIssue(body);
const lines = ['### Submission checks', ''];
let status = 'blocked';

if (errors.length > 0) {
  lines.push('This submission could not be read. Edit the issue to fix the following, and these checks will run again.', '');
  for (const error of errors) {
    lines.push(`- ❌ **${renderSubmitterText(error.field)}** — ${renderSubmitterText(error.message)}`);
  }
} else {
  const dataset = JSON.parse(await readFile(masterUrl, 'utf8'));
  const result = await checkSubmission(payload, { resolveUrl: resolve, dataset });
  status = result.status;

  const icons = { pass: '✅', fail: '❌', warn: '⚠️', unknown: '❔' };
  for (const check of result.checks) {
    lines.push(`- ${icons[check.status]} **${renderSubmitterText(check.id)}** — ${renderSubmitterText(check.message)}`);
  }
  lines.push('');
  lines.push({
    pass: 'All mechanical checks pass. A maintainer still decides whether this is market-structure or DD content at all.',
    blocked: 'One or more mechanical checks failed. Edit the issue to fix them and the checks will run again.',
    incomplete: 'A link could not be reached at check time. That is not a rejection; a maintainer can accept anyway.'
  }[status]);
  lines.push('');
  lines.push('Acceptance adds an **unrated** record. It is not a rating.');
}

lines.push('');
lines.push(`<!-- submission-status: ${status} -->`);
console.log(lines.join('\n'));
