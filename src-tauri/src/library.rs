use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GameEntry {
    pub appid: u64,
    pub name: String,
    pub image_url: String,
    pub installed_at: String,
    #[serde(default)]
    pub platforms: Vec<String>,
    #[serde(default)]
    pub metacritic_score: Option<u64>,
    #[serde(default)]
    pub release_date: String,
    #[serde(default)]
    pub review_summary: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct Library {
    pub games: Vec<GameEntry>,
}

fn library_path(app_handle: &tauri::AppHandle) -> PathBuf {
    let app_data = app_handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    fs::create_dir_all(&app_data).ok();
    app_data.join("library.json")
}

pub fn load_library(app_handle: &tauri::AppHandle) -> Library {
    let path = library_path(app_handle);
    if path.exists() {
        let data = fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        Library::default()
    }
}

pub fn save_library(app_handle: &tauri::AppHandle, library: &Library) -> Result<(), String> {
    let path = library_path(app_handle);
    let data = serde_json::to_string_pretty(library).map_err(|e| e.to_string())?;
    fs::write(&path, data).map_err(|e| e.to_string())
}

pub fn sync_library(app_handle: &tauri::AppHandle, steam_path: &str) -> Library {
    let mut lib = load_library(app_handle);
    let stplugin_dir = crate::steam::get_stplugin_dir(steam_path);

    if stplugin_dir.exists() {
        if let Ok(entries) = fs::read_dir(stplugin_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    let filename = path.file_name().unwrap_or_default().to_string_lossy();
                    if filename.ends_with(".lua") || filename.ends_with(".lua.disabled") {
                        let appid_str = filename.split('.').next().unwrap_or_default();
                        if let Ok(appid) = appid_str.parse::<u64>() {
                            // Check if game already in library
                            if !lib.games.iter().any(|g| g.appid == appid) {
                                lib.games.push(GameEntry {
                                    appid,
                                    name: format!("Game {}", appid),
                                    image_url: format!("https://cdn.akamai.steamstatic.com/steam/apps/{}/header.jpg", appid),
                                    installed_at: String::new(),
                                    platforms: Vec::new(),
                                    metacritic_score: None,
                                    release_date: String::new(),
                                    review_summary: None,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    save_library(app_handle, &lib).ok();
    lib
}

pub fn add_game(app_handle: &tauri::AppHandle, entry: GameEntry) -> Result<Library, String> {
    let mut lib = load_library(app_handle);
    lib.games.retain(|g| g.appid != entry.appid);
    lib.games.insert(0, entry);
    save_library(app_handle, &lib)?;
    Ok(lib)
}

pub fn remove_game(app_handle: &tauri::AppHandle, appid: u64) -> Result<Library, String> {
    let mut lib = load_library(app_handle);
    lib.games.retain(|g| g.appid != appid);
    save_library(app_handle, &lib)?;
    Ok(lib)
}
