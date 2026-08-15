// RECONSTRUCTED — the original July 21, 2026 extraction script was not preserved.
import { pathToFileURL } from 'node:url';

const DEFAULT_BOOKCASE_URL = 'https://fliphtml5.com/bookcase/kosyg';
const BOOK_DATA_ERROR = 'Unable to parse embedded bookData';
const IDENTIFIER = /^[A-Za-z0-9_-]+$/;
const REGEX_PREFIX_KEYWORDS = new Set([
  'await', 'case', 'delete', 'do', 'else', 'in', 'instanceof', 'new', 'of',
  'return', 'throw', 'typeof', 'void', 'yield'
]);
const CONTROL_HEADER_KEYWORDS = new Set(['catch', 'for', 'if', 'switch', 'while', 'with']);
const STATEMENT_BODY_KEYWORDS = new Set(['do', 'else', 'finally', 'try']);

function bookDataError(reason) {
  throw new Error(reason ? `${BOOK_DATA_ERROR}: ${reason}` : BOOK_DATA_ERROR);
}

function scanQuotedLiteral(source, start) {
  const quote = source[start];
  let escaped = false;

  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) {
      escaped = false;
    } else if (character === '\\') {
      escaped = true;
    } else if (character === quote) {
      return { body: source.slice(start + 1, index), quote, end: index + 1 };
    }
  }

  bookDataError('unterminated quoted string');
}

function decodeJavaScriptString(body) {
  let decoded = '';

  for (let index = 0; index < body.length; index += 1) {
    const character = body[index];
    if (character !== '\\') {
      decoded += character;
      continue;
    }

    const escape = body[++index];
    if (escape === undefined) {
      bookDataError('unterminated string escape');
    }
    if (escape === 'u') {
      const hex = body.slice(index + 1, index + 5);
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
        bookDataError('invalid Unicode escape');
      }
      decoded += String.fromCharCode(Number.parseInt(hex, 16));
      index += 4;
      continue;
    }
    if (escape === 'x') {
      const hex = body.slice(index + 1, index + 3);
      if (!/^[0-9a-fA-F]{2}$/.test(hex)) {
        bookDataError('invalid hexadecimal escape');
      }
      decoded += String.fromCharCode(Number.parseInt(hex, 16));
      index += 2;
      continue;
    }

    const decodedEscapes = {
      b: '\b',
      f: '\f',
      n: '\n',
      r: '\r',
      t: '\t',
      v: '\v',
      0: '\0'
    };
    decoded += decodedEscapes[escape] ?? escape;
  }

  return decoded;
}

function scanBalancedJson(source, start) {
  const opening = source[start];
  if (opening !== '[' && opening !== '{') {
    bookDataError('expected an array, object, or quoted string');
  }

  const stack = [opening];
  let quote = null;
  let escaped = false;
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (quote !== null) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '[' || character === '{') {
      stack.push(character);
      continue;
    }
    if (character === ']' || character === '}') {
      const expectedOpening = character === ']' ? '[' : '{';
      if (stack.at(-1) !== expectedOpening) {
        bookDataError('mismatched brackets');
      }
      stack.pop();
      if (stack.length === 0) {
        return { serialized: source.slice(start, index + 1), end: index + 1 };
      }
    }
  }

  bookDataError('unterminated array or object');
}

function parseBookDataValue(source, start) {
  const character = source[start];
  let serialized;
  let end;
  if (character === '"' || character === "'") {
    const literal = scanQuotedLiteral(source, start);
    serialized = decodeJavaScriptString(literal.body);
    end = literal.end;
  } else {
    ({ serialized, end } = scanBalancedJson(source, start));
  }

  try {
    return { value: JSON.parse(serialized), end };
  } catch {
    bookDataError('invalid JSON');
  }
}

function asBookArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === null || typeof value !== 'object') {
    bookDataError('value is not an array or object');
  }

  const arrays = Object.values(value).filter(Array.isArray);
  if (arrays.length !== 1) {
    bookDataError('containing object must have exactly one array value');
  }
  return arrays[0];
}

function requireString(value, field, index, { nonEmpty = true } = {}) {
  if (typeof value !== 'string' || (nonEmpty && value.trim() === '')) {
    throw new Error(`Invalid book record at index ${index + 1}: ${field} must be a non-empty string`);
  }
  return value;
}

function requireIdentifier(value, field, index) {
  const identifier = requireString(value, field, index);
  if (!IDENTIFIER.test(identifier)) {
    throw new Error(`Invalid book record at index ${index + 1}: ${field} is not a valid identifier`);
  }
  return identifier;
}

