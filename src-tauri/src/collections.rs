use std::fs;
use std::path::{Path, PathBuf};

const LUA_DEPOT_TAG: &str = "Lua Depot";

// ── VDF types ──────────────────────────────────────────

#[derive(Debug, Clone)]
enum Vdf {
    Str(String),
    Map(Vec<(String, Vdf)>),
}

// ── Tokenizer ──────────────────────────────────────────

fn tokenize(input: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let bytes = input.as_bytes();
    let len = bytes.len();
    let mut i = 0;

    while i < len {
        match bytes[i] {
            b'"' => {
                i += 1;
                let mut s = String::new();
                while i < len && bytes[i] != b'"' {
                    if bytes[i] == b'\\' && i + 1 < len {
                        i += 1;
                        s.push(bytes[i] as char);
                    } else {
                        s.push(bytes[i] as char);
                    }
                    i += 1;
                }
                if i < len { i += 1; }
                tokens.push(s);
            }
            b'{' => { tokens.push("{".into()); i += 1; }
            b'}' => { tokens.push("}".into()); i += 1; }
            b'/' if i + 1 < len && bytes[i + 1] == b'/' => {
                while i < len && bytes[i] != b'\n' { i += 1; }
            }
            b'/' if i + 1 < len && bytes[i + 1] == b'*' => {
                i += 2;
                while i + 1 < len && !(bytes[i] == b'*' && bytes[i + 1] == b'/') { i += 1; }
                i += 2;
            }
            b' ' | b'\t' | b'\r' | b'\n' => { i += 1; }
            _ => { i += 1; }
        }
    }
    tokens
}

// ── Parser ─────────────────────────────────────────────

fn parse(tokens: &[String], pos: &mut usize) -> Vdf {
    let mut entries = Vec::new();

    while *pos < tokens.len() {
        if tokens[*pos] == "}" {
            *pos += 1;
            break;
        }
        if *pos + 1 >= tokens.len() { break; }

        let key = tokens[*pos].clone();
        *pos += 1;

        if tokens[*pos] == "{" {
            *pos += 1;
            let val = parse(tokens, pos);
            entries.push((key, val));
        } else {
            let val = Vdf::Str(tokens[*pos].clone());
            *pos += 1;
            entries.push((key, val));
        }
    }

    Vdf::Map(entries)
}

fn parse_vdf(input: &str) -> Result<Vdf, String> {
    let tokens = tokenize(input);
    if tokens.is_empty() {
        return Err("Empty VDF".into());
    }
    let mut pos = 0;
    Ok(parse(&tokens, &mut pos))
}

// ── Serializer ─────────────────────────────────────────

fn esc(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"")
}

fn serialize_entries(entries: &[(String, Vdf)], indent: usize) -> String {
    let pad = " ".repeat(indent);
    let mut out = String::new();

    for (key, val) in entries {
        match val {
            Vdf::Str(s) => {
                out.push_str(&format!("\"{}\"  \"{}\"\n", esc(key), esc(s)));
            }
            Vdf::Map(inner) => {
                out.push_str(&format!("\"{}\"\n{}{{\n", esc(key), pad));
                out.push_str(&serialize_entries(inner, indent + 4));
                out.push_str(&format!("{}}}\n", pad));
            }
        }
    }
    out
}

fn serialize_vdf(vdf: &Vdf) -> String {
    match vdf {
        Vdf::Map(entries) => {
            if let Some((key, Vdf::Map(inner))) = entries.first() {
                format!("\"{}\"\n{{\n{}}}", esc(key), serialize_entries(inner, 4))
            } else {
                serialize_entries(entries, 0)
            }
        }
        Vdf::Str(s) => esc(s),
    }
}

// ── Navigation ─────────────────────────────────────────

fn navigate_mut<'a>(vdf: &'a mut Vdf, path: &[&str]) -> Option<&'a mut Vdf> {
    if path.is_empty() { return Some(vdf); }
    match vdf {
        Vdf::Map(entries) => {
            for i in 0..entries.len() {
                if entries[i].0 == path[0] {
                    return navigate_mut(&mut entries[i].1, &path[1..]);
                }
            }
            None
        }
        _ => None,
    }
}

fn get_or_create<'a>(vdf: &'a mut Vdf, path: &[&str]) -> &'a mut Vdf {
    let mut current = vdf;
    for key in path {
        match current {
            Vdf::Map(entries) => {
                let mut found_idx = None;
                for i in 0..entries.len() {
                    if entries[i].0 == *key {
                        found_idx = Some(i);
                        break;
                    }
                }
                if let Some(idx) = found_idx {
                    current = &mut entries[idx].1;
                } else {
                    entries.push((key.to_string(), Vdf::Map(Vec::new())));
                    let last = entries.len() - 1;
                    current = &mut entries[last].1;
                }
            }
            _ => unreachable!(),
        }
    }
    current
}

// ── Public API ─────────────────────────────────────────

