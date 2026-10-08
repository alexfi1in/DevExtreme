// Shared by checklist.mjs and registry.mjs: read and publish a tracked file of the skill so that people
// working in parallel always see one state.
//
// Push target: UI_KIT_CHECKLIST_REMOTE / UI_KIT_CHECKLIST_BRANCH, or the upstream of the current branch.
// The commit is built with git plumbing on top of the fetched remote branch: the working copy, the
// index and the current branch are never touched. A rejected push (someone pushed first) is retried on
// the fresh remote state - every change is re-applied to the fresh text, so concurrent changes to
// different rows never conflict. With `local: true` only the local file is read and written, no git.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const UPSTREAM_DEVEXPRESS = /github\.com[/:]DevExpress\/DevExtreme(\.git)?\/?$/i;

export const repoRoot = (() => {
  try { return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: here, encoding: 'utf8' }).trim(); } catch { return null; }
})();

export function git(gitArgs, options = {}) {
  return execFileSync('git', gitArgs, { cwd: repoRoot, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...options });
}

export function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function me() {
  try { return git(['config', 'user.name']).trim(); } catch { return os.userInfo().username; }
}

const relPathOf = (file) => path.relative(repoRoot, file).split(path.sep).join('/');

function target() {
  let remote = process.env.UI_KIT_CHECKLIST_REMOTE;
  let branch = process.env.UI_KIT_CHECKLIST_BRANCH;
  if (!remote || !branch) {
    let upstream;
    try { upstream = git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']).trim(); } catch {
      throw new Error('the current branch has no upstream: set UI_KIT_CHECKLIST_REMOTE and UI_KIT_CHECKLIST_BRANCH, or use --local');
    }
    const slash = upstream.indexOf('/');
    remote = remote || upstream.slice(0, slash);
    branch = branch || upstream.slice(slash + 1);
  }
  const url = git(['remote', 'get-url', remote]).trim();
  if (UPSTREAM_DEVEXPRESS.test(url)) {
    throw new Error(`${remote} is ${url} - the upstream DevExpress repository. The skill's files live in your fork: run from the fork, or set UI_KIT_CHECKLIST_REMOTE. Nothing was pushed.`);
  }
  return { remote, branch, url };
}

// Each run fetches into a ref of its own: two sessions in one clone must not fight over the lock of
// refs/remotes/<remote>/<branch> or over FETCH_HEAD.
function fetchRemote({ remote, branch }) {
  const ref = `refs/ui-kit-checklist/${process.pid}`;
  for (let attempt = 1; ; attempt += 1) {
    const r = spawnSync('git', ['fetch', '--quiet', '--no-write-fetch-head', remote, `+refs/heads/${branch}:${ref}`], { cwd: repoRoot, encoding: 'utf8' });
    if (r.status === 0) break;
    if (attempt === 5) throw new Error(`git fetch ${remote} ${branch} failed: ${r.stderr.trim()}`);
    sleep(200 * attempt);
  }
  const sha = git(['rev-parse', ref]).trim();
  spawnSync('git', ['update-ref', '-d', ref], { cwd: repoRoot });
  return sha;
}

function showAt(rev, rel) {
  const r = spawnSync('git', ['show', `${rev}:${rel}`], { cwd: repoRoot, encoding: 'utf8' });
  return r.status === 0 ? r.stdout : null;
}

const readLocal = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null);

// The current text of `file`: the remote version, or the local one with `local` (or outside git).
export function readCurrent(file, { local } = {}) {
  if (local || !repoRoot) return readLocal(file);
  const t = target();
  const remoteText = showAt(fetchRemote(t), relPathOf(file));
  if (remoteText === null) {
    console.error(`(${path.basename(file)} is not in ${t.remote}/${t.branch} yet - using the local file)`);
    return readLocal(file);
  }
  return remoteText;
}

// Applies `mutate(text | null) -> text` to the current version of `file` and publishes the result.
export function publish(file, mutate, message, { local } = {}) {
  if (local || !repoRoot) {
    const before = readLocal(file);
    const after = mutate(before);
    if (after !== before) fs.writeFileSync(file, after);
    console.log(after === before ? 'nothing to change' : `written locally: ${file}`);
    return;
  }
  const t = target();
  const rel = relPathOf(file);
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const base = fetchRemote(t);
    const current = showAt(base, rel);
    const next = mutate(current !== null ? current : readLocal(file));
    if (next === current) { console.log('nothing to change'); return; }
    const blob = git(['hash-object', '-w', '--stdin'], { input: next }).trim();
    const index = path.join(os.tmpdir(), `ui-kit-publish-index-${process.pid}-${attempt}`);
    const env = { ...process.env, GIT_INDEX_FILE: index };
    try {
      git(['read-tree', base], { env });
      git(['update-index', '--add', '--cacheinfo', `100644,${blob},${rel}`], { env });
      const tree = git(['write-tree'], { env }).trim();
      const commit = git(['commit-tree', tree, '-p', base, '-m', message]).trim();
      const push = spawnSync('git', ['push', '--quiet', t.remote, `${commit}:refs/heads/${t.branch}`], { cwd: repoRoot, encoding: 'utf8' });
      if (push.status === 0) {
        console.log(`pushed ${commit.slice(0, 10)} to ${t.remote}/${t.branch}: ${message}`);
        return;
      }
      if (!/non-fast-forward|fetch first|rejected|stale info/i.test(push.stderr)) throw new Error(push.stderr.trim());
      console.error(`push rejected (attempt ${attempt}), retrying on the fresh remote state`);
      sleep(100 * attempt + Math.floor(Math.random() * 200));
    } finally {
      fs.rmSync(index, { force: true });
    }
  }
  throw new Error('could not push after 8 attempts');
}
