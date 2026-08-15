// RECONSTRUCTED — the original July 21, 2026 extraction script was not preserved.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const MARKER_CLASS = 'flip-basic-num';
const DEFAULT_CONCURRENCY = 4;
const USAGE = [
  'Usage: node harness/extract_book_text.mjs <url>',
  '       node harness/extract_book_text.mjs --inventory <path> [--concurrency <1-8>]'
].join('\n');
const BLOCK_ENDINGS = /<\/(?:address|article|aside|blockquote|dd|div|dl|dt|fieldset|figcaption|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|table|tbody|td|tfoot|th|thead|tr|ul)\s*>/gi;
const NAMED_ENTITIES = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  quot: '"'
};

function decodeEntities(value) {
  return value.replace(/&(?:#([0-9]+)|#x([0-9a-f]+)|([a-z]+));/gi, (entity, decimal, hexadecimal, named) => {
    if (decimal !== undefined || hexadecimal !== undefined) {
      const codePoint = Number.parseInt(decimal ?? hexadecimal, hexadecimal === undefined ? 10 : 16);
      if (codePoint <= 0x10ffff) {
        return String.fromCodePoint(codePoint);
      }
      return entity;
    }
    return NAMED_ENTITIES[named.toLowerCase()] ?? entity;
  });
}

function textFromHtml(html) {
  return decodeEntities(
    html
      .replace(/<br\b[^>]*>/gi, ' ')
      .replace(BLOCK_ENDINGS, ' ')
      .replace(/<[^>]*>/g, '')
  ).replace(/\s+/g, ' ').trim();
}

function classList(attributes) {
  let index = 0;

  while (index < attributes.length) {
    while (/\s/.test(attributes[index] ?? '') || attributes[index] === '/') {
      index += 1;
    }

    const nameStart = index;
    while (/[^\s=/>]/.test(attributes[index] ?? '')) {
      index += 1;
    }
    const name = attributes.slice(nameStart, index);
    if (name === '') {
      index += 1;
      continue;
    }

    while (/\s/.test(attributes[index] ?? '')) {
      index += 1;
    }

    let value = '';
    if (attributes[index] === '=') {
      index += 1;
      while (/\s/.test(attributes[index] ?? '')) {
        index += 1;
      }

      const quote = attributes[index];
      if (quote === '"' || quote === "'") {
        const valueStart = ++index;
        while (index < attributes.length && attributes[index] !== quote) {
          index += 1;
        }
        value = attributes.slice(valueStart, index);
        if (attributes[index] === quote) {
          index += 1;
        }
      } else {
        const valueStart = index;
        while (/[^\s>]/.test(attributes[index] ?? '')) {
          index += 1;
        }
        value = attributes.slice(valueStart, index);
      }
    }

    if (name.toLowerCase() === 'class') {
      return value.trim().split(/\s+/).filter(Boolean);
    }
  }

  return [];
}

function findMarkers(html) {
  const markers = [];
  const openElements = /<([a-z][\w:-]*)\b([^>]*)>/gi;
  let match;

  while ((match = openElements.exec(html)) !== null) {
    const [opening, tagName, attributes] = match;
    if (!classList(attributes).includes(MARKER_CLASS)) {
      continue;
    }

    const closing = new RegExp(`</${tagName}\\s*>`, 'ig');
    closing.lastIndex = openElements.lastIndex;
    const closingMatch = closing.exec(html);
    if (closingMatch === null) {
      throw new Error('Invalid page marker: missing closing tag');
    }

    const pageText = textFromHtml(html.slice(openElements.lastIndex, closingMatch.index));
    if (!/^\d+$/.test(pageText)) {
      throw new Error(`Invalid page marker: ${pageText || 'empty'}`);
    }

    markers.push({
      page: Number.parseInt(pageText, 10),
      after: closing.lastIndex,
      start: match.index
    });
    openElements.lastIndex = closing.lastIndex;
  }

  return markers;
}

function associatedParagraph(html, marker, nextMarkerStart) {
  const paragraph = /<p\b[^>]*>/ig;
  paragraph.lastIndex = marker.after;
  const opening = paragraph.exec(html);
  if (opening === null || opening.index >= nextMarkerStart) {
    throw new Error(`Page marker ${marker.page} has no associated paragraph`);
  }

  const close = /<\/p\s*>/ig;
  close.lastIndex = paragraph.lastIndex;
  const closing = close.exec(html);
  if (closing === null || closing.index >= nextMarkerStart) {
    throw new Error(`Page marker ${marker.page} has no associated paragraph`);
  }
  return textFromHtml(html.slice(paragraph.lastIndex, closing.index));
}