function canonicalUrlFromEmbeddedUrl(value, index) {
  const rawUrl = requireString(value, 'url', index);
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid book record at index ${index + 1}: url is not a valid URL`);
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.hostname !== 'online.fliphtml5.com' ||
    segments.length !== 2
  ) {
    throw new Error(`Invalid book record at index ${index + 1}: url is not a FlipHTML5 book URL`);
  }

  const user = requireIdentifier(segments[0], 'url user identifier', index);
  const book = requireIdentifier(segments[1], 'url book identifier', index);
  return `https://online.fliphtml5.com/${user}/${book}/`;
}

function canonicalUrlFromIdentifiers(raw, index) {
  const user = requireIdentifier(raw.userName, 'userName', index);
  const book = requireIdentifier(raw.bookId ?? raw.bLink, 'bookId or bLink', index);
  return `https://online.fliphtml5.com/${user}/${book}/`;
}

function normalizeUploadDate(value, field, index) {
  const timestamp = requireString(value, field, index);
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|[ T])/.exec(timestamp);
  if (!match) {
    throw new Error(`Invalid book record at index ${index + 1}: ${field} must start with YYYY-MM-DD`);
  }
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`Invalid book record at index ${index + 1}: ${field} is not a calendar date`);
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function isIdentifierCharacter(character) {
  return character !== undefined && /[A-Za-z0-9_$]/.test(character);
}

function skipJavaScriptString(source, start) {
  const quote = source[start];
  let escaped = false;
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) {
      escaped = false;
    } else if (character === '\\') {
      escaped = true;
    } else if (character === quote) {
      return index + 1;
    }
  }
  return source.length;
}

function skipJavaScriptComment(source, start) {
  if (source[start + 1] === '/') {
    const newline = source.indexOf('\n', start + 2);
    return newline === -1 ? source.length : newline + 1;
  }
  const close = source.indexOf('*/', start + 2);
  return close === -1 ? source.length : close + 2;
}

function skipRegularExpression(source, start) {
  let escaped = false;
  let characterClass = false;
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) {
      escaped = false;
    } else if (character === '\\') {
      escaped = true;
    } else if (characterClass) {
      if (character === ']') {
        characterClass = false;
      }
    } else if (character === '[') {
      characterClass = true;
    } else if (character === '/') {
      let flag = index + 1;
      while (/[A-Za-z]/.test(source[flag] ?? '')) {
        flag += 1;
      }
      return flag;
    } else if (character === '\n' || character === '\r') {
      return source.length;
    }
  }
  return source.length;
}

function isJavaScriptIdentifierStart(character) {
  return character !== undefined && /[A-Za-z_$]/.test(character);
}

function skipJavaScriptIdentifier(source, start) {
  let index = start + 1;
  while (isIdentifierCharacter(source[index])) {
    index += 1;
  }
  return index;
}

function hasValidTerminator(source, end) {
  let index = end;
  while (/\s/.test(source[index] ?? '')) {
    index += 1;
  }
  return index === source.length || [';', ',', '}'].includes(source[index]);
}

