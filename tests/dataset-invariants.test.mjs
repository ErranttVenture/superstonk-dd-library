import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runNodeCli } from './cli-test-helpers.mjs';

import { checkDatasetInvariants } from '../scripts/dataset-invariants.mjs';

const baseline = Array.from({ length: 250 }, (_, index) => ({
  pos: index + 1,
  title: `Book ${index + 1}`
}));
const community = (pos) => ({ pos, title: `Submission ${pos}`, source_corpus: 'community' });

const provenance = (overrides = {}) => ({
  model: 'claude-haiku-4-5-20251001', evaluated_on: '2026-09-17',
  hindsight_version: 'v2', prompt_revision: 'p2', reviewer: 'QA maintainer', ...overrides
});

test('reviewed and unreviewable community records require provenance; pending records do not', () => {
  for (const review_status of ['reviewed', 'unreviewable']) {
    const record = { ...community(251), uploaded: '2026-08-16', review_status };
    for (const missing of [undefined, null]) {
      record.review_provenance = missing;
      assert.match(checkDatasetInvariants([...baseline, record], baseline).errors.join('\n'), /pos 251.*review_provenance/);
    }
    record.review_provenance = provenance();
    assert.deepEqual(checkDatasetInvariants([...baseline, record], baseline).errors, []);
  }
  assert.deepEqual(checkDatasetInvariants([...baseline, { ...community(251), review_status: 'pending' }], baseline).errors, []);
});

test('community provenance rejects p1 and dates after the selected hindsight version', () => {
  const record = { ...community(251), uploaded: '2026-07-21', review_provenance: provenance() };
  record.review_provenance.prompt_revision = 'p1';
  assert.match(checkDatasetInvariants([...baseline, record], baseline).errors.join('\n'), /pos 251.*p1/);
  for (const [version, boundary, later] of [['v1', '2026-07-21', '2026-07-22'], ['v2', '2026-08-16', '2026-08-17']]) {
    record.review_provenance = provenance({ hindsight_version: version });
    record.uploaded = boundary;
    assert.deepEqual(checkDatasetInvariants([...baseline, record], baseline).errors, []);
    record.uploaded = later;
    assert.match(checkDatasetInvariants([...baseline, record], baseline).errors.join('\n'), /pos 251.*after.*cutoff/);
  }
  record.review_provenance = provenance({ hindsight_version: 'v999' });
  assert.match(checkDatasetInvariants([...baseline, record], baseline).errors.join('\n'), /pos 251.*Unknown hindsight version/);
});

test('each changed preserved assessment requires provenance and a top-level hindsight version', () => {
  for (const [field, value] of Object.entries({ validity_rating: 3, evidence_quality: 4, key_claims: [{ claim: 'Changed' }] })) {
    const originals = structuredClone(baseline);
    originals[8][field] = value;
    const master = structuredClone(originals);
    assert.deepEqual(checkDatasetInvariants(master, originals).errors, [], 'structurally equal claim objects are unchanged');
    master[8][field] = field === 'key_claims' ? [{ claim: 'Re-rated' }] : 2;
    let errors = checkDatasetInvariants(master, originals).errors.join('\n');
    assert.match(errors, /pos 9.*review_provenance/, field);
    assert.match(errors, /pos 9.*top-level hindsight_version/, field);
    master[8].review_provenance = provenance();
    assert.match(checkDatasetInvariants(master, originals).errors.join('\n'), /pos 9.*top-level hindsight_version/);
    master[8].hindsight_version = 'v2';
    assert.deepEqual(checkDatasetInvariants(master, originals).errors, []);
    delete master[8].review_provenance;
    assert.match(checkDatasetInvariants(master, originals).errors.join('\n'), /pos 9.*review_provenance/);
    delete master[8][field];
    assert.match(checkDatasetInvariants(master, originals).errors.join('\n'), /pos 9.*review_provenance/, 'removing an assessment also changes it');
  }
});

test('top-level and provenance hindsight versions must agree on preserved and community records', () => {
  for (const pos of [9, 251]) {
    const master = [...structuredClone(baseline), community(251)];
    Object.assign(master[pos - 1], { uploaded: '2026-07-21', hindsight_version: 'v1', review_provenance: provenance() });
    assert.match(checkDatasetInvariants(master, baseline).errors.join('\n'), new RegExp(`pos ${pos}.*hindsight_version.*match`));
    master[pos - 1].hindsight_version = 'v2';
    assert.deepEqual(checkDatasetInvariants(master, baseline).errors, []);
  }
});

test('accepts the preserved dataset with no community records', () => {
  const result = checkDatasetInvariants(baseline, baseline);

  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
  assert.equal(result.preserved, 250);
  assert.equal(result.community, 0);
});

test('accepts a contiguous community block', () => {
  const master = [...baseline, community(251), community(252)];
  const result = checkDatasetInvariants(master, baseline);

  assert.deepEqual(result.errors, []);
  assert.equal(result.community, 2);
});

test('allows a governed edit to a preserved record', () => {
  const master = structuredClone(baseline);
  master[8].validity_rating_original = 2;

  assert.deepEqual(checkDatasetInvariants(master, baseline).errors, []);
});

test('rejects a community record occupying a preserved slot', () => {
  const master = structuredClone(baseline);
  master[41].source_corpus = 'community';

  const result = checkDatasetInvariants(master, baseline);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /preserved record 42 must not carry source_corpus/);
});

