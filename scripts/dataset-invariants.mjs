import { normalizeUrl } from './submission.mjs';

const PRESERVED_COUNT = 250;

export function checkDatasetInvariants(master, baseline) {
  const errors = [];

  if (baseline.length !== PRESERVED_COUNT) {
    errors.push(`baseline must contain exactly ${PRESERVED_COUNT} records`);
  } else if (!baseline.every((record, index) => record.pos === index + 1)) {
    errors.push('baseline positions must run 1–250 in order');
  }

  if (master.length < PRESERVED_COUNT) {
    errors.push(`canonical dataset must retain all ${PRESERVED_COUNT} preserved records`);
  } else {
    const preserved = master.slice(0, PRESERVED_COUNT);
    if (!preserved.every((record, index) => record.pos === index + 1)) {
      errors.push('preserved positions must run 1–250 in order');
    }
    for (const [index, record] of preserved.entries()) {
      if (Object.hasOwn(record, 'source_corpus')) {
        errors.push(`preserved record ${index + 1} must not carry source_corpus`);
      }
    }

    master.slice(PRESERVED_COUNT).forEach((record, offset) => {
      const expected = PRESERVED_COUNT + offset + 1;
      if (record.pos !== expected) {
        errors.push(
          `community record at index ${PRESERVED_COUNT + offset} must have pos ${expected}`
        );
      }
    });
  }

  const seen = new Set();
  for (const record of master) {
    if (seen.has(record.pos)) {
      errors.push(`duplicate pos ${record.pos}`);
    }
    seen.add(record.pos);
  }

  const seenUrls = new Map();
  for (const record of master) {
    if (typeof record.url !== 'string') {
      continue;
    }
    const normalized = normalizeUrl(record.url);
    const firstPos = seenUrls.get(normalized);
    if (firstPos !== undefined) {
      errors.push(`duplicate normalized url at pos ${record.pos} (already used by pos ${firstPos})`);
    } else {
      seenUrls.set(normalized, record.pos);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    preserved: Math.min(master.length, PRESERVED_COUNT),
    community: Math.max(master.length - PRESERVED_COUNT, 0)
  };
}
