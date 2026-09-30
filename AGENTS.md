# Stacki WSL maintenance

This repository is the Windows/WSL fork of Stacki. Preserve the existing app
identity (`com.optigoals.stacki.wsl`, product `Stacki WSL`, package `stacki`).
The updater belongs to `leemullet/stacki`, never the upstream release feed.

Before shipping an app change, read `docs/WINDOWS-RELEASES.md` and
`docs/WSL-CHANGELOG.md`. Work on an isolated branch, test the relevant behavior,
and record changes and verification limits in the changelog.

Every new published app release needs a higher stable version in both
`package.json` and `package-lock.json`. Use `npm version patch --no-git-tag-version`
for a patch release. Do not reuse or replace a published version. Source-only
documentation changes do not need a release version bump.

Approved app/build/test changes merged to main trigger the Windows release
workflow. Verify the workflow succeeds and the installer, blockmap and
`latest.yml` are published before reporting that an in-app update is available.
Users of 0.1.26 or later should update through the installed app; they should
not need to build releases locally. Refer to `test/README.md` for the test gate
and preserve known baseline/environment limits without calling them passes.
