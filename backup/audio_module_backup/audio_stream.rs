use std::sync::{Arc, Mutex};
use cpal::{Device, Stream, StreamConfig, SampleFormat, SampleRate as CpalSampleRate};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use tokio::sync::{mpsc, oneshot};
use log::{info, warn, error, debug};

use crate::audio::{AudioConfig, AudioError, AudioResult, SharedAudioRingBufferI16};

/// Audio stream wrapper for CPAL streams
pub struct AudioStream {
    _input_stream: Option<Stream>,
    _output_stream: Option<Stream>,
    is_active: Arc<std::sync::atomic::AtomicBool>,
}

impl AudioStream {
    pub fn is_active(&self) -> bool {
        self.is_active.load(std::sync::atomic::Ordering::Acquire)
    }
    
    pub fn stop(&mut self) {
        self.is_active.store(false, std::sync::atomic::Ordering::Release);
        self._input_stream = None;
        self._output_stream = None;
    }
}

/// Manages audio input/output streams using CPAL
pub struct AudioStreamManager {
    host: cpal::Host,
    input_device: Option<Device>,
    output_device: Option<Device>,
    config: AudioConfig,
    current_stream: Option<AudioStream>,
}

impl AudioStreamManager {
    /// Create a new audio stream manager
    pub fn new(config: AudioConfig) -> AudioResult<Self> {
        let host = cpal::default_host();
        
        info!("Initializing audio stream manager with host: {}", host.id().name());
        
        Ok(AudioStreamManager {
            host,
            input_device: None,
            output_device: None,
            config,
            current_stream: None,
        })
    }
    
    /// Initialize audio devices
    pub fn initialize_devices(&mut self) -> AudioResult<()> {
        info!("Initializing audio devices");
        
        // Get default input device
        self.input_device = self.host.default_input_device()
            .ok_or(AudioError::NoInputDevice)?
            .into();
        
        // Get default output device
        self.output_device = self.host.default_output_device()
            .ok_or(AudioError::NoOutputDevice)?
            .into();
        
        if let Some(ref device) = self.input_device {
            info!("Input device: {}", device.name().unwrap_or("Unknown".to_string()));
        }
        
        if let Some(ref device) = self.output_device {
            info!("Output device: {}", device.name().unwrap_or("Unknown".to_string()));
        }
        
        Ok(())
    }
    
    /// List available audio devices
    pub fn list_devices(&self) -> AudioResult<(Vec<String>, Vec<String>)> {
        let mut input_devices = Vec::new();
        let mut output_devices = Vec::new();
        
        // List input devices
        let input_device_iter = self.host.input_devices()
            .map_err(|e| AudioError::platform(format!("Failed to enumerate input devices: {}", e)))?;
        
        for device in input_device_iter {
            if let Ok(name) = device.name() {
                input_devices.push(name);
            }
        }
        
        // List output devices
        let output_device_iter = self.host.output_devices()
            .map_err(|e| AudioError::platform(format!("Failed to enumerate output devices: {}", e)))?;
        
        for device in output_device_iter {
            if let Ok(name) = device.name() {
                output_devices.push(name);
            }
        }
        
        Ok((input_devices, output_devices))
    }
    
    /// Start audio capture stream
    pub fn start_input_stream(
        &mut self,
        audio_buffer: SharedAudioRingBufferI16,
    ) -> AudioResult<()> {
        let input_device = self.input_device.as_ref()
            .ok_or(AudioError::NoInputDevice)?;
        
        info!("Starting input audio stream");
        
        // Get optimal input configuration
        let supported_config = input_device.default_input_config()
            .map_err(AudioError::from)?;
        
        let stream_config = self.build_stream_config(&supported_config)?;
        
        info!("Input stream config: {:?}", stream_config);
        
        // Create input stream
        let input_stream = match supported_config.sample_format() {
            SampleFormat::F32 => {
                self.create_input_stream_f32(input_device, &stream_config, audio_buffer)?
            }
            SampleFormat::I16 => {
                self.create_input_stream_i16(input_device, &stream_config, audio_buffer)?
            }
            SampleFormat::U16 => {
                return Err(AudioError::UnsupportedFormat("U16 not supported".to_string()));
            }
            _ => {
                return Err(AudioError::UnsupportedFormat("Unknown sample format".to_string()));
            }
        };
        
        // Start the stream
        input_stream.play().map_err(AudioError::from)?;
        
        let is_active = Arc::new(std::sync::atomic::AtomicBool::new(true));
        
        self.current_stream = Some(AudioStream {
            _input_stream: Some(input_stream),
            _output_stream: None,
            is_active,
        });
        
        info!("Input audio stream started successfully");
        Ok(())
    }
    
