import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  extractBookData,
  fetchBookcase,
  normalizeBook
} from '../harness/extract_bookcase.mjs';
import { runNodeCli, withHttpServer } from './cli-test-helpers.mjs';

const directFixture = await readFile(
  new URL('./fixtures/bookcase-direct.html', import.meta.url),
  'utf8'
);
const encodedFixture = await readFile(
  new URL('./fixtures/bookcase-encoded.html', import.meta.url),
  'utf8'
);

test('extractBookData returns records from a direct bookData assignment', () => {
  const records = extractBookData(directFixture);

  assert.equal(records.length, 2);
  assert.deepEqual(records[0], {
    title: 'Alpha', userName: 'abc', bookId: 'one', pages: 12, publishTime: '2021-07-20'
  });
});

test('extractBookData decodes a quoted bookData assignment', () => {
  const records = extractBookData(encodedFixture);

  assert.equal(records.length, 2);
  assert.equal(records[1].title, 'Beta');
});

test('extractBookData scans past brackets and escaped quotes in title strings', () => {
  const records = extractBookData(
    '<script>bookData = [{"title":"[nested] \\"quoted\\"","userName":"abc","bookId":"one","pages":12,"publishTime":"2021-07-20"}];</script>'
  );

  assert.equal(records[0].title, '[nested] "quoted"');
});

test('extractBookData rejects malformed embedded JSON', () => {
  assert.throws(
    () => extractBookData('<script>bookData = [{"title":}];</script>'),
    /Unable to parse embedded bookData/
  );
});

test('extractBookData rejects a bookData decoy in page body text', () => {
  assert.throws(
    () => extractBookData('<p>Archived notes: bookData = []</p>'),
    /Unable to parse embedded bookData/
  );
});

test('extractBookData rejects a bookData decoy in a JavaScript string', () => {
  assert.throws(
    () => extractBookData('<script>const note = "bookData = []";</script>'),
    /Unable to parse embedded bookData/
  );
});

test('extractBookData rejects a direct value followed by an expression', () => {
  assert.throws(
    () => extractBookData('<script>bookData = [] + makeBooks();</script>'),
    /Unable to parse embedded bookData/
  );
});

test('extractBookData rejects multiple valid bookData assignments', () => {
  assert.throws(
    () => extractBookData('<script>bookData = []; bookData = [];</script>'),
    /Unable to parse embedded bookData/
  );
});

test('extractBookData rejects a bookData decoy in a regular expression literal', () => {
  assert.throws(
    () => extractBookData('<script>const marker = /bookData = [];/;</script>'),
    /Unable to parse embedded bookData/
  );
});

test('extractBookData ignores a regex decoy when a real assignment follows', () => {
  assert.deepEqual(
    extractBookData('<script>const marker = /bookData = [];/; bookData = [];</script>'),
    []
  );
});

test('extractBookData skips escaped slashes and character classes in regex literals', () => {
  assert.deepEqual(
    extractBookData('<script>const marker = /bookData = [];[\\/]/; bookData = [];</script>'),
    []
  );
});

test('extractBookData rejects a regex decoy after a control-flow header', () => {
  assert.throws(
    () => extractBookData('<script>if (true) /bookData = [{"source":"regex"}];/;</script>'),
    /Unable to parse embedded bookData/
  );
});

test('extractBookData ignores a control-flow regex decoy when a real assignment follows', () => {
  assert.deepEqual(
    extractBookData('<script>if (true) /bookData = [{"source":"regex"}];/; bookData = [{"source":"real"}];</script>'),
    [{ source: 'real' }]
  );
});

test('extractBookData rejects a regex decoy after a function declaration block', () => {
  assert.throws(
    () => extractBookData('<script>function marker() {} /bookData = [{"source":"regex"}];/;</script>'),
    /Unable to parse embedded bookData/
  );
});

test('extractBookData ignores a function-block regex decoy when a real assignment follows', () => {
  assert.deepEqual(
    extractBookData('<script>function marker() {} /bookData = [{"source":"regex"}];/; bookData = [{"source":"real"}];</script>'),
    [{ source: 'real' }]
  );
});

