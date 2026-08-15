import { readFile } from 'node:fs/promises';

import { validateMasterRecords } from './schema-validator.mjs';

const schema = JSON.parse(
  await readFile(new URL('../data/schema.json', import.meta.url), 'utf8')
);
const datasets = [
  {
    name: 'current',
    outputPrefix: '',
    records: JSON.parse(
      await readFile(new URL('../data/master.json', import.meta.url), 'utf8')
    )
  },
  {
    name: 'original baseline',
    outputPrefix: 'Original baseline ',
    records: JSON.parse(
      await readFile(new URL('../data/original-master.json', import.meta.url), 'utf8')
    )
  }
];

let invalid = false;
for (const { name, outputPrefix, records } of datasets) {
  const result = validateMasterRecords(records, schema);
  for (const error of result.errors) {
    console.error(`${name} record ${error.record} ${error.path}: ${error.message}`);
  }
  const schemaLabel = outputPrefix === '' ? 'Schema' : `${outputPrefix}schema`;
  const positionLabel = outputPrefix === '' ? 'Position' : `${outputPrefix}position`;
  console.log(`${schemaLabel} validation: ${result.valid}/${result.total} records valid`);

  const positionsComplete = records.length === 250 &&
    records.every((record, index) => record.pos === index + 1);

  if (positionsComplete) {
    console.log(`${positionLabel} sequence: 1–250 complete`);
  } else {
    console.error(`${positionLabel} sequence: expected exactly 1–250`);
  }

  invalid ||= result.errors.length > 0 || !positionsComplete;
}

if (invalid) {
  process.exitCode = 1;
}
