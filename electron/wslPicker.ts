import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Dialog, BrowserWindow } from 'electron';
import type { IpcResults } from '../shared/ipc-results';
import { detectProjectRuntime } from './projectRuntime';
const execute = promisify(execFile);

export function parseDistributions(output: string | Buffer) {
  const text = Buffer.isBuffer(output) ? output.toString('utf16le') : String(output);
  return [...new Set(text.replace(/\u0000|\uFEFF/g, '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean))];
}

export async function openWslProject({ dialog, parent, isAstroProject, run = execute }: {readonly dialog: Dialog; readonly parent: BrowserWindow; readonly isAstroProject: (path: string) => boolean; readonly run?: typeof execute}): Promise<IpcResults['project:openDialog']> {
  try {
    const { stdout } = await run('wsl.exe', ['--list', '--quiet'], { encoding: 'buffer', timeout: 15000, windowsHide: true });
    const distributions = parseDistributions(stdout);
    if (!distributions.length) {return { canceled: false, error: 'No WSL distributions found. Install or import a distribution, then try again.' };}
    let distro = distributions[0];
    if (!distro) {return { canceled: true };}
    if (distributions.length > 1) {
      const { response } = await dialog.showMessageBox(parent, {
        title: 'Open WSL Project', message: 'Choose a Linux distribution',
        buttons: [...distributions, 'Cancel'], cancelId: distributions.length, noLink: true,
      });
      if (response >= distributions.length || response < 0) {return { canceled: true };}
      distro = distributions[response];
      if (!distro) {return { canceled: true };}
    }
    // Starting the distribution also makes its UNC share available. No Node
    // installation is required merely to browse for a project.
    const home = await run('wsl.exe', ['--distribution', distro, '--exec', '/bin/sh', '-c', 'printf "%s" "$HOME"'], {
      encoding: 'utf8', timeout: 30000, windowsHide: true,
    });
    const linuxHome = home.stdout.toString().trim();
    const suffix = linuxHome.startsWith('/') ? linuxHome.replace(/\//g, '\\') : '\\home';
    const result = await dialog.showOpenDialog(parent, {
      title: `Open WSL Project — ${distro}`, properties: ['openDirectory'],
      defaultPath: `\\\\wsl.localhost\\${distro}${suffix}`,
    });
    if (result.canceled || !result.filePaths.length) {return { canceled: true };}
    const projectPath = result.filePaths[0];
    if (!projectPath) {return { canceled: true };}
    if (detectProjectRuntime(projectPath).type !== 'wsl') {return { canceled: false, error: 'Select a folder inside WSL. Use Open Project for Windows folders.' };}
    if (!isAstroProject(projectPath)) {return { canceled: false, error: 'That folder does not look like an Astro project (no astro dependency or astro.config found).' };}
    return { canceled: false, projectPath };
  } catch (error) {
    return { canceled: false, error: `Could not open WSL: ${error instanceof Error ? error.message : String(error)}` };
  }
}
