use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use tauri::{State, Manager, Window, Emitter};
use tokio::sync::{mpsc, RwLock};
use uuid::Uuid;
use log::{info, warn, error, debug};
use serde::{Serialize, Deserialize};

use crate::audio::{
    AudioConfig, AudioError, AudioResult, OpusAudioProcessor, 
    AudioStreamManager, AudioStats, AudioRingBuffer
};

/// Global audio manager state
pub struct AudioManager {
    /// Current audio processor
    processor: Arc<RwLock<Option<OpusAudioProcessor>>>,
    /// Current stream manager
    stream_manager: Arc<RwLock<Option<AudioStreamManager>>>,
    /// Active sessions (peer_id -> session info)
    active_sessions: Arc<RwLock<HashMap<String, VoiceSession>>>,
    /// Current configuration
    current_config: Arc<RwLock<AudioConfig>>,
    /// Processing channels
    channels: Arc<RwLock<Option<ProcessingChannels>>>,
}

/// Voice session information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceSession {
    pub peer_id: String,
    pub channel_id: String,
    pub is_muted: bool,
    pub is_deafened: bool,
    pub connected_at: String,
}

/// Processing channels for audio pipeline
struct ProcessingChannels {
    raw_audio_tx: mpsc::UnboundedSender<Vec<i16>>,
    encoded_rx: Arc<Mutex<mpsc::UnboundedReceiver<Vec<u8>>>>,
    decoded_rx: Arc<Mutex<mpsc::UnboundedReceiver<Vec<i16>>>>,
    incoming_encoded_tx: mpsc::UnboundedSender<Vec<i16>>,
}

/// Audio devices list
#[derive(Debug, Serialize, Deserialize)]
pub struct AudioDevicesList {
    pub input_devices: Vec<String>,
    pub output_devices: Vec<String>,
    pub current_input_device: Option<String>,
    pub current_output_device: Option<String>,
}

/// Decoded audio event for frontend
#[derive(Debug, Serialize, Deserialize)]
pub struct DecodedAudioEvent {
    pub peer_id: String,
    pub samples: Vec<i16>,
    pub sample_rate: u32,
    pub channels: u32,
}

impl Default for AudioManager {
    fn default() -> Self {
        AudioManager {
            processor: Arc::new(RwLock::new(None)),
            stream_manager: Arc::new(RwLock::new(None)),
            active_sessions: Arc::new(RwLock::new(HashMap::new())),
            current_config: Arc::new(RwLock::new(AudioConfig::voice_chat())),
            channels: Arc::new(RwLock::new(None)),
        }
    }
}

/// Initialize the audio system
#[tauri::command]
pub async fn initialize_audio_system(
    config: AudioConfig,
    window: Window,
    audio_manager: State<'_, AudioManager>,
) -> Result<String, String> {
    info!("Initializing audio system with config: {:?}", config);
    
    // Validate configuration
    config.validate().map_err(|e| format!("Invalid audio config: {}", e))?;
    
    // Create audio processor
    let processor = OpusAudioProcessor::new(config.clone())
        .map_err(|e| format!("Failed to create audio processor: {}", e))?;
    
    // Create stream manager
    let mut stream_manager = AudioStreamManager::new(config.clone())
        .map_err(|e| format!("Failed to create stream manager: {}", e))?;
    
    // Initialize audio devices
    stream_manager.initialize_devices()
        .map_err(|e| format!("Failed to initialize audio devices: {}", e))?;
    
    // Store in state
    *audio_manager.processor.write().await = Some(processor);
    *audio_manager.stream_manager.write().await = Some(stream_manager);
    *audio_manager.current_config.write().await = config;
    
    info!("Audio system initialized successfully");
    Ok("Audio system initialized".to_string())
}

