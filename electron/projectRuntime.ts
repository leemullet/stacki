import path from 'node:path';
import fs from 'node:fs';
import { spawn, execFile, execFileSync } from 'node:child_process';
import type { SpawnOptionsWithoutStdio, ExecFileOptions, ExecFileSyncOptions } from 'node:child_process';

export type ProjectRuntime = { readonly type: 'native'; readonly windowsPath: string } | { readonly type: 'wsl'; readonly windowsPath: string; readonly distro: string; readonly linuxPath: string };

const WSL_PREFIX_RE = /^\\\\(?:wsl\.localhost|wsl\$)\\([^\\]+)(?:\\(.*))?$/i;

export function detectProjectRuntime(projectPath: string): ProjectRuntime {
  const windowsPath = String(projectPath || '');
  const match = WSL_PREFIX_RE.exec(windowsPath);
  if (!match || !match[1]) {return { type: 'native', windowsPath };}
  const tail = (match[2] || '').split('\\').filter(Boolean).join('/');
  return {
    type: 'wsl',
    distro: match[1],
    windowsPath,
    linuxPath: `/${tail}`.replace(/\/{2,}/g, '/'),
  };
}

export function linuxPathFor(runtime: ProjectRuntime, windowsPath: string) {
  if (runtime.type !== 'wsl') {return windowsPath;}
  const value = String(windowsPath || '');
  const own = detectProjectRuntime(value);
  if (own.type === 'wsl' && own.distro.toLowerCase() === runtime.distro.toLowerCase()) {
    return own.linuxPath;
  }
  const relative = path.win32.relative(runtime.windowsPath, value);
  if (!relative.startsWith('..') && !path.win32.isAbsolute(relative)) {
    return `${runtime.linuxPath}/${relative.split('\\').join('/')}`.replace(/\/{2,}/g, '/');
  }
  return value;
}

export function commandSpec<Options extends {cwd?: string | URL | undefined; shell?: string | boolean | undefined}>(projectPath: string, command: string, args: readonly string[], options: Options) {
  const runtime = detectProjectRuntime(projectPath);
  if (runtime.type !== 'wsl') {
    return {
      runtime,
      command,
      args,
      options: { cwd: projectPath, ...options },
    };
  }

  const linuxCommand = linuxPathFor(runtime, command);
  const linuxArgs = args.map((arg) => {
    if (typeof arg !== 'string') {return arg;}
    const detected = detectProjectRuntime(arg);
    if (detected.type === 'wsl') {return linuxPathFor(runtime, arg);}
    if (arg.toLowerCase().startsWith(runtime.windowsPath.toLowerCase())) {
      return linuxPathFor(runtime, arg);
    }
    return arg;
  });
  const cleanOptions = { ...options };
  delete cleanOptions.cwd;
  delete cleanOptions.shell;
  return {
    runtime,
    command: 'wsl.exe',
    args: [
      '--distribution', runtime.distro,
      '--cd', runtime.linuxPath,
      '--exec', '/bin/bash', '-lic', 'exec "$@"', 'stacki',
      linuxCommand,
      ...linuxArgs,
    ],
    options: { windowsHide: true, ...cleanOptions },
  };
}

export function spawnProject(projectPath: string, command: string, args: readonly string[] = [], options: SpawnOptionsWithoutStdio = {}) {
  const spec = commandSpec(projectPath, command, args, options);
  return spawn(spec.command, spec.args, spec.options);
}

export function execProject(projectPath: string, command: string, args: readonly string[] = [], options: ExecFileOptions = {}): Promise<{stdout: string; stderr: string}> {
  const spec = commandSpec(projectPath, command, args, options);
  return new Promise((resolve, reject) => {
    execFile(spec.command, spec.args, spec.options, (error, stdout, stderr) => {
      if (error) {
        Object.assign(error, { stdout, stderr });
        reject(error);
      } else {
        resolve({ stdout: stdout.toString(), stderr: stderr.toString() });
      }
    });
  });
}

export function execProjectSync(projectPath: string, command: string, args: readonly string[] = [], options: ExecFileSyncOptions = {}) {
  const spec = commandSpec(projectPath, command, args, options);
  return execFileSync(spec.command, spec.args, spec.options);
}

export function projectBin(projectPath: string, name: string) {
  const runtime = detectProjectRuntime(projectPath);
  const file = runtime.type === 'wsl' ? name : process.platform === 'win32' ? `${name}.cmd` : name;
  return runtime.type === 'wsl'
    ? path.win32.join(projectPath, 'node_modules', '.bin', file)
    : path.join(projectPath, 'node_modules', '.bin', file);
}

export async function projectBinExists(projectPath: string, name: string, { execute = execProject, exists = fs.existsSync }: {execute?: typeof execProject; exists?: typeof fs.existsSync} = {}) {
  const bin = projectBin(projectPath, name);
  if (detectProjectRuntime(projectPath).type !== 'wsl') {return exists(bin);}
  try {
    // Resolve Linux symlinks in Linux, never through Windows' UNC provider.
    await execute(projectPath, '/usr/bin/test', ['-x', bin], { timeout: 10000 });
    return true;
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 1) {return false;}
    throw error; // A broken WSL connection is not a missing dependency.
  }
}

export function windowsHostPathToWsl(filePath: string) {
  const value = String(filePath || '');
  const match = /^([A-Za-z]):[\\/](.*)$/.exec(value);
  if (!match || !match[1] || match[2] === undefined) {return value;}
  return `/mnt/${match[1].toLowerCase()}/${match[2].replace(/\\/g, '/')}`;
}
