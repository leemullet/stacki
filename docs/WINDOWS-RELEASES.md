# Stacki WSL Windows updates

## Using the installed app

The first updater-enabled version is 0.1.26. Close Stacki WSL and install the
Windows x64 setup executable from
[this fork's releases](https://github.com/leemullet/stacki/releases/latest).
Keep the existing installation directory. App identity and product name are
unchanged, so it updates Stacki WSL rather than the official Stacki app.

Older 0.1.25-wsl.1 builds do not know this feed; one manual installation is
required. From 0.1.26 onward, **File → Check for Updates** checks for a newer
published version, downloads it, and offers **Restart Now** or **Later**.
It also checks at launch and every six hours. Development runs are not updated.
The fork's installers remain unsigned like the previous local builds; Windows
may display its unknown-publisher notice on first installation.

## Shipping future fixes

For each approved app release:

1. Start from current main, implement and test the change on a branch.
2. Bump the stable version in both package.json and package-lock.json before
   merging: `npm version patch --no-git-tag-version` (or choose the appropriate
   minor/major increment). Include the changelog. Never reuse a published version.
3. Merge the reviewed change into main. App/build changes automatically start
   **Release Stacki WSL** in GitHub Actions. No local Windows build is required.
4. Check the Actions result and release assets before telling users the update
   is available. A source merge alone is not a published update.

The workflow also has **Run workflow** on main for retrying a failed release.
Existing draft uploads can be retried only at the same version and commit;
after a source change, use a new version. Published installers are immutable:
an already-published version fails preflight instead of replacing user downloads.
Documentation-only changes do not normally publish an app.

The Windows runner installs the lockfile with Node 22, runs updater/WSL
regressions and the full upstream test gate, builds the TypeScript runtime and Vite, and creates a complete x64 NSIS installer. It verifies:

- package, lockfile, packaged app and latest.yml versions agree;
- app-update.yml points to leemullet/stacki, without embedded credentials;
- latest.yml names the expected installer and matches its SHA-512 and size;
- the installer blockmap exists;
- all three uploaded release assets have the expected sizes.

Only after those checks does a draft become the latest public release. Required
assets are `Stacki-WSL-Setup-VERSION.exe`, its `.exe.blockmap`, and `latest.yml`.
An interrupted or failed build leaves the previous public release active.

## Repository setup and troubleshooting

GitHub Actions must be enabled for this fork. The job uses the repository's
short-lived GITHUB_TOKEN with contents:write, not a personal access token or
upstream signing secrets. No token is shipped with the app. Releases are public.
This workflow ships Windows only; it does not wait for upstream macOS signing.

If a check says this is the latest version, compare the installed version with
the latest published release. If a check fails, inspect `auto-update.log` in the
app logs directory. Packaged resource `app-update.yml` must name this fork, and
the published release must contain `latest.yml`. Do not redirect this app to
flowtricks/stacki-releases: that would replace the WSL fork with upstream code.

Full installed-app download/restart acceptance still requires Windows. Build
verification checks the actual packaged feed and installer; unit tests simulate
the menu/download/restart events. Neither is a claim of installed end-to-end QA.

## References

- https://www.electron.build/auto-update.html
- https://www.electron.build/publish.html
- https://docs.github.com/en/actions/concepts/security/github_token

Pull requests also run the full gate on Windows and macOS. The Windows check builds
and verifies an installer without publishing. Release helpers are compiled from
`scripts/windows-release.ts` and invoked from `dist/scripts/windows-release.js`.
