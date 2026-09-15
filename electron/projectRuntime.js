const path = require('node:path');
const fs = require('node:fs');
const { spawn, execFile, execFileSync } = require('node:child_process');

const WSL_PREFIX_RE = /^\\\\(?:wsl\.localhost|wsl\$)\\([^\\]+)(?:\\(.*))?$/i;

function detectProjectRuntime(projectPath) {
  const windowsPath = String(projectPath || '');
  const match = WSL_PREFIX_RE.exec(windowsPath);
  if (!match) return { type: 'native', windowsPath };
  const tail = (match[2] || '').split('\\').filter(Boolean).join('/');
  return {
    type: 'wsl',
    distro: match[1],
    windowsPath,
    linuxPath: `/${tail}`.replace(/\/{2,}/g, '/'),
  };
}

function linuxPathFor(runtime, windowsPath) {
  if (runtime.type !== 'wsl') return windowsPath;
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

function commandSpec(projectPath, command, args = [], options = {}) {
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
    if (typeof arg !== 'string') return arg;
    const detected = detectProjectRuntime(arg);
    if (detected.type === 'wsl') return linuxPathFor(runtime, arg);
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

function spawnProject(projectPath, command, args = [], options = {}) {
  const spec = commandSpec(projectPath, command, args, options);
  return spawn(spec.command, spec.args, spec.options);
}

function execProject(projectPath, command, args = [], options = {}) {
  const spec = commandSpec(projectPath, command, args, options);
  return new Promise((resolve, reject) => {
    execFile(spec.command, spec.args, spec.options, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      } else {
        resolve({ stdout: stdout.toString(), stderr: stderr.toString() });
      }
    });
  });
}

function execProjectSync(projectPath, command, args = [], options = {}) {
  const spec = commandSpec(projectPath, command, args, options);
  return execFileSync(spec.command, spec.args, spec.options);
}

function projectBin(projectPath, name) {
  const runtime = detectProjectRuntime(projectPath);
  const file = runtime.type === 'wsl' ? name : process.platform === 'win32' ? `${name}.cmd` : name;
  return runtime.type === 'wsl'
    ? path.win32.join(projectPath, 'node_modules', '.bin', file)
    : path.join(projectPath, 'node_modules', '.bin', file);
}

async function projectBinExists(projectPath, name, { execute = execProject, exists = fs.existsSync } = {}) {
  const bin = projectBin(projectPath, name);
  if (detectProjectRuntime(projectPath).type !== 'wsl') return exists(bin);
  try {
    // Resolve Linux symlinks in Linux, never through Windows' UNC provider.
    await execute(projectPath, '/usr/bin/test', ['-x', bin], { timeout: 10000 });
    return true;
  } catch (error) {
    if (error.code === 1) return false;
    throw error; // A broken WSL connection is not a missing dependency.
  }
}

function windowsHostPathToWsl(filePath) {
  const value = String(filePath || '');
  const match = /^([A-Za-z]):[\\/](.*)$/.exec(value);
  if (!match) return value;
  return `/mnt/${match[1].toLowerCase()}/${match[2].replace(/\\/g, '/')}`;
}

module.exports = {
  commandSpec,
  detectProjectRuntime,
  execProject,
  execProjectSync,
  linuxPathFor,
  projectBin,
  projectBinExists,
  spawnProject,
  windowsHostPathToWsl,
};
