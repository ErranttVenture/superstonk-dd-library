import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

test('publication admits only canonical main pushes affecting master or preserved submissions', async () => {
  const { publicationEligible } = await import('../scripts/publication.mjs');
  const event = { name: 'push', repository: 'ErranttVenture/superstonk-dd-library', ref: 'refs/heads/main' };
  assert.equal(publicationEligible(event, ['data/master.json']), true);
  assert.equal(publicationEligible(event, ['submissions/12/dd.md']), true);
  assert.equal(publicationEligible(event, ['README.md', 'scripts/submission.mjs']), false);
  for (const patch of [{ name: 'pull_request' }, { repository: 'fork/library' }, { ref: 'refs/heads/topic' }]) {
    assert.equal(publicationEligible({ ...event, ...patch }, ['data/master.json']), false);
  }
});

test('change CLI checks the entire push range and initial pushes using local git only', async () => {
  const run = promisify(execFile);
  const root = await mkdtemp(join(tmpdir(), 'publication-git-'));
  const git = (...args) => run('git', args, { cwd: root });
  await git('init');
  await git('config', 'user.name', 'Test');
  await git('config', 'user.email', 'test@example.test');
  await git('config', 'commit.gpgsign', 'false');
  await writeFile(join(root, 'README.md'), 'initial');
  await git('add', '.');
  await git('commit', '-m', 'initial');
  const before = (await git('rev-parse', 'HEAD')).stdout.trim();
  await mkdir(join(root, 'data'));
  await writeFile(join(root, 'data/master.json'), '[]');
  await git('add', '.');
  await git('commit', '-m', 'data');
  const dataCommit = (await git('rev-parse', 'HEAD')).stdout.trim();
  await writeFile(join(root, 'README.md'), 'unrelated');
  await git('add', '.');
  await git('commit', '-m', 'unrelated');
  const sha = (await git('rev-parse', 'HEAD')).stdout.trim();
  for (const [base, expected] of [[before, true], [dataCommit, false], ['0'.repeat(40), true]]) {
    const eventPath = join(root, 'event.json');
    const output = join(root, 'output.txt');
    await writeFile(eventPath, JSON.stringify({ before: base }));
    await writeFile(output, '');
    await run(process.execPath, [fileURLToPath(new URL('../scripts/publication.mjs', import.meta.url)), 'changes'], {
      cwd: root, env: { ...process.env, GITHUB_EVENT_PATH: eventPath, GITHUB_SHA: sha, GITHUB_OUTPUT: output,
        GITHUB_EVENT_NAME: 'push', GITHUB_REPOSITORY: 'ErranttVenture/superstonk-dd-library', GITHUB_REF: 'refs/heads/main' }
    });
    assert.equal(await readFile(output, 'utf8'), `publish=${expected}\n`);
  }
});

test('hook accepts only the exact HTTPS Cloudflare endpoint and does not fetch malformed or absent secrets', async () => {
  const { triggerPublication } = await import('../scripts/publication.mjs');
  const endpoint = 'https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/abc-123';
  for (const value of ['', endpoint.replace('https:', 'http:'), endpoint + '?secret=1', endpoint + '#x',
    endpoint.replace('api.cloudflare.com', 'api.cloudflare.com.evil.test'), endpoint.replace('https://', 'https://user:pass@'),
    endpoint.replace('deploy_hooks/', 'deploy_hooks/%2e%2e/'), endpoint + '/', endpoint.replace('/abc-123', '/')]) {
    let called = false;
    await assert.rejects(triggerPublication(value, { fetchImpl: async () => { called = true; } }));
    assert.equal(called, false);
  }
  const result = await triggerPublication(endpoint, { fetchImpl: async (url, options) => {
    assert.equal(url, endpoint);
    assert.equal(options.method, 'POST');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    return { ok: true, json: async () => ({ success: true }) };
  } });
  assert.equal(result, 'Cloudflare accepted the build request. Verify the build and website provenance before calling it deployed.');
});

test('hook failures redact URLs, response bodies and thrown errors', async () => {
  const { triggerPublication } = await import('../scripts/publication.mjs');
  const endpoint = 'https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/secret-id';
  for (const fetchImpl of [
    async () => ({ ok: false, status: 500, json: async () => ({ errors: ['secret-id'] }) }),
    async () => ({ ok: true, json: async () => ({ success: false, errors: ['secret-id'] }) }),
    async () => ({ ok: true, json: async () => { throw new Error(endpoint); } }),
    async () => { throw new Error(endpoint); },
    async () => ({ ok: true, json: async () => ({}) })
  ]) {
    await assert.rejects(triggerPublication(endpoint, { fetchImpl }), (error) => {
      assert.doesNotMatch(error.stack, /secret-id|api\.cloudflare\.com/);
      assert.match(error.message, /Cloudflare build request failed/);
      return true;
    });
  }
});