/// Start voice capture and processing
#[tauri::command]
pub async fn start_voice_capture(
    window: Window,
    audio_manager: State<'_, AudioManager>,
) -> Result<String, String> {
    info!("Starting voice capture");
    
    let mut processor_guard = audio_manager.processor.write().await;
    let processor = processor_guard.as_mut()
        .ok_or("Audio system not initialized")?;
    
    // Start audio processor
    let channels = processor.start()
        .map_err(|e| format!("Failed to start audio processor: {}", e))?;
    
    // Setup input audio stream
    let config = audio_manager.current_config.read().await.clone();
    let input_buffer = AudioRingBuffer::new_shared(config.samples_per_frame() * 10);
    
    let mut stream_manager_guard = audio_manager.stream_manager.write().await;
    let stream_manager = stream_manager_guard.as_mut()
        .ok_or("Stream manager not initialized")?;
    
    stream_manager.start_input_stream(input_buffer.clone())
        .map_err(|e| format!("Failed to start input stream: {}", e))?;
    
    // Setup event forwarding for encoded audio
    let window_clone = window.clone();
    let encoded_rx = Arc::new(Mutex::new(channels.encoded_rx));
    let encoded_rx_clone = Arc::clone(&encoded_rx);
    
    tokio::spawn(async move {
        let mut rx = encoded_rx_clone.lock().unwrap();
        while let Some(encoded_packet) = rx.recv().await {
            // Emit encoded audio packet to frontend
            if let Err(e) = window_clone.emit("opus-audio-packet", &encoded_packet) {
                warn!("Failed to emit audio packet: {}", e);
                break;
            }
        }
    });
    
    // Store processing channels
    *audio_manager.channels.write().await = Some(ProcessingChannels {
        raw_audio_tx: channels.raw_audio_tx,
        encoded_rx,
        decoded_rx: Arc::new(Mutex::new(channels.decoded_rx)),
        incoming_encoded_tx: channels.incoming_encoded_tx,
    });
    
    info!("Voice capture started successfully");
    Ok("Voice capture started".to_string())
}

/// Stop voice capture and processing
#[tauri::command]
pub async fn stop_voice_capture(
    audio_manager: State<'_, AudioManager>,
) -> Result<String, String> {
    info!("Stopping voice capture");
    
    // Stop audio processor
    let mut processor_guard = audio_manager.processor.write().await;
    if let Some(processor) = processor_guard.as_mut() {
        processor.stop().await
            .map_err(|e| format!("Failed to stop audio processor: {}", e))?;
    }
    
    // Stop stream manager
    let mut stream_manager_guard = audio_manager.stream_manager.write().await;
    if let Some(stream_manager) = stream_manager_guard.as_mut() {
        stream_manager.stop_streams()
            .map_err(|e| format!("Failed to stop audio streams: {}", e))?;
    }
    
    // Clear processing channels
    *audio_manager.channels.write().await = None;
    
    info!("Voice capture stopped successfully");
    Ok("Voice capture stopped".to_string())
}

/// Process incoming encoded audio from remote peer
#[tauri::command]
pub async fn process_incoming_audio(
    encoded_data: Vec<u8>,
    peer_id: String,
    window: Window,
    audio_manager: State<'_, AudioManager>,
) -> Result<(), String> {
    debug!("Processing incoming audio from peer: {}", peer_id);
    
    let processor_guard = audio_manager.processor.read().await;
    let processor = processor_guard.as_ref()
        .ok_or("Audio system not initialized")?;
    
    // Decode the incoming audio
    let decoded_samples = processor.decode(&encoded_data)
        .map_err(|e| format!("Failed to decode audio: {}", e))?;
    
    // Emit decoded audio for playback
    if let Err(e) = window.emit("decoded-audio-samples", &DecodedAudioEvent {
        peer_id,
        samples: decoded_samples,
        sample_rate: audio_manager.current_config.read().await.sample_rate,
        channels: audio_manager.current_config.read().await.channels,
    }) {
        warn!("Failed to emit decoded audio: {}", e);
    }
    
    Ok(())
}

/// Get current audio statistics
#[tauri::command]
pub async fn get_audio_stats(
    audio_manager: State<'_, AudioManager>,
) -> Result<AudioStats, String> {
    let processor_guard = audio_manager.processor.read().await;
    let processor = processor_guard.as_ref()
        .ok_or("Audio system not initialized")?;
    
    Ok(processor.get_stats())
}

/// Reset audio statistics
#[tauri::command]
pub async fn reset_audio_stats(
    audio_manager: State<'_, AudioManager>,
) -> Result<String, String> {
    let processor_guard = audio_manager.processor.read().await;
    let processor = processor_guard.as_ref()
        .ok_or("Audio system not initialized")?;
    
    processor.reset_stats();
    Ok("Audio statistics reset".to_string())
}