function findBookDataCandidates(script) {
  const candidates = [];
  const delimiters = [];
  let expectsExpression = true;
  let atStatementStart = true;
  let pendingControlHeader = false;
  let pendingFunctionDeclaration = false;

  for (let index = 0; index < script.length; index += 1) {
    const character = script[index];
    if (character === '"' || character === "'" || character === '`') {
      index = skipJavaScriptString(script, index) - 1;
      expectsExpression = false;
      atStatementStart = false;
      continue;
    }
    if (character === '/' && (script[index + 1] === '/' || script[index + 1] === '*')) {
      index = skipJavaScriptComment(script, index) - 1;
      continue;
    }
    if (character === '/') {
      // A slash after an operand is division; only expression-start slashes can be regex literals.
      if (expectsExpression) {
        index = skipRegularExpression(script, index) - 1;
        expectsExpression = false;
      } else {
        expectsExpression = true;
      }
      atStatementStart = false;
      continue;
    }
    if (
      script.startsWith('bookData', index) &&
      !isIdentifierCharacter(script[index - 1]) &&
      !isIdentifierCharacter(script[index + 'bookData'.length])
    ) {
      let delimiter = index + 'bookData'.length;
      while (/\s/.test(script[delimiter] ?? '')) {
        delimiter += 1;
      }
      if (script[delimiter] === '=' || script[delimiter] === ':') {
        let valueStart = delimiter + 1;
        while (/\s/.test(script[valueStart] ?? '')) {
          valueStart += 1;
        }
        try {
          const parsed = parseBookDataValue(script, valueStart);
          if (hasValidTerminator(script, parsed.end)) {
            candidates.push(asBookArray(parsed.value));
          }
          index = parsed.end - 1;
        } catch {
          // This assignment is not a valid embedded JSON value. Continue lexing.
        }
      }
      expectsExpression = false;
      atStatementStart = false;
      continue;
    }
    if (isJavaScriptIdentifierStart(character)) {
      const end = skipJavaScriptIdentifier(script, index);
      const word = script.slice(index, end);
      pendingControlHeader = CONTROL_HEADER_KEYWORDS.has(word);
      pendingFunctionDeclaration ||= word === 'function' && atStatementStart;
      expectsExpression = REGEX_PREFIX_KEYWORDS.has(word);
      atStatementStart = STATEMENT_BODY_KEYWORDS.has(word);
      index = end - 1;
      continue;
    }
    if (/[0-9]/.test(character)) {
      expectsExpression = false;
      atStatementStart = false;
      continue;
    }
    if (character === '+' || character === '-') {
      if (script[index + 1] === character) {
        expectsExpression = false;
        index += 1;
      } else {
        expectsExpression = true;
      }
      atStatementStart = false;
      continue;
    }
    if (character === '(') {
      delimiters.push({ opening: '(', kind: pendingControlHeader ? 'control-header' : 'group' });
      pendingControlHeader = false;
      expectsExpression = true;
      atStatementStart = false;
      continue;
    }
    if (character === '[') {
      delimiters.push({ opening: '[', kind: 'group' });
      expectsExpression = true;
      atStatementStart = false;
      continue;
    }
    if (character === '{') {
      const kind = pendingFunctionDeclaration
        ? 'function-declaration'
        : atStatementStart ? 'statement-block' : 'object';
      delimiters.push({ opening: '{', kind });
      pendingFunctionDeclaration = false;
      expectsExpression = true;
      atStatementStart = kind !== 'object';
      continue;
    }
    if (character === ')') {
      const delimiter = delimiters.at(-1)?.opening === '(' ? delimiters.pop() : null;
      expectsExpression = delimiter?.kind === 'control-header';
      atStatementStart = expectsExpression;
      continue;
    }
    if (character === ']') {
      if (delimiters.at(-1)?.opening === '[') {
        delimiters.pop();
      }
      expectsExpression = false;
      atStatementStart = false;
      continue;
    }
    if (character === '}') {
      const delimiter = delimiters.at(-1)?.opening === '{' ? delimiters.pop() : null;
      expectsExpression = delimiter?.kind === 'statement-block' || delimiter?.kind === 'function-declaration';
      atStatementStart = expectsExpression;
      continue;
    }
    if (character === ';') {
      expectsExpression = true;
      atStatementStart = true;
      continue;
    }
    if ([',', ':', '=', '!', '~', '*', '%', '&', '|', '^', '<', '>', '?'].includes(character)) {
      expectsExpression = true;
      atStatementStart = false;
      continue;
    }
  }

  return candidates;
}

export function extractBookData(html) {
  if (typeof html !== 'string') {
    bookDataError('HTML must be a string');
  }
  const candidates = [];
  const scripts = /<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi;
  let match;
  while ((match = scripts.exec(html)) !== null) {
    candidates.push(...findBookDataCandidates(match[1]));
  }
  if (candidates.length !== 1) {
    bookDataError('expected exactly one valid assignment');
  }
  return candidates[0];
}

export function normalizeBook(raw, index) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`Invalid book record at index ${index + 1}: record must be an object`);
  }
  if (!Number.isInteger(index) || index < 0) {
    throw new Error('Invalid book record index');
  }

  const title = requireString(raw.title, 'title', index);
  const byline = requireString(raw.description ?? raw.userName, 'description or userName', index, { nonEmpty: false });
  if (!Number.isInteger(raw.pages) || raw.pages < 1) {
    throw new Error(`Invalid book record at index ${index + 1}: pages must be a positive integer`);
  }
  const uploaded = normalizeUploadDate(raw.newTime ?? raw.publishTime, 'newTime or publishTime', index);
  const url = raw.url === undefined
    ? canonicalUrlFromIdentifiers(raw, index)
    : canonicalUrlFromEmbeddedUrl(raw.url, index);

  return { pos: index + 1, title, byline, pages: raw.pages, uploaded, url };
}

export async function fetchBookcase(url, fetchImpl = fetch) {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Bookcase request failed: HTTP ${response.status}`);
  }
  const records = extractBookData(await response.text());
  return records.map(normalizeBook);
}

async function main() {
  const url = process.argv[2] ?? DEFAULT_BOOKCASE_URL;
  try {
    process.stdout.write(`${JSON.stringify(await fetchBookcase(url), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
