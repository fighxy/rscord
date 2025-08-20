pub mod opus_processor;
pub mod audio_config;
pub mod audio_stream;
pub mod ring_buffer;
pub mod error;

// Re-export main types for easier use
pub use opus_processor::OpusAudioProcessor;
pub use audio_config::AudioConfig;
pub use audio_stream::{AudioStream, AudioStreamManager};
pub use ring_buffer::AudioRingBuffer;
pub use error::{AudioError, AudioResult};