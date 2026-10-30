#!/usr/bin/env bash
# Cut a release: scripts/release.sh 0.2.0
# Sets the version everywhere, commits, tags v0.2.0 and pushes; the Release
# workflow then builds, signs and publishes, and installed apps update.
set -euo pipefail
v="${1:-}"
[[ "$v" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "usage: $0 X.Y.Z" >&2; exit 2; }
cd "$(dirname "$0")/.."
[ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "commit or stash your changes first" >&2; exit 1; }

sed -i -E "0,/\"version\": \"[0-9.]+\"/s//\"version\": \"$v\"/" desktop/tauri.conf.json package.json
sed -i -E "0,/^version = \"[0-9.]+\"/s//version = \"$v\"/" desktop/Cargo.toml
# the lockfile's entry for the app itself
sed -i -E "/^name = \"backtest-studio\"$/{n;s/^version = \"[0-9.]+\"/version = \"$v\"/}" desktop/Cargo.lock

git commit -qam "Release v$v"
git tag "v$v"
git push origin HEAD "v$v"
echo "Pushed v$v: follow the build under Actions → Release."
