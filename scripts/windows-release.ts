import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import YAML from 'yaml';
import { extractFile } from '@electron/asar';

const REPO = 'leemullet/stacki';
const ROOT = path.join(__dirname, '..', '..');
const fail = (message: string): never => { throw new Error(message); };
function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {return fail('Expected a release metadata object');}
  return Object.fromEntries(Object.entries(value));
}
function json(source: string): Record<string, unknown> { const value: unknown = JSON.parse(source); return record(value); }
function records(source: string): Record<string, unknown>[] {
  const value: unknown = JSON.parse(source);
  if (!Array.isArray(value) || value.length > 10000) {return fail('Invalid release metadata list');}
  return value.map(record);
}
function string(value: unknown): string { if (typeof value !== 'string') {return fail('Expected release metadata string');} return value; }
function yaml(source: string) { const value: unknown = YAML.parse(source); return record(value); }
export function config(root = ROOT) {
  const pkg = json(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const lock = json(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  const version = string(pkg['version']);
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {fail('Use a stable major.minor.patch release version.');}
  if (lock['version'] !== version || record(record(lock['packages'])[''])['version'] !== version) {fail('Package and lockfile versions must match.');}
  const build = record(pkg['build']);
  if (build['appId'] !== 'com.optigoals.stacki.wsl' || pkg['name'] !== 'stacki' || build['productName'] !== 'Stacki WSL') {fail('Do not change the installed app identity.');}
  const feed = record(build['publish']);
  if (feed['provider'] !== 'github' || feed['owner'] !== 'leemullet' || feed['repo'] !== 'stacki') {fail('Release feed must point to the Stacki WSL fork.');}
  return { root, version, tag: `v${version}`, installer: `Stacki-WSL-Setup-${version}.exe` };
}

export function verifyArtifacts(root = ROOT, readPackaged: (file: string) => Buffer = (file) => extractFile(file, 'package.json')) {
  const release = config(root);
  const dir = path.join(root, 'release');
  const manifest = yaml(fs.readFileSync(path.join(dir, 'latest.yml'), 'utf8'));
  if (manifest['version'] !== release.version || manifest['path'] !== release.installer) {fail('Update manifest has the wrong version or installer.');}
  const files = manifest['files'];
  if (!Array.isArray(files) || files.length !== 1) {return fail('Expected exactly the full Windows installer in latest.yml.');}
  const file = record(files[0]);
  if (file['url'] !== release.installer) {fail('Expected exactly the full Windows installer in latest.yml.');}
  const bytes = fs.readFileSync(path.join(dir, release.installer));
  const digest = crypto.createHash('sha512').update(bytes).digest('base64');
  if (file['sha512'] !== digest || manifest['sha512'] !== digest || file['size'] !== bytes.length) {fail('Installer checksum or size does not match latest.yml.');}
  if (bytes.subarray(0, 2).toString() !== 'MZ') {fail('Installer is not a Windows executable.');}
  if (!fs.statSync(path.join(dir, release.installer + '.blockmap')).size) {fail('Installer blockmap is empty.');}
  const resources = path.join(dir, 'win-unpacked', 'resources');
  const embedded = yaml(fs.readFileSync(path.join(resources, 'app-update.yml'), 'utf8'));
  if (embedded['provider'] !== 'github' || embedded['owner'] !== 'leemullet' || embedded['repo'] !== 'stacki' || embedded['token'] || embedded['private']) {fail('Packaged updater has an incorrect or credentialed feed.');}
  const packaged = json(readPackaged(path.join(resources, 'app.asar')).toString());
  if (packaged['version'] !== release.version || packaged['name'] !== 'stacki') {fail('Packaged application version or identity is incorrect.');}
  return { ...release, dir, files: [release.installer, release.installer + '.blockmap', 'latest.yml'] };
}

const gh = (args: readonly string[]) => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
export function preflight(root = ROOT, env: NodeJS.ProcessEnv = process.env, run = gh) {
  const release = config(root);
  if (env['GITHUB_REPOSITORY'] !== REPO || env['GITHUB_REF'] !== 'refs/heads/main' || !/^[a-f0-9]{40}$/.test(env['GITHUB_SHA'] || '')) {fail('Publish only from this repository main at a known commit.');}
  const releases = records(run(['release', 'list', '--repo', REPO, '--limit', '100', '--json', 'tagName,isDraft']));
  const numbers = (tag: string) => tag.replace(/^v/, '').split('.').map(Number);
  const newer = (a: string, b: string) => {
    const x = numbers(a), y = numbers(b);
    for (let i = 0; i < 3; i++) { const left = x[i], right = y[i]; if (left === undefined || right === undefined) {return fail('Invalid version');} if (left !== right) {return left > right;} }
    return false;
  };
  for (const previous of releases.filter((item) => !item['isDraft'] && /^v\d+\.\d+\.\d+$/.test(string(item['tagName'])))) {
    if (!newer(release.tag, string(previous['tagName']))) {fail(`Version ${release.version} is already released or older. Bump package.json and package-lock.json before releasing.`);}
  }
  const draft = releases.find((item) => item['tagName'] === release.tag);
  const tags = records(run(['api', `repos/${REPO}/git/matching-refs/tags/${release.tag}`]));
  const existingTag = tags.find((item) => item['ref'] === `refs/tags/${release.tag}`);
  if (existingTag) {
    const object = record(existingTag['object']);
    if (object['type'] !== 'commit' || object['sha'] !== env['GITHUB_SHA']) {fail('Existing version tag belongs to a different commit. Use a new version.');}
  }
  if (draft) {
    const info = json(run(['release', 'view', release.tag, '--repo', REPO, '--json', 'targetCommitish']));
    if (info['targetCommitish'] !== env['GITHUB_SHA']) {fail('Existing draft belongs to a different commit. Use a new version.');}
  }
  return { ...release, draft: !!draft };
}

function publish() {
  const planned = preflight();
  const built = verifyArtifacts();
  const notes = path.join(built.dir, 'release-notes.md');
  const sha = string(process.env['GITHUB_SHA']);
  fs.writeFileSync(notes, `Stacki WSL ${built.version}\n\nIntegrates upstream Stacki 0.1.35 while preserving WSL project support, orange branding, and the Stacki WSL update feed.\n\nWindows x64 installer built from ${sha}.\n\nIncludes upstream editor, component-property, and Windows fixes. The browser engine remains unchanged; Intuición rendering investigation continues separately.\n\nInstall this release through File → Check for Updates.\n`);
  if (!planned.draft) {gh(['release', 'create', built.tag, '--repo', REPO, '--target', sha, '--draft', '--title', `Stacki WSL ${built.version}`, '--notes-file', notes]);}
  gh(['release', 'upload', built.tag, '--repo', REPO, ...built.files.map((file) => path.join(built.dir, file)), '--clobber']);
  const remote = json(gh(['release', 'view', built.tag, '--repo', REPO, '--json', 'isDraft,assets']));
  const assets = remote['assets'];
  if (!Array.isArray(assets)) {return fail('Invalid release assets');}
  const parsedAssets = assets.map(record);
  if (!remote['isDraft'] || !built.files.every((name) => parsedAssets.some((asset) => asset['name'] === name && asset['size'] === fs.statSync(path.join(built.dir, name)).size))) {fail('Draft release assets are incomplete; refusing to publish.');}
  gh(['release', 'edit', built.tag, '--repo', REPO, '--draft=false', '--latest']);
  const url = `https://github.com/${REPO}/releases/tag/${built.tag}`;
  console.log(`Published ${url}`);
  const summary = process.env['GITHUB_STEP_SUMMARY'];
  if (summary) {fs.appendFileSync(summary, `Published [Stacki WSL ${built.version}](${url}) with verified installer, blockmap and latest.yml.\n`);}
}

if (require.main === module) {
  try {
    const command = process.argv[2];
    if (command === 'preflight') {console.log(`Ready to release ${preflight().tag}`);}
    else if (command === 'verify') {console.log(`Verified ${verifyArtifacts().installer}`);}
    else if (command === 'publish') {publish();}
    else {fail('Usage: node dist/scripts/windows-release.js preflight|verify|publish');}
  } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
