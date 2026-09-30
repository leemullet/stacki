const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const YAML = require('yaml');
const { config, verifyArtifacts, preflight } = require('../scripts/windows-release');
const pkg = require('../package.json');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stacki-release-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const put = (file, data) => { const p = path.join(root, file); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data); };
  put('package.json', JSON.stringify(pkg));
  put('package-lock.json', JSON.stringify({ version: pkg.version, packages: { '': { version: pkg.version } } }));
  const exe = `Stacki-WSL-Setup-${pkg.version}.exe`;
  const bytes = Buffer.from('MZ fixture installer');
  const sha512 = crypto.createHash('sha512').update(bytes).digest('base64');
  put('release/' + exe, bytes);
  put('release/' + exe + '.blockmap', 'blockmap');
  put('release/latest.yml', YAML.stringify({ version: pkg.version, path: exe, sha512, files: [{ url: exe, size: bytes.length, sha512 }] }));
  put('release/win-unpacked/resources/app-update.yml', YAML.stringify(pkg.build.publish));
  return { root, put, exe, readPackaged: () => Buffer.from(JSON.stringify({ name: 'stacki', version: pkg.version })) };
}

test('a complete installer and packaged public feed pass verification', (t) => {
  const f = fixture(t);
  assert.equal(verifyArtifacts(f.root, f.readPackaged).files.length, 3);
});
test('changed installer bytes cannot be published with old metadata', (t) => {
  const f = fixture(t); f.put('release/' + f.exe, 'MZ corrupted');
  assert.throws(() => verifyArtifacts(f.root, f.readPackaged), /checksum/);
});
test('missing blockmap, wrong packaged version and upstream feed are rejected', (t) => {
  const f = fixture(t);
  assert.throws(() => verifyArtifacts(f.root, () => Buffer.from('{"name":"stacki","version":"0.0.1"}')), /Packaged application/);
  f.put('release/win-unpacked/resources/app-update.yml', 'provider: github\nowner: flowtricks\nrepo: stacki-releases\n');
  assert.throws(() => verifyArtifacts(f.root, f.readPackaged), /feed/);
  f.put('release/win-unpacked/resources/app-update.yml', YAML.stringify(pkg.build.publish));
  fs.unlinkSync(path.join(f.root, 'release', f.exe + '.blockmap'));
  assert.throws(() => verifyArtifacts(f.root, f.readPackaged), /ENOENT/);
});
test('lockfile drift and prerelease channels are rejected', (t) => {
  const f = fixture(t); f.put('package-lock.json', '{"version":"0.0.1"}');
  assert.throws(() => config(f.root), /versions must match/);
  f.put('package.json', JSON.stringify({ ...pkg, version: '0.1.26-wsl.2' }));
  assert.throws(() => config(f.root), /stable/);
});
test('release preflight enforces main, monotonic versions and immutable tag ownership', (t) => {
  const f = fixture(t);
  const env = { GITHUB_REPOSITORY: 'leemullet/stacki', GITHUB_REF: 'refs/heads/main', GITHUB_SHA: 'a'.repeat(40) };
  const run = (releases, tags = [], target = env.GITHUB_SHA) => (args) => JSON.stringify(args[0] === 'api' ? tags : args[1] === 'view' ? { targetCommitish: target } : releases);
  assert.equal(preflight(f.root, env, run([])).tag, `v${pkg.version}`);
  assert.throws(() => preflight(f.root, { ...env, GITHUB_REF: 'refs/heads/feature' }, run([])), /only from/);
  assert.throws(() => preflight(f.root, env, run([{ tagName: `v${pkg.version}`, isDraft: false }])), /already released/);
  assert.throws(() => preflight(f.root, env, run([{ tagName: 'v99.0.0', isDraft: false }])), /older/);
  assert.throws(() => preflight(f.root, env, run([], [{ ref: `refs/tags/v${pkg.version}`, object: { type: 'commit', sha: 'b'.repeat(40) } }])), /different commit/);
  assert.equal(preflight(f.root, env, run([{ tagName: `v${pkg.version}`, isDraft: true }])).draft, true);
  assert.throws(() => preflight(f.root, env, run([{ tagName: `v${pkg.version}`, isDraft: true }], [], 'b'.repeat(40))), /different commit/);
});
test('workflow builds and verifies on Windows before publishing to this fork', () => {
  const workflow = YAML.parse(fs.readFileSync(path.join(__dirname, '../.github/workflows/release.yml'), 'utf8'));
  assert.deepEqual(workflow.on.push.branches, ['main']);
  assert.equal(workflow.jobs.windows['runs-on'], 'windows-latest');
  const steps = workflow.jobs.windows.steps.map((s) => s.run || s.uses);
  assert.ok(steps.indexOf('node scripts/windows-release.js verify') < steps.indexOf('node scripts/windows-release.js publish'));
  assert.ok(steps.some((s) => s.includes('--publish never')));
});