/// List available audio devices
#[tauri::command]
pub async fn list_audio_devices(
    audio_manager: State<'_, AudioManager>,
) -> Result<AudioDevicesList, String> {
    let stream_manager_guard = audio_manager.stream_manager.read().await;
    let stream_manager = stream_manager_guard.as_ref()
        .ok_or("Stream manager not initialized")?;
    
    let (input_devices, output_devices) = stream_manager.list_devices()
        .map_err(|e| format!("Failed to list audio devices: {}", e))?;
    
    let (current_input, current_output) = stream_manager.get_device_info()
        .map_err(|e| format!("Failed to get current device info: {}", e))?;
    
    Ok(AudioDevicesList {
        input_devices,
        output_devices,
        current_input_device: current_input,
        current_output_device: current_output,
    })
}

/// Set audio input device
#[tauri::command]
pub async fn set_audio_input_device(
    device_name: String,
    audio_manager: State<'_, AudioManager>,
) -> Result<String, String> {
    info!("Setting audio input device to: {}", device_name);
    
    let mut stream_manager_guard = audio_manager.stream_manager.write().await;
    let stream_manager = stream_manager_guard.as_mut()
        .ok_or("Stream manager not initialized")?;
    
    stream_manager.set_input_device(&device_name)
        .map_err(|e| format!("Failed to set input device: {}", e))?;
    
    Ok(format!("Input device set to: {}", device_name))
}

/// Set audio output device
#[tauri::command]
pub async fn set_audio_output_device(
    device_name: String,
    audio_manager: State<'_, AudioManager>,
) -> Result<String, String> {
    info!("Setting audio output device to: {}", device_name);
    
    let mut stream_manager_guard = audio_manager.stream_manager.write().await;
    let stream_manager = stream_manager_guard.as_mut()
        .ok_or("Stream manager not initialized")?;
    
    stream_manager.set_output_device(&device_name)
        .map_err(|e| format!("Failed to set output device: {}", e))?;
    
    Ok(format!("Output device set to: {}", device_name))
}

/// Update audio configuration
#[tauri::command]
pub async fn update_audio_config(
    new_config: AudioConfig,
    audio_manager: State<'_, AudioManager>,
) -> Result<String, String> {
    info!("Updating audio configuration: {:?}", new_config);
    
    // Validate new configuration
    new_config.validate().map_err(|e| format!("Invalid audio config: {}", e))?;
    
    // Check if processor is running
    let processor_guard = audio_manager.processor.read().await;
    if let Some(processor) = processor_guard.as_ref() {
        if processor.is_running() {
            return Err("Cannot update configuration while audio system is running".to_string());
        }
    }
    drop(processor_guard);
    
    // Update configuration
    *audio_manager.current_config.write().await = new_config.clone();
    
    // Update stream manager configuration
    let mut stream_manager_guard = audio_manager.stream_manager.write().await;
    if let Some(stream_manager) = stream_manager_guard.as_mut() {
        stream_manager.update_config(new_config.clone())
            .map_err(|e| format!("Failed to update stream manager config: {}", e))?;
    }
    
    // Update processor configuration
    let mut processor_guard = audio_manager.processor.write().await;
    if let Some(processor) = processor_guard.as_mut() {
        processor.update_config(new_config)
            .map_err(|e| format!("Failed to update processor config: {}", e))?;
    }
    
    info!("Audio configuration updated successfully");
    Ok("Audio configuration updated".to_string())
}

/// Join voice channel
#[tauri::command]
pub async fn join_voice_channel(
    channel_id: String,
    peer_id: String,
    audio_manager: State<'_, AudioManager>,
) -> Result<String, String> {
    info!("Joining voice channel: {} as peer: {}", channel_id, peer_id);
    
    let session = VoiceSession {
        peer_id: peer_id.clone(),
        channel_id: channel_id.clone(),
        is_muted: false,
        is_deafened: false,
        connected_at: chrono::Utc::now().to_rfc3339(),
    };
    
    let mut sessions = audio_manager.active_sessions.write().await;
    sessions.insert(peer_id.clone(), session);
    
    Ok(format!("Joined voice channel: {}", channel_id))
}

