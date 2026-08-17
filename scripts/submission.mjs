const NO_RESPONSE = '_No response_';

export const MAX_RENDER_LENGTH = 200;

// Renders arbitrary, possibly hostile, submitter-derived text safely for inclusion in the
// bot's public markdown comment or stderr: no embedded newlines that could fake a standalone
// line, no `<` that could open an HTML comment or tag, no `@` or `#` that GitHub would
// linkify into a user mention or an issue/PR cross-reference, and a length cap. The `&#64;`
// and `&#35;` entities render as the original `@` and `#` characters but are not linkified.
export function renderSubmitterText(value) {
  // Order matters: '#' must be escaped before '@', because the '@' replacement's own output
  // (`&#64;`) contains a literal '#' that a later '#' pass would double-escape.
  const text = String(value)
    .replace(/[\r\n]+/g, ' ')
    .replace(/</g, '&lt;')
    .replace(/#/g, '&#35;')
    .replace(/@/g, '&#64;')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > MAX_RENDER_LENGTH ? `${text.slice(0, MAX_RENDER_LENGTH)}…` : text;
}

const FIELDS = new Map([
  ['Title', { field: 'title', kind: 'text', required: true }],
  ['Author / byline', { field: 'byline', kind: 'text', required: true }],
  ['Source URL', { field: 'url', kind: 'text', required: true }],
  ['Archive snapshot URL', { field: 'archive_url', kind: 'text', required: true }],
  ['Publication date', { field: 'published', kind: 'text', required: true }],
  ['Platform', { field: 'platform', kind: 'platform', required: true }],
  ['Length in pages', { field: 'length', kind: 'pages', required: false }],
  ['Compilation', { field: 'compilation', kind: 'checkbox', required: false }],
  ['One-line thesis', { field: 'thesis', kind: 'text', required: true }],
  ['Is the full text readable at the source URL?', { field: 'text_available', kind: 'yesno', required: true }],
  ['Related existing record', { field: 'related', kind: 'text', required: false }],
  ['Attribution', { field: 'attribution', kind: 'attribution', required: true }],
  ['Copyright acknowledgement', { field: 'acknowledgement', kind: 'checkbox', required: true }]
]);

const PLATFORMS = new Map([
  ['Reddit', 'reddit'],
  ['FlipHTML5', 'fliphtml5'],
  ['Substack', 'substack'],
  ['Hosted PDF', 'pdf'],
  ['Other', 'other']
]);

const ATTRIBUTIONS = new Map([
  ['Credit my GitHub handle', 'handle'],
  ['Submit anonymously', 'anonymous']
]);

const KNOWN_LABELS = new Set(FIELDS.keys());

function splitSections(body) {
  const sections = new Map();
  let heading = null;
  let lines = [];

  for (const rawLine of body.replace(/\r\n/g, '\n').split('\n')) {
    const match = /^###\s+(.*)$/.exec(rawLine);
    const label = match ? match[1].trim() : null;
    if (match && KNOWN_LABELS.has(label)) {
      if (heading !== null) {
        sections.set(heading, lines.join('\n').trim());
      }
      heading = label;
      lines = [];
    } else if (heading !== null) {
      lines.push(rawLine);
    }
  }
  if (heading !== null) {
    sections.set(heading, lines.join('\n').trim());
  }
  return sections;
}

export function parseSubmissionIssue(body) {
  const sections = splitSections(body ?? '');
  const payload = {};
  const errors = [];

  for (const [label, { field, kind, required }] of FIELDS) {
    const raw = sections.get(label) ?? '';
    const value = raw === NO_RESPONSE ? '' : raw;

    if (kind === 'checkbox') {
      const ticked = /^-\s*\[[xX]\]/m.test(value);
      if (field === 'acknowledgement') {
        if (!ticked) {
          errors.push({ field, message: 'The copyright acknowledgement must be ticked.' });
        }
        payload.acknowledged = ticked;
      } else {
        payload[field] = ticked;
      }
      continue;
    }

    if (value === '') {
      if (required) {
        errors.push({ field, message: `${label} is required.` });
      } else {
        payload[field] = null;
      }
      continue;
    }

    if (kind === 'platform') {
      const mapped = PLATFORMS.get(value);
      if (mapped === undefined) {
        errors.push({ field, message: `"${value}" is not one of the listed platforms.` });
      } else {
        payload[field] = mapped;
      }
    } else if (kind === 'attribution') {
      const mapped = ATTRIBUTIONS.get(value);
      if (mapped === undefined) {
        errors.push({ field, message: `"${value}" is not one of the listed attribution options.` });
      } else {
        payload[field] = mapped;
      }
    } else if (kind === 'yesno') {
      if (!/^(yes|no)$/i.test(value)) {
        errors.push({ field, message: `"${value}" must be Yes or No.` });
      } else {
        payload[field] = /^yes$/i.test(value);
      }
    } else if (kind === 'pages') {
      if (!/^[0-9]+$/.test(value)) {
        errors.push({ field, message: `"${value}" is not a whole number of pages.` });
      } else {
        const numPages = Number(value);
        if (numPages < 1) {
          errors.push({ field, message: 'Page count must be at least 1.' });
        } else {
          payload[field] = numPages;
        }
      }
    } else {
      payload[field] = value;
    }
  }

  return { payload, errors };
}

const ARCHIVAL_HOSTS = new Set([
  'web.archive.org',
  'archive.today',
  'archive.ph',
  'archive.is'
]);
const TRACKING_PARAMETERS = new Set(['ref', 'ref_source', 'share_id', 'si', 'fbclid']);
const MINIMUM_THESIS_LENGTH = 40;
const RESOLVE_TIMEOUT_MS = 10_000;
const DEFINITIVE_MISSING_STATUSES = new Set([404, 410]);

export function normalizeUrl(value) {
  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    return value.trim().toLowerCase();
  }

  parsed.protocol = 'https:';
  parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
  parsed.hash = '';
  parsed.pathname = parsed.pathname.replace(/\/+$/, '');

  for (const key of [...parsed.searchParams.keys()]) {
    if (key.startsWith('utm_') || TRACKING_PARAMETERS.has(key)) {
      parsed.searchParams.delete(key);
    }
  }
  parsed.searchParams.sort();

  return parsed.toString();
}

