import { isDeepStrictEqual } from 'node:util';
import { REVIEW_PROMPT_VERSIONS, hindsightCutoff } from './review-versions.mjs';
import { isPublicHttpUrl, normalizeUrl } from './submission.mjs';

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

  const originals = new Map(baseline.map((record) => [record.pos, record]));
  for (const record of master) {
    const provenance = record.review_provenance;
    if (provenance && !REVIEW_PROMPT_VERSIONS.includes(provenance.prompt_revision)) {
      errors.push(`record at pos ${record.pos} stamps prompt_revision ${provenance.prompt_revision}; reviews and dispute re-ratings must use ${REVIEW_PROMPT_VERSIONS.join(' or ')}`);
    }
    if (record.pos > PRESERVED_COUNT) {
      if (['reviewed', 'unreviewable'].includes(record.review_status) && !provenance) {
        errors.push(`community record at pos ${record.pos} requires review_provenance`);
      }
      if (record.review_status === 'pending' && provenance) {
        errors.push(`community record at pos ${record.pos} is pending and must not carry review_provenance`);
      }
      if (provenance) {
        try {
          const cutoff = hindsightCutoff(provenance.hindsight_version);
          if (!cutoff || !/^\d{4}-\d{2}-\d{2}$/.test(record.uploaded ?? '')) {
            errors.push(`community record at pos ${record.pos} needs a publication date and a dated hindsight version`);
          } else if (record.uploaded > cutoff) {
            errors.push(`community record at pos ${record.pos} was published ${record.uploaded}, after the ${provenance.hindsight_version} hindsight cutoff ${cutoff}`);
          }
        } catch (error) {
          errors.push(`community record at pos ${record.pos}: ${error.message}`);
        }
      }
    } else {
      const original = originals.get(record.pos);
      const changed = original && ['validity_rating', 'evidence_quality', 'key_claims']
        .some((field) => !isDeepStrictEqual(record[field], original[field]));
      if (changed) {
        if (!provenance) {
          errors.push(`changed preserved assessment at pos ${record.pos} requires review_provenance`);
        }
        if (!record.hindsight_version) {
          errors.push(`changed preserved assessment at pos ${record.pos} requires top-level hindsight_version`);
        }
      }
    }
    if (record.hindsight_version && provenance?.hindsight_version && record.hindsight_version !== provenance.hindsight_version) {
      errors.push(`record at pos ${record.pos}: top-level hindsight_version must match review_provenance.hindsight_version`);
    }
  }

  const seenUrls = new Map();
  for (const record of master) {
    const archiveUrl = record.submission?.archive_url;
    if (archiveUrl != null && !isPublicHttpUrl(archiveUrl)) {
      errors.push(`archive URL at pos ${record.pos} must be a public HTTP(S) URL without credentials`);
    }
    if (typeof record.url !== 'string') {
      // Requiredness and type are enforced by the record schema.
      continue;
    }
    if (!isPublicHttpUrl(record.url)) {
      errors.push(`source URL at pos ${record.pos} must be a public HTTP(S) URL without credentials`);
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
