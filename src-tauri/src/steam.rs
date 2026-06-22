use std::path::{Path, PathBuf};

/// Detect the Steam installation path based on the current platform.
pub fn detect_steam_path() -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        detect_steam_path_windows()
    }
    #[cfg(target_os = "macos")]
    {
        detect_steam_path_macos(false)
    }
    #[cfg(target_os = "linux")]
    {
        detect_steam_path_linux()
    }
}

/// Detect Steam path on macOS. If `crossover` is true, look in CrossOver bottles.
pub fn detect_steam_path_macos(crossover: bool) -> Option<String> {
    if crossover {
        detect_steam_path_crossover()
    } else {
        let home = dirs::home_dir()?;
        let steam_path = home.join("Library/Application Support/Steam");
        if steam_path.exists() {
            Some(steam_path.to_string_lossy().to_string())
        } else {
            None
        }
    }
}

/// Scan CrossOver bottles for a Steam installation.
fn detect_steam_path_crossover() -> Option<String> {
    let home = dirs::home_dir()?;
    let bottles_dir = home.join("Library/Application Support/CrossOver/Bottles");
    if !bottles_dir.exists() {
        return None;
    }

    if let Ok(entries) = std::fs::read_dir(&bottles_dir) {
        for entry in entries.flatten() {
            let bottle_path = entry.path();
            if bottle_path.is_dir() {
                let steam_path = bottle_path.join("drive_c/Program Files (x86)/Steam");
                if steam_path.exists() {
                    return Some(steam_path.to_string_lossy().to_string());
                }
            }
        }
    }
    None
}

#[cfg(target_os = "windows")]
fn detect_steam_path_windows() -> Option<String> {
    use std::process::Command;
    // Try registry via reg query
    let output = Command::new("reg")
        .args(["query", r"HKCU\Software\Valve\Steam", "/v", "SteamPath"])
        .output()
        .ok()?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        if line.contains("SteamPath") {
            let parts: Vec<&str> = line.split("REG_SZ").collect();
            if parts.len() > 1 {
                let path = parts[1].trim().to_string();
                if Path::new(&path).exists() {
                    return Some(path);
                }
            }
        }
    }
    // Fallback to default path
    let default = PathBuf::from(r"C:\Program Files (x86)\Steam");
    if default.exists() {
        return Some(default.to_string_lossy().to_string());
    }
    None
}

#[cfg(target_os = "linux")]
fn detect_steam_path_linux() -> Option<String> {
    let home = dirs::home_dir()?;
    let candidates = vec![
        home.join(".steam/steam"),
        home.join(".local/share/Steam"),
    ];
    for candidate in candidates {
        if candidate.exists() {
            return Some(candidate.to_string_lossy().to_string());
        }
    }
    None
}

/// Validate that a given path is a valid Steam installation.
pub fn validate_steam_path(path: &str) -> bool {
    let p = Path::new(path);
    p.exists() && p.join("steamapps").exists()
}

/// Get the stplug-in directory path.
pub fn get_stplugin_dir(steam_path: &str) -> PathBuf {
    Path::new(steam_path).join("config").join("stplug-in")
}

/// Get the depotcache directory path.
pub fn get_depotcache_dir(steam_path: &str) -> PathBuf {
    Path::new(steam_path).join("depotcache")
}
