use regex::Regex;
use std::fs;
use std::io::Read;
use std::path::Path;

use crate::steam::{get_depotcache_dir, get_stplugin_dir};

/// Result of compiling a manifest zip.
#[derive(serde::Serialize, Clone)]
pub struct CompileResult {
    pub success: bool,
    pub appid: Option<u64>,
    pub lua_installed: bool,
    pub manifests_installed: u32,
    pub error: Option<String>,
}

/// Process a downloaded zip file: extract .manifest files to depotcache,
/// process and install .lua file to stplug-in directory.
pub fn compile_manifest_zip(steam_path: &str, zip_bytes: &[u8]) -> CompileResult {
    let stplugin_dir = get_stplugin_dir(steam_path);
    let depotcache_dir = get_depotcache_dir(steam_path);

    // Ensure directories exist
    if let Err(e) = fs::create_dir_all(&stplugin_dir) {
        return CompileResult {
            success: false,
            appid: None,
            lua_installed: false,
            manifests_installed: 0,
            error: Some(format!("Failed to create stplug-in dir: {}", e)),
        };
    }
    if let Err(e) = fs::create_dir_all(&depotcache_dir) {
        return CompileResult {
            success: false,
            appid: None,
            lua_installed: false,
            manifests_installed: 0,
            error: Some(format!("Failed to create depotcache dir: {}", e)),
        };
    }

    let cursor = std::io::Cursor::new(zip_bytes);
    let mut archive = match zip::ZipArchive::new(cursor) {
        Ok(a) => a,
        Err(e) => {
            return CompileResult {
                success: false,
                appid: None,
                lua_installed: false,
                manifests_installed: 0,
                error: Some(format!("Failed to open zip: {}", e)),
            };
        }
    };

    let mut manifests_installed: u32 = 0;
    let mut lua_installed = false;
    let mut appid: Option<u64> = None;

    let lua_pattern = Regex::new(r"^(\d+)\.lua$").unwrap();
    let manifest_id_pattern = Regex::new(r"^\s*setManifestid\(").unwrap();
    let comment_pattern = Regex::new(r"^\s*--").unwrap();

    // First pass: collect file names
    let names: Vec<String> = (0..archive.len())
        .filter_map(|i| archive.by_index(i).ok().map(|f| f.name().to_string()))
        .collect();

    // Extract .manifest files
    for name in &names {
        let basename = Path::new(name)
            .file_name()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_default();

        if basename.to_lowercase().ends_with(".manifest") {
            if let Ok(mut file) = archive.by_name(name) {
                let mut data = Vec::new();
                if file.read_to_end(&mut data).is_ok() {
                    let dest = depotcache_dir.join(&basename);
                    if fs::write(&dest, &data).is_ok() {
                        manifests_installed += 1;
                    }
                }
            }
        }
    }

    // Find and process .lua files
    let mut lua_candidates: Vec<String> = Vec::new();
    for name in &names {
        let basename = Path::new(name)
            .file_name()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_default();

        if lua_pattern.is_match(&basename) {
            lua_candidates.push(name.clone());
            // Extract appid from filename
            if appid.is_none() {
                if let Some(caps) = lua_pattern.captures(&basename) {
                    if let Some(id_str) = caps.get(1) {
                        appid = id_str.as_str().parse::<u64>().ok();
                    }
                }
            }
        }
    }

    // Prefer {appid}.lua if we found an appid
    let chosen_lua = if let Some(aid) = appid {
        let preferred = format!("{}.lua", aid);
        lua_candidates
            .iter()
            .find(|n| {
                Path::new(n)
                    .file_name()
                    .map(|f| f.to_string_lossy().to_string())
                    .unwrap_or_default()
                    == preferred
            })
            .cloned()
            .or_else(|| lua_candidates.first().cloned())
    } else {
        lua_candidates.first().cloned()
    };

    if let Some(lua_name) = chosen_lua {
        if let Ok(mut file) = archive.by_name(&lua_name) {
            let mut data = Vec::new();
            if file.read_to_end(&mut data).is_ok() {
                let text = String::from_utf8_lossy(&data).to_string();

                // Process lua: comment out setManifestid() calls
                let processed: String = text
                    .lines()
                    .map(|line| {
                        if manifest_id_pattern.is_match(line) && !comment_pattern.is_match(line) {
                            format!("--{}", line)
                        } else {
                            line.to_string()
                        }
                    })
                    .collect::<Vec<_>>()
                    .join("\n");

                // Extract appid from lua filename if not already set
                if appid.is_none() {
                    let basename = Path::new(&lua_name)
                        .file_name()
                        .map(|f| f.to_string_lossy().to_string())
                        .unwrap_or_default();
                    if let Some(caps) = lua_pattern.captures(&basename) {
                        if let Some(id_str) = caps.get(1) {
                            appid = id_str.as_str().parse::<u64>().ok();
                        }
                    }
                }

                if let Some(aid) = appid {
                    let dest = stplugin_dir.join(format!("{}.lua", aid));
                    if fs::write(&dest, &processed).is_ok() {
                        lua_installed = true;
                    }
                }
            }
        }
    }

    CompileResult {
        success: lua_installed || manifests_installed > 0,
        appid,
        lua_installed,
        manifests_installed,
        error: if !lua_installed && manifests_installed == 0 {
            Some("No .lua or .manifest files found in zip".to_string())
        } else {
            None
        },
    }
}

