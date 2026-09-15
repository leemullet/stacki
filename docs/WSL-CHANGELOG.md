# WSL support: change history and open bugs

## Quick status

Windows Stacki UI with project processes running inside Ubuntu/WSL 2. Work is on `feature/wsl-project-support`; `main` has not been changed and no installer or release has been published.

As reported by Lee on 2026-09-15 after the symlink fix:

- Preview starts successfully.
- Preview loading takes approximately 10 seconds versus a reported previous comparison of about 3 seconds. This is a user observation, not an instrumented benchmark.
- Layers panel appears to work.
- Clicking objects on the canvas does not select them. Visual editing is therefore not fully working yet.
- Astro was verified inside Ubuntu as v7.3.2; its executable is a symlink to ../astro/bin/astro.mjs.

This document records changes and unresolved issues; it does not claim complete WSL support.

## Git history

| Date | GitHub commit | Changes and outcome |
| --- | --- | --- |
| 2026-09-15 | [4f35a89](https://github.com/leemullet/stacki/commit/4f35a895cd8d1b165ba7e5b690a79fd4bc3eb97d) | Initial WSL runtime routing, Linux file watcher, terminal/content/scaffolder integration, separate package identity, tests and guide. |
| 2026-09-15 | [790e2a0](https://github.com/leemullet/stacki/commit/790e2a0685a37670564b061aeeaac6a455304bf7) | Fix false missing-Astro detection by checking executable inside Linux; propagate asynchronous checks across preview entry points; read diagnostic metadata in Linux. User subsequently confirmed working preview. |

Base: [800fa52](https://github.com/leemullet/stacki/commit/800fa5270523e7df3afbcaeee8bdbb3a6fe07b49).
[Complete code comparison](https://github.com/leemullet/stacki/compare/800fa5270523e7df3afbcaeee8bdbb3a6fe07b49...790e2a0685a37670564b061aeeaac6a455304bf7).

The initial GitHub commit combines two earlier local commits, e11c4b5 (runtime support) and 830bd90 (Linux watcher). Those local hashes are not the canonical GitHub history. Early patch-download attempts did not apply to the user's checkout; the original version banner and unchanged Git history confirmed that. The user then fetched the feature branch from GitHub.

## File and line map

Links are pinned to code commit `790e2a0685a37670564b061aeeaac6a455304bf7` so future edits cannot silently move the cited code. Ranges group related changes and can include surrounding context; use the commit diffs above for every exact added/deleted line.

| File / lines | Change |
| --- | --- |
| [electron/projectRuntime.js:1-135](https://github.com/leemullet/stacki/blob/790e2a0685a37670564b061aeeaac6a455304bf7/electron/projectRuntime.js#L1-L135) | New runtime adapter: detect both WSL UNC spellings, convert paths, execute commands through wsl.exe and Bash, choose Linux executable shims, translate clipboard paths. Lines 105–116 add asynchronous Linux executable checks; only test exit code 1 means missing. |
| [electron/main.js:70-79](https://github.com/leemullet/stacki/blob/790e2a0685a37670564b061aeeaac6a455304bf7/electron/main.js#L70-L79) | Import runtime helpers and gate updates on an explicit publish feed. |
| [electron/main.js:637-646](https://github.com/leemullet/stacki/blob/790e2a0685a37670564b061aeeaac6a455304bf7/electron/main.js#L637-L646) | Explain disabled updates in the fork's menu. |
| [electron/main.js:709-712](https://github.com/leemullet/stacki/blob/790e2a0685a37670564b061aeeaac6a455304bf7/electron/main.js#L709-L712) | Skip scheduled updates when no feed is configured. |
| [electron/main.js:910-922](https://github.com/leemullet/stacki/blob/790e2a0685a37670564b061aeeaac6a455304bf7/electron/main.js#L910-L922) | Route shared command execution (including Git) through the project runtime. |
| [electron/main.js:1111-1133](https://github.com/leemullet/stacki/blob/790e2a0685a37670564b061aeeaac6a455304bf7/electron/main.js#L1111-L1133) | Await runtime-aware dependency checks for Recents; unavailable projects cannot refresh thumbnails. |
| [electron/main.js:1181-1247](https://github.com/leemullet/stacki/blob/790e2a0685a37670564b061aeeaac6a455304bf7/electron/main.js#L1181-L1247) | Check thumbnail dependencies in the project runtime; start WSL Astro with host 0.0.0.0; route temporary-server stop commands. |
| [electron/main.js:1348-1358](https://github.com/leemullet/stacki/blob/790e2a0685a37670564b061aeeaac6a455304bf7/electron/main.js#L1348-L1358) | Install packages using the distribution's package manager for WSL projects. |
| [electron/main.js:1398-1402](https://github.com/leemullet/stacki/blob/790e2a0685a37670564b061aeeaac6a455304bf7/electron/main.js#L1398-L1402) | Run Astro project creation in the owning runtime. |
| [electron/main.js:3000-3005](https://github.com/leemullet/stacki/blob/790e2a0685a37670564b061aeeaac6a455304bf7/electron/main.js#L3000-L3005) | Request WSL Astro shutdown, then stop the wrapper process. |
| [electron/main.js:3357-3415](https://github.com/leemullet/stacki/blob/790e2a0685a37670564b061aeeaac6a455304bf7/electron/main.js#L3357-L3415) | Check generated config using WSL Node; stage parser/helpers as .cjs; use Linux project paths for markers. |
| [electron/main.js:3726-3783](https://github.com/leemullet/stacki/blob/790e2a0685a37670564b061aeeaac6a455304bf7/electron/main.js#L3726-L3783) | Validate generated marker config, bind WSL dev server, and collect Astro failure logs through runtime commands. |
| [electron/main.js:3868-3897](https://github.com/leemullet/stacki/blob/790e2a0685a37670564b061aeeaac6a455304bf7/electron/main.js#L3868-L3897) | Report WSL distro/path, check Linux Node, and check Astro inside Linux before and after installing dependencies. |
| [electron/main.js:4326-4366](https://github.com/leemullet/stacki/blob/790e2a0685a37670564b061aeeaac6a455304bf7/electron/main.js#L4326-L4366) | Diagnose the WSL Node version, read Astro metadata in Linux, and report runtime/distro/path and dependency availability. |
| [electron/main.js:4614-4669](https://github.com/leemullet/stacki/blob/790e2a0685a37670564b061aeeaac6a455304bf7/electron/main.js#L4614-L4669) | Route historical preview launch/stop and dependency checks through WSL. |
| [electron/projectWatcher.js:1-140](https://github.com/leemullet/stacki/blob/790e2a0685a37670564b061aeeaac6a455304bf7/electron/projectWatcher.js#L1-L140) | Replace Windows recursive fs.watch for WSL projects with a Linux Node watcher; stream JSON events back to existing debounce/self-write routing; close worker with project. |
| [electron/contentConfig.js:5-10](https://github.com/leemullet/stacki/blob/790e2a0685a37670564b061aeeaac6a455304bf7/electron/contentConfig.js#L5-L10) | Import runtime helpers. |
| [electron/contentConfig.js:72-88](https://github.com/leemullet/stacki/blob/790e2a0685a37670564b061aeeaac6a455304bf7/electron/contentConfig.js#L72-L88) | Translate staged content config import paths. |
| [electron/contentConfig.js:164-218](https://github.com/leemullet/stacki/blob/790e2a0685a37670564b061aeeaac6a455304bf7/electron/contentConfig.js#L164-L218) | Bundle config with esbuild inside WSL using project dependencies and Linux paths. |
| [electron/contentConfig.js:279-305](https://github.com/leemullet/stacki/blob/790e2a0685a37670564b061aeeaac6a455304bf7/electron/contentConfig.js#L279-L305) | Choose WSL bundling and a Linux Node schema worker; preserve native path. |
| [electron/terminal.js:267-288](https://github.com/leemullet/stacki/blob/790e2a0685a37670564b061aeeaac6a455304bf7/electron/terminal.js#L267-L288) | Launch wsl.exe into the selected distribution/project, with a native Windows cwd for ConPTY. |
| [electron/terminal.js:440-444](https://github.com/leemullet/stacki/blob/790e2a0685a37670564b061aeeaac6a455304bf7/electron/terminal.js#L440-L444) | Return a /mnt/<drive>/ path for clipboard image paste in WSL. |
| [electron/starter.js:3](https://github.com/leemullet/stacki/blob/790e2a0685a37670564b061aeeaac6a455304bf7/electron/starter.js#L3) | Import runtime launcher. |
| [electron/starter.js:36-49](https://github.com/leemullet/stacki/blob/790e2a0685a37670564b061aeeaac6a455304bf7/electron/starter.js#L36-L49) | Route scaffolding and Git subprocesses through project runtime. |
| [electron/starter.js:108-109](https://github.com/leemullet/stacki/blob/790e2a0685a37670564b061aeeaac6a455304bf7/electron/starter.js#L108-L109) | Choose npm rather than npm.cmd for WSL. |
| [package.json:3-4](https://github.com/leemullet/stacki/blob/790e2a0685a37670564b061aeeaac6a455304bf7/package.json#L3-L4) | Name the fork Stacki WSL and set version 0.1.25-wsl.1. |
| [package.json:143](https://github.com/leemullet/stacki/blob/790e2a0685a37670564b061aeeaac6a455304bf7/package.json#L143) | Add test:wslruntime. |
| [package.json:181-205](https://github.com/leemullet/stacki/blob/790e2a0685a37670564b061aeeaac6a455304bf7/package.json#L181-L205) | Use separate app ID com.optigoals.stacki.wsl/product name; remove upstream publish configuration (a deletion, visible in initial commit diff). |
| [package-lock.json:1-10](https://github.com/leemullet/stacki/blob/790e2a0685a37670564b061aeeaac6a455304bf7/package-lock.json#L1-L10) | Align root version with fork version; no dependency version changes. |
| [test/backend-lifecycle.test.js:53-58](https://github.com/leemullet/stacki/blob/790e2a0685a37670564b061aeeaac6a455304bf7/test/backend-lifecycle.test.js#L53-L58) | Adapt content-worker test harness to runtime imports. |
| [test/backend-lifecycle.test.js:225-260](https://github.com/leemullet/stacki/blob/790e2a0685a37670564b061aeeaac6a455304bf7/test/backend-lifecycle.test.js#L225-L260) | Test WSL watcher routing and cleanup without Windows fs.watch. |
| [test/wsl-runtime.test.js:1-96](https://github.com/leemullet/stacki/blob/790e2a0685a37670564b061aeeaac6a455304bf7/test/wsl-runtime.test.js#L1-L96) | Test paths, safe argument passing, executable selection, clipboard paths, Linux symlink checks, missing executable versus launch failure, and native behavior. |
| [README.md:7-9](https://github.com/leemullet/stacki/blob/790e2a0685a37670564b061aeeaac6a455304bf7/README.md#L7-L9) | Link to WSL setup documentation. |
| [docs/WSL.md:1-154](https://github.com/leemullet/stacki/blob/790e2a0685a37670564b061aeeaac6a455304bf7/docs/WSL.md#L1-L154) | Initial setup, packaging, troubleshooting, and manual acceptance guide; implementation notes are historical and subject to corrections below. |

No renderer/canvas-selection implementation was edited in these commits.

## Failure history

1. **Windows npm launched for a WSL project.** Original log used Windows Node and cwd C:\\Windows, then failed creating package-lock.json. Runtime routing now invokes tools inside the selected distribution.
2. **Windows watcher failed with EISDIR on the WSL src folder.** The initial runtime-only local patch missed this. The Linux watcher correction was included in the first GitHub commit.
3. **Astro falsely reported missing after install.** The original runtime implementation still used Windows fs.existsSync on Linux's executable symlink. User demonstrated the symlink and successful Astro version command in Ubuntu. Commit 790e2a0 moves executable detection into Linux, including Recents, thumbnails, startup, historical previews, and diagnostics.
4. **Preview now renders, but canvas selection remains broken.** Open; see WSL-001.
5. **Preview starts more slowly.** Open; see WSL-002.

## Open bugs and investigation plan

### WSL-001 — Canvas selection unavailable

Status: open; high priority because it prevents normal visual editing.

Observed: preview renders and layers panel appears functional, but canvas clicks cannot select elements.

Reproduction: open the WSL project, start preview, click a visible element, and compare with selecting its layer. Expected: canvas and layers select the same source element. Actual: canvas selection fails.

Cause is not established. Investigate:
- Capture the full Stacki dev log and whether startup returns bare/external mode.
- Check generated node_modules/.avb/astro.config.mjs and staged .cjs helpers for successful loading.
- Inspect preview HTML for Stacki selection markers; verify source paths match the Windows-side project model.
- Check renderer/iframe console errors and selection message handling.

Start at [electron/main.js:3357-3415](https://github.com/leemullet/stacki/blob/790e2a0685a37670564b061aeeaac6a455304bf7/electron/main.js#L3357-L3415), [electron/main.js:3726-3752](https://github.com/leemullet/stacki/blob/790e2a0685a37670564b061aeeaac6a455304bf7/electron/main.js#L3726-L3752), and [electron/main.js:3899-3940](https://github.com/leemullet/stacki/blob/790e2a0685a37670564b061aeeaac6a455304bf7/electron/main.js#L3899-L3940). Existing bare-preview fallback explicitly omits markers; external-server adoption can also explain a rendered page without full editing integration. These are hypotheses, not confirmed causes.

Acceptance: canvas click/hover selection, layer synchronization, component drill-in, text/style changes and refresh all work in WSL and in a native Windows project.

### WSL-002 — Preview startup around 10 seconds

Status: open; measure before optimizing.

Observed: approximately 10 seconds versus user's comparison of 3 seconds. Cold/warm state and exact comparison conditions were not recorded.

Measure separate timings for WSL startup, Bash profile initialization, Node/executable probes, marker staging/config validation, Astro readiness and iframe loading. Repeated wsl.exe + bash -lic calls and synchronous config validation are candidates, not established causes. Do not remove checks or cache results indefinitely merely to reduce timings.

Acceptance: record comparable cold/warm measurements, identify dominant cost, improve it without breaking nvm resolution, dependency detection, or project switching.

## Validation and limits

- Syntax checks and renderer production build passed during implementation.
- Initial full suite: 122/124 commands passed (some commands intentionally skip without fixtures/display). Thumbnail test was blocked by Electron/display environment; hover-cost assertion failed reproducibly and was not diagnosed. It must not be described as proven environment-only.
- Latest targeted run: 26 tests passed across test/wsl-runtime.test.js and test/backend-lifecycle.test.js, including 10 runtime tests and 16 backend lifecycle tests.
- WSL routing tests use mocks/command specifications; they are not actual Windows-to-WSL integration tests.
- Linux runner's native node-pty installation hit fchown errors. Dependencies were installed with lifecycle scripts skipped for JavaScript testing; no Windows installer was built here.
- User testing confirms successful preview only; it does not yet certify terminal, CMS, Git, historical previews, shutdown cleanup, all distros or package managers.

## Documentation corrections and remaining assumptions

The older [WSL setup guide](WSL.md) describes the initial design. Its statement that watching runs through Windows UNC is superseded: file reads/writes still use UNC, but WSL file watching runs inside Linux Node. Treat its acceptance checklist as tests to perform, not completed results.

The command adapter currently assumes /bin/bash and the executable probe uses /usr/bin/test. Clipboard conversion assumes default /mnt/<drive> mounts. Bash profile output, custom WSL configuration and non-Ubuntu distributions still need validation. Servers bind to 0.0.0.0 and the UI relies on Windows localhost forwarding; accessibility depends on the user's WSL networking/firewall configuration.

Fork package version remains 0.1.25-wsl.1 across the fixes; use commit SHA, not the version alone, to identify code.

## Maintaining this history

For each future change, append the date, actual GitHub commit link, reason, affected files/functions with commit-pinned line links, tests performed, user-observed result and remaining limitations. Keep bug IDs stable and record the resolving commit when closed.

Useful commands:

```powershell
git log --oneline origin/feature/wsl-project-support
git diff --stat 800fa52 origin/feature/wsl-project-support
git diff --unified=0 800fa52 origin/feature/wsl-project-support
```

Use [WSL.md](WSL.md) for build instructions. Resolve canvas selection before treating this as a ready-to-use visual editor release.

## 2026-09-15 — Editing configuration paths, validation and startup diagnostics

Code commit: [ae482a7](https://github.com/leemullet/stacki/commit/ae482a782f4c7daaff7f58a3c4e8ad71434515c2).

WSL-001: a confirmed configuration-path defect is corrected; user acceptance of canvas selection is still pending. WSL-002: timing instrumentation added; no measured speed improvement is claimed and no shell caching/optimization was introduced.

### Changes

| File / pinned lines | Change |
| --- | --- |
| [electron/main.js:74](https://github.com/leemullet/stacki/blob/ae482a782f4c7daaff7f58a3c4e8ad71434515c2/electron/main.js#L74) | Import Linux path conversion helper. |
| [electron/main.js:3358–3379](https://github.com/leemullet/stacki/blob/ae482a782f4c7daaff7f58a3c4e8ad71434515c2/electron/main.js#L3358-L3379) | Reject nonzero WSL config-validation exit status and log syntax output. If validation cannot execute, log that limitation and allow Astro to report the failure. |
| [electron/main.js:3678–3689](https://github.com/leemullet/stacki/blob/ae482a782f4c7daaff7f58a3c4e8ad71434515c2/electron/main.js#L3678-L3689) | Convert all three injected routes (preview, paths, data) to Linux paths before generating config. Slash replacement alone previously left invalid //wsl.localhost/... entrypoints. |
| [electron/main.js:3740–3743](https://github.com/leemullet/stacki/blob/ae482a782f4c7daaff7f58a3c4e8ad71434515c2/electron/main.js#L3740-L3743) | Log config staging failures instead of silently returning a plain preview. |
| [electron/main.js:3747–3822](https://github.com/leemullet/stacki/blob/ae482a782f4c7daaff7f58a3c4e8ad71434515c2/electron/main.js#L3747-L3822) | Log editing/plain mode, config preparation and port readiness times. Keep a separate bounded output buffer for each spawn, so earlier attempt messages cannot establish daemon readiness for a later process. |
| [electron/main.js:3881–3945](https://github.com/leemullet/stacki/blob/ae482a782f4c7daaff7f58a3c4e8ad71434515c2/electron/main.js#L3881-L3945) | Log runtime/dependency preparation, attempt numbers, failures and external-server adoption. Preserve the session log across retries; detect existing servers from the failing attempt's error detail rather than accumulated session logs. Existing 200-chunk session-log limit remains. |
| [test/wsl-preview.test.js](https://github.com/leemullet/stacki/blob/ae482a782f4c7daaff7f58a3c4e8ad71434515c2/test/wsl-preview.test.js) | Four regression tests execute actual config-generation/validation functions and the generated marker plugin with a simulated Windows filesystem. Check three Linux route paths, staged CommonJS imports, page/component markers, staging error logging, and validation failure behavior. |

### Evidence and testing

Before the correction, generating config with Windows path semantics reproduced all three routes under //wsl.localhost/Ubuntu/...; Linux interpreted them as /wsl.localhost/Ubuntu/... rather than the user's /home/... project. A simulated Node syntax failure also reproduced the validator returning true.

After the correction:
- main.js syntax check and git diff whitespace check passed.
- 30 targeted tests passed: 4 preview tests, 10 runtime tests, 16 backend lifecycle tests.
- Generated page output includes avb-s selection comments; generated component output includes its project-relative marker namespace.
- These checks do not execute Electron on Windows or a real WSL Astro server. Browser click selection remains to be verified by the user.
- Full UI suite was not rerun for this main-process-only correction; prior limitations remain documented above.

### User verification

Fetch the feature branch, restart the development app fully, and start the WSL project preview. Use Stacki's Show log panel (dev:log output is sent there, not necessarily to the launching PowerShell terminal).

Look for:
- Editing server attempt 1
- Preview mode: editing config
- Runtime/dependency preparation ... ms
- Astro port ready after ... ms

Editing config means the generated file was supplied, not proof that every page received markers. Confirm canvas click/hover, matching layer selection, component drill-in and text/style edits. If plain preview or external-server mode appears, include the preceding errors in the report.

The readiness timer includes configuration/port selection and server startup; it stops when the port answers, not when the iframe finishes rendering. Config timing includes initial free-port selection. Compare cold and warm runs separately. Do not close WSL-001 or WSL-002 until Windows/WSL results confirm behavior and measured performance.