test('extractBookData rejects a regex decoy after an else block', () => {
  assert.throws(
    () => extractBookData('<script>if (true) {} else {} /bookData = [{"source":"regex"}];/;</script>'),
    /Unable to parse embedded bookData/
  );
});

test('extractBookData ignores an else-block regex decoy when a real assignment follows', () => {
  assert.deepEqual(
    extractBookData('<script>if (true) {} else {} /bookData = [{"source":"regex"}];/; bookData = [{"source":"real"}];</script>'),
    [{ source: 'real' }]
  );
});

test('extractBookData rejects a regex decoy after an optional-binding catch block', () => {
  assert.throws(
    () => extractBookData('<script>try { throw 1; } catch {} /bookData = [{"source":"regex"}];/;</script>'),
    /Unable to parse embedded bookData/
  );
});

test('extractBookData ignores an optional-binding catch regex decoy when a real assignment follows', () => {
  assert.deepEqual(
    extractBookData('<script>try { throw 1; } catch {} /bookData = [{"source":"regex"}];/; bookData = [{"source":"real"}];</script>'),
    [{ source: 'real' }]
  );
});

test('extractBookData keeps the parenthesized catch-header path for regex statements', () => {
  assert.deepEqual(
    extractBookData('<script>try {} catch (error) {} /bookData = [{"source":"regex"}];/; bookData = [{"source":"real"}];</script>'),
    [{ source: 'real' }]
  );
});

test('extractBookData keeps division inside a bound catch body from swallowing a real assignment', () => {
  assert.deepEqual(
    extractBookData('<script>try {} catch (error) { const ratio = error / divisor; bookData = [{"source":"real"}]; }</script>'),
    [{ source: 'real' }]
  );
});

test('extractBookData keeps division after a catch-named method call from swallowing a real assignment', () => {
  assert.deepEqual(
    extractBookData('<script>const ratio = promise.catch(handler) / divisor; bookData = [{"source":"real"}];</script>'),
    [{ source: 'real' }]
  );
});

test('extractBookData ignores a try-finally regex decoy when a real assignment follows', () => {
  assert.deepEqual(
    extractBookData('<script>try {} finally {} /bookData = [{"source":"regex"}];/; bookData = [{"source":"real"}];</script>'),
    [{ source: 'real' }]
  );
});

test('extractBookData rejects a regex decoy after a nested block in a do body', () => {
  assert.throws(
    () => extractBookData('<script>do { {} /bookData = [{"source":"regex"}];/; } while (false);</script>'),
    /Unable to parse embedded bookData/
  );
});

test('extractBookData keeps a division operator from swallowing a real assignment', () => {
  assert.deepEqual(
    extractBookData('<script>const ratio = 12 / 3; bookData = [{"source":"real"}];</script>'),
    [{ source: 'real' }]
  );
});

test('extractBookData keeps division after an object literal from swallowing a real assignment', () => {
  assert.deepEqual(
    extractBookData('<script>const ratio = ({ source: "object" }) / divisor; bookData = [{"source":"real"}];</script>'),
    [{ source: 'real' }]
  );
});

test('extractBookData keeps division after a function expression from swallowing a real assignment', () => {
  assert.deepEqual(
    extractBookData('<script>const ratio = function () {} / divisor; bookData = [{"source":"real"}];</script>'),
    [{ source: 'real' }]
  );
});

test('extractBookData ignores a line-comment decoy before a real assignment', () => {
  assert.deepEqual(
    extractBookData('<script>// bookData = [{"source":"comment"}];\nbookData = [{"source":"real"}];</script>'),
    [{ source: 'real' }]
  );
});

test('extractBookData ignores a block-comment decoy before a real assignment', () => {
  assert.deepEqual(
    extractBookData('<script>/* bookData = [{"source":"comment"}]; */ bookData = [{"source":"real"}];</script>'),
    [{ source: 'real' }]
  );
});

