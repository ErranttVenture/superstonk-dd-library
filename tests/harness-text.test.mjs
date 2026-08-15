import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

import {
  extractPageText,
  fetchBookText
} from '../harness/extract_book_text.mjs';

const textFixture = await readFile(
  new URL('./fixtures/book-text.html', import.meta.url),
  'utf8'
);
const noTextFixture = await readFile(
  new URL('./fixtures/book-no-text.html', import.meta.url),
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

test('CLI requires exactly one URL', () => {
  const result = spawnSync(process.execPath, ['harness/extract_book_text.mjs'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8'
  });

  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /Usage: node harness\/extract_book_text\.mjs <url>/);
});
