// Installing an update from the fastest route: GitHub redirects a release
// download to its file CDN, whose name resolves to several addresses, and
// some are much slower than others depending on where the user is. All of
// them are asked for the start of the file at once; the download then goes
// to the first that answers. The updater still checks the signature.
use std::{net::SocketAddr, time::Duration};
use tauri::{AppHandle, Emitter, Runtime};
use tauri_plugin_updater::UpdaterExt;

const PROBE_BYTES: u64 = 64 * 1024;

#[derive(Clone, serde::Serialize)]
struct Progress {
    downloaded: u64,
    total: Option<u64>,
    route: Option<String>,
}

/// Where `url` redirects to (GitHub's CDN), or `url` itself.
async fn redirect_target(url: &str) -> reqwest::Url {
    let fallback = || reqwest::Url::parse(url).expect("updater gave a valid url");
    let Ok(client) = reqwest::Client::builder().redirect(reqwest::redirect::Policy::none()).timeout(Duration::from_secs(20)).build() else {
        return fallback();
    };
    match client.get(url).send().await {
        Ok(r) if r.status().is_redirection() => r
            .headers()
            .get(reqwest::header::LOCATION)
            .and_then(|l| l.to_str().ok())
            .and_then(|l| fallback().join(l).ok())
            .unwrap_or_else(fallback),
        _ => fallback(),
    }
}

/// The address of `target`'s host that first returns the start of the file,
/// or None when there is only one address or none answers in time.
async fn fastest_address(target: &reqwest::Url) -> Option<(String, SocketAddr)> {
    let host = target.host_str()?.to_owned();
    let port = target.port_or_known_default().unwrap_or(443);
    let addrs: Vec<SocketAddr> = tokio::net::lookup_host((host.as_str(), port)).await.ok()?.collect();
    if addrs.len() < 2 {
        return None;
    }
    let (tx, mut rx) = tokio::sync::mpsc::channel(addrs.len());
    for addr in addrs {
        let (tx, host, url) = (tx.clone(), host.clone(), target.clone());
        tauri::async_runtime::spawn(async move {
            let probe = async {
                let client = reqwest::Client::builder().resolve(&host, addr).timeout(Duration::from_secs(8)).build().ok()?;
                let mut r = client.get(url).header(reqwest::header::RANGE, format!("bytes=0-{}", PROBE_BYTES - 1)).send().await.ok()?.error_for_status().ok()?;
                let mut got = 0;
                while let Ok(Some(chunk)) = r.chunk().await {
                    got += chunk.len() as u64;
                    if got >= PROBE_BYTES {
                        break;
                    }
                }
                (got > 0).then_some(())
            };
            if probe.await.is_some() {
                let _ = tx.send(addr).await;
            }
        });
    }
    drop(tx);
    let addr = tokio::time::timeout(Duration::from_secs(10), rx.recv()).await.ok()??;
    Some((host, addr))
}

/// Checks, downloads from the fastest route, installs, restarts. Progress goes
/// to the window as "update-progress" events.
#[tauri::command]
pub async fn install_update<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let err = |e: tauri_plugin_updater::Error| e.to_string();
    // a connection that stalls without closing must end, so the fallback below gets its turn
    let stall = Duration::from_secs(30);
    let Some(update) = app.updater_builder().configure_client(move |b| b.read_timeout(stall)).build().map_err(err)?.check().await.map_err(err)? else {
        return Err("No update available".into());
    };
    let target = redirect_target(update.download_url.as_str()).await;
    let route = fastest_address(&target).await;

    // the same update, fetched through a client pinned to that address
    let pinned = match route.clone() {
        Some((host, addr)) => app
            .updater_builder()
            .configure_client(move |b| b.resolve(&host, addr).read_timeout(stall))
            .build()
            .map_err(err)?
            .check()
            .await
            .map_err(err)?
            .unwrap_or(update),
        None => update,
    };

    let pinned_ok = download(&app, pinned, route.as_ref().map(|(_, a)| a.ip().to_string())).await;
    // the chosen address can fail mid-download: then once more the normal way
    if let Err(e) = pinned_ok {
        if route.is_none() {
            return Err(e);
        }
        let plain = app.updater_builder().configure_client(move |b| b.read_timeout(stall)).build().map_err(err)?
            .check().await.map_err(err)?.ok_or("No update available")?;
        download(&app, plain, None).await?;
    }
    app.restart();
}

async fn download<R: Runtime>(app: &AppHandle<R>, update: tauri_plugin_updater::Update, route: Option<String>) -> Result<(), String> {
    let mut downloaded = 0u64;
    let app2 = app.clone();
    update
        .download_and_install(
            move |chunk, total| {
                downloaded += chunk as u64;
                let _ = app2.emit("update-progress", Progress { downloaded, total, route: route.clone() });
            },
            || {},
        )
        .await
        .map_err(|e| e.to_string())
}
