import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  extractPageText,
  fetchBookText,
  fetchBookTextInventory
} from '../harness/extract_book_text.mjs';
import { runNodeCli, withHttpServer } from './cli-test-helpers.mjs';

const textFixture = await readFile(
  new URL('./fixtures/book-text.html', import.meta.url),
  'utf8'
);
const noTextFixture = await readFile(
  new URL('./fixtures/book-no-text.html', import.meta.url),
  'utf8'
);
const emptyPagesFixture = await readFile(
  new URL('./fixtures/book-empty-pages.html', import.meta.url),
  'utf8'
);

test('extractPageText returns ordered text from page markers and paragraphs', () => {
  assert.deepEqual(extractPageText(textFixture), {
    textAvailable: true,
    pages: [
      { page: 1, text: 'First line & second line' },
      { page: 2, text: 'Quoted "claim" — checked' }
    ]
  });
});

test('extractPageText reports no text when page markers are absent', () => {
  assert.deepEqual(extractPageText(noTextFixture), { textAvailable: false, pages: [] });
});

test('extractPageText reports no text when every marked page is empty or markup-only', () => {
  assert.deepEqual(extractPageText(emptyPagesFixture), { textAvailable: false, pages: [] });
});

test('extractPageText concatenates duplicate pages and ignores empty paragraphs', () => {
  assert.deepEqual(
    extractPageText(
      '<span class="flip-basic-num">7</span><p>First</p><span class="flip-basic-num">7</span><p>   </p><span class="flip-basic-num">7</span><p>Second</p><span class="flip-basic-num">8</span><p>O&#39;Brien</p>'
    ),
    {
      textAvailable: true,
      pages: [{ page: 7, text: 'First\nSecond' }, { page: 8, text: "O'Brien" }]
    }
  );
});

test('extractPageText rejects nonnumeric page markers', () => {
  assert.throws(
    () => extractPageText('<span class="flip-basic-num">seven</span><p>Text</p>'),
    /Invalid page marker/
  );
});

test('extractPageText recognizes only an HTML class attribute as a page marker', () => {
  assert.deepEqual(
    extractPageText(`
      <span data-class="flip-basic-num">1</span><p>Data attribute</p>
      <span aria-class="flip-basic-num">2</span><p>ARIA attribute</p>
      <span markerclass="flip-basic-num">3</span><p>Suffixed attribute</p>
      <span data-kind="page" class="flip-basic-num" aria-label="four">4</span><p>Quoted class</p>
      <span data-kind="page" class=flip-basic-num aria-label="five">5</span><p>Unquoted class</p>
    `),
    {
      textAvailable: true,
      pages: [
        { page: 4, text: 'Quoted class' },
        { page: 5, text: 'Unquoted class' }
      ]
    }
  );
});

test('extractPageText ignores class-looking text inside foreign attribute values', () => {
  assert.deepEqual(
    extractPageText(`
      <span data-note="text class=flip-basic-num">1</span><p>Double-quoted value</p>
      <span data-note='text class=flip-basic-num'>2</span><p>Single-quoted value</p>
      <span data-note="class=not-a-marker" class="flip-basic-num">3</span><p>Real later class</p>
    `),
    { textAvailable: true, pages: [{ page: 3, text: 'Real later class' }] }
  );
});

test('fetchBookText fetches and returns the source URL with text', async () => {
  const url = 'https://example.test/book';
  const result = await fetchBookText(url, async (requestedUrl) => {
    assert.equal(requestedUrl, url);
    return { ok: true, text: async () => textFixture };
  });

  assert.deepEqual(result, {
    url,
    textAvailable: true,
    pages: [
      { page: 1, text: 'First line & second line' },
      { page: 2, text: 'Quoted "claim" — checked' }
    ]
  });
});

test('fetchBookText rejects invalid or unsupported URLs', async () => {
  await assert.rejects(() => fetchBookText('not a URL'), /Invalid book URL/);
  await assert.rejects(() => fetchBookText('ftp://example.test/book'), /Invalid book URL/);
});

test('fetchBookText names HTTP failures', async () => {
  await assert.rejects(
    () => fetchBookText('https://example.test/book', async () => ({ ok: false, status: 404 })),
    /Book request failed: HTTP 404/
  );
});

test('fetchBookTextInventory defaults to four workers, preserves order, and fetches each item once', async () => {
  const items = Array.from({ length: 6 }, (_, index) => ({
    pos: index + 1,
    url: `https://example.test/book-${index + 1}`,
    label: `book-${index + 1}`
  }));
  const requests = new Map();
  let active = 0;
  let peak = 0;
  const result = await fetchBookTextInventory(items, {
    fetchImpl: async (url) => {
      requests.set(url, (requests.get(url) ?? 0) + 1);
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 15));
      active -= 1;
      return {
        ok: true,
        text: async () => '<span class="flip-basic-num">1</span><p>Text</p>'
      };
    }
  });

  assert.equal(peak, 4);
  assert.deepEqual([...requests.values()], Array(6).fill(1));
  assert.deepEqual(result.map(({ pos, label }) => ({ pos, label })),
    items.map(({ pos, label }) => ({ pos, label })));
});

