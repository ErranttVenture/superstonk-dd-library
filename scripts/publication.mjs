import { readFile, appendFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

export function publicationEligible(event, paths) {
  return event.name === 'push' && event.repository === 'ErranttVenture/superstonk-dd-library' &&
    event.ref === 'refs/heads/main' && paths.some((path) => path === 'data/master.json' || path.startsWith('submissions/'));
}

export async function triggerPublication(endpoint, { fetchImpl = fetch } = {}) {
  // Validate the original string too: URL normalization must not accept credentials,
  // dot segments, alternate ports, escapes, trailing whitespace or another endpoint.
  if (typeof endpoint !== 'string' || !/^https:\/\/api\.cloudflare\.com\/client\/v4\/workers\/builds\/deploy_hooks\/[A-Za-z0-9_-]+$/.test(endpoint)) {
    throw new Error('Configure JUSTTHEBROS_DEPLOY_HOOK_URL with the exact Cloudflare Workers HTTPS deploy hook endpoint.');
  }
  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok || (await response.json())?.success !== true) throw new Error('Build rejected');
  } catch {
    // Never retain a cause or print response bodies: both can include the secret URL.
    throw new Error('Cloudflare build request failed. Check the hook configuration or retry this publication job; response details are redacted.');
  }
  return 'Cloudflare accepted the build request. Verify the build and website provenance before calling it deployed.';
}

async function main() {
  if (process.argv[2] === 'changes') {
    const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
    const before = event.before;
    const sha = process.env.GITHUB_SHA;
    if (![before, sha].every((value) => /^[0-9a-f]{40}$/.test(value))) throw new Error('Push event must contain valid before and head commits.');
    const args = /^0{40}$/.test(before)
      ? ['ls-tree', '-r', '--name-only', '-z', sha]
      : ['diff', '--name-only', '-z', `${before}..${sha}`, '--'];
    const { stdout } = await promisify(execFile)('git', args, { maxBuffer: 10 * 1024 * 1024 });
    const publish = publicationEligible({ name: process.env.GITHUB_EVENT_NAME,
      repository: process.env.GITHUB_REPOSITORY, ref: process.env.GITHUB_REF }, stdout.split('\0'));
    await appendFile(process.env.GITHUB_OUTPUT, `publish=${publish}\n`);
    console.log(publish ? 'Canonical data changed; publication is eligible.' : 'No eligible data change; publication skipped.');
  } else if (process.argv[2] === 'hook') {
    const message = await triggerPublication(process.env.JUSTTHEBROS_DEPLOY_HOOK_URL);
    console.log(message);
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${message}\n`);
  } else throw new Error('Usage: node scripts/publication.mjs <changes|hook>');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    // Unexpected runtime errors must also not expose the secret or HTTP internals.
    console.error('Publication failed. Check configuration and retry; sensitive details are redacted.');
    process.exitCode = 1;
  });
}