/// Leave voice channel
#[tauri::command]
pub async fn leave_voice_channel(
    peer_id: String,
    audio_manager: State<'_, AudioManager>,
) -> Result<String, String> {
    info!("Leaving voice channel for peer: {}", peer_id);
    
    let mut sessions = audio_manager.active_sessions.write().await;
    sessions.remove(&peer_id);
    
    Ok("Left voice channel".to_string())
}

/// Toggle mute status
#[tauri::command]
pub async fn toggle_mute(
    peer_id: String,
    audio_manager: State<'_, AudioManager>,
) -> Result<bool, String> {
    info!("Toggling mute for peer: {}", peer_id);
    
    let mut sessions = audio_manager.active_sessions.write().await;
    if let Some(session) = sessions.get_mut(&peer_id) {
        session.is_muted = !session.is_muted;
        Ok(session.is_muted)
    } else {
        Err("Voice session not found".to_string())
    }
}

/// Toggle deafen status
#[tauri::command]
pub async fn toggle_deafen(
    peer_id: String,
    audio_manager: State<'_, AudioManager>,
) -> Result<bool, String> {
    info!("Toggling deafen for peer: {}", peer_id);
    
    let mut sessions = audio_manager.active_sessions.write().await;
    if let Some(session) = sessions.get_mut(&peer_id) {
        session.is_deafened = !session.is_deafened;
        // If deafened, also mute
        if session.is_deafened {
            session.is_muted = true;
        }
        Ok(session.is_deafened)
    } else {
        Err("Voice session not found".to_string())
    }
}

/// Get current voice sessions
#[tauri::command]
pub async fn get_voice_sessions(
    audio_manager: State<'_, AudioManager>,
) -> Result<HashMap<String, VoiceSession>, String> {
    let sessions = audio_manager.active_sessions.read().await;
    Ok(sessions.clone())
}

/// Check if audio system is running
#[tauri::command]
pub async fn is_audio_system_running(
    audio_manager: State<'_, AudioManager>,
) -> Result<bool, String> {
    let processor_guard = audio_manager.processor.read().await;
    if let Some(processor) = processor_guard.as_ref() {
        Ok(processor.is_running())
    } else {
        Ok(false)
    }
}

/// Get current audio configuration
#[tauri::command]
pub async fn get_audio_config(
    audio_manager: State<'_, AudioManager>,
) -> Result<AudioConfig, String> {
    let config = audio_manager.current_config.read().await;
    Ok(config.clone())
}

/// Test audio system with a sine wave
#[tauri::command]
pub async fn test_audio_system(
    frequency: f64,
    duration_ms: u32,
    audio_manager: State<'_, AudioManager>,
) -> Result<String, String> {
    info!("Testing audio system with {}Hz sine wave for {}ms", frequency, duration_ms);
    
    let config = audio_manager.current_config.read().await.clone();
    let processor_guard = audio_manager.processor.read().await;
    let processor = processor_guard.as_ref()
        .ok_or("Audio system not initialized")?;
    
    // Generate test audio (sine wave)
    let sample_rate = config.sample_rate as f64;
    let samples_needed = (sample_rate * duration_ms as f64 / 1000.0) as usize;
    let mut test_audio = vec![0i16; samples_needed];
    
    for i in 0..samples_needed {
        let t = i as f64 / sample_rate;
        let sample = (16384.0 * (2.0 * std::f64::consts::PI * frequency * t).sin()) as i16;
        test_audio[i] = sample;
    }
    
    // Test encode/decode cycle
    let frame_size = config.samples_per_frame();
    let mut total_encoded_bytes = 0;
    
    for chunk in test_audio.chunks(frame_size) {
        if chunk.len() == frame_size {
            let encoded = processor.encode(chunk)
                .map_err(|e| format!("Encoding test failed: {}", e))?;
            total_encoded_bytes += encoded.len();
            
            let decoded = processor.decode(&encoded)
                .map_err(|e| format!("Decoding test failed: {}", e))?;
            
            if decoded.len() != chunk.len() {
                return Err("Decode length mismatch".to_string());
            }
        }
    }
    
    let compression_ratio = test_audio.len() * 2 / total_encoded_bytes;
    
    Ok(format!(
        "Audio test completed successfully. Compression ratio: {}:1, Total frames: {}", 
        compression_ratio,
        test_audio.len() / frame_size
    ))
}