test('single-URL CLI writes successful JSON from a local HTTP server', async () => {
  await withHttpServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end(textFixture);
  }, async (baseUrl) => {
    const url = `${baseUrl}/single`;
    const result = await runNodeCli('harness/extract_book_text.mjs', [url]);

    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
    assert.deepEqual(JSON.parse(result.stdout), {
      url,
      textAvailable: true,
      pages: [
        { page: 1, text: 'First line & second line' },
        { page: 2, text: 'Quoted "claim" — checked' }
      ]
    });
  });
});

test('inventory CLI preserves input order and fields while bounding concurrency', async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'superstonk-text-cli-'));
  const inventoryPath = join(temporaryDirectory, 'inventory.json');
  const requests = new Map();
  let active = 0;
  let peak = 0;

  try {
    await withHttpServer((request, response) => {
      requests.set(request.url, (requests.get(request.url) ?? 0) + 1);
      active += 1;
      peak = Math.max(peak, active);
      const delay = request.url === '/first' ? 60 : 15;
      setTimeout(() => {
        active -= 1;
        response.writeHead(200, { 'content-type': 'text/html' });
        response.end(`<span class="flip-basic-num">1</span><p>${request.url}</p>`);
      }, delay);
    }, async (baseUrl) => {
      const inventory = [
        { pos: 1, title: 'First', url: `${baseUrl}/first` },
        { pos: 2, title: 'Second', url: `${baseUrl}/second` },
        { pos: 3, title: 'Third', url: `${baseUrl}/third` },
        { pos: 4, title: 'Fourth', url: `${baseUrl}/fourth` }
      ];
      await writeFile(inventoryPath, `${JSON.stringify(inventory)}\n`, 'utf8');

      const result = await runNodeCli('harness/extract_book_text.mjs', [
        '--inventory', inventoryPath, '--concurrency', '2'
      ]);

      assert.equal(result.status, 0);
      assert.equal(result.stderr, '');
      const output = JSON.parse(result.stdout);
      assert.deepEqual(output.map(({ pos, title, url }) => ({ pos, title, url })), inventory);
      assert.deepEqual(output.map(({ pages }) => pages[0].text),
        ['/first', '/second', '/third', '/fourth']);
      assert.equal(peak, 2);
      assert.deepEqual([...requests.values()], [1, 1, 1, 1]);
    });
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test('inventory CLI writes every result and exits nonzero after a per-item failure', async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'superstonk-text-cli-'));
  const inventoryPath = join(temporaryDirectory, 'inventory.json');

  try {
    await withHttpServer((request, response) => {
      if (request.url === '/broken') {
        response.writeHead(503);
        response.end('unavailable');
        return;
      }
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('<span class="flip-basic-num">1</span><p>Available</p>');
    }, async (baseUrl) => {
      const inventory = [
        { id: 'available', url: `${baseUrl}/available` },
        { id: 'broken', url: `${baseUrl}/broken` },
        { id: 'still-available', url: `${baseUrl}/later` }
      ];
      await writeFile(inventoryPath, JSON.stringify(inventory), 'utf8');

      const result = await runNodeCli('harness/extract_book_text.mjs', [
        '--inventory', inventoryPath
      ]);

      assert.equal(result.status, 1);
      assert.equal(result.stderr, '');
      const output = JSON.parse(result.stdout);
      assert.deepEqual(output.map(({ id }) => id), inventory.map(({ id }) => id));
      assert.equal(output[0].textAvailable, true);
      assert.equal(output[1].error, 'Book request failed: HTTP 503');
      assert.equal('pages' in output[1], false);
      assert.equal('textAvailable' in output[1], false);
      assert.equal(output[2].textAvailable, true);
    });
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test('inventory CLI rejects non-array and invalid-item inventories before fetching', async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'superstonk-text-cli-'));
  try {
    for (const [filename, contents, expectedError] of [
      ['object.json', '{}', /Inventory must be a JSON array/],
      ['bad-item.json', '[{"url":"ftp:\/\/example.test\/book"}]', /Inventory item 1 must be an object with an HTTP\(S\) url/]
    ]) {
      const inventoryPath = join(temporaryDirectory, filename);
      await writeFile(inventoryPath, contents, 'utf8');
      const result = await runNodeCli('harness/extract_book_text.mjs', [
        '--inventory', inventoryPath
      ]);

      assert.equal(result.status, 1);
      assert.equal(result.stdout, '');
      assert.match(result.stderr, expectedError);
    }
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test('CLI rejects missing, extra, incompatible, and invalid-concurrency arguments', async () => {
  for (const [arguments_, expectedError] of [
    [[], /Usage: node harness\/extract_book_text\.mjs <url>/],
    [['https://example.test/book', 'extra'], /Usage: node harness\/extract_book_text\.mjs <url>/],
    [['--concurrency', '2'], /Usage: node harness\/extract_book_text\.mjs <url>/],
    [['--inventory', 'inventory.json', '--concurrency', '0'], /Concurrency must be an integer from 1 to 8/],
    [['--inventory', 'inventory.json', '--concurrency', '2.5'], /Concurrency must be an integer from 1 to 8/],
    [['--inventory', 'inventory.json', 'extra'], /Usage: node harness\/extract_book_text\.mjs <url>/]
  ]) {
    const result = await runNodeCli('harness/extract_book_text.mjs', arguments_);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, expectedError);
  }
});
