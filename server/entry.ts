// The one executable the desktop app ships: `studio-server` runs the web
// server, `studio-server cli <command>` runs what tools/*.sh call.
// Agent CLIs reach the cli through STUDIO_BIN (inherited from the server).
if (!/bun(\.exe)?$/i.test(process.execPath)) process.env.STUDIO_BIN = process.execPath;

// Inside an AppImage the environment points library and data paths into the
// image. Wine, the agent CLIs and MT5 must not inherit that, so every path
// list loses its entries under $APPDIR (and is dropped when nothing is left).
const appdir = process.env.APPDIR;
if (process.env.APPIMAGE && appdir) {
  for (const [k, v] of Object.entries(process.env)) {
    if (!v?.includes(appdir) || k === "APPDIR" || k === "APPIMAGE" || k === "STUDIO_RESOURCES") continue;
    const kept = v.split(":").filter((p) => p && !p.startsWith(appdir));
    if (kept.length) process.env[k] = kept.join(":");
    else delete process.env[k];
  }
  for (const k of ["LD_PRELOAD", "GDK_BACKEND", "GTK_IM_MODULE_FILE", "PYTHONHOME", "PERLLIB"]) delete process.env[k];
}

if (process.argv[2] === "cli") {
  process.argv.splice(2, 1);
  await import("./cli");
} else {
  await import("./main");
}