export function extractPageText(html) {
  if (typeof html !== 'string') {
    throw new Error('HTML must be a string');
  }

  const markers = findMarkers(html);
  if (markers.length === 0) {
    return { textAvailable: false, pages: [] };
  }

  const pagesByNumber = new Map();
  for (let index = 0; index < markers.length; index += 1) {
    const text = associatedParagraph(html, markers[index], markers[index + 1]?.start ?? Infinity);
    if (text === '') {
      continue;
    }
    const existing = pagesByNumber.get(markers[index].page);
    pagesByNumber.set(markers[index].page, existing === undefined
      ? text
      : `${existing}\n${text}`);
  }

  const pages = [...pagesByNumber].map(([page, text]) => ({ page, text }));
  return pages.length === 0
    ? { textAvailable: false, pages: [] }
    : { textAvailable: true, pages };
}

function validateBookUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid book URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Invalid book URL');
  }
}

export async function fetchBookText(url, fetchImpl = fetch) {
  validateBookUrl(url);
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Book request failed: HTTP ${response.status}`);
  }
  return { url, ...extractPageText(await response.text()) };
}

function validateInventory(inventory) {
  if (!Array.isArray(inventory)) {
    throw new Error('Inventory must be a JSON array');
  }

  inventory.forEach((item, index) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`Inventory item ${index + 1} must be an object with an HTTP(S) url`);
    }
    try {
      validateBookUrl(item.url);
    } catch {
      throw new Error(`Inventory item ${index + 1} must be an object with an HTTP(S) url`);
    }
  });
}

function validateConcurrency(concurrency) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) {
    throw new Error('Concurrency must be an integer from 1 to 8');
  }
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export async function fetchBookTextInventory(
  inventory,
  { concurrency = DEFAULT_CONCURRENCY, fetchImpl = fetch } = {}
) {
  validateInventory(inventory);
  validateConcurrency(concurrency);

  const results = new Array(inventory.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < inventory.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = inventory[index];
      try {
        const { textAvailable, pages } = await fetchBookText(item.url, fetchImpl);
        const result = { ...item, textAvailable, pages };
        delete result.error;
        results[index] = result;
      } catch (error) {
        const result = { ...item, error: errorMessage(error) };
        delete result.textAvailable;
        delete result.pages;
        results[index] = result;
      }
    }
  }

  const workerCount = Math.min(concurrency, inventory.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

function parseArguments(arguments_) {
  if (arguments_.length === 1 && !arguments_[0].startsWith('--')) {
    return { mode: 'single', url: arguments_[0] };
  }
  if (arguments_.length === 2 && arguments_[0] === '--inventory') {
    return { mode: 'inventory', path: arguments_[1], concurrency: DEFAULT_CONCURRENCY };
  }
  if (
    arguments_.length === 4 &&
    arguments_[0] === '--inventory' &&
    arguments_[2] === '--concurrency'
  ) {
    if (!/^[1-8]$/.test(arguments_[3])) {
      throw new Error('Concurrency must be an integer from 1 to 8');
    }
    return {
      mode: 'inventory',
      path: arguments_[1],
      concurrency: Number.parseInt(arguments_[3], 10)
    };
  }
  throw new Error(USAGE);
}

async function readInventory(path) {
  let serialized;
  try {
    serialized = await readFile(path, 'utf8');
  } catch (error) {
    throw new Error(`Unable to read inventory: ${errorMessage(error)}`);
  }
  try {
    return JSON.parse(serialized);
  } catch {
    throw new Error('Inventory must contain valid JSON');
  }
}

async function main() {
  try {
    const command = parseArguments(process.argv.slice(2));
    if (command.mode === 'single') {
      process.stdout.write(`${JSON.stringify(await fetchBookText(command.url), null, 2)}\n`);
      return;
    }

    const results = await fetchBookTextInventory(await readInventory(command.path), {
      concurrency: command.concurrency
    });
    process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
    if (results.some((result) => Object.hasOwn(result, 'error'))) {
      process.exitCode = 1;
    }
  } catch (error) {
    process.stderr.write(`${errorMessage(error)}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
