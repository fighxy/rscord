use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;
use cpal::traits::{DeviceTrait, HostTrait};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioDevice {
    pub id: String,
    pub name: String,
    pub is_default: bool,
    pub device_type: String, // "input" or "output"
    pub supported_configs: Vec<String>,
}

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

// Audio devices commands
#[tauri::command]
fn get_audio_devices() -> Result<Vec<AudioDevice>, String> {
    let host = cpal::default_host();
    let mut devices = Vec::new();
    
    // Get input devices
    match host.input_devices() {
        Ok(input_devices) => {
            let default_input = host.default_input_device();
            
            for device in input_devices {
                match device.name() {
                    Ok(_name) => {
                        let device_name = device.name().unwrap_or_else(|_| "Unknown Device".to_string());
                        let is_default = default_input.as_ref()
                            .map(|default| default.name().unwrap_or_default() == device_name)
                            .unwrap_or(false);
                        
                        let supported_configs = match device.supported_input_configs() {
                            Ok(configs) => {
                                configs.map(|config| {
                                    format!("{}Hz, {} channels, {:?}", 
                                        config.max_sample_rate().0,
                                        config.channels(),
                                        config.sample_format())
                                }).collect()
                            },
                            Err(_) => vec!["Unknown".to_string()]
                        };
                        
                        devices.push(AudioDevice {
                            id: format!("input_{}", devices.len()),
                            name: device_name,
                            is_default,
                            device_type: "input".to_string(),
                            supported_configs,
                        });
                    }
                    Err(e) => {
                        log::warn!("Failed to get input device name: {}", e);
                    }
                }
            }
        }
        Err(e) => {
            log::error!("Failed to enumerate input devices: {}", e);
            return Err(format!("Failed to get input devices: {}", e));
        }
    }
    
    // Get output devices
    match host.output_devices() {
        Ok(output_devices) => {
            let default_output = host.default_output_device();
            
            for device in output_devices {
                match device.name() {
                    Ok(_name) => {
                        let device_name = device.name().unwrap_or_else(|_| "Unknown Device".to_string());
                        let is_default = default_output.as_ref()
                            .map(|default| default.name().unwrap_or_default() == device_name)
                            .unwrap_or(false);
                        
                        let supported_configs = match device.supported_output_configs() {
                            Ok(configs) => {
                                configs.map(|config| {
                                    format!("{}Hz, {} channels, {:?}", 
                                        config.max_sample_rate().0,
                                        config.channels(),
                                        config.sample_format())
                                }).collect()
                            },
                            Err(_) => vec!["Unknown".to_string()]
                        };
                        
                        devices.push(AudioDevice {
                            id: format!("output_{}", devices.len()),
                            name: device_name,
                            is_default,
                            device_type: "output".to_string(),
                            supported_configs,
                        });
                    }
                    Err(e) => {
                        log::warn!("Failed to get output device name: {}", e);
                    }
                }
            }
        }
        Err(e) => {
            log::error!("Failed to enumerate output devices: {}", e);
            return Err(format!("Failed to get output devices: {}", e));
        }
    }
    
    Ok(devices)
}

#[tauri::command]
fn get_default_audio_devices() -> Result<HashMap<String, String>, String> {
    let host = cpal::default_host();
    let mut defaults = HashMap::new();
    
    // Get default input device
    if let Some(default_input) = host.default_input_device() {
        match default_input.name() {
            Ok(name) => {
                defaults.insert("input".to_string(), name);
            }
            Err(e) => {
                log::warn!("Failed to get default input device name: {}", e);
                defaults.insert("input".to_string(), "Unknown".to_string());
            }
        }
    } else {
        defaults.insert("input".to_string(), "None".to_string());
    }
    
    // Get default output device
    if let Some(default_output) = host.default_output_device() {
        match default_output.name() {
            Ok(name) => {
                defaults.insert("output".to_string(), name);
            }
            Err(e) => {
                log::warn!("Failed to get default output device name: {}", e);
                defaults.insert("output".to_string(), "Unknown".to_string());
            }
        }
    } else {
        defaults.insert("output".to_string(), "None".to_string());
    }
    
    Ok(defaults)
}

#[tauri::command]
fn test_microphone() -> Result<HashMap<String, String>, String> {
    let host = cpal::default_host();
    let mut result = HashMap::new();
    
    match host.default_input_device() {
        Some(device) => {
            match device.name() {
                Ok(name) => {
                    result.insert("device_name".to_string(), name);
                    result.insert("status".to_string(), "available".to_string());
                    
                    // Test if we can get supported configs
                    match device.supported_input_configs() {
                        Ok(mut configs) => {
                            if let Some(config) = configs.next() {
                                result.insert("sample_rate".to_string(), config.max_sample_rate().0.to_string());
                                result.insert("channels".to_string(), config.channels().to_string());
                                result.insert("format".to_string(), format!("{:?}", config.sample_format()));
                            }
                        }
                        Err(e) => {
                            result.insert("config_error".to_string(), e.to_string());
                        }
                    }
                }
                Err(e) => {
                    result.insert("name_error".to_string(), e.to_string());
                    result.insert("status".to_string(), "error".to_string());
                }
            }
        }
        None => {
            result.insert("status".to_string(), "no_device".to_string());
        }
    }
    
    Ok(result)
}

// System info command
#[tauri::command]
fn get_system_info() -> HashMap<String, String> {
    let mut info = HashMap::new();
    info.insert("os".to_string(), std::env::consts::OS.to_string());
    info.insert("arch".to_string(), std::env::consts::ARCH.to_string());
    info.insert("family".to_string(), std::env::consts::FAMILY.to_string());
    
    // Audio system info
    info.insert("audio_backend".to_string(), "CPAL + LiveKit + WebRTC".to_string());
    info.insert("voice_system".to_string(), "LiveKit Server".to_string());
    
    // Audio host info
    let host = cpal::default_host();
    info.insert("audio_host".to_string(), format!("{:?}", host.id()));
    
    info
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging
    env_logger::init();
    
    log::info!("Starting RSCORD Desktop Application");
    log::info!("Audio system: LiveKit with WebRTC");
    
    tauri::Builder::default()
        .manage(Storage::default())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            // Storage commands
            get_storage,
            set_storage,
            remove_storage,
            clear_storage,
            
            // System commands
            check_server_status,
            get_system_info,
            
            // Audio commands
            get_audio_devices,
            get_default_audio_devices,
            test_microphone
        ])
        .setup(|_app| {
            log::info!("RSCORD Desktop setup completed");
            log::info!("Voice communication via LiveKit ready");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}