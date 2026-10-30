fn main() {
    // app commands are listed, so the UI's capability must allow each one by name
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&[
            "install_update", "appimage_location", "move_to_applications", "keep_here", "set_launcher",
        ])),
    )
    .expect("failed to run tauri-build");
}
