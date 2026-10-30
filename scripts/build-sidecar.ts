// Compiles the server into one executable for this OS, named the way Tauri
// expects its sidecar: desktop/binaries/studio-server-<target triple>.
const key = `${process.platform}-${process.arch}`;
const target = { "linux-x64": ["bun-linux-x64", "x86_64-unknown-linux-gnu", ""], "win32-x64": ["bun-windows-x64", "x86_64-pc-windows-msvc", ".exe"] }[key];
if (!target) throw new Error(`No desktop build for ${key} yet`);
const [bunTarget, triple, ext] = target;
const out = `desktop/binaries/studio-server-${triple}${ext}`;
const r = Bun.spawnSync(["bun", "build", "--compile", `--target=${bunTarget}`, "server/entry.ts", "--outfile", out], { stdio: ["inherit", "inherit", "inherit"] });
if (r.exitCode !== 0) process.exit(r.exitCode ?? 1);
console.log(`sidecar: ${out}`);
