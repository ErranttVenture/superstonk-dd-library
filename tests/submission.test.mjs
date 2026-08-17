import test from 'node:test';
import assert from 'node:assert/strict';

import { parseSubmissionIssue } from '../scripts/submission.mjs';

const completeBody = [
  '### Title', '', 'Swaps and the Offshore Bid', '',
  '### Author / byline', '', 'u/example', '',
  '### Source URL', '', 'https://www.reddit.com/r/Superstonk/comments/abc123/swaps/', '',
  '### Archive snapshot URL', '', 'https://web.archive.org/web/20260801000000/https://www.reddit.com/r/Superstonk/comments/abc123/swaps/', '',
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

test('parses a complete submission body', () => {
  const { payload, errors } = parseSubmissionIssue(completeBody);

  assert.deepEqual(errors, []);
  assert.deepEqual(payload, {
    title: 'Swaps and the Offshore Bid',
    byline: 'u/example',
    url: 'https://www.reddit.com/r/Superstonk/comments/abc123/swaps/',
    archive_url: 'https://web.archive.org/web/20260801000000/https://www.reddit.com/r/Superstonk/comments/abc123/swaps/',
    published: '2026-07-04',
    platform: 'reddit',
    length: null,
    compilation: false,
    thesis: 'Cross-border swap reporting gaps let short exposure sit outside US disclosure.',
    text_available: true,
    related: null,
    attribution: 'handle',
    acknowledged: true
  });
});

test('reads pages, compilation, anonymity and unreadable text', () => {
  const body = completeBody
    .replace('### Length in pages\n\n_No response_', '### Length in pages\n\n42')
    .replace('- [ ] This work compiles', '- [X] This work compiles')
    .replace('Credit my GitHub handle', 'Submit anonymously')
    .replace('### Is the full text readable at the source URL?\n\nYes', '### Is the full text readable at the source URL?\n\nNo');
  const { payload, errors } = parseSubmissionIssue(body);

  assert.deepEqual(errors, []);
  assert.equal(payload.length, 42);
  assert.equal(payload.compilation, true);
  assert.equal(payload.attribution, 'anonymous');
  assert.equal(payload.text_available, false);
});

test('reports every missing required field at once', () => {
  const { errors } = parseSubmissionIssue('### Title\n\nOnly a title\n');
  const missing = errors.map(({ field }) => field);

  assert.deepEqual(missing, [
    'byline',
    'url',
    'archive_url',
    'published',
    'platform',
    'thesis',
    'text_available',
    'attribution',
    'acknowledgement'
  ]);
});

test('treats _No response_ in a required field as missing', () => {
  const body = completeBody.replace('### Author / byline\n\nu/example', '### Author / byline\n\n_No response_');

  assert.deepEqual(
    parseSubmissionIssue(body).errors.map(({ field }) => field),
    ['byline']
  );
});

test('rejects an unticked copyright acknowledgement', () => {
  const body = completeBody.replace(
    '- [X] I have not pasted',
    '- [ ] I have not pasted'
  );

  assert.deepEqual(
    parseSubmissionIssue(body).errors.map(({ field }) => field),
    ['acknowledgement']
  );
});

test('rejects an unrecognised platform and a non-numeric length', () => {
  const body = completeBody
    .replace('### Platform\n\nReddit', '### Platform\n\nMySpace')
    .replace('### Length in pages\n\n_No response_', '### Length in pages\n\nquite long');
  const fields = parseSubmissionIssue(body).errors.map(({ field }) => field);

  assert.deepEqual(fields, ['platform', 'length']);
});

test('rejects a page count of 0 with a minimum-value error', () => {
  const body = completeBody.replace('### Length in pages\n\n_No response_', '### Length in pages\n\n0');
  const { payload, errors } = parseSubmissionIssue(body);

  assert.deepEqual(errors.map(({ field }) => field), ['length']);
  assert.match(errors[0].message, /must be at least 1/);
});

test('accepts a page count of 1', () => {
  const body = completeBody.replace('### Length in pages\n\n_No response_', '### Length in pages\n\n1');
  const { payload, errors } = parseSubmissionIssue(body);

  assert.deepEqual(errors, []);
  assert.equal(payload.length, 1);
});

test('blank length in pages still yields null', () => {
  const { payload, errors } = parseSubmissionIssue(completeBody);

  assert.deepEqual(errors, []);
  assert.equal(payload.length, null);
});

test('trims whitespace, tolerates CRLF, and preserves unicode', () => {
  const body = completeBody
    .replace('Swaps and the Offshore Bid', '  Swaps, Ürsprung & the Offshore Bid  ')
    .replace(/\n/g, '\r\n');
  const { payload, errors } = parseSubmissionIssue(body);

  assert.deepEqual(errors, []);
  assert.equal(payload.title, 'Swaps, Ürsprung & the Offshore Bid');
});

test('ignores unrecognised headings without failing', () => {
  const { errors } = parseSubmissionIssue(`${completeBody}\n### Random extra section\n\nnoise\n`);

  assert.deepEqual(errors, []);
});

test('retains thesis text after an embedded markdown sub-heading', () => {
  const body = completeBody.replace(
    'Cross-border swap reporting gaps let short exposure sit outside US disclosure.',
    'Intro line.\n### Sub-heading a Redditor typed in their thesis\nSecond half of the real thesis text that is now lost.'
  );
  const { payload, errors } = parseSubmissionIssue(body);

  assert.deepEqual(errors, []);
  assert.equal(
    payload.thesis,
    'Intro line.\n### Sub-heading a Redditor typed in their thesis\nSecond half of the real thesis text that is now lost.'
  );
});

test('retains both paragraphs of a multi-line thesis separated by a blank line', () => {
  const body = completeBody.replace(
    'Cross-border swap reporting gaps let short exposure sit outside US disclosure.',
    'First paragraph of the thesis.\n\nSecond paragraph of the thesis.'
  );
  const { payload, errors } = parseSubmissionIssue(body);

  assert.deepEqual(errors, []);
  assert.equal(payload.thesis, 'First paragraph of the thesis.\n\nSecond paragraph of the thesis.');
});

test('a field value containing a line that reads as a real label hijacks that label', () => {
  // splitSections can only disambiguate "### X" by checking whether X is a known
  // label. It has no way to tell a genuine new section from a submitter's prose
  // that happens to reproduce a real label verbatim (the format is inherently
  // ambiguous here, same as GitHub's own issue-form rendering). Chosen, asserted
  // behaviour: the embedded "### Platform" line closes out the thesis section
  // early (truncating it to the text before that line) and re-opens the
  // "Platform" section, so the later value ("Substack") overwrites the real one
  // ("Reddit") parsed earlier in the body. No error is raised because "Substack"
  // is itself a valid platform value.
  const body = completeBody.replace(
    'Cross-border swap reporting gaps let short exposure sit outside US disclosure.',
    'Intro line before impostor heading.\n### Platform\nSubstack'
  );
  const { payload, errors } = parseSubmissionIssue(body);

  assert.deepEqual(errors, []);
  assert.equal(payload.thesis, 'Intro line before impostor heading.');
  assert.equal(payload.platform, 'substack');
});

import { checkSubmission, normalizeUrl } from '../scripts/submission.mjs';

const validPayload = {
  title: 'Swaps and the Offshore Bid',
  byline: 'u/example',
  url: 'https://www.reddit.com/r/Superstonk/comments/abc123/swaps/',
  archive_url: 'https://web.archive.org/web/20260801000000/https://example.test/dd',
  published: '2026-07-04',
  platform: 'reddit',
  length: null,
  compilation: false,
  thesis: 'Cross-border swap reporting gaps let short exposure sit outside US disclosure.',
  text_available: true,
  related: null,
  attribution: 'handle',
  acknowledged: true
};
const allOk = async () => 'ok';
const byId = (checks) => new Map(checks.map((check) => [check.id, check]));

test('normalizeUrl folds case, trailing slash and tracking parameters', () => {
  assert.equal(
    normalizeUrl('HTTPS://Example.TEST/DD/?utm_source=x&si=9&fbclid=1'),
    normalizeUrl('https://example.test/DD')
  );
  assert.equal(
    normalizeUrl('http://example.test/dd'),
    normalizeUrl('https://example.test/dd')
  );
  assert.notEqual(
    normalizeUrl('https://reddit.com/r/x/comments/1/a/?context=3'),
    normalizeUrl('https://reddit.com/r/x/comments/1/a/')
  );
});

test('a complete submission against an empty dataset passes', async () => {
  const { status, checks } = await checkSubmission(validPayload, {
    resolveUrl: allOk,
    dataset: []
  });

  assert.equal(status, 'pass');
  assert.deepEqual(checks.filter((check) => check.status !== 'pass'), []);
});

test('a dead source URL blocks the submission', async () => {
  const { status, checks } = await checkSubmission(validPayload, {
    resolveUrl: async (url) => url === validPayload.url ? 'missing' : 'ok',
    dataset: []
  });

  assert.equal(status, 'blocked');
  assert.equal(byId(checks).get('url_resolves').status, 'fail');
});

test('a non-http(s) source URL is rejected without ever being resolved', async () => {
  const resolvedUrls = [];
  const { status, checks } = await checkSubmission(
    { ...validPayload, url: 'data:text/html,<script>evil</script>' },
    { resolveUrl: async (url) => { resolvedUrls.push(url); return 'ok'; }, dataset: [] }
  );

  assert.equal(status, 'blocked');
  assert.equal(byId(checks).get('url_resolves').status, 'fail');
  assert.equal(resolvedUrls.includes('data:text/html,<script>evil</script>'), false);
});

test('an unparseable source URL fails instead of matching the schema by prefix alone', async () => {
  const { status, checks } = await checkSubmission(
    { ...validPayload, url: 'https://' },
    { resolveUrl: allOk, dataset: [] }
  );

  assert.equal(status, 'blocked');
  assert.equal(byId(checks).get('url_resolves').status, 'fail');
});

test('an unreachable host is incomplete, not blocked', async () => {
  const { status, checks } = await checkSubmission(validPayload, {
    resolveUrl: async () => 'unknown',
    dataset: []
  });

  assert.equal(status, 'incomplete');
  assert.equal(byId(checks).get('url_resolves').status, 'unknown');
});

test('a non-archival snapshot host blocks the submission', async () => {
  const { status, checks } = await checkSubmission(
    { ...validPayload, archive_url: 'https://example.test/my-own-copy' },
    { resolveUrl: allOk, dataset: [] }
  );

  assert.equal(status, 'blocked');
  assert.equal(byId(checks).get('archive_present').status, 'fail');
});

test('accepts every recognised archival host', async () => {
  for (const host of ['web.archive.org', 'archive.today', 'archive.ph', 'archive.is']) {
    const { checks } = await checkSubmission(
      { ...validPayload, archive_url: `https://${host}/snapshot/1` },
      { resolveUrl: allOk, dataset: [] }
    );

    assert.equal(byId(checks).get('archive_present').status, 'pass', host);
  }
});

test('a URL already in the dataset blocks the submission despite cosmetic differences', async () => {
  const dataset = [{ pos: 1, title: 'Other', byline: 'someone', url: 'http://WWW.reddit.com/r/Superstonk/comments/abc123/swaps?utm_source=share' }];
  const { status, checks } = await checkSubmission(validPayload, { resolveUrl: allOk, dataset });

  assert.equal(status, 'blocked');
  assert.match(byId(checks).get('no_duplicate').message, /already in the library at no\. 1/);
});

test('a matching title and byline warns without blocking', async () => {
  const dataset = [{
    pos: 7,
    title: 'swaps and the OFFSHORE bid',
    byline: 'U/Example',
    url: 'https://example.test/somewhere-else'
  }];
  const { status, checks } = await checkSubmission(validPayload, { resolveUrl: allOk, dataset });

  assert.equal(status, 'pass');
  assert.equal(byId(checks).get('title_byline_near_match').status, 'warn');
  assert.match(byId(checks).get('title_byline_near_match').message, /Same title and byline as no\. 7/);
});

test('an empty byline, bad date, future date, short thesis and missing acknowledgement each block', async () => {
  const cases = [
    ['byline_present', { byline: '   ' }],
    ['published_valid', { published: '04/07/2026' }],
    ['published_valid', { published: '2999-01-01' }],
    ['thesis_present', { thesis: 'Too short.' }],
    ['copyright_ack', { acknowledged: false }]
  ];

  for (const [id, override] of cases) {
    const { status, checks } = await checkSubmission(
      { ...validPayload, ...override },
      { resolveUrl: allOk, dataset: [] }
    );

    assert.equal(status, 'blocked', id);
    assert.equal(byId(checks).get(id).status, 'fail', id);
  }
});

test('the future-date rule reads the injected clock, not the machine clock', async () => {
  const options = { resolveUrl: allOk, dataset: [], now: Date.parse('2026-07-01T00:00:00Z') };
  const before = await checkSubmission(validPayload, options);
  const after = await checkSubmission({ ...validPayload, published: '2026-06-01' }, options);

  assert.equal(byId(before.checks).get('published_valid').status, 'fail');
  assert.equal(byId(after.checks).get('published_valid').status, 'pass');
});

test('a failure outranks an unknown in the overall status', async () => {
  const { status } = await checkSubmission(
    { ...validPayload, acknowledged: false },
    { resolveUrl: async () => 'unknown', dataset: [] }
  );

  assert.equal(status, 'blocked');
});

import { withHttpServer } from './cli-test-helpers.mjs';
import { resolveUrl } from '../scripts/submission.mjs';

test('the default resolver maps 2xx, 4xx and 5xx to ok, missing and unknown', async () => {
  await withHttpServer((request, response) => {
    const status = request.url === '/ok' ? 200 : request.url === '/gone' ? 404 : 503;
    response.writeHead(status);
    response.end();
  }, async (origin) => {
    assert.equal(await resolveUrl(`${origin}/ok`), 'ok');
    assert.equal(await resolveUrl(`${origin}/gone`), 'missing');
    assert.equal(await resolveUrl(`${origin}/broken`), 'unknown');
  });
});

test('the default resolver reports an unreachable host as unknown', async () => {
  assert.equal(await resolveUrl('http://127.0.0.1:1/nothing'), 'unknown');
});

// --- Fix 1: normalizeUrl must not blanket-lowercase the whole URL ---

test('normalizeUrl keeps path case and query-value case distinct', () => {
  assert.notEqual(
    normalizeUrl('https://example.test/DD'),
    normalizeUrl('https://example.test/dd')
  );
  assert.notEqual(
    normalizeUrl('https://example.test/watch?v=AbC123xyz'),
    normalizeUrl('https://example.test/watch?v=abc123xyz')
  );
});

test('normalizeUrl still folds scheme, host case, www, trailing slash and tracking parameters', () => {
  assert.equal(
    normalizeUrl('HTTP://WWW.Example.TEST/dd/'),
    normalizeUrl('https://example.test/dd')
  );
  assert.equal(
    normalizeUrl('https://example.test/dd?utm_source=x&si=9&fbclid=1'),
    normalizeUrl('https://example.test/dd')
  );
});

// --- Fix 2: only a definitive 404/410 may resolve to 'missing' ---

test('resolveUrl maps 404 and 410 to missing, and 401, 403 and 429 to unknown', async () => {
  await withHttpServer((request, response) => {
    const map = { '/404': 404, '/410': 410, '/401': 401, '/403': 403, '/429': 429 };
    response.writeHead(map[request.url] ?? 500);
    response.end();
  }, async (origin) => {
    assert.equal(await resolveUrl(`${origin}/404`), 'missing');
    assert.equal(await resolveUrl(`${origin}/410`), 'missing');
    assert.equal(await resolveUrl(`${origin}/401`), 'unknown');
    assert.equal(await resolveUrl(`${origin}/403`), 'unknown');
    assert.equal(await resolveUrl(`${origin}/429`), 'unknown');
  });
});

// --- Fix 3: a 5xx on HEAD must fall through to the GET attempt ---

test('resolveUrl returns ok when HEAD gives 500 but GET succeeds', async () => {
  await withHttpServer((request, response) => {
    if (request.method === 'HEAD') {
      response.writeHead(500);
      response.end();
    } else {
      response.writeHead(200);
      response.end();
    }
  }, async (origin) => {
    assert.equal(await resolveUrl(`${origin}/flaky-head`), 'ok');
  });
});

// --- Fix 4: calendar-invalid dates must not silently roll over ---

test('checkSubmission reports published_valid as fail for a calendar-invalid date', async () => {
  const { status, checks } = await checkSubmission(
    { ...validPayload, published: '2026-02-30' },
    { resolveUrl: allOk, dataset: [] }
  );

  assert.equal(status, 'blocked');
  assert.equal(byId(checks).get('published_valid').status, 'fail');
});

import { readFile } from 'node:fs/promises';
import { buildPendingRecord } from '../scripts/submission.mjs';
import { validateAgainstSchema } from '../scripts/schema-validator.mjs';

const recordSchema = JSON.parse(
  await readFile(new URL('../data/schema.json', import.meta.url), 'utf8')
);
const buildOptions = {
  nextPos: 251,
  submittedOn: '2026-08-20',
  issue: 'https://github.com/ErranttVenture/superstonk-dd-library/issues/12',
  author: 'octocat'
};

test('builds a schema-valid pending record from a payload', () => {
  const built = buildPendingRecord(validPayload, buildOptions);

  assert.deepEqual(validateAgainstSchema(recordSchema, built), []);
  assert.deepEqual(built, {
    pos: 251,
    title: 'Swaps and the Offshore Bid',
    byline: 'u/example',
    pages: null,
    uploaded: '2026-07-04',
    url: 'https://www.reddit.com/r/Superstonk/comments/abc123/swaps/',
    type: 'original',
    text_available: true,
    source_corpus: 'community',
    review_status: 'pending',
    submission: {
      submitted_on: '2026-08-20',
      submitted_by: 'octocat',
      issue: 'https://github.com/ErranttVenture/superstonk-dd-library/issues/12',
      archive_url: 'https://web.archive.org/web/20260801000000/https://example.test/dd',
      platform: 'reddit'
    }
  });
});

test('carries pages, compilation type and anonymity into the record', () => {
  const built = buildPendingRecord(
    { ...validPayload, length: 42, compilation: true, attribution: 'anonymous', text_available: false },
    buildOptions
  );

  assert.deepEqual(validateAgainstSchema(recordSchema, built), []);
  assert.equal(built.pages, 42);
  assert.equal(built.type, 'compilation');
  assert.equal(built.text_available, false);
  assert.equal(built.submission.submitted_by, 'anonymous');
});

test('does not store the thesis or the related-record note', () => {
  const built = buildPendingRecord({ ...validPayload, related: '#40' }, buildOptions);

  assert.equal(Object.hasOwn(built, 'summary'), false);
  assert.equal(JSON.stringify(built).includes('Cross-border swap'), false);
});

test('trims surrounding whitespace out of stored strings', () => {
  const built = buildPendingRecord(
    { ...validPayload, title: '  Padded Title  ', byline: '  u/padded  ' },
    buildOptions
  );

  assert.equal(built.title, 'Padded Title');
  assert.equal(built.byline, 'u/padded');
});

import { renderSubmitterText } from '../scripts/submission.mjs';

test('renderSubmitterText neutralizes markup, mentions and issue autolinks without changing what a reader sees', () => {
  assert.equal(renderSubmitterText('<script>@someone said #37</script>'), '&lt;script>&#64;someone said &#35;37&lt;/script>');
  assert.equal(renderSubmitterText('multiple @handles and #12 plus #34'), 'multiple &#64;handles and &#35;12 plus &#35;34');
  assert.equal(renderSubmitterText('a\r\nb\nc'), 'a b c');
  assert.equal(renderSubmitterText('  spaced   out  '), 'spaced out');
  assert.equal(renderSubmitterText('x'.repeat(250)), `${'x'.repeat(200)}…`);
});
