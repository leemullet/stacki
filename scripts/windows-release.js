const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const YAML = require('yaml');

const REPO = 'leemullet/stacki';
const fail = (message) => { throw new Error(message); };
function config(root = path.join(__dirname, '..')) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(pkg.version)) fail('Use a stable major.minor.patch release version.');
  if (lock.version !== pkg.version || lock.packages[''].version !== pkg.version) fail('Package and lockfile versions must match.');
  if (pkg.build.appId !== 'com.optigoals.stacki.wsl' || pkg.name !== 'stacki' || pkg.build.productName !== 'Stacki WSL') fail('Do not change the installed app identity.');
  const feed = pkg.build.publish;
  if (feed?.provider !== 'github' || feed.owner !== 'leemullet' || feed.repo !== 'stacki') fail('Release feed must point to the Stacki WSL fork.');
  const version = pkg.version;
  return { root, version, tag: `v${version}`, installer: `Stacki-WSL-Setup-${version}.exe` };
}

function verifyArtifacts(root = path.join(__dirname, '..'), readPackaged = (file) => require('@electron/asar').extractFile(file, 'package.json')) {
  const release = config(root);
  const dir = path.join(root, 'release');
  const manifest = YAML.parse(fs.readFileSync(path.join(dir, 'latest.yml'), 'utf8'));
  if (manifest.version !== release.version || manifest.path !== release.installer) fail('Update manifest has the wrong version or installer.');
  const file = manifest.files?.find((item) => item.url === release.installer);
  if (!file || manifest.files.length !== 1) fail('Expected exactly the full Windows installer in latest.yml.');
  const bytes = fs.readFileSync(path.join(dir, release.installer));
  const digest = crypto.createHash('sha512').update(bytes).digest('base64');
  if (file.sha512 !== digest || manifest.sha512 !== digest || file.size !== bytes.length) fail('Installer checksum or size does not match latest.yml.');
  if (bytes.subarray(0, 2).toString() !== 'MZ') fail('Installer is not a Windows executable.');
  if (!fs.statSync(path.join(dir, release.installer + '.blockmap')).size) fail('Installer blockmap is empty.');
  const resources = path.join(dir, 'win-unpacked', 'resources');
  const embedded = YAML.parse(fs.readFileSync(path.join(resources, 'app-update.yml'), 'utf8'));
  if (embedded.provider !== 'github' || embedded.owner !== 'leemullet' || embedded.repo !== 'stacki' || embedded.token || embedded.private) fail('Packaged updater has an incorrect or credentialed feed.');
  const packaged = JSON.parse(readPackaged(path.join(resources, 'app.asar')).toString());
  if (packaged.version !== release.version || packaged.name !== 'stacki') fail('Packaged application version or identity is incorrect.');
  return { ...release, dir, files: [release.installer, release.installer + '.blockmap', 'latest.yml'] };
}

const gh = (args) => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
function preflight(root = path.join(__dirname, '..'), env = process.env, run = gh) {
  const release = config(root);
  if (env.GITHUB_REPOSITORY !== REPO || env.GITHUB_REF !== 'refs/heads/main' || !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA || '')) fail('Publish only from this repository main at a known commit.');
  const releases = JSON.parse(run(['release', 'list', '--repo', REPO, '--limit', '100', '--json', 'tagName,isDraft']));
  const numbers = (tag) => tag.replace(/^v/, '').split('.').map(Number);
  const newer = (a, b) => { const x = numbers(a), y = numbers(b); for (let i = 0; i < 3; i++) { if (x[i] !== y[i]) return x[i] > y[i]; } return false; };
  for (const previous of releases.filter((item) => !item.isDraft && /^v\d+\.\d+\.\d+$/.test(item.tagName))) {
    if (!newer(release.tag, previous.tagName)) fail(`Version ${release.version} is already released or older. Bump package.json and package-lock.json before releasing.`);
  }
  const draft = releases.find((item) => item.tagName === release.tag);
  const tags = JSON.parse(run(['api', `repos/${REPO}/git/matching-refs/tags/${release.tag}`]));
  const existingTag = tags.find((item) => item.ref === `refs/tags/${release.tag}`);
  if (existingTag && (existingTag.object.type !== 'commit' || existingTag.object.sha !== env.GITHUB_SHA)) fail('Existing version tag belongs to a different commit. Use a new version.');
  if (draft) {
    const info = JSON.parse(run(['release', 'view', release.tag, '--repo', REPO, '--json', 'targetCommitish']));
    if (info.targetCommitish !== env.GITHUB_SHA) fail('Existing draft belongs to a different commit. Use a new version.');
  }
  return { ...release, draft: !!draft };
}

function publish() {
  const planned = preflight();
  const built = verifyArtifacts();
  const notes = path.join(built.dir, 'release-notes.md');
  fs.writeFileSync(notes, `Stacki WSL ${built.version}\n\nWindows x64 installer built from ${process.env.GITHUB_SHA}.\n\nIncludes the approved main-branch changes and the Stacki WSL update feed.\n\nFirst installation from 0.1.25-wsl.1: close Stacki WSL and run the installer once. Later published versions are available through File → Check for Updates.\n\nThis community fork installer is unsigned, like the previous local build.\n`);
  if (!planned.draft) gh(['release', 'create', built.tag, '--repo', REPO, '--target', process.env.GITHUB_SHA, '--draft', '--title', `Stacki WSL ${built.version}`, '--notes-file', notes]);
  gh(['release', 'upload', built.tag, '--repo', REPO, ...built.files.map((file) => path.join(built.dir, file)), '--clobber']);
  const remote = JSON.parse(gh(['release', 'view', built.tag, '--repo', REPO, '--json', 'isDraft,assets']));
  if (!remote.isDraft || !built.files.every((name) => remote.assets.some((asset) => asset.name === name && asset.size === fs.statSync(path.join(built.dir, name)).size))) fail('Draft release assets are incomplete; refusing to publish.');
  gh(['release', 'edit', built.tag, '--repo', REPO, '--draft=false', '--latest']);
  const url = `https://github.com/${REPO}/releases/tag/${built.tag}`;
  console.log(`Published ${url}`);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `Published [Stacki WSL ${built.version}](${url}) with verified installer, blockmap and latest.yml.\n`);
}

module.exports = { config, verifyArtifacts, preflight };
if (require.main === module) {
  try {
    const command = process.argv[2];
    if (command === 'preflight') console.log(`Ready to release ${preflight().tag}`);
    else if (command === 'verify') console.log(`Verified ${verifyArtifacts().installer}`);
    else if (command === 'publish') publish();
    else fail('Usage: node scripts/windows-release.js preflight|verify|publish');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
