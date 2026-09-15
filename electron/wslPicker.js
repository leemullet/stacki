const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { detectProjectRuntime } = require('./projectRuntime');
const execute = promisify(execFile);

function parseDistributions(output) {
  const text = Buffer.isBuffer(output) ? output.toString('utf16le') : String(output);
  return [...new Set(text.replace(/\u0000|\uFEFF/g, '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean))];
}

async function openWslProject({ dialog, parent, isAstroProject, run = execute }) {
  try {
    const { stdout } = await run('wsl.exe', ['--list', '--quiet'], { encoding: 'buffer', timeout: 15000, windowsHide: true });
    const distributions = parseDistributions(stdout);
    if (!distributions.length) return { error: 'No WSL distributions found. Install or import a distribution, then try again.' };
    let distro = distributions[0];
    if (distributions.length > 1) {
      const { response } = await dialog.showMessageBox(parent, {
        title: 'Open WSL Project', message: 'Choose a Linux distribution',
        buttons: [...distributions, 'Cancel'], cancelId: distributions.length, noLink: true,
      });
      if (response >= distributions.length || response < 0) return { canceled: true };
      distro = distributions[response];
    }
    // Starting the distribution also makes its UNC share available. No Node
    // installation is required merely to browse for a project.
    const home = await run('wsl.exe', ['--distribution', distro, '--exec', '/bin/sh', '-c', 'printf "%s" "$HOME"'], {
      encoding: 'utf8', timeout: 30000, windowsHide: true,
    });
    const linuxHome = home.stdout.trim();
    const suffix = linuxHome.startsWith('/') ? linuxHome.replace(/\//g, '\\') : '\\home';
    const result = await dialog.showOpenDialog(parent, {
      title: `Open WSL Project — ${distro}`, properties: ['openDirectory'],
      defaultPath: `\\\\wsl.localhost\\${distro}${suffix}`,
    });
    if (result.canceled || !result.filePaths.length) return { canceled: true };
    const projectPath = result.filePaths[0];
    if (detectProjectRuntime(projectPath).type !== 'wsl') return { error: 'Select a folder inside WSL. Use Open Project for Windows folders.' };
    if (!isAstroProject(projectPath)) return { error: 'That folder does not look like an Astro project (no astro dependency or astro.config found).' };
    return { canceled: false, projectPath };
  } catch (error) {
    return { error: `Could not open WSL: ${error.message}` };
  }
}

module.exports = { openWslProject, parseDistributions };