test('extractBookData unwraps the only array in a containing object', () => {
  const records = extractBookData(
    '<script>bookData: {"total": 1, "books": [{"title":"Alpha"}]};</script>'
  );

  assert.deepEqual(records, [{ title: 'Alpha' }]);
});

test('extractBookData rejects an object with ambiguous array values', () => {
  assert.throws(
    () => extractBookData('<script>bookData = {"books": [], "featured": []};</script>'),
    /Unable to parse embedded bookData/
  );
});

test('normalizeBook creates the canonical inventory record', () => {
  assert.deepEqual(
    normalizeBook({
      title: 'Alpha', userName: 'abc', bookId: 'one', pages: 12, publishTime: '2021-07-20'
    }, 0),
    {
      pos: 1,
      title: 'Alpha',
      byline: 'abc',
      pages: 12,
      uploaded: '2021-07-20',
      url: 'https://online.fliphtml5.com/abc/one/'
    }
  );
});

test('normalizeBook uses the current bookcase aliases and canonicalizes its URL', () => {
  assert.deepEqual(
    normalizeBook({
      title: 'Alpha',
      description: 'by Example',
      url: 'http://online.fliphtml5.com/abc/one/',
      pages: 12,
      newTime: '2021-07-20 21:41:02'
    }, 0),
    {
      pos: 1,
      title: 'Alpha',
      byline: 'by Example',
      pages: 12,
      uploaded: '2021-07-20',
      url: 'https://online.fliphtml5.com/abc/one/'
    }
  );
});

test('fetchBookcase fetches once and normalizes the extracted records', async () => {
  let requests = 0;
  const fetchImpl = async (url) => {
    requests += 1;
    assert.equal(url, 'https://example.test/bookcase');
    return { ok: true, text: async () => directFixture };
  };

  const records = await fetchBookcase('https://example.test/bookcase', fetchImpl);

  assert.equal(requests, 1);
  assert.deepEqual(records.map(({ pos, url }) => ({ pos, url })), [
    { pos: 1, url: 'https://online.fliphtml5.com/abc/one/' },
    { pos: 2, url: 'https://online.fliphtml5.com/def/two/' }
  ]);
});

test('fetchBookcase names non-successful HTTP responses', async () => {
  await assert.rejects(
    () => fetchBookcase('https://example.test/bookcase', async () => ({ ok: false, status: 503 })),
    /Bookcase request failed: HTTP 503/
  );
});

test('bookcase CLI uses its default URL and writes successful JSON', async () => {
  const preload = new URL('./fixtures/bookcase-cli-fetch-preload.mjs', import.meta.url).href;
  const result = await runNodeCli('harness/extract_bookcase.mjs', [], {
    nodeArguments: ['--import', preload],
    env: { BOOKCASE_CLI_HTML: directFixture }
  });

  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  assert.deepEqual(JSON.parse(result.stdout).map(({ pos, title }) => ({ pos, title })), [
    { pos: 1, title: 'Alpha' },
    { pos: 2, title: 'Beta' }
  ]);
});

test('bookcase CLI accepts one explicit URL and writes successful JSON', async () => {
  await withHttpServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end(directFixture);
  }, async (baseUrl) => {
    const result = await runNodeCli('harness/extract_bookcase.mjs', [`${baseUrl}/bookcase`]);

    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
    assert.equal(JSON.parse(result.stdout).length, 2);
  });
});

test('bookcase CLI reports HTTP failures', async () => {
  await withHttpServer((_request, response) => {
    response.writeHead(503);
    response.end('unavailable');
  }, async (baseUrl) => {
    const result = await runNodeCli('harness/extract_bookcase.mjs', [`${baseUrl}/bookcase`]);

    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, 'Bookcase request failed: HTTP 503\n');
  });
});

test('bookcase CLI rejects extra arguments instead of ignoring them', async () => {
  const result = await runNodeCli('harness/extract_bookcase.mjs', [
    'https://example.test/bookcase', 'extra'
  ]);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, 'Usage: node harness/extract_bookcase.mjs [url]\n');
});
