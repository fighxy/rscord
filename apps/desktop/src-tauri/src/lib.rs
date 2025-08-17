use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;

// Storage structure
#[derive(Default)]
struct Storage {
    data: Mutex<HashMap<String, String>>,
}

// Commands for storage operations
#[tauri::command]
fn get_storage(key: String, storage: State<Storage>) -> Option<String> {
    let data = storage.data.lock().unwrap();
    data.get(&key).cloned()
}

#[tauri::command]
fn set_storage(key: String, value: String, storage: State<Storage>) -> Result<(), String> {
    let mut data = storage.data.lock().unwrap();
    data.insert(key, value);
    Ok(())
}

#[tauri::command]
fn remove_storage(key: String, storage: State<Storage>) -> Result<(), String> {
    let mut data = storage.data.lock().unwrap();
    data.remove(&key);
    Ok(())
}

#[tauri::command]
fn clear_storage(storage: State<Storage>) -> Result<(), String> {
    let mut data = storage.data.lock().unwrap();
    data.clear();
    Ok(())
}

// Server status check command
#[tauri::command]
async fn check_server_status() -> Result<bool, String> {
    let client = reqwest::Client::new();
    let url = "http://5.35.83.143:14700/health";
    
    match client.get(url).send().await {
        Ok(response) => Ok(response.status().is_success()),
        Err(e) => {
            eprintln!("Server check failed: {}", e);
            Ok(false)
        }
    }
}

// System info command
#[tauri::command]
fn get_system_info() -> HashMap<String, String> {
    let mut info = HashMap::new();
    info.insert("os".to_string(), std::env::consts::OS.to_string());
    info.insert("arch".to_string(), std::env::consts::ARCH.to_string());
    info.insert("family".to_string(), std::env::consts::FAMILY.to_string());
    info
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Storage::default())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_storage,
            set_storage,
            remove_storage,
            clear_storage,
            check_server_status,
            get_system_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