test('rejects a reordered preserved block', () => {
  const master = structuredClone(baseline);
  [master[3], master[4]] = [master[4], master[3]];

  const result = checkDatasetInvariants(master, baseline);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /preserved positions must run 1–250 in order/);
});

test('rejects a dropped preserved record', () => {
  const result = checkDatasetInvariants(baseline.slice(0, 249), baseline);

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /must retain all 250 preserved records/);
});

test('rejects a gap in the community block', () => {
  const result = checkDatasetInvariants([...baseline, community(251), community(253)], baseline);

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /community record at index 251 must have pos 252/);
});

test('rejects a duplicate position', () => {
  const result = checkDatasetInvariants([...baseline, community(251), community(251)], baseline);

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /duplicate pos 251/);
});

test('rejects a duplicate normalized url even across cosmetically different forms', () => {
  const master = [
    ...baseline,
    { ...community(251), url: 'https://example.test/dd/' },
    { ...community(252), url: 'HTTP://WWW.Example.TEST/dd?utm_source=x' }
  ];

  const result = checkDatasetInvariants(master, baseline);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /duplicate normalized url at pos 252 \(already used by pos 251\)/);
});

test('accepts distinct urls in the community block', () => {
  const master = [
    ...baseline,
    { ...community(251), url: 'https://example.test/dd-one' },
    { ...community(252), url: 'https://example.test/dd-two' }
  ];

  assert.deepEqual(checkDatasetInvariants(master, baseline).errors, []);
});

test('rejects a baseline that is not exactly 1-250', () => {
  const short = baseline.slice(0, 249);

  assert.match(
    checkDatasetInvariants(short, short).errors.join('\n'),
    /baseline must contain exactly 250 records/
  );
});

test('accepts the real dataset as it stands today', async () => {
  const { readFile } = await import('node:fs/promises');
  const realMaster = JSON.parse(
    await readFile(new URL('../data/master.json', import.meta.url), 'utf8')
  );
  const realBaseline = JSON.parse(
    await readFile(new URL('../data/original-master.json', import.meta.url), 'utf8')
  );

  assert.deepEqual(checkDatasetInvariants(realMaster, realBaseline).errors, []);
});

test('manually edited source and archive URLs must be HTTP(S) without credentials', () => {
  for (const value of ['https://reader:password@example.test/dd', 'https://reader@example.test/dd',
    'https://:password@example.test/dd', 'https://', 'ftp://example.test/dd', 'javascript:alert(1)']) {
    for (const field of ['source', 'archive']) {
      const record = { ...community(251), url: 'https://example.test/dd', submission: { archive_url: null } };
      if (field === 'source') record.url = value;
      else record.submission.archive_url = value;
      const result = checkDatasetInvariants([...baseline, record], baseline);
      assert.equal(result.ok, false, `${field}: ${value}`);
      assert.match(result.errors.join('\n'), /HTTP\(S\).*without credentials/);
      assert.doesNotMatch(result.errors.join('\n'), /reader|password/);
    }
  }
});

test('repository invariants reject uppercase tracking duplicates of original records', () => {
  const originals = baseline.map((record) => ({ ...record, url: `https://example.test/Book${record.pos}` }));
  const result = checkDatasetInvariants([...originals,
    { ...community(251), url: `${originals[0].url}?UTM_source=review` }], originals);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /duplicate normalized url at pos 251/);
});

test('required repository validation CLI rejects manually edited credential links and tracking duplicates', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dd-validation-'));
  await cp(new URL('../scripts/', import.meta.url), join(root, 'scripts'), { recursive: true });
  await cp(new URL('../harness/', import.meta.url), join(root, 'harness'), { recursive: true });
  await mkdir(join(root, 'data'));
  for (const file of ['schema.json', 'original-master.json']) {
    await cp(new URL(`../data/${file}`, import.meta.url), join(root, 'data', file));
  }
  const originals = JSON.parse(await readFile(new URL('../data/master.json', import.meta.url), 'utf8'));
  const accepted = {
    pos: 251, title: 'Manual edit fixture', byline: 'QA author', pages: null,
    uploaded: '2026-08-01', url: 'https://example.test/dd', type: 'original', text_available: true,
    source_corpus: 'community', review_status: 'pending', submission: {
      submitted_on: '2026-08-01', submitted_by: 'qa',
      issue: 'https://github.com/ErranttVenture/superstonk-dd-library/issues/123',
      archive_url: 'https://archive.ph/abc123', platform: 'other'
    }
  };
  const cases = [
    { field: 'source', value: 'https://reader:password@example.test/dd', expected: /HTTP\(S\).*without credentials/ },
    { field: 'archive', value: 'https://reader:password@archive.ph/abc123', expected: /HTTP\(S\).*without credentials/ },
    { field: 'source', value: 'https://', expected: /HTTP\(S\).*without credentials/ },
    { field: 'archive', value: 'https://', expected: /HTTP\(S\).*without credentials/ },
    { field: 'source', value: `${originals[0].url}?UTM_source=review`, expected: /duplicate normalized url/ }
  ];
  for (const { field, value, expected } of cases) {
    const record = structuredClone(accepted);
    if (field === 'source') record.url = value;
    else record.submission.archive_url = value;
    await writeFile(join(root, 'data/master.json'), JSON.stringify([...originals, record]));
    const result = await runNodeCli(join(root, 'scripts/validate-repository.mjs'));
    assert.equal(result.status, 1, `${field}: ${value}`);
    assert.match(result.stderr, expected);
    assert.doesNotMatch(result.stderr, /reader|password/);
  }
});
