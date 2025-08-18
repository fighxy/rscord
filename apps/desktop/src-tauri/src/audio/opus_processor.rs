use std::sync::{Arc, Mutex};
use tokio::sync::{mpsc, oneshot};
use audiopus::{Encoder, Decoder, Application, SampleRate, Channels, Bitrate};
use log::{info, warn, error, debug};

use crate::audio::{
    AudioConfig, AudioError, AudioResult, AudioRingBuffer, 
    SharedAudioRingBufferI16, SharedAudioRingBufferU8
};

/// Main Opus audio processor for RSCORD
/// Handles encoding, decoding, and audio pipeline management
pub struct OpusAudioProcessor {
    /// Audio configuration
    config: AudioConfig,
    /// Opus encoder for outgoing audio
    encoder: Arc<Mutex<Encoder>>,
    /// Opus decoder for incoming audio
    decoder: Arc<Mutex<Decoder>>,
    /// Input buffer for raw PCM data
    input_buffer: SharedAudioRingBufferI16,
    /// Output buffer for encoded Opus data
    output_buffer: SharedAudioRingBufferU8,
    /// Channel for sending encoded audio packets
    encoded_tx: Option<mpsc::UnboundedSender<Vec<u8>>>,
    /// Channel for receiving raw audio for encoding
    raw_audio_rx: Option<mpsc::UnboundedReceiver<Vec<i16>>>,
    /// Processing thread handle
    processing_handle: Option<tokio::task::JoinHandle<()>>,
    /// State tracking
    is_running: Arc<std::sync::atomic::AtomicBool>,
    /// Statistics
    stats: Arc<Mutex<AudioStats>>,
}

/// Audio processing statistics
#[derive(Debug, Default, Clone)]
pub struct AudioStats {
    pub frames_encoded: u64,
    pub frames_decoded: u64,
    pub encoding_errors: u64,
    pub decoding_errors: u64,
    pub bytes_encoded: u64,
    pub bytes_decoded: u64,
    pub average_encoding_time_us: f64,
    pub average_decoding_time_us: f64,
}

impl OpusAudioProcessor {
    /// Create a new Opus audio processor
    pub fn new(config: AudioConfig) -> AudioResult<Self> {
        // Validate configuration
        config.validate().map_err(AudioError::config)?;
        
        info!("Initializing Opus audio processor with config: {:?}", config);
        
        // Create Opus encoder
        let encoder = Encoder::new(
            config.to_audiopus_sample_rate()?,
            config.to_audiopus_channels()?,
            config.to_audiopus_application(),
        ).map_err(AudioError::from)?;
        
        // Configure encoder settings
        {
            encoder.set_bitrate(config.to_audiopus_bitrate())
                .map_err(AudioError::from)?;
            
            if config.enable_dtx {
                encoder.set_dtx(true).map_err(AudioError::from)?;
            }
            
            if config.enable_fec {
                encoder.set_inband_fec(true).map_err(AudioError::from)?;
            }
            
            // Set complexity (0-10, higher = better quality but more CPU)
            encoder.set_complexity(8).map_err(AudioError::from)?;
            
            // Set packet loss percentage for FEC optimization
            encoder.set_packet_loss_perc(5).map_err(AudioError::from)?;
        }
        
        // Create Opus decoder
        let decoder = Decoder::new(
            config.to_audiopus_sample_rate()?,
            config.to_audiopus_channels()?,
        ).map_err(AudioError::from)?;
        
        // Calculate buffer sizes based on configuration
        let frame_size = config.samples_per_frame();
        let input_buffer_size = frame_size * 10;  // 10 frames buffer
        let output_buffer_size = 4000 * 10;       // 10 encoded frames (~4KB each max)
        
        Ok(OpusAudioProcessor {
            config,
            encoder: Arc::new(Mutex::new(encoder)),
            decoder: Arc::new(Mutex::new(decoder)),
            input_buffer: AudioRingBuffer::new_shared(input_buffer_size),
            output_buffer: AudioRingBuffer::new_shared(output_buffer_size),
            encoded_tx: None,
            raw_audio_rx: None,
            processing_handle: None,
            is_running: Arc::new(std::sync::atomic::AtomicBool::new(false)),
            stats: Arc::new(Mutex::new(AudioStats::default())),
        })
    }
    
    /// Start the audio processing pipeline
    pub fn start(&mut self) -> AudioResult<AudioProcessingChannels> {
        if self.is_running.load(std::sync::atomic::Ordering::Acquire) {
            return Err(AudioError::init("Audio processor already running"));
        }
        
        info!("Starting Opus audio processor");
        
        // Create communication channels
        let (encoded_tx, encoded_rx) = mpsc::unbounded_channel();
        let (raw_audio_tx, raw_audio_rx) = mpsc::unbounded_channel();
        let (decoded_tx, decoded_rx) = mpsc::unbounded_channel();
        
        self.encoded_tx = Some(encoded_tx.clone());
        self.raw_audio_rx = Some(raw_audio_rx);
        
        // Start processing thread
        let processor_handle = self.start_processing_thread(
            encoded_tx,
            raw_audio_tx.clone(),
            decoded_tx.clone(),
        )?;
        
        self.processing_handle = Some(processor_handle);
        self.is_running.store(true, std::sync::atomic::Ordering::Release);
        
        info!("Opus audio processor started successfully");
        
        Ok(AudioProcessingChannels {
            raw_audio_tx,
            encoded_rx,
            decoded_rx,
            incoming_encoded_tx: decoded_tx,
        })
    }
    
    /// Stop the audio processing pipeline
    pub async fn stop(&mut self) -> AudioResult<()> {
        if !self.is_running.load(std::sync::atomic::Ordering::Acquire) {
            return Ok(());
        }
        
        info!("Stopping Opus audio processor");
        
        self.is_running.store(false, std::sync::atomic::Ordering::Release);
        
        // Close channels
        self.encoded_tx = None;
        self.raw_audio_rx = None;
        
        // Wait for processing thread to finish
        if let Some(handle) = self.processing_handle.take() {
            if let Err(e) = handle.await {
                warn!("Processing thread finished with error: {}", e);
            }
        }
        
        info!("Opus audio processor stopped");
        Ok(())
    }
    
    /// Encode raw PCM audio data
    pub fn encode(&self, pcm_data: &[i16]) -> AudioResult<Vec<u8>> {
        let start_time = std::time::Instant::now();
        
        let encoder = self.encoder.lock().unwrap();
        let mut output_buffer = vec![0u8; 4000]; // Max Opus frame size
        
        let encoded_size = encoder.encode(pcm_data, &mut output_buffer)
            .map_err(AudioError::from)?;
        
        output_buffer.truncate(encoded_size);
        
        // Update statistics
        {
            let mut stats = self.stats.lock().unwrap();
            stats.frames_encoded += 1;
            stats.bytes_encoded += encoded_size as u64;
            
            let encoding_time = start_time.elapsed().as_micros() as f64;
            stats.average_encoding_time_us = 
                (stats.average_encoding_time_us * (stats.frames_encoded - 1) as f64 + encoding_time) 
                / stats.frames_encoded as f64;
        }
        
        debug!("Encoded {} samples to {} bytes", pcm_data.len(), encoded_size);
        Ok(output_buffer)
    }
    
    /// Decode Opus audio data to PCM
    pub fn decode(&self, opus_data: &[u8]) -> AudioResult<Vec<i16>> {
        let start_time = std::time::Instant::now();
        
        let decoder = self.decoder.lock().unwrap();
        let max_frame_size = self.config.samples_per_frame();
        let mut output_buffer = vec![0i16; max_frame_size * 2]; // Extra space for safety
        
        let decoded_samples = decoder.decode(opus_data, &mut output_buffer, false)
            .map_err(AudioError::from)?;
        
        output_buffer.truncate(decoded_samples);
        
        // Update statistics
        {
            let mut stats = self.stats.lock().unwrap();
            stats.frames_decoded += 1;
            stats.bytes_decoded += opus_data.len() as u64;
            
            let decoding_time = start_time.elapsed().as_micros() as f64;
            stats.average_decoding_time_us = 
                (stats.average_decoding_time_us * (stats.frames_decoded - 1) as f64 + decoding_time) 
                / stats.frames_decoded as f64;
        }
        
        debug!("Decoded {} bytes to {} samples", opus_data.len(), decoded_samples);
        Ok(output_buffer)
    }
    
    /// Handle packet loss by generating appropriate replacement audio
    pub fn decode_with_fec(&self, opus_data: Option<&[u8]>) -> AudioResult<Vec<i16>> {
        let decoder = self.decoder.lock().unwrap();
        let max_frame_size = self.config.samples_per_frame();
        let mut output_buffer = vec![0i16; max_frame_size * 2];
        
        let decoded_samples = match opus_data {
            Some(data) => {
                // Normal decoding
                decoder.decode(data, &mut output_buffer, false)
                    .map_err(AudioError::from)?
            }
            None => {
                // Packet loss - generate replacement audio
                decoder.decode(&[], &mut output_buffer, true)
                    .map_err(AudioError::from)?
            }
        };
        
        output_buffer.truncate(decoded_samples);
        Ok(output_buffer)
    }
    
    /// Get current audio processing statistics
    pub fn get_stats(&self) -> AudioStats {
        self.stats.lock().unwrap().clone()
    }
    
    /// Reset statistics
    pub fn reset_stats(&self) {
        *self.stats.lock().unwrap() = AudioStats::default();
    }
    
    /// Update audio configuration (requires restart)
    pub fn update_config(&mut self, new_config: AudioConfig) -> AudioResult<()> {
        new_config.validate().map_err(AudioError::config)?;
        
        if self.is_running.load(std::sync::atomic::Ordering::Acquire) {
            return Err(AudioError::config("Cannot update config while processor is running"));
        }
        
        info!("Updating audio configuration: {:?}", new_config);
        self.config = new_config;
        Ok(())
    }
    
    /// Start the main processing thread
    fn start_processing_thread(
        &self,
        encoded_tx: mpsc::UnboundedSender<Vec<u8>>,
        raw_audio_tx: mpsc::UnboundedSender<Vec<i16>>,
        decoded_tx: mpsc::UnboundedSender<Vec<i16>>,
    ) -> AudioResult<tokio::task::JoinHandle<()>> {
        let processor = self.clone_for_thread();
        
        let handle = tokio::spawn(async move {
            processor.processing_loop(encoded_tx, decoded_tx).await;
        });
        
        Ok(handle)
    }
    
    /// Clone processor state for use in processing thread
    fn clone_for_thread(&self) -> OpusProcessorThread {
        OpusProcessorThread {
            config: self.config.clone(),
            encoder: Arc::clone(&self.encoder),
            decoder: Arc::clone(&self.decoder),
            input_buffer: Arc::clone(&self.input_buffer),
            output_buffer: Arc::clone(&self.output_buffer),
            is_running: Arc::clone(&self.is_running),
            stats: Arc::clone(&self.stats),
        }
    }
    
    /// Check if processor is currently running
    pub fn is_running(&self) -> bool {
        self.is_running.load(std::sync::atomic::Ordering::Acquire)
    }
}

/// Thread-safe subset of OpusAudioProcessor for use in processing thread
#[derive(Clone)]
struct OpusProcessorThread {
    config: AudioConfig,
    encoder: Arc<Mutex<Encoder>>,
    decoder: Arc<Mutex<Decoder>>,
    input_buffer: SharedAudioRingBufferI16,
    output_buffer: SharedAudioRingBufferU8,
    is_running: Arc<std::sync::atomic::AtomicBool>,
    stats: Arc<Mutex<AudioStats>>,
}

impl OpusProcessorThread {
    /// Main processing loop
    async fn processing_loop(
        &self,
        encoded_tx: mpsc::UnboundedSender<Vec<u8>>,
        decoded_tx: mpsc::UnboundedSender<Vec<i16>>,
    ) {
        let frame_duration = tokio::time::Duration::from_millis(self.config.frame_duration as u64);
        let mut interval = tokio::time::interval(frame_duration);
        
        info!("Audio processing loop started");
        
        while self.is_running.load(std::sync::atomic::Ordering::Acquire) {
            interval.tick().await;
            
            // Process one frame of audio
            if let Err(e) = self.process_frame(&encoded_tx).await {
                warn!("Frame processing error: {}", e);
                
                // Update error statistics
                {
                    let mut stats = self.stats.lock().unwrap();
                    stats.encoding_errors += 1;
                }
            }
        }
        
        info!("Audio processing loop stopped");
    }
    
