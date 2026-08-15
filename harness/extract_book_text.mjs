// RECONSTRUCTED — the original July 21, 2026 extraction script was not preserved.
import { pathToFileURL } from 'node:url';

const MARKER_CLASS = 'flip-basic-num';
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
  const quoted = /\bclass\s*=\s*(["'])(.*?)\1/i.exec(attributes);
  const unquoted = /\bclass\s*=\s*([^\s>]+)/i.exec(attributes);
  return (quoted?.[2] ?? unquoted?.[1] ?? '').trim().split(/\s+/).filter(Boolean);
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

  return {
    textAvailable: true,
    pages: [...pagesByNumber].map(([page, text]) => ({ page, text }))
  };
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

async function main() {
  const [url, ...extraArguments] = process.argv.slice(2);
  if (url === undefined || extraArguments.length > 0) {
    process.stderr.write('Usage: node harness/extract_book_text.mjs <url>\n');
    process.exitCode = 1;
    return;
  }

  try {
    process.stdout.write(`${JSON.stringify(await fetchBookText(url), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
