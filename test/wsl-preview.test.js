const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const runtime = require('../electron/projectRuntime');
const main = fs.readFileSync(path.join(__dirname, '../electron/main.js'), 'utf8');
const root = String.raw`\\wsl.localhost\Ubuntu\home\lee\my site`;

function generate({ failCopy = false } = {}) {
  const writes = new Map();
  const logs = [];
  const context = {
    path: path.win32, __dirname: String.raw`C:\dev\stacki\electron`,
    ...runtime, toPosix: (p) => p.replace(/\\/g, '/'),
    PREVIEW_PAGE: '', PATHS_ENDPOINT: '', DATA_ENDPOINT: '',
    MORPH_CLIENT: '', MORPH_TAG_HTML: '', parsesAsModule: () => true,
    pushDevLog: (line) => logs.push(line),
    fs: {
      mkdirSync() {}, rmSync() {}, existsSync: () => false,
      copyFileSync() { if (failCopy) throw new Error('copy denied'); },
      readFileSync: (p) => fs.readFileSync(path.join(__dirname, '../electron', path.win32.basename(p)), 'utf8'),
      writeFileSync: (p, text) => writes.set(p, text),
    },
  };
  vm.createContext(context);
  vm.runInContext(main.slice(main.indexOf('function writeMarkerConfig('), main.indexOf('\nasync function spawnDevServer')), context);
  const file = context.writeMarkerConfig(root);
  return { config: writes.get(file), writes, logs, file };
}

test('generated WSL routes use Linux paths and staged CommonJS helpers', () => {
  const { config, writes } = generate();
  const entries = [...config.matchAll(/entrypoint: ("[^"]+")/g)].map((m) => JSON.parse(m[1]));
  assert.deepEqual(entries, ['preview.astro', 'paths.js', 'data.js'].map((f) => `/home/lee/my site/node_modules/.avb/${f}`));
  assert.ok(config.includes('require("./astroParser.cjs")'));
  const parser = writes.get(path.win32.join(root, 'node_modules/.avb/astroParser.cjs'));
  assert.ok(parser.includes("require('./htmlText.cjs')"));
  assert.ok(parser.includes("require('./frontmatter.cjs')"));
});

test('generated marker plugin marks Linux page and component source', () => {
  const { config } = generate();
  const prefix = config.slice(0, config.indexOf('// Markdown can'))
    .replace(/^import .*;$/gm, '');
  const context = {
    createRequire: () => () => require('../electron/astroParser'),
    readFileSync: () => '<h1>Hello</h1>', writeFileSync() {},
  };
  // The test executes the generated plugin, not a duplicate implementation.
  vm.createContext(context);
  vm.runInContext(prefix.replace('createRequire(import.meta.url)', 'createRequire("fixture")') + '\nthis.plugin = avbMarkers;', context);
  assert.match(context.plugin.load('/home/lee/my site/src/pages/index.astro'), /<!--avb-s:/);
  assert.match(context.plugin.load('/home/lee/my site/src/components/Hero.astro'), /src\/components\/Hero.astro\|/);
  assert.equal(context.plugin.load('/outside/src/pages/index.astro'), null);
});

test('config staging errors are retained in dev log', () => {
  const { file, logs } = generate({ failCopy: true });
  assert.equal(file, null);
  assert.match(logs.join(''), /copy denied/);
});

test('WSL syntax failures are rejected while unavailable checks are reported', () => {
  const logs = [];
  let failure = Object.assign(new Error('invalid syntax'), { status: 1, stderr: 'SyntaxError' });
  const context = {
    detectProjectRuntime: () => ({ type: 'wsl' }),
    execProjectSync: () => { throw failure; },
    pushDevLog: (line) => logs.push(line),
  };
  vm.createContext(context);
  vm.runInContext(main.slice(main.indexOf('function parsesAsModule('), main.indexOf('\nfunction writeMarkerConfig(')), context);
  assert.equal(context.parsesAsModule(root, 'config.mjs'), false);
  assert.match(logs.join(''), /SyntaxError/);
  failure = new Error('WSL unavailable');
  assert.equal(context.parsesAsModule(root, 'config.mjs'), true);
  assert.match(logs.join(''), /could not run: WSL unavailable/);
});
