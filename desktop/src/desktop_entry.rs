// Linux, AppImage only: fitting the app into the desktop.
// - The app-menu entry and icon: on Wayland the window's icon comes from a
//   .desktop entry matching the app id, which an AppImage doesn't install.
//   Written at each start, pointing at wherever the AppImage is now, unless
//   the user removed it from the menu (remembered).
// - A one-time offer to move the AppImage into ~/Applications when it runs
//   from somewhere else (Downloads, say), so the menu entry doesn't point at
//   a file that may be deleted.
// Choices are kept in the app's data folder (desktop.json).
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Runtime};

const ICON: &[u8] = include_bytes!("../icons/128x128@2x.png");
const ID: &str = "backtest-studio";
// the Wayland app id may be the binary name or the bundle identifier: one
// visible entry for the launcher, a hidden alias for the other name
const ALIAS: &str = "com.anas1412.backteststudio";
const MOVED_NAME: &str = "BacktestStudio.AppImage";

#[derive(Default, serde::Serialize, serde::Deserialize)]
struct Choices {
    #[serde(default)]
    keep_here: bool, // don't offer the move again
    #[serde(default)]
    no_launcher: bool, // the user removed the app-menu entry
}

fn home() -> Option<PathBuf> {
    std::env::var_os("HOME").map(PathBuf::from)
}
fn data_home() -> Option<PathBuf> {
    std::env::var_os("XDG_DATA_HOME").map(PathBuf::from).or_else(|| home().map(|h| h.join(".local/share")))
}
fn appimage() -> Option<PathBuf> {
    if cfg!(target_os = "linux") { std::env::var_os("APPIMAGE").map(PathBuf::from) } else { None }
}
fn applications_dir() -> Option<PathBuf> {
    home().map(|h| h.join("Applications"))
}
fn choices_file() -> Option<PathBuf> {
    data_home().map(|d| d.join(ALIAS).join("desktop.json"))
}
fn load() -> Choices {
    choices_file().and_then(|f| fs::read_to_string(f).ok()).and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default()
}
fn save(c: &Choices) {
    if let Some(f) = choices_file() {
        let _ = fs::create_dir_all(f.parent().unwrap());
        let _ = fs::write(f, serde_json::to_string(c).unwrap_or_default());
    }
}

fn entry_paths() -> Option<(PathBuf, [PathBuf; 2])> {
    let data = data_home()?;
    Some((
        data.join(format!("icons/hicolor/256x256/apps/{ID}.png")),
        [data.join(format!("applications/{ID}.desktop")), data.join(format!("applications/{ALIAS}.desktop"))],
    ))
}

fn write_entry(appimage: &std::path::Path) {
    let Some((icon, [main, alias])) = entry_paths() else { return };
    let _ = fs::create_dir_all(icon.parent().unwrap());
    let _ = fs::create_dir_all(main.parent().unwrap());
    let _ = fs::write(&icon, ICON);
    let exec = appimage.to_string_lossy().replace('"', "\\\"");
    for (path, hidden) in [(main, false), (alias, true)] {
        let content = format!(
            "[Desktop Entry]\nType=Application\nName=Backtest Studio\nComment=Write, backtest and run MT5 strategies with AI\n\
             Exec=\"{exec}\"\nIcon={ID}\nCategories=Office;Finance;\nStartupWMClass={ID}\nTerminal=false\n{}",
            if hidden { "NoDisplay=true\n" } else { "" }
        );
        if fs::read_to_string(&path).ok().as_deref() != Some(content.as_str()) {
            let _ = fs::write(path, content);
        }
    }
}

fn remove_entry() {
    if let Some((icon, entries)) = entry_paths() {
        let _ = fs::remove_file(icon);
        for e in entries {
            let _ = fs::remove_file(e);
        }
    }
}

/// At start: keep the menu entry pointing at this AppImage, unless removed.
pub fn register() {
    if let Some(app) = appimage() {
        if !load().no_launcher {
            write_entry(&app);
        }
    }
}

#[derive(serde::Serialize)]
pub struct Location {
    appimage: Option<String>,
    in_applications: bool,
    offer_move: bool,
    launcher: bool,
}

#[tauri::command]
pub fn appimage_location() -> Location {
    let app = appimage();
    let c = load();
    let in_applications = match (&app, applications_dir()) {
        (Some(a), Some(dir)) => a.parent() == Some(dir.as_path()),
        _ => false,
    };
    Location {
        offer_move: app.is_some() && !in_applications && !c.keep_here,
        appimage: app.map(|a| a.to_string_lossy().into_owned()),
        in_applications,
        launcher: !c.no_launcher,
    }
}

#[tauri::command]
pub fn keep_here() {
    save(&Choices { keep_here: true, ..load() });
}

/// Copies the AppImage into ~/Applications, points the menu there, starts
/// the copy and quits; the original is deleted (a running AppImage keeps
/// working from its mount, so this is safe).
#[tauri::command]
pub fn move_to_applications<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let from = appimage().ok_or("Not running as an AppImage")?;
    let dir = applications_dir().ok_or("No home folder")?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let to = dir.join(MOVED_NAME);
    if to != from {
        let tmp = dir.join(format!(".{MOVED_NAME}.part"));
        fs::copy(&from, &tmp).map_err(|e| format!("Couldn't copy the app to {}: {e}", dir.display()))?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&tmp, fs::Permissions::from_mode(0o755)).map_err(|e| e.to_string())?;
        }
        fs::rename(&tmp, &to).map_err(|e| e.to_string())?;
        let _ = fs::remove_file(&from);
    }
    if !load().no_launcher {
        write_entry(&to);
    }
    // the new copy must start after this one is gone (one instance at a time)
    std::process::Command::new("sh")
        .arg("-c")
        .arg("sleep 1; exec \"$0\"")
        .arg(&to)
        .spawn()
        .map_err(|e| format!("Moved, but couldn't start it: {e}"))?;
    app.exit(0);
    Ok(())
}

/// Adds or removes the app-menu entry; the choice is kept across starts.
#[tauri::command]
pub fn set_launcher(enabled: bool) -> Result<(), String> {
    let app = appimage().ok_or("Not running as an AppImage")?;
    save(&Choices { no_launcher: !enabled, ..load() });
    if enabled { write_entry(&app) } else { remove_entry() }
    Ok(())
}
