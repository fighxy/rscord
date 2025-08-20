import React, { useState, useEffect } from 'react';
import { audioManager, AudioConfig, AudioStats, AudioDevicesList, AudioUtils } from '../lib/audio/audioManager';

interface AudioTestComponentProps {
  className?: string;
}

export const AudioTestComponent: React.FC<AudioTestComponentProps> = ({ className = '' }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [audioStats, setAudioStats] = useState<AudioStats | null>(null);
  const [devices, setDevices] = useState<AudioDevicesList | null>(null);
  const [config, setConfig] = useState<AudioConfig>(AudioUtils.createVoiceChatConfig());
  const [testResult, setTestResult] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // Setup event listeners
    audioManager.on('voice-capture-started', () => {
      setIsCapturing(true);
      setError('');
    });

    audioManager.on('voice-capture-stopped', () => {
      setIsCapturing(false);
    });

    audioManager.on('audio-packet-encoded', (data: number[]) => {
      console.log('Encoded audio packet received:', data.length, 'bytes');
    });

    audioManager.on('audio-packet-decoded', (data: any) => {
      console.log('Decoded audio packet received from peer:', data.peer_id);
    });

    // Cleanup
    return () => {
      audioManager.off('voice-capture-started', () => {});
      audioManager.off('voice-capture-stopped', () => {});
      audioManager.off('audio-packet-encoded', () => {});
      audioManager.off('audio-packet-decoded', () => {});
    };
  }, []);

  const handleInitialize = async () => {
    try {
      setError('');
      await audioManager.initialize(config);
      setIsInitialized(true);
      
      // Load devices list
      const devicesList = await audioManager.listAudioDevices();
      setDevices(devicesList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize audio system');
    }
  };

  const handleStartCapture = async () => {
    try {
      setError('');
      await audioManager.startVoiceCapture();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start voice capture');
    }
  };

  const handleStopCapture = async () => {
    try {
      setError('');
      await audioManager.stopVoiceCapture();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop voice capture');
    }
  };

  const handleGetStats = async () => {
    try {
      const stats = await audioManager.getAudioStats();
      setAudioStats(stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get audio stats');
    }
  };

  const handleTestAudio = async () => {
    try {
      setError('');
      setTestResult('Running audio test...');
      const result = await audioManager.testAudioSystem(440, 2000); // 440Hz for 2 seconds
      setTestResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Audio test failed');
      setTestResult('');
    }
  };

  const handleConfigChange = async () => {
    try {
      setError('');
      await audioManager.updateConfig(config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update configuration');
    }
  };

  return (
    <div className={`audio-test-component p-6 ${className}`}>
      <div className="glass-panel rounded-2xl p-6 space-y-6">
        <h2 className="text-2xl font-bold text-white mb-4">🎤 RSCORD Audio System Test</h2>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-200">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Initialization */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">System Initialization</h3>
          <div className="flex gap-4">
            <button
              onClick={handleInitialize}
              disabled={isInitialized}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 text-white rounded-lg transition-colors"
            >
              {isInitialized ? '✅ Initialized' : 'Initialize Audio System'}
            </button>
            
            <div className="flex items-center">
              <span className={`w-3 h-3 rounded-full mr-2 ${isInitialized ? 'bg-green-500' : 'bg-red-500'}`}></span>
              <span className="text-white/80">
                Status: {isInitialized ? 'Ready' : 'Not Initialized'}
              </span>
            </div>
          </div>
        </div>

        {/* Audio Configuration */}
        {isInitialized && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Audio Configuration</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-white/80 text-sm mb-1">Sample Rate</label>
                <select
                  value={config.sample_rate}
                  onChange={(e) => setConfig({...config, sample_rate: parseInt(e.target.value)})}
                  className="w-full p-2 bg-white/10 border border-white/20 rounded text-white"
                >
                  <option value={8000}>8 kHz</option>
                  <option value={16000}>16 kHz</option>
                  <option value={24000}>24 kHz</option>
                  <option value={48000}>48 kHz</option>
                </select>
              </div>
              
              <div>
                <label className="block text-white/80 text-sm mb-1">Channels</label>
                <select
                  value={config.channels}
                  onChange={(e) => setConfig({...config, channels: parseInt(e.target.value)})}
                  className="w-full p-2 bg-white/10 border border-white/20 rounded text-white"
                >
                  <option value={1}>Mono</option>
                  <option value={2}>Stereo</option>
                </select>
              </div>
              
              <div>
                <label className="block text-white/80 text-sm mb-1">Bitrate (bps)</label>
                <input
                  type="number"
                  value={config.bitrate}
                  onChange={(e) => setConfig({...config, bitrate: parseInt(e.target.value)})}
                  className="w-full p-2 bg-white/10 border border-white/20 rounded text-white"
                  min={6000}
                  max={510000}
                />
              </div>
              
              <div>
                <label className="block text-white/80 text-sm mb-1">Application</label>
                <select
                  value={config.application}
                  onChange={(e) => setConfig({...config, application: e.target.value as any})}
                  className="w-full p-2 bg-white/10 border border-white/20 rounded text-white"
                >
                  <option value="VoIP">VoIP</option>
                  <option value="Audio">Audio</option>
                  <option value="LowDelay">Low Delay</option>
                </select>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleConfigChange}
                className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
              >
                Update Configuration
              </button>
              
              <button
                onClick={() => setConfig(AudioUtils.createVoiceChatConfig())}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Voice Chat Preset
              </button>
              
              <button
                onClick={() => setConfig(AudioUtils.createHighQualityConfig())}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                High Quality Preset
              </button>
            </div>
          </div>
        )}

        {/* Voice Capture Controls */}
        {isInitialized && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Voice Capture</h3>
            <div className="flex gap-4 items-center">
              <button
                onClick={handleStartCapture}
                disabled={isCapturing}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-500 text-white rounded-lg transition-colors"
              >
                {isCapturing ? '🎤 Recording...' : 'Start Capture'}
              </button>
              
              <button
                onClick={handleStopCapture}
                disabled={!isCapturing}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-500 text-white rounded-lg transition-colors"
              >
                Stop Capture
              </button>
              
              <div className="flex items-center">
                <span className={`w-3 h-3 rounded-full mr-2 ${isCapturing ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></span>
                <span className="text-white/80">
                  {isCapturing ? 'Capturing Audio' : 'Idle'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Audio Test */}
        {isInitialized && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Audio System Test</h3>
            <div className="space-y-2">
              <button
                onClick={handleTestAudio}
                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors"
              >
                🔊 Test Audio (440Hz Sine Wave)
              </button>
              
              {testResult && (
                <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 text-green-200">
                  <strong>Test Result:</strong> {testResult}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Audio Statistics */}
        {isInitialized && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Audio Statistics</h3>
            <button
              onClick={handleGetStats}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              📊 Refresh Stats
            </button>
            
            {audioStats && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                {Object.entries(AudioUtils.formatStats(audioStats)).map(([key, value]) => (
                  <div key={key} className="bg-white/5 p-3 rounded-lg">
                    <div className="text-white/60">{key}</div>
                    <div className="text-white font-mono">{value}</div>
                  </div>
                ))}
                
                <div className="col-span-2 bg-white/5 p-3 rounded-lg">
                  <div className="text-white/60">Compression Ratio</div>
                  <div className="text-white font-mono">
                    {AudioUtils.calculateCompressionRatio(audioStats).toFixed(2)}:1
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Audio Devices */}
        {devices && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Audio Devices</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-white/80 font-medium mb-2">Input Devices</h4>
                <div className="space-y-1">
                  {devices.input_devices.map((device, index) => (
                    <div
                      key={index}
                      className={`p-2 rounded text-sm cursor-pointer transition-colors ${
                        device === devices.current_input_device
                          ? 'bg-green-500/20 text-green-200'
                          : 'bg-white/5 text-white/80 hover:bg-white/10'
                      }`}
                      onClick={() => audioManager.setInputDevice(device)}
                    >
                      {device === devices.current_input_device && '🎤 '}
                      {device}
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="text-white/80 font-medium mb-2">Output Devices</h4>
                <div className="space-y-1">
                  {devices.output_devices.map((device, index) => (
                    <div
                      key={index}
                      className={`p-2 rounded text-sm cursor-pointer transition-colors ${
                        device === devices.current_output_device
                          ? 'bg-green-500/20 text-green-200'
                          : 'bg-white/5 text-white/80 hover:bg-white/10'
                      }`}
                      onClick={() => audioManager.setOutputDevice(device)}
                    >
                      {device === devices.current_output_device && '🔊 '}
                      {device}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioTestComponent;