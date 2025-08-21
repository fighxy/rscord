// Audio device types for Tauri integration

export interface AudioDevice {
  id: string;
  name: string;
  is_default: boolean;
  device_type: 'input' | 'output';
  supported_configs: string[];
}

export interface MicrophoneTestResult {
  status: 'available' | 'no_device' | 'error';
  device_name?: string;
  sample_rate?: string;
  channels?: string;
  format?: string;
  config_error?: string;
  name_error?: string;
}

export interface AudioSettings {
  input_device_id?: string;
  output_device_id?: string;
  echo_cancellation: boolean;
  noise_suppression: boolean;
  auto_gain_control: boolean;
  input_volume: number;
  output_volume: number;
}

export interface SystemAudioInfo {
  os: string;
  arch: string;
  family: string;
  audio_backend: string;
  voice_system: string;
  audio_host: string;
}

// Audio API functions
export interface AudioAPI {
  getAudioDevices: () => Promise<AudioDevice[]>;
  getDefaultAudioDevices: () => Promise<Record<string, string>>;
  testMicrophone: () => Promise<MicrophoneTestResult>;
  getSystemInfo: () => Promise<SystemAudioInfo>;
}