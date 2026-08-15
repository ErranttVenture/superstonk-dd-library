import { readFile } from 'node:fs/promises';

import { validateMasterRecords } from './schema-validator.mjs';

const records = JSON.parse(
  await readFile(new URL('../data/master.json', import.meta.url), 'utf8')
);
const schema = JSON.parse(
  await readFile(new URL('../data/schema.json', import.meta.url), 'utf8')
);

const result = validateMasterRecords(records, schema);
for (const error of result.errors) {
  console.error(`record ${error.record} ${error.path}: ${error.message}`);
}
console.log(`Schema validation: ${result.valid}/${result.total} records valid`);

const positionsComplete = records.length === 250 &&
  records.every((record, index) => record.pos === index + 1);

if (positionsComplete) {
  console.log('Position sequence: 1–250 complete');
} else {
  console.error('Position sequence: expected exactly 1–250');
}

if (result.errors.length > 0 || !positionsComplete) {
  process.exitCode = 1;
}
