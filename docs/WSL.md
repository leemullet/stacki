# WSL project support

Stacki WSL is a Windows Electron build that can open Astro projects stored in a
WSL 2 distribution. Windows still renders the desktop UI, while project tools
run inside the distribution that owns the files.

For example, a folder selected as:

```text
\\wsl.localhost\Ubuntu\home\lee\agency\clients\site
```

is executed with a command equivalent to:

```powershell
wsl.exe --distribution Ubuntu --cd /home/lee/agency/clients/site --exec bash -lic "..."
```

Arguments are passed separately rather than interpolated into a shell command,
so paths containing spaces do not need special handling.

## What runs where

| Operation | Runtime |
| --- | --- |
| Stacki window and renderer | Windows |
| File reads, writes, and watching | Windows through the WSL UNC path |
| Node, npm, Astro, Git, and content-config bundling | Selected WSL distribution |
| Embedded terminal | Login shell in the selected WSL distribution |
| Preview browser | Windows, using WSL localhost forwarding |

Ordinary drive-letter projects continue to use the existing native Windows
paths. Both `\\wsl.localhost\Distro\...` and `\\wsl$\Distro\...` are recognized.

## Requirements

- Windows 11 or a Windows 10 release with `wsl.exe --cd` support
- WSL 2 and a Linux distribution, such as Ubuntu
- Node.js and the project's package manager installed **inside that distribution**
- Git installed inside the distribution if Stacki's Git features will be used
- Windows Node.js 22 for developing or packaging the Stacki desktop app

Check the project environment before opening Stacki:

```powershell
wsl -d Ubuntu -- bash -lic 'node --version && npm --version && git --version'
```

## Run the modified app from source

Clone and build the Stacki fork on the **Windows filesystem**, not inside WSL.
The desktop app contains a native Windows terminal dependency, even though the
Astro project being edited lives in Linux.

```powershell
git clone https://github.com/leemullet/stacki.git C:\dev\stacki-wsl
cd C:\dev\stacki-wsl
git switch feature/wsl-project-support
npm ci
npm run dev
```

In the development build, choose **Open Project**, enter `\\wsl.localhost` in
the folder picker, open the distribution, and select the Astro project folder.

The already-downloaded official Stacki app cannot load source changes from this
fork. Use the development command above, or install a package built from the
fork.

## Build a side-by-side Windows installer

From Windows PowerShell in the fork checkout:

```powershell
npm ci
npm test
npm run dist:win
```

The installer is written to `release\`. This fork uses the product name
`Stacki WSL` and app ID `com.optigoals.stacki.wsl`, so it installs separately
from the official Stacki app. The fork has no automatic-update feed; rebuilding
and reinstalling updates it.

The installer is unsigned. Windows SmartScreen may show an **Unknown publisher**
warning; use **More info → Run anyway** only when the installer is one you built
from this checkout.

## Manual acceptance test

Use a disposable branch or project for tests that modify files.

1. In Ubuntu, create or choose an Astro project under `/home/...`, run its
   package-manager install, and confirm `npm run dev` works inside WSL.
2. Open the matching `\\wsl.localhost\Ubuntu\...` folder in Stacki WSL.
3. Click **Start dev server**. Confirm the preview loads and the log identifies
   the WSL distribution and Linux project path.
4. Open Stacki's terminal. Confirm `pwd` is the Linux project path and
   `node --version` is the WSL Node version, not the Windows version.
5. Edit text and CSS in Stacki. Confirm the files change inside WSL and the
   preview refreshes.
6. Stop and restart the preview. Confirm no Astro process continues holding
   port 4321 after it is stopped.
7. Exercise the branch menu (`git status`, create/switch a disposable branch)
   and confirm Git runs against the repository inside WSL.
8. If the project has `src/content.config.*`, open its content collections and
   validate an entry. This verifies that esbuild and the config worker run in
   WSL.
9. Close and reopen the project from Recents, then capture or refresh its
   thumbnail.
10. Open a normal `C:\...` Astro project to confirm native Windows projects are
    unchanged.

## Troubleshooting

### Stacki says Node is missing

Install Node inside the distribution. A Windows `node.exe` is deliberately not
used for WSL projects. If Node is managed by nvm, ensure a login/interactive
Bash shell can resolve it:

```powershell
wsl -d Ubuntu -- bash -lic 'command -v node; node --version'
```

### Preview starts in a terminal but not in Stacki

Run the exact environment check above, then remove any stale Astro daemon from
the project:

```bash
npx astro dev stop
```

Restart Stacki WSL and try again. The app binds WSL previews to `0.0.0.0` and
opens them through Windows localhost forwarding.

### The folder picker does not show Linux

Enter `\\wsl.localhost` directly in the Windows folder picker's address bar.
Confirm the distribution is running with `wsl -l -v`, then open it once with
`wsl -d Ubuntu` before retrying.

## Implementation notes

`electron/projectRuntime.js` is the boundary between native projects and WSL
projects. It detects WSL UNC paths, translates project-owned paths to Linux
paths, and builds safe `wsl.exe` spawn/exec specifications. Main-process dev
servers, dependency installation, Git, project scaffolders, content config
workers, commit previews, and the embedded terminal all use that boundary.

The app does not copy a project to Windows and does not run Linux `node_modules`
with Windows Node. Keeping files and processes on the same side avoids native
package, symlink, permission, and executable-shim mismatches.
