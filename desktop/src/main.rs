// Backtest Studio desktop app: starts the studio's own server (the
// `studio-server` sidecar) with the user's data folder, then points the
// window at it. The UI and all the work live in that server; this only
// hosts the window, keeps one instance, and installs updates.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod desktop_entry;
mod update;

use std::sync::Mutex;
use tauri::{Manager, RunEvent, Url};
use tauri_plugin_shell::{process::{CommandChild, CommandEvent}, ShellExt};

struct Server(Mutex<Option<CommandChild>>);

fn main() {
    // On a Wayland session use Wayland: the AppImage's GTK hook defaults to X11.
    if std::env::var_os("WAYLAND_DISPLAY").is_some() && std::env::var("GDK_BACKEND").as_deref() != Ok("wayland") {
        std::env::set_var("GDK_BACKEND", "wayland");
    }

    desktop_entry::register();

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![update::install_update])
        .setup(|app| {
            let data = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data)?;
            let resources = app.path().resource_dir()?;
            let (mut events, child) = app
                .shell()
                .sidecar("studio-server")?
                .env("STUDIO_DATA", &data)
                .env("STUDIO_RESOURCES", &resources)
                .env("PORT", "0")
                .spawn()?;
            app.manage(Server(Mutex::new(Some(child))));

            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                // the last lines of stderr, shown if the server dies
                let mut tail = String::new();
                while let Some(event) = events.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            let line = String::from_utf8_lossy(&line);
                            if let Some(port) = line.trim().strip_prefix("READY ") {
                                if let (Some(w), Ok(url)) = (handle.get_webview_window("main"), Url::parse(&format!("http://127.0.0.1:{port}/"))) {
                                    let _ = w.navigate(url);
                                }
                            }
                        }
                        CommandEvent::Stderr(line) => {
                            tail.push_str(&String::from_utf8_lossy(&line));
                            if tail.len() > 4000 {
                                tail = tail.split_off(tail.len() - 4000);
                            }
                        }
                        CommandEvent::Terminated(status) => {
                            if let Some(w) = handle.get_webview_window("main") {
                                let msg = format!("{tail}\n(exit code {:?})", status.code);
                                let _ = w.eval(&format!("window.showError && window.showError({})", serde_json::to_string(&msg).unwrap_or_default()));
                            }
                            break;
                        }
                        _ => {}
                    }
                }
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Backtest Studio");

    app.run(|app, event| {
        // closing the app stops the server; live trading keeps running in MT5
        if let RunEvent::Exit = event {
            if let Some(child) = app.state::<Server>().0.lock().unwrap().take() {
                let _ = child.kill();
            }
        }
    });
}
