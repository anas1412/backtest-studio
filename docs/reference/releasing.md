# Releasing

## Write the notes as you go

Every change worth telling users goes under **Unreleased** at the top of
[`CHANGELOG.md`](https://github.com/anas1412/backtest-studio/blob/main/CHANGELOG.md), in plain words.

## Cut a release

```sh
scripts/release.sh 0.2.0
```

The script refuses to run with uncommitted changes or an empty *Unreleased* section. Otherwise it:

1. turns *Unreleased* into `## 0.2.0 — <today>` in `CHANGELOG.md`;
2. sets the version in `desktop/tauri.conf.json`, `package.json`, `desktop/Cargo.toml` and `Cargo.lock`;
3. commits "Release v0.2.0", tags `v0.2.0` and pushes both.

The script needs Bash: on Windows, run it from Git Bash or WSL.

## What GitHub does

The tag starts the **Release** workflow:

- builds the Windows installer (on Windows) and the Linux AppImage (on Ubuntu 22.04, so it runs on glibc 2.35 and newer);
- signs both for the updater;
- publishes the GitHub release with that version's CHANGELOG section as its notes, plus `latest.json`, the file
  installed apps check for updates. Installed apps then show the same notes when they offer the update.

A manual run of the workflow builds the same into a **draft** release, to test the pipeline without publishing.

## The signing key

Updates are only accepted when signed with the project's key. Its private half is the repository secret
`TAURI_SIGNING_PRIVATE_KEY` (and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`); the public half is in `tauri.conf.json`.
**Keep a backup of the private key**: without it, installed apps can never take a new update.

## Forks

To publish your own builds, generate your own key (`bunx tauri signer generate`), put its public key and your
repository's `latest.json` URL in `desktop/tauri.conf.json`, and add the private key as your repository's secrets.
