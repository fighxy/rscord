use serde::{Deserialize, Serialize};
use audiopus::{SampleRate, Channels, Bitrate, Application};

/// Configuration for Opus audio processing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioConfig {
    /// Sample rate (48kHz recommended for voice chat)
    pub sample_rate: u32,
    /// Number of channels (1 = mono, 2 = stereo)
    pub channels: u32,
    /// Bitrate in bits per second
    pub bitrate: u32,
    /// Frame duration in milliseconds (10, 20, 40, 60ms)
    pub frame_duration: u32,
    /// Enable Discontinuous Transmission (silence detection)
    pub enable_dtx: bool,
    /// Enable Forward Error Correction
    pub enable_fec: bool,
    /// Audio application type
    pub application: AudioApplication,
    /// Audio device buffer size in frames
    pub buffer_size: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AudioApplication {
    /// General purpose audio (music, mixed content)
    Audio,
    /// Voice over IP applications (optimized for speech)
    VoIP,
    /// Low-delay applications (gaming, real-time communication)
    LowDelay,
}

impl Default for AudioConfig {
    fn default() -> Self {
        AudioConfig {
            sample_rate: 48000,       // 48kHz - standard for VoIP
            channels: 2,              // Stereo for better quality
            bitrate: 40000,           // 40 kbps - good balance
            frame_duration: 20,       // 20ms frames for low latency
            enable_dtx: true,         // Save bandwidth during silence
            enable_fec: true,         // Packet loss protection
            application: AudioApplication::VoIP,
            buffer_size: Self::get_optimal_buffer_size(),
        }
    }
}

impl AudioConfig {
    /// Create configuration optimized for voice chat
    pub fn voice_chat() -> Self {
        AudioConfig {
            sample_rate: 48000,
            channels: 1,              // Mono for voice
            bitrate: 32000,           // 32 kbps sufficient for voice
            frame_duration: 20,
            enable_dtx: true,
            enable_fec: true,
            application: AudioApplication::VoIP,
            buffer_size: Self::get_optimal_buffer_size(),
        }
    }
    
    /// Create configuration optimized for music/high quality
    pub fn high_quality() -> Self {
        AudioConfig {
            sample_rate: 48000,
            channels: 2,              // Stereo for music
            bitrate: 64000,           // Higher bitrate for quality
            frame_duration: 20,
            enable_dtx: false,        // Don't cut music during quiet parts
            enable_fec: true,
            application: AudioApplication::Audio,
            buffer_size: Self::get_optimal_buffer_size(),
        }
    }
    
    /// Create configuration optimized for low latency
    pub fn low_latency() -> Self {
        AudioConfig {
            sample_rate: 48000,
            channels: 1,
            bitrate: 24000,           // Lower bitrate for speed
            frame_duration: 10,       // 10ms frames for minimal latency
            enable_dtx: true,
            enable_fec: false,        // Disable FEC for lower latency
            application: AudioApplication::LowDelay,
            buffer_size: 64,          // Smaller buffer for low latency
        }
    }
    
    /// Validate configuration parameters
    pub fn validate(&self) -> Result<(), String> {
        // Validate sample rate
        if ![8000, 12000, 16000, 24000, 48000].contains(&self.sample_rate) {
            return Err("Invalid sample rate. Supported: 8000, 12000, 16000, 24000, 48000".to_string());
        }
        
        // Validate channels
        if self.channels < 1 || self.channels > 2 {
            return Err("Channels must be 1 (mono) or 2 (stereo)".to_string());
        }
        
        // Validate frame duration
        if ![10, 20, 40, 60].contains(&self.frame_duration) {
            return Err("Frame duration must be 10, 20, 40, or 60 ms".to_string());
        }
        
        // Validate bitrate range
        if self.bitrate < 6000 || self.bitrate > 510000 {
            return Err("Bitrate must be between 6000 and 510000 bps".to_string());
        }
        
        Ok(())
    }
    
    /// Get optimal buffer size for the current platform
    pub fn get_optimal_buffer_size() -> u32 {
        #[cfg(target_os = "windows")]
        {
            256  // ~5.3ms at 48kHz, good balance for Windows
        }
        
        #[cfg(target_os = "macos")]
        {
            128  // ~2.7ms at 48kHz, macOS handles small buffers well
        }
        
        #[cfg(target_os = "linux")]
        {
            512  // ~10.7ms at 48kHz, conservative for Linux compatibility
        }
        
        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        {
            256  // Default fallback
        }
    }
    
    /// Calculate samples per frame based on configuration
    pub fn samples_per_frame(&self) -> usize {
        (self.sample_rate as usize * self.frame_duration as usize / 1000) * self.channels as usize
    }
    
    /// Calculate bytes per frame for PCM data (16-bit samples)
    pub fn bytes_per_frame(&self) -> usize {
        self.samples_per_frame() * 2  // 16-bit = 2 bytes per sample
    }
}

// Convert to audiopus types
impl AudioConfig {
    pub fn to_audiopus_sample_rate(&self) -> Result<SampleRate, String> {
        match self.sample_rate {
            8000 => Ok(SampleRate::Hz8000),
            12000 => Ok(SampleRate::Hz12000),
            16000 => Ok(SampleRate::Hz16000),
            24000 => Ok(SampleRate::Hz24000),
            48000 => Ok(SampleRate::Hz48000),
            _ => Err(format!("Unsupported sample rate: {}", self.sample_rate)),
        }
    }
    
    pub fn to_audiopus_channels(&self) -> Result<Channels, String> {
        match self.channels {
            1 => Ok(Channels::Mono),
            2 => Ok(Channels::Stereo),
            _ => Err(format!("Unsupported channel count: {}", self.channels)),
        }
    }
    
    pub fn to_audiopus_application(&self) -> Application {
        match self.application {
            AudioApplication::Audio => Application::Audio,
            AudioApplication::VoIP => Application::Voip,
            AudioApplication::LowDelay => Application::LowDelay,
        }
    }
    
    pub fn to_audiopus_bitrate(&self) -> Bitrate {
        Bitrate::BitsPerSecond(self.bitrate as i32)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_default_config_validation() {
        let config = AudioConfig::default();
        assert!(config.validate().is_ok());
    }
    
    #[test]
    fn test_voice_chat_config() {
        let config = AudioConfig::voice_chat();
        assert_eq!(config.channels, 1);
        assert_eq!(config.application, AudioApplication::VoIP);
        assert!(config.validate().is_ok());
    }
    
    #[test]
    fn test_samples_per_frame_calculation() {
        let config = AudioConfig {
            sample_rate: 48000,
            channels: 2,
            frame_duration: 20,
            ..Default::default()
        };
        
        // 48000 samples/sec * 0.02 sec * 2 channels = 1920 samples
        assert_eq!(config.samples_per_frame(), 1920);
        assert_eq!(config.bytes_per_frame(), 3840);  // 1920 * 2 bytes
    }
    
    #[test]
    fn test_invalid_config() {
        let mut config = AudioConfig::default();
        config.sample_rate = 44100;  // Unsupported
        assert!(config.validate().is_err());
        
        config.sample_rate = 48000;  // Fix sample rate
        config.channels = 3;         // Invalid channel count
        assert!(config.validate().is_err());
    }
}