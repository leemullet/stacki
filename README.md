# Stacki

Visual Builder for Astro.

A Mac & Windows desktop app for editing [Astro](https://astro.build) projects visually.

This fork adds WSL 2 project support. See [WSL project support](docs/WSL.md)
for requirements, development setup, packaging, and the acceptance checklist.

MIT licensed — fork it, build on it, ship your own version.

## Features

- **Pages** — browse every page in `src/pages`, create new pages (including nested routes like `blog/post-1`), and delete pages.
- **Layouts** — choose which layout from `src/layouts` wraps each page, and edit the layout's props (e.g. `title`).
- **Components** — every component in `src/components` appears in the palette. Drag one into the page structure (or double-click to append), drag to reorder, click ✕ to remove.
- **Props** — the props panel reads each component's `interface Props` / `Astro.props` destructure and generates typed fields (text, number, checkbox). Defaults are shown as placeholders.
- **Live preview** — the app runs `astro dev` for the opened project and embeds it. Edits are auto-saved (300 ms debounce), so Astro's hot reload updates the preview as you type.
- **Git & GitHub** — the branch chip in the title bar shows the current branch and dirty state. From its dropdown you can switch branches, create branches, commit, push, or publish a brand-new repo to GitHub (via the `gh` CLI).
- **Tell an AI what's selected** — **⇧⌘C** copies whatever the canvas has selected as the trail of `file:line-range` pointers that leads to it: the page, each component drilled into on the way down, then the node itself. Paste that into Claude Code or any AI chat that can read the project and it knows exactly which markup you mean.
- **Code fallback** — pages with markup too complex for the visual model open in a code editor instead, still with live preview.
- **New project** — "New Project…" scaffolds a minimal Astro starter (layout + 5 components + home page) and runs `npm install` for you.

## Running in development

```bash
npm install
npm run dev
```

`npm run dev` starts Vite (renderer hot reload) and launches Electron against it.

To run against a production build of the UI:

```bash
npm start
```

## Packaging installers

If you're building for yourself or from a fork, use the unsigned build — it
needs no Apple Developer account and no certificates:

```bash
npm run dist:mac:unsigned   # .dmg + .zip, no signing (build on macOS)
npm run dist:win            # NSIS installer (build on Windows)
```

Output lands in `release/`. macOS will warn the first time you open an
unsigned build; right-click the app and choose Open to get past Gatekeeper.

The signed variants are for maintainers with the release certificates:

```bash
npm run dist:mac   # requires a Developer ID cert + notarization credentials
```

## Releases

Stacki WSL 0.1.26 and later use [this fork's public Windows releases](https://github.com/leemullet/stacki/releases/latest).
Install the updater-enabled build once, then use **File → Check for Updates**.

Approved app changes merged to main trigger the Windows release workflow.
Maintainers must bump the stable version in package.json and package-lock.json
for each release. The workflow builds and verifies the installer and update
metadata before publishing. See [Windows release instructions](docs/WINDOWS-RELEASES.md)
for the process, retry behavior, and one-time setup.

The fork retains its own app ID and update feed. Its Windows installers are
unsigned; upstream signing credentials are neither required nor available.

## Contributing

Issues and pull requests are welcome. A few notes:

- `npm run dev` is all you need for day-to-day work — no credentials required.
- Please don't add workflows that use `pull_request_target`, or any workflow
  that exposes secrets to code from a fork.
- Report security issues privately to the maintainer rather than opening a
  public issue.

## Requirements

- Node.js 18+ and npm (the app shells out to `npm install` / `astro dev` for opened projects)
- `git` for version control features
- [GitHub CLI](https://cli.github.com) (`gh`), authenticated via `gh auth login`, for "Publish to GitHub"

## How editing works

Pages are parsed into a simple model: optional layout wrapper + a flat list of
self-closing component instances with props. The editor writes that model back
as clean `.astro` source. Pages containing arbitrary HTML, expressions, or
nested children fall back to the built-in code editor — nothing is ever
rewritten destructively.

## Build output

`npm run build` starts from a clean `dist/` directory and writes the Electron
CommonJS runtime to `dist/electron/`, shared contracts to `dist/shared/`, and
the Vite renderer to `dist/renderer/`. Content workers and runtime icons are
copied under `dist/` too. `npm run dev` rebuilds the runtime and serves the
renderer through Vite. Only `dist/` needs ignoring for compiler output;
JavaScript files elsewhere in the repository are authored source.

Use `npm run build:clean` to remove generated output. Build before running an
individual runtime test; `npm test` performs the clean build automatically.
