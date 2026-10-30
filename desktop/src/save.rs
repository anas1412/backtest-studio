// Saving a file the UI made (a PDF report): the system's "Save as" dialog,
// then the bytes go where the user chose. The UI never picks a path itself.
use tauri::{ipc::InvokeBody, AppHandle, Runtime};
use tauri_plugin_dialog::DialogExt;

/// The request body is the file; the "x-file-name" header is the suggested
/// name. Returns where it was saved, or None when the user cancelled.
#[tauri::command]
pub async fn save_file<R: Runtime>(app: AppHandle<R>, request: tauri::ipc::Request<'_>) -> Result<Option<String>, String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("No file to save".into());
    };
    let bytes = bytes.clone();
    let name = request.headers().get("x-file-name").and_then(|v| v.to_str().ok()).unwrap_or("file").to_owned();
    let ext = name.rsplit_once('.').map(|(_, e)| e.to_owned());
    // the dialog blocks until the user answers, so off the async runtime
    tauri::async_runtime::spawn_blocking(move || {
        let mut dialog = app.dialog().file().set_file_name(&name);
        if let Some(ext) = &ext {
            dialog = dialog.add_filter(ext.to_uppercase(), &[ext.as_str()]);
        }
        let Some(choice) = dialog.blocking_save_file() else { return Ok(None) };
        let path = choice.into_path().map_err(|e| e.to_string())?;
        std::fs::write(&path, &bytes).map_err(|e| format!("Couldn't save to {}: {e}", path.display()))?;
        Ok(Some(path.to_string_lossy().into_owned()))
    })
    .await
    .map_err(|e| e.to_string())?
}