export async function resolveUrl(url) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const response = await fetch(url, {
        method,
        redirect: 'follow',
        signal: AbortSignal.timeout(RESOLVE_TIMEOUT_MS)
      });
      if (response.ok) {
        return 'ok';
      }
      if (DEFINITIVE_MISSING_STATUSES.has(response.status) && method === 'GET') {
        return 'missing';
      }
    } catch {
      if (method === 'GET') {
        return 'unknown';
      }
    }
  }
  return 'unknown';
}

function fold(value) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function checkSubmission(payload, { resolveUrl: resolve, dataset, now = Date.now() }) {
  const checks = [];
  const add = (id, status, message) => checks.push({ id, status, message });

  let sourceUrl = null;
  try {
    sourceUrl = new URL(payload.url);
  } catch {
    sourceUrl = null;
  }
  if (sourceUrl === null || (sourceUrl.protocol !== 'http:' && sourceUrl.protocol !== 'https:')) {
    add(
      'url_resolves',
      'fail',
      'Source URL must be a valid http:// or https:// URL.'
    );
  } else {
    const sourceState = await resolve(payload.url);
    add(
      'url_resolves',
      sourceState === 'ok' ? 'pass' : sourceState === 'missing' ? 'fail' : 'unknown',
      sourceState === 'ok'
        ? 'Source URL resolves.'
        : sourceState === 'missing'
          ? 'Source URL did not resolve.'
          : 'Source URL could not be reached at check time; this is not a rejection.'
    );
  }

  let archiveHost = null;
  try {
    archiveHost = new URL(payload.archive_url).hostname.toLowerCase();
  } catch {
    archiveHost = null;
  }
  if (archiveHost === null || !ARCHIVAL_HOSTS.has(archiveHost)) {
    add(
      'archive_present',
      'fail',
      `Archive snapshot must be hosted at ${[...ARCHIVAL_HOSTS].join(', ')}.`
    );
  } else {
    const archiveState = await resolve(payload.archive_url);
    add(
      'archive_present',
      archiveState === 'ok' ? 'pass' : archiveState === 'missing' ? 'fail' : 'unknown',
      archiveState === 'ok'
        ? 'Archive snapshot resolves.'
        : archiveState === 'missing'
          ? 'Archive snapshot did not resolve.'
          : 'Archive snapshot could not be reached at check time; this is not a rejection.'
    );
  }

  const normalized = normalizeUrl(payload.url);
  const duplicate = dataset.find((entry) => normalizeUrl(entry.url) === normalized);
  add(
    'no_duplicate',
    duplicate ? 'fail' : 'pass',
    duplicate
      ? `That URL is already in the library at no. ${duplicate.pos}.`
      : 'Not already in the library.'
  );

  const hasByline = payload.byline.trim() !== '';
  add(
    'byline_present',
    hasByline ? 'pass' : 'fail',
    hasByline ? 'Author identified.' : 'An author or handle is required. Pseudonyms are fine.'
  );

  const wellFormedDate = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(payload.published);
  const parsedDate = wellFormedDate ? new Date(`${payload.published}T00:00:00Z`) : null;
  const validDate = parsedDate !== null &&
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === payload.published &&
    parsedDate.getTime() <= now;
  add(
    'published_valid',
    validDate ? 'pass' : 'fail',
    validDate
      ? 'Publication date is valid.'
      : 'Publication date must be a real past date in YYYY-MM-DD format.'
  );

  const longEnough = payload.thesis.trim().length >= MINIMUM_THESIS_LENGTH;
  add(
    'thesis_present',
    longEnough ? 'pass' : 'fail',
    longEnough
      ? 'Thesis stated.'
      : `State the thesis in at least ${MINIMUM_THESIS_LENGTH} characters.`
  );

  add(
    'copyright_ack',
    payload.acknowledged ? 'pass' : 'fail',
    payload.acknowledged
      ? 'Copyright acknowledgement given.'
      : 'The copyright acknowledgement must be ticked.'
  );

  const nearMatch = dataset.find((entry) =>
    fold(entry.title) === fold(payload.title) && fold(entry.byline) === fold(payload.byline));
  add(
    'title_byline_near_match',
    nearMatch ? 'warn' : 'pass',
    nearMatch
      ? `Same title and byline as no. ${nearMatch.pos}. Not a blocker, but confirm this is a distinct work.`
      : 'No title and byline collision.'
  );

  const status = checks.some((check) => check.status === 'fail')
    ? 'blocked'
    : checks.some((check) => check.status === 'unknown')
      ? 'incomplete'
      : 'pass';

  return { status, checks };
}

export function buildPendingRecord(payload, { nextPos, submittedOn, issue, author }) {
  return {
    pos: nextPos,
    title: payload.title.trim(),
    byline: payload.byline.trim(),
    pages: payload.length,
    uploaded: payload.published,
    url: payload.url.trim(),
    type: payload.compilation ? 'compilation' : 'original',
    text_available: payload.text_available,
    source_corpus: 'community',
    review_status: 'pending',
    submission: {
      submitted_on: submittedOn,
      submitted_by: payload.attribution === 'anonymous' ? 'anonymous' : author,
      issue,
      archive_url: payload.archive_url.trim(),
      platform: payload.platform
    }
  };
}
