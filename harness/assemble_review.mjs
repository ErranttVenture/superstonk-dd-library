// Provenance: MAINTAINED. Model-neutral assembly of review packets and prompts from the
// recovered p1 sources and the maintained prompt_versions.md registry. It never invokes a
// model; see prompt_versions.md for the calibrated runtime that consumes its output.
import { readFileSync } from 'node:fs';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { digest, validatePreservedFiles } from '../scripts/preservation.mjs';

const USAGE = 'Usage: node harness/assemble_review.mjs --pos <n> --prompt <p1|p2> --hindsight <v1|v2> --packet <path> [--kind <review|verify>] [--output <path>]\n   or: node harness/assemble_review.mjs --pos <n> --packet-out <path> --evaluated-on <YYYY-MM-DD>';
const DEFAULT_MAX_CHARS = 400000;
const DEFAULT_LINE_WIDTH = 500;
const PLACEHOLDERS = /\{\{BOOK_PACKET_PATH\}\}|\{\{REVIEW_OUTPUT_PATH\}\}|\{\{VERIFY_OUTPUT_PATH\}\}|\$\{typeBlock\}|\$\{HINDSIGHT\}|\$\{RUBRIC\}|\$\{TIME_RULES\}|\$\{p\}/g;

function source(name) {
  return readFileSync(new URL(name, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
}

function fencedBlock(text, opening) {
  const found = [...text.matchAll(/```\n([\s\S]*?)\n```/g)]
    .map((match) => match[1])
    .find((block) => block.startsWith(opening));
  if (found === undefined) {
    throw new Error(`Missing fenced block starting "${opening}"`);
  }
  return found;
}

const reviewPromptSource = source('review_prompt.md');
const versionsSource = source('prompt_versions.md');

const TEMPLATES = {
  p1: {
    review: fencedBlock(reviewPromptSource, 'You are one reviewer in a 214-book'),
    verify: fencedBlock(source('calibration.md'), 'Calibration check for a standardized 214-book review'),
    types: {
      c: fencedBlock(reviewPromptSource, 'This book is PRE-CLASSIFIED AS A COMPILATION'),
      n: fencedBlock(reviewPromptSource, 'This book is a PERIODICAL'),
      o: fencedBlock(reviewPromptSource, 'This book is pre-classified as a single original work')
    }
  },
  p2: {
    review: fencedBlock(versionsSource, 'You are one reviewer for the DD Library'),
    verify: fencedBlock(versionsSource, 'Calibration check for the DD Library'),
    types: {
      c: fencedBlock(versionsSource, 'This work is PRE-CLASSIFIED AS A COMPILATION'),
      n: fencedBlock(versionsSource, 'This work is a PERIODICAL'),
      o: fencedBlock(versionsSource, 'This work is pre-classified as a single original work')
    }
  }
};
const RUBRIC = fencedBlock(source('rubric.md'), 'VALIDITY RATING ANCHORS');
const HINDSIGHT_V1 = fencedBlock(reviewPromptSource, 'VERIFIED HINDSIGHT FACTS (as of mid-2026');
const TIME_RULES = TEMPLATES.p2.review.slice(
  TEMPLATES.p2.review.indexOf('TIME RULES:'),
  TEMPLATES.p2.review.indexOf('\n\nRULES:')
);

// hindsight.md "Assembling the block for a review": the re-dated heading, the 15 v1
// bullets, then the v2 fact bullets (joined from their wrapped Markdown lines).
function assembleHindsightV2() {
  const hindsight = source('hindsight.md');
  const heading = /The heading line `([^`]+)`/.exec(hindsight)?.[1].replace(/\s+/g, ' ');
  const amendments = hindsight.slice(hindsight.indexOf('## v2 amendments'), hindsight.indexOf('## Changelog'));
  const bullets = [];
  for (const line of amendments.split('\n')) {
    if (line.startsWith('- ')) {
      bullets.push(line);
    } else if (line.startsWith('  ') && bullets.length > 0 && line.trim() !== '') {
      bullets[bullets.length - 1] += ` ${line.trim()}`;
    }
  }
  if (!heading || bullets.length === 0) {
    throw new Error('hindsight.md does not define a v2 block');
  }
  return [heading, ...HINDSIGHT_V1.split('\n').slice(1), ...bullets].join('\n');
}

const HINDSIGHT = { v1: HINDSIGHT_V1, v2: assembleHindsightV2() };

export function hindsightBlock(version) {
  if (!Object.hasOwn(HINDSIGHT, version)) {
    throw new Error(`Unknown hindsight version: ${version}`);
  }
  return HINDSIGHT[version];
}

// v1's heading says "as of mid-2026"; prompt_versions.md fixes it at the July run date.
export function hindsightCutoff(version) {
  const heading = hindsightBlock(version).split('\n')[0];
  return /as of (\d{4}-\d{2}-\d{2})/.exec(heading)?.[1] ?? (version === 'v1' ? '2026-07-21' : null);
}

function typeKey(record) {
  if (record.type === 'compilation') return 'c';
  if (record.type === 'periodical') return 'n';
  return 'o';
}

export function assemblePrompt({ promptVersion, hindsightVersion, record, packetPath, kind = 'review', outputPath }) {
  if (!Object.hasOwn(TEMPLATES, promptVersion)) {
    throw new Error(`Unknown prompt version: ${promptVersion}`);
  }
  if (kind !== 'review' && kind !== 'verify') {
    throw new Error(`Unknown prompt kind: ${kind}`);
  }
  const prompts = TEMPLATES[promptVersion];
  const template = prompts[kind];
  if (promptVersion === 'p1' && !outputPath) {
    throw new Error('p1 prompts require an output path for their Write step');
  }
  // A work newer than the hindsight block would have its recent claims graded against stale facts.
  const cutoff = hindsightCutoff(hindsightVersion);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(record.uploaded ?? '')) {
    throw new Error(`Record ${record.pos} needs a YYYY-MM-DD publication date (uploaded)`);
  }
  if (!cutoff || record.uploaded > cutoff) {
    throw new Error(`Record ${record.pos} was published ${record.uploaded}, after the ${hindsightVersion} hindsight cutoff ${cutoff}; publish a newer hindsight version first`);
  }
  const values = {
    '{{BOOK_PACKET_PATH}}': packetPath,
    '{{REVIEW_OUTPUT_PATH}}': outputPath,
    '{{VERIFY_OUTPUT_PATH}}': outputPath,
    '${typeBlock}': prompts.types[typeKey(record)],
    '${HINDSIGHT}': hindsightBlock(hindsightVersion),
    '${RUBRIC}': RUBRIC,
    '${TIME_RULES}': TIME_RULES,
    '${p}': String(record.pos)
  };
  // One pass with a function replacer: inserted text is never rescanned and "$&" stays literal.
  return template.replace(PLACEHOLDERS, (placeholder) => values[placeholder]);
}

// Wrap at single spaces so no line exceeds the width; a token longer than the width is split.
function wrapLine(line, width) {
  if (line.length <= width) return [line];
  const lines = [];
  let current = null;
  for (const word of line.split(' ')) {
    for (let start = 0; start === 0 || start < word.length; start += width) {
      const piece = word.slice(start, start + width);
      if (current === null) {
        current = piece;
      } else if (current.length + 1 + piece.length <= width) {
        current = `${current} ${piece}`;
      } else {
        lines.push(current);
        current = piece;
      }
    }
  }
  lines.push(current);
  return lines;
}

// Sorted page numbers as contiguous ranges ("3-13, 15-35, 37"), so gaps stay visible.
function pageRanges(numbers) {
  const ranges = [];
  for (const number of numbers) {
    const last = ranges.at(-1);
    if (last && number === last[1] + 1) last[1] = number;
    else ranges.push([number, number]);
  }
  return ranges.map(([first, last]) => (first === last ? `${first}` : `${first}-${last}`)).join(', ');
}

function wrapText(text, width) {
  return text.split('\n').flatMap((line) => wrapLine(line, width)).join('\n');
}

export function buildPacket(record, text, { contract, evaluatedOn, maxChars = DEFAULT_MAX_CHARS, lineWidth = DEFAULT_LINE_WIDTH } = {}) {
  if (contract !== 'p1' && contract !== 'p2') {
    throw new Error(`Unknown packet contract: ${contract}`);
  }
  if (contract === 'p2' && !evaluatedOn) {
    throw new Error('p2 packets require evaluatedOn');
  }

  let body;
  let coverage;
  if (typeof text === 'string') {
    if (text.length > maxChars) {
      throw new Error('Text exceeds the packet limit; supply it as pages');
    }
    body = wrapText(text, lineWidth);
    coverage = 'full text';
  } else {
    const pages = [...text].sort((left, right) => left.page - right.page);
    const kept = [];
    let characters = 0;
    for (const page of pages) {
      if (characters + page.text.length > maxChars) break;
      kept.push(page);
      characters += page.text.length;
    }
    if (kept.length === 0) {
      throw new Error('No page fits within the packet limit');
    }
    body = kept.map((page) => `[page ${page.page}]\n${wrapText(page.text, lineWidth)}`).join('\n\n');
    const total = record.pages ?? pages.length;
    const complete = kept.length === total && kept.every((page, index) => page.page === index + 1);
    coverage = complete ? 'full text' : `sample: pages ${pageRanges(kept.map((page) => page.page))} of ${total}`;
  }

  const header = contract === 'p1'
    ? [
        `TITLE: ${record.title}`,
        `BYLINE: ${record.byline}`,
        `OFFICIAL PAGE COUNT: ${record.pages ?? 'n/a'}`,
        `UPLOAD DATE: ${record.uploaded}`,
        `TEXT COVERAGE: ${coverage}`
      ]
    : [
        `TITLE: ${record.title}`,
        `BYLINE: ${record.byline}`,
        `PLATFORM: ${record.submission?.platform ?? 'FlipHTML5'}`,
        `PUBLISHED: ${record.uploaded}`,
        `PAGES: ${record.pages ?? 'n/a'}`,
        `EVALUATED ON: ${evaluatedOn}`,
        `TEXT COVERAGE: ${coverage}`
      ];
  return `${header.join('\n')}\n---\n${body}`;
}

function parseArguments(arguments_) {
  const options = {};
  for (let index = 0; index < arguments_.length; index += 2) {
    const [flag, value] = [arguments_[index], arguments_[index + 1]];
    if (!/^--(pos|prompt|hindsight|packet|kind|output|packet-out|evaluated-on)$/.test(flag) || !value || value.startsWith('--') || Object.hasOwn(options, flag.slice(2))) {
      throw new Error(USAGE);
    }
    options[flag.slice(2)] = value;
  }
  const packetMode = Object.hasOwn(options, 'packet-out');
  if (!/^[1-9][0-9]*$/.test(options.pos ?? '') || (packetMode
    ? (!options['evaluated-on'] || ['prompt', 'hindsight', 'packet', 'kind', 'output'].some((key) => Object.hasOwn(options, key)))
    : (!options.prompt || !options.hindsight || !options.packet || Object.hasOwn(options, 'evaluated-on')))) {
    throw new Error(USAGE);
  }
  return options;
}

function isWithin(root, path) {
  const distance = relative(root, path);
  return distance === '' || (distance !== '..' && !distance.startsWith(`..${sep}`) && !isAbsolute(distance));
}

async function writeCommunityPacket(record, path, evaluatedOn) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(evaluatedOn) || !Number.isFinite(Date.parse(evaluatedOn)) ||
      new Date(evaluatedOn).toISOString().slice(0, 10) !== evaluatedOn) {
    throw new Error('--evaluated-on must be a valid YYYY-MM-DD date');
  }
  const copy = record.submission?.preserved_text;
  if (record.pos <= 250 || record.source_corpus !== 'community' || !copy) {
    throw new Error(`Record ${record.pos}: packet mode requires a community record with submission.preserved_text`);
  }
  const root = fileURLToPath(new URL('../', import.meta.url));
  const output = resolve(path);
  // Check both the spelling and the real parent: an external junction can lead back inside.
  if (isWithin(root, output) || isWithin(await realpath(root), await realpath(dirname(output)))) {
    throw new Error('Packet output must be outside the repository');
  }
  const errors = await validatePreservedFiles([record], root);
  if (errors.length) throw new Error(errors.join('\n'));
  const bytes = await readFile(join(root, copy.path));
  // Hash the actual buffer used below as well as validating the canonical preserved path.
  if (digest(bytes) !== copy.sha256) throw new Error(`Record ${record.pos}: Preserved text SHA-256 mismatch.`);
  const text = bytes.toString('utf8');
  const separator = /^---\r?$/m.exec(text);
  if (!separator) throw new Error(`Record ${record.pos}: preserved text has no --- separator line`);
  let start = separator.index + separator[0].length;
  if (text[start] === '\n') start += 1;
  // Preserved Markdown is already the source text: retain its exact body, including long lines.
  const packet = buildPacket(record, text.slice(start), { contract: 'p2', evaluatedOn, lineWidth: Infinity });
  // Exclusive creation also refuses existing symlinks and protects previous packet files.
  await writeFile(output, packet, { encoding: 'utf8', flag: 'wx' });
  return output;
}

async function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    const master = JSON.parse(readFileSync(new URL('../data/master.json', import.meta.url), 'utf8'));
    const record = master.find((candidate) => candidate.pos === Number(options.pos));
    if (!record) {
      throw new Error(`No record at position ${options.pos}`);
    }
    if (options['packet-out']) {
      process.stdout.write(`${await writeCommunityPacket(record, options['packet-out'], options['evaluated-on'])}\n`);
      return;
    }
    process.stdout.write(`${assemblePrompt({
      promptVersion: options.prompt,
      hindsightVersion: options.hindsight,
      record,
      packetPath: options.packet,
      kind: options.kind,
      outputPath: options.output
    })}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
