mod collections;
mod manifest;
mod steam;
mod library;

use library::{GameEntry, Library};
use manifest::CompileResult;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;
use tauri_plugin_updater::UpdaterExt;

// ── Settings ────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppSettings {
    pub steam_path: String,
    pub crossover_mode: bool,
    pub backend_token: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            steam_path: String::new(),
            crossover_mode: false,
            backend_token: String::new(),
        }
    }
}

fn settings_path(app_handle: &tauri::AppHandle) -> PathBuf {
    let app_data = app_handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    fs::create_dir_all(&app_data).ok();
    app_data.join("settings.json")
}

fn load_settings_internal(app_handle: &tauri::AppHandle) -> AppSettings {
    let path = settings_path(app_handle);
    if path.exists() {
        let data = fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        AppSettings::default()
    }
}

fn save_settings_internal(app_handle: &tauri::AppHandle, settings: &AppSettings) -> Result<(), String> {
    let path = settings_path(app_handle);
    let data = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(&path, data).map_err(|e| e.to_string())
}

fn resolve_steam_path(app_handle: &tauri::AppHandle) -> String {
    let settings = load_settings_internal(app_handle);
    if !settings.steam_path.is_empty() && steam::validate_steam_path(&settings.steam_path) {
        return settings.steam_path;
    }

    #[cfg(target_os = "macos")]
    {
        if settings.crossover_mode {
            if let Some(path) = steam::detect_steam_path_macos(true) {
                return path;
            }
        }
    }

    steam::detect_steam_path().unwrap_or_default()
}

// ── Tauri Commands ──────────────────────────────────────

#[tauri::command]
fn get_settings(app_handle: tauri::AppHandle) -> AppSettings {
    load_settings_internal(&app_handle)
}

#[tauri::command]
fn save_settings(app_handle: tauri::AppHandle, settings: AppSettings) -> Result<(), String> {
    save_settings_internal(&app_handle, &settings)
}

#[tauri::command]
fn detect_steam(app_handle: tauri::AppHandle) -> String {
    resolve_steam_path(&app_handle)
}

#[tauri::command]
fn validate_steam(path: String) -> bool {
    steam::validate_steam_path(&path)
}

#[tauri::command]
fn get_library(app_handle: tauri::AppHandle) -> Library {
    let steam_path = resolve_steam_path(&app_handle);
    if !steam_path.is_empty() {
        library::sync_library(&app_handle, &steam_path)
    } else {
        library::load_library(&app_handle)
    }
}

#[tauri::command]
fn sync_library(app_handle: tauri::AppHandle) -> Library {
    let steam_path = resolve_steam_path(&app_handle);
    library::sync_library(&app_handle, &steam_path)
}