/// Install a raw .lua file into stplug-in directory.
pub fn install_lua_file(steam_path: &str, lua_content: &[u8], appid: u64) -> Result<(), String> {
    let stplugin_dir = get_stplugin_dir(steam_path);
    fs::create_dir_all(&stplugin_dir).map_err(|e| format!("Failed to create dir: {}", e))?;

    let text = String::from_utf8_lossy(lua_content).to_string();
    let manifest_id_pattern = Regex::new(r"^\s*setManifestid\(").unwrap();
    let comment_pattern = Regex::new(r"^\s*--").unwrap();

    let processed: String = text
        .lines()
        .map(|line| {
            if manifest_id_pattern.is_match(line) && !comment_pattern.is_match(line) {
                format!("--{}", line)
            } else {
                line.to_string()
            }
        })
        .collect::<Vec<_>>()
        .join("\n");

    let dest = stplugin_dir.join(format!("{}.lua", appid));
    fs::write(&dest, &processed).map_err(|e| format!("Failed to write lua: {}", e))
}

/// Install a raw .manifest file into depotcache directory.
pub fn install_manifest_file(
    steam_path: &str,
    manifest_content: &[u8],
    filename: &str,
) -> Result<(), String> {
    let depotcache_dir = get_depotcache_dir(steam_path);
    fs::create_dir_all(&depotcache_dir).map_err(|e| format!("Failed to create dir: {}", e))?;

    let dest = depotcache_dir.join(filename);
    fs::write(&dest, manifest_content).map_err(|e| format!("Failed to write manifest: {}", e))
}

/// Remove a game's lua and manifest files.
pub fn remove_game_files(steam_path: &str, appid: u64) -> Result<(), String> {
    let stplugin_dir = get_stplugin_dir(steam_path);
    let lua_file = stplugin_dir.join(format!("{}.lua", appid));
    let disabled_file = stplugin_dir.join(format!("{}.lua.disabled", appid));

    if lua_file.exists() {
        fs::remove_file(&lua_file).map_err(|e| format!("Failed to remove lua: {}", e))?;
    }
    if disabled_file.exists() {
        fs::remove_file(&disabled_file)
            .map_err(|e| format!("Failed to remove disabled lua: {}", e))?;
    }

    Ok(())
}

/// Check if a game has lua files installed.
pub fn has_lua_for_app(steam_path: &str, appid: u64) -> bool {
    let stplugin_dir = get_stplugin_dir(steam_path);
    let lua_file = stplugin_dir.join(format!("{}.lua", appid));
    let disabled_file = stplugin_dir.join(format!("{}.lua.disabled", appid));
    lua_file.exists() || disabled_file.exists()
}
