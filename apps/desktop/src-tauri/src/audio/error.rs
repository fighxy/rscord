use thiserror::Error;

/// Audio processing error types
#[derive(Error, Debug)]
pub enum AudioError {
    /// Opus codec errors
    #[error("Opus codec error: {0}")]
    OpusError(#[from] audiopus::Error),
    
    /// Audio device errors
    #[error("Audio device error: {0}")]
    DeviceError(#[from] cpal::DeviceNameError),
    
    /// Audio stream errors
    #[error("Audio stream error: {0}")]
    StreamError(#[from] cpal::BuildStreamError),
    
    /// Audio playback errors
    #[error("Audio playback error: {0}")]
    PlayStreamError(#[from] cpal::PlayStreamError),
    
    /// Configuration errors
    #[error("Configuration error: {0}")]
    ConfigError(String),
    
    /// No audio input device available
    #[error("No audio input device available")]
    NoInputDevice,
    
    /// No audio output device available
    #[error("No audio output device available")]
    NoOutputDevice,
    
    /// Unsupported audio format
    #[error("Unsupported audio format: {0}")]
    UnsupportedFormat(String),
    
    /// Buffer overflow/underflow
    #[error("Audio buffer {0}: expected {1} samples, got {2}")]
    BufferError(&'static str, usize, usize),
    
    /// Channel communication errors
    #[error("Channel communication error: {0}")]
    ChannelError(String),
    
    /// Initialization errors
    #[error("Audio system initialization error: {0}")]
    InitializationError(String),
    
    /// Generic I/O errors
    #[error("Audio I/O error: {0}")]
    IoError(#[from] std::io::Error),
    
    /// Ring buffer errors
    #[error("Ring buffer error: {0}")]
    RingBufferError(String),
    
    /// Platform-specific errors
    #[error("Platform-specific audio error: {0}")]
    PlatformError(String),
}

/// Convenient result type for audio operations
pub type AudioResult<T> = Result<T, AudioError>;

impl AudioError {
    /// Create a configuration error
    pub fn config(msg: impl Into<String>) -> Self {
        AudioError::ConfigError(msg.into())
    }
    
    /// Create a channel error
    pub fn channel(msg: impl Into<String>) -> Self {
        AudioError::ChannelError(msg.into())
    }
    
    /// Create an initialization error
    pub fn init(msg: impl Into<String>) -> Self {
        AudioError::InitializationError(msg.into())
    }
    
    /// Create a ring buffer error
    pub fn ring_buffer(msg: impl Into<String>) -> Self {
        AudioError::RingBufferError(msg.into())
    }
    
    /// Create a platform-specific error
    pub fn platform(msg: impl Into<String>) -> Self {
        AudioError::PlatformError(msg.into())
    }
    
    /// Check if error is recoverable
    pub fn is_recoverable(&self) -> bool {
        matches!(
            self,
            AudioError::BufferError(_, _, _)
                | AudioError::ChannelError(_)
                | AudioError::StreamError(_)
                | AudioError::PlayStreamError(_)
        )
    }
    
    /// Check if error requires reinitialization
    pub fn requires_reinit(&self) -> bool {
        matches!(
            self,
            AudioError::NoInputDevice
                | AudioError::NoOutputDevice
                | AudioError::DeviceError(_)
                | AudioError::InitializationError(_)
        )
    }
}

// Convert from various error types that might occur in channels
impl From<tokio::sync::mpsc::error::SendError<Vec<u8>>> for AudioError {
    fn from(err: tokio::sync::mpsc::error::SendError<Vec<u8>>) -> Self {
        AudioError::channel(format!("Failed to send audio data: {}", err))
    }
}

impl<T> From<tokio::sync::mpsc::error::SendError<T>> for AudioError {
    fn from(err: tokio::sync::mpsc::error::SendError<T>) -> Self {
        AudioError::channel(format!("Channel send error: {}", err))
    }
}

impl From<tokio::sync::oneshot::error::RecvError> for AudioError {
    fn from(err: tokio::sync::oneshot::error::RecvError) -> Self {
        AudioError::channel(format!("Oneshot receive error: {}", err))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_error_creation() {
        let config_err = AudioError::config("Invalid sample rate");
        assert!(matches!(config_err, AudioError::ConfigError(_)));
        
        let channel_err = AudioError::channel("Channel closed");
        assert!(matches!(channel_err, AudioError::ChannelError(_)));
    }
    
    #[test]
    fn test_error_classification() {
        let buffer_err = AudioError::BufferError("overflow", 1024, 2048);
        assert!(buffer_err.is_recoverable());
        assert!(!buffer_err.requires_reinit());
        
        let device_err = AudioError::NoInputDevice;
        assert!(!device_err.is_recoverable());
        assert!(device_err.requires_reinit());
    }
}