    /// Start audio playback stream
    pub fn start_output_stream(
        &mut self,
        audio_buffer: SharedAudioRingBufferI16,
    ) -> AudioResult<()> {
        let output_device = self.output_device.as_ref()
            .ok_or(AudioError::NoOutputDevice)?;
        
        info!("Starting output audio stream");
        
        // Get optimal output configuration
        let supported_config = output_device.default_output_config()
            .map_err(AudioError::from)?;
        
        let stream_config = self.build_stream_config(&supported_config)?;
        
        info!("Output stream config: {:?}", stream_config);
        
        // Create output stream
        let output_stream = match supported_config.sample_format() {
            SampleFormat::F32 => {
                self.create_output_stream_f32(output_device, &stream_config, audio_buffer)?
            }
            SampleFormat::I16 => {
                self.create_output_stream_i16(output_device, &stream_config, audio_buffer)?
            }
            SampleFormat::U16 => {
                return Err(AudioError::UnsupportedFormat("U16 not supported".to_string()));
            }
            _ => {
                return Err(AudioError::UnsupportedFormat("Unknown sample format".to_string()));
            }
        };
        
        // Start the stream
        output_stream.play().map_err(AudioError::from)?;
        
        let is_active = Arc::new(std::sync::atomic::AtomicBool::new(true));
        
        if let Some(ref mut current) = self.current_stream {
            current._output_stream = Some(output_stream);
        } else {
            self.current_stream = Some(AudioStream {
                _input_stream: None,
                _output_stream: Some(output_stream),
                is_active,
            });
        }
        
        info!("Output audio stream started successfully");
        Ok(())
    }
    
    /// Stop all active streams
    pub fn stop_streams(&mut self) -> AudioResult<()> {
        if let Some(ref mut stream) = self.current_stream {
            stream.stop();
        }
        self.current_stream = None;
        info!("All audio streams stopped");
        Ok(())
    }
    
    /// Check if streams are active
    pub fn is_active(&self) -> bool {
        self.current_stream.as_ref()
            .map(|s| s.is_active())
            .unwrap_or(false)
    }
    
    /// Build stream configuration from supported config
    fn build_stream_config(&self, supported: &cpal::SupportedStreamConfig) -> AudioResult<StreamConfig> {
        let sample_rate = CpalSampleRate(self.config.sample_rate);
        let channels = self.config.channels as u16;
        let buffer_size = cpal::BufferSize::Fixed(self.config.buffer_size);
        
        Ok(StreamConfig {
            channels,
            sample_rate,
            buffer_size,
        })
    }
    
    /// Create F32 input stream
    fn create_input_stream_f32(
        &self,
        device: &Device,
        config: &StreamConfig,
        audio_buffer: SharedAudioRingBufferI16,
    ) -> AudioResult<Stream> {
        let channels = config.channels as usize;
        let conversion_buffer = Arc::new(Mutex::new(Vec::<i16>::new()));
        
        let stream = device.build_input_stream(
            config,
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                // Convert F32 to I16
                let mut conv_buffer = conversion_buffer.lock().unwrap();
                conv_buffer.clear();
                conv_buffer.reserve(data.len());
                
                for &sample in data {
                    let i16_sample = (sample.clamp(-1.0, 1.0) * 32767.0) as i16;
                    conv_buffer.push(i16_sample);
                }
                
                // Write to ring buffer
                if let Err(e) = audio_buffer.try_write(&conv_buffer) {
                    warn!("Failed to write audio data to buffer: {}", e);
                }
            },
            move |err| {
                error!("Input stream error: {}", err);
            },
            None,
        ).map_err(AudioError::from)?;
        
