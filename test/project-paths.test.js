const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { transformSync } = require('esbuild');
const mod = new Module(__filename);
mod._compile(transformSync(fs.readFileSync(path.join(__dirname, '../src/projectPaths.js'), 'utf8'), { format: 'cjs' }).code, __filename);
const { projectRelativePath } = mod.exports;

test('renderer paths match marker namespaces across separators and trailing slashes', () => {
  for (const root of ['/site', '/site/', 'C:\\site', 'C:/site/', String.raw`\\wsl.localhost\Ubuntu\home\lee\café site`]) {
    for (const sep of ['/', '\\']) {
      const file = root.replace(/[/\\]+$/, '') + sep + ['src', 'components', 'Heading.astro'].join(sep);
      assert.equal(projectRelativePath(root, file), 'src/components/Heading.astro');
    }
  }
});

test('root stripping respects directory boundaries and preserves source case', () => {
  assert.equal(projectRelativePath('/site', '/site-copy/src/Heading.astro'), '/site-copy/src/Heading.astro');
  assert.equal(projectRelativePath('/site', '/site/src/Heading.astro'), 'src/Heading.astro');
  assert.equal(projectRelativePath('/site', '/SITE/src/Heading.astro'), '/SITE/src/Heading.astro');
  assert.equal(projectRelativePath('/', '/src/Heading.astro'), 'src/Heading.astro');
  assert.equal(projectRelativePath(null, '/site/file'), null);
  assert.equal(projectRelativePath('/site', null), null);
});
