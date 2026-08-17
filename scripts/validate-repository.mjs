import { readFile } from 'node:fs/promises';

import { validateMasterRecords } from './schema-validator.mjs';
import { checkDatasetInvariants } from './dataset-invariants.mjs';

const schema = JSON.parse(
  await readFile(new URL('../data/schema.json', import.meta.url), 'utf8')
);
const master = JSON.parse(
  await readFile(new URL('../data/master.json', import.meta.url), 'utf8')
);
const baseline = JSON.parse(
  await readFile(new URL('../data/original-master.json', import.meta.url), 'utf8')
);

let invalid = false;
for (const { name, outputPrefix, records } of [
  { name: 'current', outputPrefix: '', records: master },
  { name: 'original baseline', outputPrefix: 'Original baseline ', records: baseline }
]) {
  const result = validateMasterRecords(records, schema);
  for (const error of result.errors) {
    console.error(`${name} record ${error.record} ${error.path}: ${error.message}`);
  }
  const schemaLabel = outputPrefix === '' ? 'Schema' : `${outputPrefix}schema`;
  console.log(`${schemaLabel} validation: ${result.valid}/${result.total} records valid`);
  invalid ||= result.errors.length > 0;
}

const baselineSequenceComplete = baseline.length === 250 &&
  baseline.every((record, index) => record.pos === index + 1);
if (baselineSequenceComplete) {
  console.log('Original baseline position sequence: 1–250 complete');
} else {
  console.error('Original baseline position sequence: expected exactly 1–250');
}

const invariants = checkDatasetInvariants(master, baseline);
for (const error of invariants.errors) {
  console.error(`Canonical dataset: ${error}`);
}
if (invariants.ok) {
  console.log(
    `Canonical dataset: ${invariants.preserved} preserved + ${invariants.community} community records`
  );
}

if (invalid || !baselineSequenceComplete || !invariants.ok) {
  process.exitCode = 1;
}