        Ok(stream)
    }
    
    /// Create I16 input stream
    fn create_input_stream_i16(
        &self,
        device: &Device,
        config: &StreamConfig,
        audio_buffer: SharedAudioRingBufferI16,
    ) -> AudioResult<Stream> {
        let stream = device.build_input_stream(
            config,
            move |data: &[i16], _: &cpal::InputCallbackInfo| {
                // Direct write of I16 data
                if let Err(e) = audio_buffer.try_write(data) {
                    warn!("Failed to write audio data to buffer: {}", e);
                }
            },
            move |err| {
                error!("Input stream error: {}", err);
            },
            None,
        ).map_err(AudioError::from)?;
        
        Ok(stream)
    }
    
    /// Create F32 output stream
    fn create_output_stream_f32(
        &self,
        device: &Device,
        config: &StreamConfig,
        audio_buffer: SharedAudioRingBufferI16,
    ) -> AudioResult<Stream> {
        let stream = device.build_output_stream(
            config,
            move |data: &mut [f32], _: &cpal::OutputCallbackInfo| {
                // Create temporary buffer for reading
                let mut i16_buffer = vec![0i16; data.len()];
                
                // Try to read data from ring buffer
                match audio_buffer.try_read(&mut i16_buffer) {
                    Ok(samples_read) => {
                        // Convert I16 to F32
                        for i in 0..samples_read {
                            data[i] = i16_buffer[i] as f32 / 32767.0;
                        }
                        
                        // Fill remaining with silence
                        for i in samples_read..data.len() {
                            data[i] = 0.0;
                        }
                    }
                    Err(e) => {
                        warn!("Failed to read audio data from buffer: {}", e);
                        // Fill with silence on error
                        for sample in data.iter_mut() {
                            *sample = 0.0;
                        }
                    }
                }
            },
            move |err| {
                error!("Output stream error: {}", err);
            },
            None,
        ).map_err(AudioError::from)?;
        
        Ok(stream)
    }
    
    /// Create I16 output stream
    fn create_output_stream_i16(
        &self,
        device: &Device,
        config: &StreamConfig,
        audio_buffer: SharedAudioRingBufferI16,
    ) -> AudioResult<Stream> {
        let stream = device.build_output_stream(
            config,
            move |data: &mut [i16], _: &cpal::OutputCallbackInfo| {
                // Try to read data directly
                match audio_buffer.try_read(data) {
                    Ok(samples_read) => {
                        // Fill remaining with silence
                        for i in samples_read..data.len() {
                            data[i] = 0;
                        }
                    }
                    Err(e) => {
                        warn!("Failed to read audio data from buffer: {}", e);
                        // Fill with silence on error
                        for sample in data.iter_mut() {
                            *sample = 0;
                        }
                    }
                }
            },
            move |err| {
                error!("Output stream error: {}", err);
            },
            None,
        ).map_err(AudioError::from)?;
        
        Ok(stream)
    }
    
    /// Get current audio device information
    pub fn get_device_info(&self) -> AudioResult<(Option<String>, Option<String>)> {
        let input_name = if let Some(ref device) = self.input_device {
            device.name().ok()
        } else {
            None
        };
        
        let output_name = if let Some(ref device) = self.output_device {
            device.name().ok()
        } else {
            None
        };
        
        Ok((input_name, output_name))
    }
    
    /// Set specific input device by name
    pub fn set_input_device(&mut self, device_name: &str) -> AudioResult<()> {
        let devices = self.host.input_devices()
            .map_err(|e| AudioError::platform(format!("Failed to enumerate input devices: {}", e)))?;
        
        for device in devices {
            if let Ok(name) = device.name() {
                if name == device_name {
                    self.input_device = Some(device);
                    info!("Set input device to: {}", device_name);
                    return Ok(());
                }
            }
        }
        
        Err(AudioError::platform(format!("Input device '{}' not found", device_name)))
    }
    
    /// Set specific output device by name
    pub fn set_output_device(&mut self, device_name: &str) -> AudioResult<()> {
        let devices = self.host.output_devices()
            .map_err(|e| AudioError::platform(format!("Failed to enumerate output devices: {}", e)))?;
        
        for device in devices {
            if let Ok(name) = device.name() {
                if name == device_name {
                    self.output_device = Some(device);
                    info!("Set output device to: {}", device_name);
                    return Ok(());
                }
            }
        }
        
        Err(AudioError::platform(format!("Output device '{}' not found", device_name)))
    }
    
    /// Update audio configuration
    pub fn update_config(&mut self, new_config: AudioConfig) -> AudioResult<()> {
        new_config.validate().map_err(AudioError::config)?;
        
        if self.is_active() {
            return Err(AudioError::config("Cannot update config while streams are active"));
        }
        
        self.config = new_config;
        Ok(())
    }
}

impl Drop for AudioStreamManager {
    fn drop(&mut self) {
        if let Err(e) = self.stop_streams() {
            warn!("Error stopping streams during drop: {}", e);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::audio::AudioRingBuffer;
    
    #[test]
    fn test_audio_stream_manager_creation() {
        let config = AudioConfig::voice_chat();
        let manager = AudioStreamManager::new(config);
        assert!(manager.is_ok());
        
        let manager = manager.unwrap();
        assert!(!manager.is_active());
    }
    
    #[test]
    fn test_device_listing() {
        let config = AudioConfig::voice_chat();
        let manager = AudioStreamManager::new(config).unwrap();
        
        let result = manager.list_devices();
        // Should not fail even if no devices are available
        assert!(result.is_ok());
        
        let (input_devices, output_devices) = result.unwrap();
        println!("Input devices: {:?}", input_devices);
        println!("Output devices: {:?}", output_devices);
    }
    
    #[tokio::test]
    async fn test_stream_lifecycle() {
        let config = AudioConfig::voice_chat();
        let mut manager = AudioStreamManager::new(config).unwrap();
        
        // Try to initialize devices (might fail in test environment)
        if manager.initialize_devices().is_ok() {
            let audio_buffer = AudioRingBuffer::new_shared(1024);
            
            // Try to start input stream
            let result = manager.start_input_stream(audio_buffer);
            if result.is_ok() {
                assert!(manager.is_active());
                
                // Stop streams
                manager.stop_streams().unwrap();
                assert!(!manager.is_active());
            }
        }
    }
}