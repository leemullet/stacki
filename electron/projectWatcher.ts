import fs from 'fs';
import path from 'path';
import { detectProjectRuntime, spawnProject } from './projectRuntime';
import { toRecord } from '../shared/record';
interface WatchProjectDeps {
  readonly projectPath: string;
  readonly send: (channel: string, payload: unknown) => void;
  readonly isSelfWrite: (absolutePath: string) => boolean;
  readonly notePageMayHaveChanged: (changed: boolean) => void;
  readonly scheduleThumb: (projectPath: string, delayMs: number) => void;
  readonly mediaPattern: RegExp;
  readonly watch?: typeof fs.watch;
  readonly runtimeOf?: typeof detectProjectRuntime;
  readonly spawnInProject?: typeof spawnProject;
}



// Windows cannot recursively fs.watch a directory through the WSL UNC
// provider (it reports EISDIR). Run the same watcher with the project's Linux
// Node instead and send newline-delimited events back to the Electron parent.
// The script is an argument, not an interpolated shell command, so project
// paths and filenames never become executable text.
const WSL_WATCH_SCRIPT = String.raw`
const fs = require('node:fs');
const path = require('node:path');
const watchers = [];
const emit = (message) => process.stdout.write(JSON.stringify(message) + '\n');
for (const kind of ['src', 'public']) {
  const dir = path.join(process.cwd(), kind);
  if (!fs.existsSync(dir)) continue;
  try {
    watchers.push(fs.watch(dir, { recursive: true }, (event, filename) => {
      if (filename) emit({ kind, event, filename: String(filename) });
    }));
  } catch (error) {
    emit({ kind: 'error', message: error && error.message || String(error) });
  }
}
const close = () => {
  for (const watcher of watchers) watcher.close();
  process.exit(0);
};
process.stdin.on('end', close);
process.on('SIGTERM', close);
process.stdin.resume();
`;

// Both directory watchers and every queued notification belong to one open
// project. Closing it cancels the whole group before another project can hear
// an event or a timer left over from the old one.
export function watchProject({
  projectPath,
  send,
  isSelfWrite,
  notePageMayHaveChanged,
  scheduleThumb,
  mediaPattern,
  watch = fs.watch,
  runtimeOf = detectProjectRuntime,
  spawnInProject = spawnProject,
}: WatchProjectDeps) {
  const watchers: {close: () => void}[] = [];
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const files = new Set<string>();
  let closed = false;
  const debounce = (channel: string, delay = 200) => {
    clearTimeout(timers.get(channel));
    timers.set(channel, setTimeout(() => {
      timers.delete(channel);
      if (closed) {return;}
      const payload = channel === 'fs:changed' ? { files: [...files] } : {};
      if (channel === 'fs:changed') {files.clear();}
      send(channel, payload);
    }, delay));
  };
  const close = () => {
    closed = true;
    for (const watcher of watchers) {watcher.close();}
    for (const timer of timers.values()) {clearTimeout(timer);}
    timers.clear();
    files.clear();
  };

  const onSourceChange = (filename: string | Buffer | null) => {
    if (closed || !filename) {return;}
    const name = filename.toString();
    const srcDir = path.join(projectPath, 'src');
    const changed = path.join(srcDir, name);
    // Comparing self writes can read the file. Do it once per event, before
    // routing it to the panels interested in that kind of file.
    if (isSelfWrite(changed)) {return;}
    notePageMayHaveChanged(true);
    if (/\.json$/i.test(name)) {return debounce('cms:changed');}
    if (mediaPattern.test(name)) {return debounce('assets:changed');}
    if (/\.css$/i.test(name)) {return debounce('css:changed');}
    if (!/\.(astro|md|mdx|html)$/i.test(name)) {return;}
    files.add(changed);
    scheduleThumb(projectPath, 60000);
    debounce('fs:changed', 150);
  };

  const onPublicChange = (filename: string | Buffer | null) => {
    if (closed || (filename && String(filename).startsWith('.'))) {return;}
    const publicDir = path.join(projectPath, 'public');
    if (filename && isSelfWrite(path.join(publicDir, filename.toString()))) {return;}
    debounce('assets:changed');
  };

  try {
    if (runtimeOf(projectPath).type === 'wsl') {
      const child = spawnInProject(projectPath, 'node', ['-e', WSL_WATCH_SCRIPT], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      let buffer = '';
      child.stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        if (buffer.length > 1024 * 1024) { buffer = ''; console.warn('WSL watcher message exceeded limit'); return; }
        for (let lines = 0; lines < 65536; lines++) {
          const at = buffer.indexOf('\n');
          if (at < 0) {break;}
          const line = buffer.slice(0, at);
          buffer = buffer.slice(at + 1);
          let raw: unknown;
          try { raw = JSON.parse(line); } catch { continue; }
          const message = toRecord(raw);
          if (!message) {continue;}
          if (message['kind'] === 'src' && typeof message['filename'] === 'string') {onSourceChange(message['filename']);}
          else if (message['kind'] === 'public' && typeof message['filename'] === 'string') {onPublicChange(message['filename']);}
          else if (message['kind'] === 'error') {console.warn('WSL project watcher:', message['message']);}
        }
      });
      child.on('error', (error) => console.warn('WSL project watcher:', error));
      child.stderr.on('data', (chunk: Buffer) => console.warn('WSL project watcher:', chunk.toString().trim()));
      watchers.push({
        close() {
          try { child.stdin.end(); } catch { /* already gone */ }
          try { child.kill(); } catch { /* already gone */ }
        },
      });
      return { close };
    }

    const srcDir = path.join(projectPath, 'src');
    watchers.push(watch(srcDir, { recursive: true }, (_event, filename) => onSourceChange(filename)));

    const publicDir = path.join(projectPath, 'public');
    if (fs.existsSync(publicDir)) {
      watchers.push(watch(publicDir, { recursive: true }, (_event, filename) => onPublicChange(filename)));
    }
  } catch (error) {
    close();
    throw error;
  }
  return { close };
}