#[tauri::command]
async fn search_steam(query: String) -> Result<Vec<library::GameEntry>, String> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }

    let client = reqwest::Client::new();
    let mut results = Vec::new();

    // Try as AppID first
    if let Ok(appid) = trimmed.parse::<u64>() {
        let url = format!("https://store.steampowered.com/api/appdetails?appids={}", appid);
        if let Ok(resp) = client.get(&url).send().await {
            if let Ok(data) = resp.json::<serde_json::Value>().await {
                if let Some(entry) = data.get(&appid.to_string()) {
                    if entry["success"].as_bool().unwrap_or(false) {
                        let game_data = &entry["data"];
                        results.push(library::GameEntry {
                            appid,
                            name: game_data["name"].as_str().unwrap_or("Unknown").to_string(),
                            image_url: game_data["header_image"].as_str().unwrap_or("").to_string(),
                            installed_at: String::new(),
                            platforms: Vec::new(),
                            metacritic_score: None,
                            release_date: String::new(),
                            review_summary: None,
                        });
                        return Ok(results);
                    }
                }
            }
        }
    }

    // Search by name
    let url = format!(
        "https://store.steampowered.com/api/storesearch/?term={}&l=english&cc=US",
        urlencoding::encode(trimmed)
    );

    if let Ok(resp) = client.get(&url).send().await {
        if let Ok(data) = resp.json::<serde_json::Value>().await {
            if let Some(items) = data["items"].as_array() {
                let mut appids = Vec::new();
                let mut temp_results = Vec::new();

                for item in items {
                    if let (Some(id), Some(name)) = (item["id"].as_u64(), item["name"].as_str()) {
                        let mut platforms = Vec::new();
                        if let Some(plats) = item["platforms"].as_object() {
                            if plats.get("windows").and_then(|v| v.as_bool()).unwrap_or(false) { platforms.push("windows".to_string()); }
                            if plats.get("mac").and_then(|v| v.as_bool()).unwrap_or(false) { platforms.push("mac".to_string()); }
                            if plats.get("linux").and_then(|v| v.as_bool()).unwrap_or(false) { platforms.push("linux".to_string()); }
                        }
                        appids.push(id.to_string());
                        temp_results.push((id, name.to_string(), platforms));
                    }
                }

                // Bulk fetch details
                if !appids.is_empty() {
                    let details_url = format!("https://store.steampowered.com/api/appdetails?appids={}", appids.join(","));
                    if let Ok(details_resp) = client.get(&details_url).send().await {
                        if let Ok(details_data) = details_resp.json::<serde_json::Value>().await {
                            for (id, name, platforms) in temp_results.iter().take(5) {
                                let mut score = None;
                                let mut release_date = String::new();
                                let mut review_summary = None;
                                
                                // Fetch review summary
                                let review_url = format!("https://store.steampowered.com/appreviews/{}?json=1&num_per_page=0", id);
                                if let Ok(review_resp) = client.get(&review_url).send().await {
                                    if let Ok(review_data) = review_resp.json::<serde_json::Value>().await {
                                        review_summary = review_data["query_summary"]["review_score_desc"].as_str().map(|s| s.to_string());
                                        if review_summary.is_none() {
                                            println!("Review summary missing for appid {}: {:?}", id, review_data["query_summary"]);
                                        }
                                    }
                                }

                                if let Some(app_data) = details_data.get(&id.to_string()) {
                                    if app_data["success"].as_bool().unwrap_or(false) {
                                        let data = &app_data["data"];
                                        score = data["metacritic"]["score"].as_u64();
                                        release_date = data["release_date"]["date"].as_str().unwrap_or("").to_string();
                                        if release_date.is_empty() {
                                            println!("Release date missing for appid {}: {:?}", id, data["release_date"]);
                                        }
                                    }
                                }

                                results.push(library::GameEntry {
                                    appid: *id,
                                    name: name.clone(),
                                    image_url: format!("https://cdn.akamai.steamstatic.com/steam/apps/{}/header.jpg", id),
                                    installed_at: String::new(),
                                    platforms: platforms.clone(),
                                    metacritic_score: score,
                                    release_date,
                                    review_summary,
                                });
                            }
                        }
                    }
                }
            }
        }
    }
    Ok(results)
}