fn find_sharedconfig_path(steam_path: &str) -> Option<PathBuf> {
    let userdata_dir = Path::new(steam_path).join("userdata");
    if !userdata_dir.exists() { return None; }

    let mut best: Option<(u64, PathBuf)> = None;

    if let Ok(entries) = fs::read_dir(&userdata_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() { continue; }

            let name = match path.file_name().and_then(|n| n.to_str()) {
                Some(n) => n,
                None => continue,
            };
            if name.is_empty() || !name.chars().all(|c| c.is_ascii_digit()) { continue; }

            let uid: u64 = name.parse().unwrap_or(0);
            let config = path.join("7/remote/sharedconfig.vdf");
            if config.exists() {
                match &best {
                    Some((best_uid, _)) if uid <= *best_uid => {}
                    _ => best = Some((uid, config)),
                }
            }
        }
    }

    best.map(|(_, p)| p)
}

fn ensure_config_path(steam_path: &str) -> Result<PathBuf, String> {
    if let Some(p) = find_sharedconfig_path(steam_path) {
        return Ok(p);
    }

    let userdata_dir = Path::new(steam_path).join("userdata");
    let user_dir = fs::read_dir(&userdata_dir)
        .ok()
        .and_then(|entries| {
            entries
                .flatten()
                .find(|e| {
                    e.path().is_dir()
                        && e.file_name().to_string_lossy()
                            .chars().all(|c| c.is_ascii_digit())
                })
                .map(|e| e.path())
        })
        .unwrap_or_else(|| userdata_dir.join("0"));

    let remote = user_dir.join("7/remote");
    fs::create_dir_all(&remote).map_err(|e| format!("Failed to create dir: {}", e))?;
    Ok(remote.join("sharedconfig.vdf"))
}

/// Add a game appid to the "Lua Depot" collection in Steam sharedconfig.vdf
pub fn add_game_to_collection(steam_path: &str, appid: u64) -> Result<(), String> {
    let config_path = ensure_config_path(steam_path)?;

    let mut vdf = if config_path.exists() {
        let content = fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read sharedconfig.vdf: {}", e))?;
        parse_vdf(&content)?
    } else {
        Vdf::Map(vec![
            ("sharedconfig.vdf".to_string(), Vdf::Map(vec![
                ("UserRoamingConfigStore".to_string(), Vdf::Map(vec![
                    ("Software".to_string(), Vdf::Map(vec![
                        ("Valve".to_string(), Vdf::Map(vec![
                            ("Apps".to_string(), Vdf::Map(Vec::new())),
                        ])),
                    ])),
                ])),
            ])),
        ])
    };

    let apps = get_or_create(&mut vdf, &[
        "sharedconfig.vdf", "UserRoamingConfigStore", "Software", "Valve", "Apps"
    ]);

    let appid_key = appid.to_string();

    match apps {
        Vdf::Map(entries) => {
            let app_node = entries.iter_mut().find(|(k, _)| *k == appid_key);

            match app_node {
                Some((_, node)) => {
                    let tags = get_or_create(node, &["tags"]);
                    if let Vdf::Map(tag_entries) = tags {
                        let has = tag_entries.iter().any(|(_, v)| {
                            matches!(v, Vdf::Str(s) if s == LUA_DEPOT_TAG)
                        });
                        if !has {
                            let idx = tag_entries.len();
                            tag_entries.push((idx.to_string(), Vdf::Str(LUA_DEPOT_TAG.to_string())));
                        }
                    }
                }
                None => {
                    entries.push((appid_key, Vdf::Map(vec![
                        ("tags".to_string(), Vdf::Map(vec![
                            ("0".to_string(), Vdf::Str(LUA_DEPOT_TAG.to_string())),
                        ])),
                    ])));
                }
            }
        }
        _ => return Err("Invalid VDF structure".into()),
    }

    let output = serialize_vdf(&vdf);
    fs::write(&config_path, &output)
        .map_err(|e| format!("Failed to write sharedconfig.vdf: {}", e))?;

    Ok(())
}

/// Remove a game from the "Lua Depot" collection
pub fn remove_game_from_collection(steam_path: &str, appid: u64) -> Result<(), String> {
    let config_path = match find_sharedconfig_path(steam_path) {
        Some(p) => p,
        None => return Ok(()),
    };

    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read sharedconfig.vdf: {}", e))?;
    let mut vdf = parse_vdf(&content)?;

    let apps_path = ["sharedconfig.vdf", "UserRoamingConfigStore", "Software", "Valve", "Apps"];
    if let Some(apps) = navigate_mut(&mut vdf, &apps_path) {
        let appid_key = appid.to_string();
        if let Vdf::Map(entries) = apps {
            if let Some((_, node)) = entries.iter_mut().find(|(k, _)| *k == appid_key) {
                if let Some(tags) = navigate_mut(node, &["tags"]) {
                    if let Vdf::Map(tag_entries) = tags {
                        tag_entries.retain(|(_, v)| !matches!(v, Vdf::Str(s) if s == LUA_DEPOT_TAG));
                    }
                }
            }
        }
    }

    let output = serialize_vdf(&vdf);
    fs::write(&config_path, &output)
        .map_err(|e| format!("Failed to write sharedconfig.vdf: {}", e))?;

    Ok(())
}
