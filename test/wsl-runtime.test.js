const test = require('node:test');
const assert = require('node:assert/strict');
const {
  commandSpec,
  detectProjectRuntime,
  linuxPathFor,
  projectBin,
  windowsHostPathToWsl,
} = require('../electron/projectRuntime');

test('detects both Windows WSL UNC spellings', () => {
  for (const root of ['wsl.localhost', 'wsl$']) {
    const runtime = detectProjectRuntime(`\\\\${root}\\Ubuntu\\home\\lee\\site`);
    assert.deepEqual(runtime, {
      type: 'wsl',
      distro: 'Ubuntu',
      windowsPath: `\\\\${root}\\Ubuntu\\home\\lee\\site`,
      linuxPath: '/home/lee/site',
    });
  }
});

test('ordinary Windows paths remain native', () => {
  assert.deepEqual(detectProjectRuntime('C:\\Projects\\site'), {
    type: 'native',
    windowsPath: 'C:\\Projects\\site',
  });
});

test('converts project descendants into Linux paths', () => {
  const root = '\\\\wsl.localhost\\Ubuntu\\home\\lee\\my site';
  const runtime = detectProjectRuntime(root);
  assert.equal(linuxPathFor(runtime, `${root}\\node_modules\\.bin\\astro`), '/home/lee/my site/node_modules/.bin/astro');
});

test('builds a quoted-argument-safe WSL command', () => {
  const root = '\\\\wsl.localhost\\Ubuntu\\home\\lee\\my site';
  const spec = commandSpec(root, 'npm', ['install', '--no-audit']);
  assert.equal(spec.command, 'wsl.exe');
  assert.deepEqual(spec.args, [
    '--distribution', 'Ubuntu', '--cd', '/home/lee/my site',
    '--exec', '/bin/bash', '-lic', 'exec "$@"', 'stacki',
    'npm', 'install', '--no-audit',
  ]);
  assert.equal(spec.options.cwd, undefined);
  assert.equal(spec.options.shell, undefined);
});

test('converts WSL path arguments without touching ordinary arguments', () => {
  const root = '\\\\wsl.localhost\\Ubuntu\\home\\lee\\my site';
  const spec = commandSpec(root, 'node', ['--check', `${root}\\node_modules\\.avb\\astro.config.mjs`]);
  assert.deepEqual(spec.args.slice(-2), [
    '--check', '/home/lee/my site/node_modules/.avb/astro.config.mjs',
  ]);
});

test('uses the Linux Astro shim for WSL projects', () => {
  const root = '\\\\wsl.localhost\\Ubuntu\\home\\lee\\site';
  assert.match(projectBin(root, 'astro'), /[\\/]astro$/);
  assert.doesNotMatch(projectBin(root, 'astro'), /\.cmd$/);
});

test('converts Windows host files for WSL terminal paste', () => {
  assert.equal(
    windowsHostPathToWsl('C:\\Users\\lee\\AppData\\Local\\Temp\\image.png'),
    '/mnt/c/Users/lee/AppData/Local/Temp/image.png'
  );
});
