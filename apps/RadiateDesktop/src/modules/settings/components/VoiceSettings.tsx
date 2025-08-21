import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { Mic, Volume2, TestTube, RefreshCw, CheckCircle, XCircle } from 'lucide-react';

interface AudioDevice {
  id: string;
  name: string;
  is_default: boolean;
  device_type: string;
  supported_configs: string[];
}

interface MicrophoneTestResult {
  status: string;
  device_name?: string;
  sample_rate?: string;
  channels?: string;
  format?: string;
  config_error?: string;
  name_error?: string;
}

export const VoiceSettings: React.FC = () => {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [micTest, setMicTest] = useState<MicrophoneTestResult | null>(null);
  const [isTestingMic, setIsTestingMic] = useState(false);

  const loadAudioDevices = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const audioDevices = await invoke<AudioDevice[]>('get_audio_devices');
      setDevices(audioDevices);
    } catch (err) {
      console.error('Failed to load audio devices:', err);
      setError(err as string);
    } finally {
      setIsLoading(false);
    }
  };

  const testMicrophone = async () => {
    try {
      setIsTestingMic(true);
      const result = await invoke<MicrophoneTestResult>('test_microphone');
      setMicTest(result);
    } catch (err) {
      console.error('Failed to test microphone:', err);
      setMicTest({ status: 'error' });
    } finally {
      setIsTestingMic(false);
    }
  };

  useEffect(() => {
    loadAudioDevices();
  }, []);

  const inputDevices = devices.filter(device => device.device_type === 'input');
  const outputDevices = devices.filter(device => device.device_type === 'output');

  const renderDeviceCard = (device: AudioDevice) => (
    <div
      key={device.id}
      className={`card p-4 border transition-colors ${
        device.is_default ? 'border-brand-experiment bg-brand-experiment/5' : 'border-border'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {device.device_type === 'input' ? (
              <Mic className="w-4 h-4 text-interactive-muted" />
            ) : (
              <Volume2 className="w-4 h-4 text-interactive-muted" />
            )}
            <h4 className="font-medium text-text-primary">{device.name}</h4>
            {device.is_default && (
              <span className="px-2 py-1 bg-brand-experiment text-white text-xs rounded-full">
                По умолчанию
              </span>
            )}
          </div>
          
          <div className="mt-2">
            <p className="text-sm text-text-secondary">
              Тип: {device.device_type === 'input' ? 'Микрофон' : 'Динамики'}
            </p>
            
            {device.supported_configs.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-text-secondary mb-1">Поддерживаемые форматы:</p>
                <div className="space-y-1">
                  {device.supported_configs.slice(0, 3).map((config, index) => (
                    <p key={index} className="text-xs text-interactive-muted font-mono">
                      {config}
                    </p>
                  ))}
                  {device.supported_configs.length > 3 && (
                    <p className="text-xs text-interactive-muted">
                      +{device.supported_configs.length - 3} еще...
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          className="ml-4"
          disabled={device.is_default}
        >
          {device.is_default ? 'Активно' : 'Выбрать'}
        </Button>
      </div>
    </div>
  );

  const renderMicrophoneTest = () => {
    if (!micTest) return null;

    const getStatusIcon = () => {
      switch (micTest.status) {
        case 'available':
          return <CheckCircle className="w-5 h-5 text-green-500" />;
        case 'no_device':
        case 'error':
          return <XCircle className="w-5 h-5 text-red-500" />;
        default:
          return <XCircle className="w-5 h-5 text-orange-500" />;
      }
    };

    const getStatusText = () => {
      switch (micTest.status) {
        case 'available':
          return 'Микрофон работает';
        case 'no_device':
          return 'Микрофон не найден';
        case 'error':
          return 'Ошибка микрофона';
        default:
          return 'Неизвестный статус';
      }
    };

    return (
      <div className="card p-4 border border-border">
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <div className="flex-1">
            <h4 className="font-medium text-text-primary">{getStatusText()}</h4>
            {micTest.device_name && (
              <p className="text-sm text-text-secondary">Устройство: {micTest.device_name}</p>
            )}
            {micTest.sample_rate && micTest.channels && (
              <p className="text-xs text-interactive-muted">
                {micTest.sample_rate}Hz, {micTest.channels} каналов, {micTest.format}
              </p>
            )}
            {micTest.config_error && (
              <p className="text-xs text-red-400">Ошибка конфигурации: {micTest.config_error}</p>
            )}
            {micTest.name_error && (
              <p className="text-xs text-red-400">Ошибка имени: {micTest.name_error}</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-text-primary mb-2">
            Голос и видео
          </h2>
          <p className="text-text-secondary mb-6">
            Настройки микрофона, камеры и звуковых устройств
          </p>
        </div>
        
        <div className="card p-6">
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 mx-auto mb-4 text-interactive-muted animate-spin" />
            <p className="text-text-secondary">Загрузка устройств...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-text-primary mb-2">
            Голос и видео
          </h2>
          <p className="text-text-secondary mb-6">
            Настройки микрофона, камеры и звуковых устройств
          </p>
        </div>
        
        <div className="card p-6 border-red-500/20 bg-red-500/5">
          <div className="text-center py-8">
            <XCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <h3 className="text-lg font-medium text-text-primary mb-2">
              Ошибка загрузки устройств
            </h3>
            <p className="text-text-secondary mb-4">{error}</p>
            <Button onClick={loadAudioDevices} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Попробовать снова
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-text-primary mb-2">
          Голос и видео
        </h2>
        <p className="text-text-secondary mb-6">
          Настройки микрофона, камеры и звуковых устройств
        </p>
      </div>

      {/* Microphone Test */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-text-primary">Тест микрофона</h3>
          <Button
            onClick={testMicrophone}
            disabled={isTestingMic}
            variant="outline"
            size="sm"
          >
            {isTestingMic ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <TestTube className="w-4 h-4 mr-2" />
            )}
            {isTestingMic ? 'Тестирование...' : 'Тест микрофона'}
          </Button>
        </div>
        
        {renderMicrophoneTest()}
      </div>

      {/* Input Devices */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-text-primary">
            Устройства ввода ({inputDevices.length})
          </h3>
          <Button onClick={loadAudioDevices} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Обновить
          </Button>
        </div>
        
        {inputDevices.length > 0 ? (
          <div className="grid gap-3">
            {inputDevices.map(renderDeviceCard)}
          </div>
        ) : (
          <div className="card p-6">
            <div className="text-center py-8">
              <Mic className="w-12 h-12 mx-auto mb-4 text-interactive-muted" />
              <h3 className="text-lg font-medium text-text-primary mb-2">
                Устройства ввода не найдены
              </h3>
              <p className="text-text-secondary">
                Подключите микрофон или другое устройство записи звука
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Output Devices */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-text-primary">
          Устройства вывода ({outputDevices.length})
        </h3>
        
        {outputDevices.length > 0 ? (
          <div className="grid gap-3">
            {outputDevices.map(renderDeviceCard)}
          </div>
        ) : (
          <div className="card p-6">
            <div className="text-center py-8">
              <Volume2 className="w-12 h-12 mx-auto mb-4 text-interactive-muted" />
              <h3 className="text-lg font-medium text-text-primary mb-2">
                Устройства вывода не найдены
              </h3>
              <p className="text-text-secondary">
                Подключите наушники или динамики для вывода звука
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Audio Settings */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-text-primary">Настройки качества</h3>
        
        <div className="card p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-text-primary">Подавление эха</h4>
                <p className="text-sm text-text-secondary">
                  Автоматически убирает эхо во время разговора
                </p>
              </div>
              <label className="switch">
                <input type="checkbox" defaultChecked />
                <span className="slider round"></span>
              </label>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-text-primary">Подавление шума</h4>
                <p className="text-sm text-text-secondary">
                  Убирает фоновый шум для более чистого звука
                </p>
              </div>
              <label className="switch">
                <input type="checkbox" defaultChecked />
                <span className="slider round"></span>
              </label>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-text-primary">Автоматическая регулировка громкости</h4>
                <p className="text-sm text-text-secondary">
                  Автоматически подстраивает громкость микрофона
                </p>
              </div>
              <label className="switch">
                <input type="checkbox" />
                <span className="slider round"></span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceSettings;