// Linux, AppImage only: register the app with the desktop. On Wayland the
// window's icon comes from a .desktop entry matching the app id, which an
// AppImage doesn't install, so without this the desktop shows a generic icon.
// The entry points at wherever the AppImage is now (rewritten if it moves)
// and also puts the app in the launcher.
use std::{fs, path::PathBuf};

const ICON: &[u8] = include_bytes!("../icons/128x128@2x.png");
const ID: &str = "backtest-studio";
// the Wayland app id may be the binary name or the bundle identifier: one
// visible entry for the launcher, a hidden alias for the other name
const ALIAS: &str = "com.anas1412.backteststudio";

pub fn register() {
    #[cfg(target_os = "linux")]
    if let (Some(appimage), Some(home)) = (std::env::var_os("APPIMAGE"), std::env::var_os("HOME")) {
        let home = PathBuf::from(home);
        let data = std::env::var_os("XDG_DATA_HOME").map(PathBuf::from).unwrap_or_else(|| home.join(".local/share"));
        let icon_dir = data.join("icons/hicolor/256x256/apps");
        let apps = data.join("applications");
        if fs::create_dir_all(&icon_dir).is_err() || fs::create_dir_all(&apps).is_err() {
            return;
        }
        let _ = fs::write(icon_dir.join(format!("{ID}.png")), ICON);
        let exec = appimage.to_string_lossy().replace('"', "\\\"");
        let entry = |hidden: bool| {
            format!(
                "[Desktop Entry]\nType=Application\nName=Backtest Studio\nComment=Write, backtest and run MT5 strategies with AI\n\
                 Exec=\"{exec}\"\nIcon={ID}\nCategories=Office;Finance;\nStartupWMClass={ID}\nTerminal=false\n{}",
                if hidden { "NoDisplay=true\n" } else { "" }
            )
        };
        for (name, hidden) in [(ID, false), (ALIAS, true)] {
            let path = apps.join(format!("{name}.desktop"));
            let content = entry(hidden);
            if fs::read_to_string(&path).ok().as_deref() != Some(content.as_str()) {
                let _ = fs::write(path, content);
            }
        }
    }
}
