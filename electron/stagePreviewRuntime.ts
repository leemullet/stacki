import fs from 'node:fs';
import path from 'node:path';

// Astro runs in Linux and cannot load modules from the Windows application.
// Copy the compiled relative dependency graph, keeping its CommonJS boundary.
export function stagePreviewRuntime(sourceRoot: string, targetDir: string) {
  const source = sourceRoot.replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
  const target = path.join(targetDir, 'runtime');
  const pending = ['electron/astroParser.js', 'electron/componentPreview.js'];
  const copied = new Set<string>();
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'package.json'), '{"type":"commonjs"}\n');
  for (let count = 0; pending.length > 0 && count < 128; count++) {
    const relative = pending.pop();
    if (!relative || copied.has(relative)) {continue;}
    if (relative.startsWith('..') || path.isAbsolute(relative)) {throw new Error('Preview runtime dependency escaped its build directory');}
    const contents = fs.readFileSync(path.join(source, relative), 'utf8');
    const destination = path.join(target, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, contents);
    copied.add(relative);
    for (const match of contents.matchAll(/require\(["'](\.[^"']+)["']\)/g)) {
      if (!match[1]) {continue;}
      const dependency = path.normalize(path.join(path.dirname(relative), match[1]));
      pending.push(path.extname(dependency) === '.js' ? dependency : `${dependency}.js`);
    }
  }
  if (pending.length > 0) {throw new Error('Preview runtime dependency limit exceeded');}
  return { parserPath: './runtime/electron/astroParser.js', previewHelperPath: './runtime/electron/componentPreview.js' };
}