#[tauri::command]
async fn download_and_compile(
    app_handle: tauri::AppHandle,
    appid: u64,
    name: String,
) -> Result<CompileResult, String> {
    let settings = load_settings_internal(&app_handle);
    if settings.backend_token.is_empty() {
        return Err("Backend token not configured. Go to Settings to connect your account.".to_string());
    }

    let steam_path = resolve_steam_path(&app_handle);
    if steam_path.is_empty() {
        return Err("Steam installation not found. Configure it in Settings.".to_string());
    }

    // Download zip from LuaDepot API
    let url = format!(
        "https://api.luadepot.dev/game/{}/download",
        appid
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", &settings.backend_token))
        .send()
        .await
        .map_err(|e| format!("Download failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        if status == 401 {
            return Err("Authentication failed. Your backend token may have expired. Please get a new token from Settings.".to_string());
        }
        return Err(format!("API returned error: {} — The game may not be available yet.", status));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    // Compile the manifest
    let result = manifest::compile_manifest_zip(&steam_path, &bytes);

    if result.success {
        let image_url = format!(
            "https://cdn.akamai.steamstatic.com/steam/apps/{}/header.jpg",
            appid
        );
        let entry = GameEntry {
            appid,
            name: name.clone(),
            image_url,
            installed_at: chrono_now(),
            platforms: Vec::new(),
            metacritic_score: None,
            release_date: String::new(),
            review_summary: None,
        };
        library::add_game(&app_handle, entry).ok();

        // Add to "Lua Depot" collection in Steam
        collections::add_game_to_collection(&steam_path, appid).ok();
    }

    Ok(result)
}

#[tauri::command]
fn remove_game_cmd(app_handle: tauri::AppHandle, appid: u64) -> Result<Library, String> {
    let steam_path = resolve_steam_path(&app_handle);
    if !steam_path.is_empty() {
        manifest::remove_game_files(&steam_path, appid).ok();
    }
    library::remove_game(&app_handle, appid)
}

#[tauri::command]
fn handle_dropped_files(
    app_handle: tauri::AppHandle,
    paths: Vec<String>,
) -> Result<Vec<CompileResult>, String> {
    let steam_path = resolve_steam_path(&app_handle);
    if steam_path.is_empty() {
        return Err("Steam installation not found. Configure it in Settings.".to_string());
    }

    let mut results = Vec::new();

    for path_str in &paths {
        let path = std::path::Path::new(path_str);
        if !path.exists() {
            continue;
        }

        let bytes = fs::read(path).map_err(|e| format!("Failed to read file: {}", e))?;
        let filename = path
            .file_name()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_default();

        if filename.to_lowercase().ends_with(".zip") {
            let result = manifest::compile_manifest_zip(&steam_path, &bytes);
            if result.success {
                if let Some(aid) = result.appid {
                    let entry = GameEntry {
                        appid: aid,
                        name: format!("Game {}", aid),
                        image_url: format!(
                            "https://cdn.akamai.steamstatic.com/steam/apps/{}/header.jpg",
                            aid
                        ),
                        installed_at: chrono_now(),
                        platforms: Vec::new(),
                        metacritic_score: None,
                        release_date: String::new(),
                        review_summary: None,
                    };
                    library::add_game(&app_handle, entry).ok();
                    collections::add_game_to_collection(&steam_path, aid).ok();
                }
            }
            results.push(result);
        } else if filename.to_lowercase().ends_with(".lua") {
            let appid_str = filename.trim_end_matches(".lua");
            if let Ok(appid) = appid_str.parse::<u64>() {
                match manifest::install_lua_file(&steam_path, &bytes, appid) {
                    Ok(()) => {
                        let entry = GameEntry {
                            appid,
                            name: format!("Game {}", appid),
                            image_url: format!(
                                "https://cdn.akamai.steamstatic.com/steam/apps/{}/header.jpg",
                                appid
                            ),
                            installed_at: chrono_now(),
                            platforms: Vec::new(),
                            metacritic_score: None,
                            release_date: String::new(),
                            review_summary: None,
                        };
                        library::add_game(&app_handle, entry).ok();
                        collections::add_game_to_collection(&steam_path, appid).ok();
                        results.push(CompileResult {
                            success: true,
                            appid: Some(appid),
                            lua_installed: true,
                            manifests_installed: 0,
                            error: None,
                        });
                    }
                    Err(e) => results.push(CompileResult {
                        success: false,
                        appid: Some(appid),
                        lua_installed: false,
                        manifests_installed: 0,
                        error: Some(e),
                    }),
                }
            }
        } else if filename.to_lowercase().ends_with(".manifest") {
            match manifest::install_manifest_file(&steam_path, &bytes, &filename) {
                Ok(()) => results.push(CompileResult {
                    success: true,
                    appid: None,
                    lua_installed: false,
                    manifests_installed: 1,
                    error: None,
                }),
                Err(e) => results.push(CompileResult {
                    success: false,
                    appid: None,
                    lua_installed: false,
                    manifests_installed: 0,
                    error: Some(e),
                }),
            }
        }
    }

    Ok(results)
}

fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    format!("{}", duration.as_secs())
}

#[tauri::command]
async fn get_game_details(appid: u64) -> Result<serde_json::Value, String> {
    let url = format!("https://store.steampowered.com/api/appdetails?appids={}", appid);
    let client = reqwest::Client::new();
    
    if let Ok(resp) = client.get(&url).send().await {
        if let Ok(data) = resp.json::<serde_json::Value>().await {
            if let Some(entry) = data.get(&appid.to_string()) {
                if entry["success"].as_bool().unwrap_or(false) {
                    return Ok(entry["data"].clone());
                }
            }
        }
    }
    Err("Failed to fetch game details".to_string())
}

#[tauri::command]
async fn get_game_reviews(appid: u64, cursor: Option<String>, num_per_page: Option<u32>) -> Result<serde_json::Value, String> {
    let cursor_str = cursor.unwrap_or_default();
    let count = num_per_page.unwrap_or(3);
    let url = format!(
        "https://store.steampowered.com/appreviews/{}?json=1&num_per_page={}&filter=recent&language=all&cursor={}",
        appid, count, urlencoding::encode(&cursor_str)
    );
    let client = reqwest::Client::new();

    if let Ok(resp) = client.get(&url).send().await {
        if let Ok(data) = resp.json::<serde_json::Value>().await {
            if data["success"].as_i64() == Some(1) {
                return Ok(data.clone());
            }
        }
    }
    Err("Failed to fetch reviews".to_string())
}

#[tauri::command]
fn minimize_window(window: tauri::WebviewWindow) {
    println!("Minimize command received");
    window.minimize().unwrap();
}

#[tauri::command]
fn toggle_maximize_window(window: tauri::WebviewWindow) {
    println!("Toggle maximize command received");
    if window.is_maximized().unwrap_or(false) {
        window.unmaximize().unwrap();
    } else {
        window.maximize().unwrap();
    }
}

#[tauri::command]
fn close_window(window: tauri::WebviewWindow) {
    println!("Close command received");
    window.close().unwrap();
}

// ── App Entry Point ─────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            detect_steam,
            validate_steam,
            get_library,
            sync_library,
            download_and_compile,
            remove_game_cmd,
            handle_dropped_files,
            search_steam,
            get_game_details,
            get_game_reviews,
            minimize_window,
            toggle_maximize_window,
            close_window,
            check_for_update,
            install_update,
            restart_app,
            restart_steam,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[derive(Serialize, Clone, Debug)]
struct UpdateInfo {
    version: String,
    notes: Option<String>,
    current_version: String,
}

#[tauri::command]
async fn check_for_update(app_handle: tauri::AppHandle) -> Result<Option<UpdateInfo>, String> {
    let updater = app_handle.updater_builder().build().map_err(|e| e.to_string())?;
    match updater.check().await {
        Ok(Some(update)) => Ok(Some(UpdateInfo {
            version: update.version,
            notes: update.body,
            current_version: update.current_version,
        })),
        Ok(None) => Ok(None),
        Err(e) => Err(format!("Update check failed: {}", e)),
    }
}

#[tauri::command]
async fn install_update(app_handle: tauri::AppHandle) -> Result<(), String> {
    use tauri::Emitter;
    let updater = app_handle.updater_builder().build().map_err(|e| e.to_string())?;
    let update = updater.check().await.map_err(|e| e.to_string())?;
    if let Some(update) = update {
        let handle = app_handle.clone();
        update
            .download_and_install(
                move |bytes_downloaded, total_size| {
                    let _ = handle.emit(
                        "update-progress",
                        serde_json::json!({
                            "downloaded": bytes_downloaded,
                            "total": total_size,
                        }),
                    );
                },
                || {},
            )
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn restart_app(app_handle: tauri::AppHandle) {
    app_handle.restart();
}

#[tauri::command]
#[allow(unused_variables)]
async fn restart_steam(steam_path: String) -> Result<(), String> {
    // Quit Steam
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("osascript")
            .args(["-e", "quit app \"Steam\""])
            .output()
            .map_err(|e| format!("Failed to quit Steam: {}", e))?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("taskkill")
            .args(["/IM", "steam.exe", "/F"])
            .output()
            .map_err(|e| format!("Failed to quit Steam: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("steam")
            .arg("-shutdown")
            .output()
            .map_err(|e| format!("Failed to quit Steam: {}", e))?;
    }

    // Wait for Steam to close
    tokio::time::sleep(std::time::Duration::from_secs(2)).await;

    // Start Steam
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-a")
            .arg("Steam")
            .output()
            .map_err(|e| format!("Failed to start Steam: {}", e))?;
    }
    #[cfg(target_os = "windows")]
    {
        let steam_exe = std::path::PathBuf::from(&steam_path).join("Steam.exe");
        std::process::Command::new(&steam_exe)
            .spawn()
            .map_err(|e| format!("Failed to start Steam: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("steam")
            .spawn()
            .map_err(|e| format!("Failed to start Steam: {}", e))?;
    }

    Ok(())
}