    /// Process a single frame of audio
    async fn process_frame(
        &self,
        encoded_tx: &mpsc::UnboundedSender<Vec<u8>>,
    ) -> AudioResult<()> {
        let frame_size = self.config.samples_per_frame();
        let mut pcm_frame = vec![0i16; frame_size];
        
        // Try to read a complete frame from input buffer
        let samples_read = self.input_buffer.try_read(&mut pcm_frame)?;
        
        if samples_read == frame_size {
            // We have a complete frame, encode it
            let encoder = self.encoder.lock().unwrap();
            let mut encoded_buffer = vec![0u8; 4000];
            
            match encoder.encode(&pcm_frame, &mut encoded_buffer) {
                Ok(encoded_size) => {
                    encoded_buffer.truncate(encoded_size);
                    
                    // Send encoded frame
                    if let Err(_) = encoded_tx.send(encoded_buffer) {
                        // Channel closed, stop processing
                        self.is_running.store(false, std::sync::atomic::Ordering::Release);
                    }
                }
                Err(e) => {
                    error!("Encoding error: {}", e);
                    return Err(AudioError::from(e));
                }
            }
        }
        // If we don't have a complete frame, just wait for next tick
        
        Ok(())
    }
}

/// Communication channels for audio processing
pub struct AudioProcessingChannels {
    /// Send raw PCM audio data for encoding
    pub raw_audio_tx: mpsc::UnboundedSender<Vec<i16>>,
    /// Receive encoded Opus audio packets
    pub encoded_rx: mpsc::UnboundedReceiver<Vec<u8>>,
    /// Receive decoded PCM audio data
    pub decoded_rx: mpsc::UnboundedReceiver<Vec<i16>>,
    /// Send incoming encoded data for decoding
    pub incoming_encoded_tx: mpsc::UnboundedSender<Vec<i16>>,
}

// Implement Drop for cleanup
impl Drop for OpusAudioProcessor {
    fn drop(&mut self) {
        if self.is_running.load(std::sync::atomic::Ordering::Acquire) {
            warn!("OpusAudioProcessor dropped while still running");
            self.is_running.store(false, std::sync::atomic::Ordering::Release);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_opus_processor_creation() {
        let config = AudioConfig::voice_chat();
        let processor = OpusAudioProcessor::new(config).unwrap();
        assert!(!processor.is_running());
    }
    
    #[tokio::test]
    async fn test_opus_encode_decode() {
        let config = AudioConfig::voice_chat();
        let processor = OpusAudioProcessor::new(config.clone()).unwrap();
        
        // Generate test audio (sine wave)
        let frame_size = config.samples_per_frame();
        let mut test_audio = vec![0i16; frame_size];
        for i in 0..frame_size {
            test_audio[i] = (16384.0 * (2.0 * std::f64::consts::PI * 440.0 * i as f64 / 48000.0).sin()) as i16;
        }
        
        // Encode
        let encoded = processor.encode(&test_audio).unwrap();
        assert!(!encoded.is_empty());
        
        // Decode
        let decoded = processor.decode(&encoded).unwrap();
        assert_eq!(decoded.len(), test_audio.len());
        
        // Verify audio is similar (not exact due to lossy compression)
        let mut max_diff = 0i16;
        for (original, decoded) in test_audio.iter().zip(decoded.iter()) {
            let diff = (original - decoded).abs();
            max_diff = max_diff.max(diff);
        }
        
        // Opus should maintain reasonable quality for voice
        assert!(max_diff < 8192, "Audio quality degradation too high: {}", max_diff);
    }
    
    #[tokio::test]
    async fn test_opus_fec_decode() {
        let config = AudioConfig::voice_chat();
        let processor = OpusAudioProcessor::new(config.clone()).unwrap();
        
        // Test packet loss handling
        let result = processor.decode_with_fec(None);
        assert!(result.is_ok());
        
        let replacement_audio = result.unwrap();
        assert!(!replacement_audio.is_empty());
    }
    
    #[test]
    fn test_audio_stats() {
        let config = AudioConfig::voice_chat();
        let processor = OpusAudioProcessor::new(config).unwrap();
        
        let stats = processor.get_stats();
        assert_eq!(stats.frames_encoded, 0);
        assert_eq!(stats.frames_decoded, 0);
        
        processor.reset_stats();
        let stats_after_reset = processor.get_stats();
        assert_eq!(stats_after_reset.frames_encoded, 0);
    }
}