import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bell, Volume2, VolumeX, Smartphone, Monitor, AlertCircle, MessageSquare, Users, Phone } from 'lucide-react';

interface NotificationSettingsProps {
  onSettingsChange?: (settings: NotificationConfig) => void;
}

export interface NotificationConfig {
  enabled: boolean;
  desktop: boolean;
  sound: boolean;
  soundVolume: number;
  doNotDisturb: boolean;
  dndStart: string;
  dndEnd: string;
  messages: {
    direct: boolean;
    mentions: boolean;
    keywords: boolean;
    allMessages: boolean;
  };
  voice: {
    joins: boolean;
    leaves: boolean;
    moves: boolean;
  };
  system: {
    updates: boolean;
    maintenance: boolean;
    errors: boolean;
  };
  customSounds: {
    message: string;
    mention: string;
    voice: string;
  };
}

const SOUND_OPTIONS = [
  { value: 'default', label: 'По умолчанию' },
  { value: 'subtle', label: 'Тихий' },
  { value: 'classic', label: 'Классический' },
  { value: 'modern', label: 'Современный' },
  { value: 'none', label: 'Без звука' },
];

export function NotificationSettings({ onSettingsChange }: NotificationSettingsProps) {
  const [settings, setSettings] = useState<NotificationConfig>({
    enabled: true,
    desktop: true,
    sound: true,
    soundVolume: 50,
    doNotDisturb: false,
    dndStart: '22:00',
    dndEnd: '08:00',
    messages: {
      direct: true,
      mentions: true,
      keywords: true,
      allMessages: false,
    },
    voice: {
      joins: true,
      leaves: false,
      moves: false,
    },
    system: {
      updates: true,
      maintenance: true,
      errors: true,
    },
    customSounds: {
      message: 'default',
      mention: 'default',
      voice: 'default',
    },
  });

  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [testNotification, setTestNotification] = useState<boolean>(false);

  useEffect(() => {
    // Загружаем настройки из localStorage
    const savedSettings = localStorage.getItem('radiate-notification-settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsed }));
      } catch (error) {
        console.error('Ошибка при загрузке настроек уведомлений:', error);
      }
    }

    // Проверяем разрешения на уведомления
    checkNotificationPermission();
  }, []);

  useEffect(() => {
    // Сохраняем настройки в localStorage
    localStorage.setItem('radiate-notification-settings', JSON.stringify(settings));
    
    // Уведомляем родительский компонент
    onSettingsChange?.(settings);
  }, [settings, onSettingsChange]);

  const checkNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = Notification.permission;
      setHasPermission(permission === 'granted');
    }
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setHasPermission(permission === 'granted');
      
      if (permission === 'granted') {
        updateSetting('enabled', true);
        updateSetting('desktop', true);
      }
    }
  };

  const updateSetting = <K extends keyof NotificationConfig>(
    key: K,
    value: NotificationConfig[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const updateNestedSetting = <T extends keyof NotificationConfig>(
    category: T,
    key: keyof NotificationConfig[T],
    value: any
  ) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...(prev[category] as object),
        [key]: value,
      } as NotificationConfig[T],
    }));
  };

  const sendTestNotification = () => {
    if (!hasPermission || !settings.enabled) return;
    
    setTestNotification(true);
    
    if (settings.desktop) {
      new Notification('Radiate - Тестовое уведомление', {
        body: 'Это тестовое уведомление для проверки ваших настроек',
        icon: '/icons/icon.png',
      });
    }
    
    setTimeout(() => setTestNotification(false), 3000);
  };

  return (
    <div className="space-y-anthropic">
      <div className="content-block">
        <h2 className="text-xl font-semibold text-text-primary mb-2">
          Настройки уведомлений
        </h2>
        <p className="text-text-secondary leading-relaxed">
          Полный контроль над тем, как и когда вы получаете уведомления. 
          Настройте систему так, чтобы она поддерживала вашу продуктивность и комфорт.
        </p>
      </div>

      {/* Основные настройки */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Bell className="w-5 h-5 text-accent-primary" />
          <h3 className="text-lg font-medium text-text-primary">Основные настройки</h3>
        </div>

        {!hasPermission && (
          <div className="bg-warning-light border-l-4 border-warning rounded-xl p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-warning/10">
                <AlertCircle className="w-5 h-5 text-warning flex-shrink-0" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-text-primary mb-2">
                  Требуется разрешение на уведомления
                </h4>
                <p className="text-sm text-text-secondary mb-4 leading-relaxed">
                  Для получения уведомлений от Radiate необходимо предоставить соответствующие разрешения в браузере.
                  Это безопасно и можно отменить в любое время.
                </p>
                <Button 
                  onClick={requestNotificationPermission} 
                  className="shadow-sm hover:shadow-md transition-shadow"
                >
                  Разрешить уведомления
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          <div className="flex items-start justify-between py-2">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-accent-primary/10 mt-1">
                <Bell className="w-4 h-4 text-accent-primary" />
              </div>
              <div className="flex-1">
                <Label className="text-sm font-semibold text-text-primary">Включить уведомления</Label>
                <p className="text-sm text-text-secondary leading-relaxed mt-1">
                  Основной переключатель, контролирующий все уведомления от приложения.
                </p>
              </div>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) => updateSetting('enabled', checked)}
              disabled={!hasPermission}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Monitor className="w-4 h-4 text-accent-primary" />
              <div>
                <Label className="text-sm font-medium">Системные уведомления</Label>
                <p className="text-xs text-text-muted">Показывать уведомления на рабочем столе</p>
              </div>
            </div>
            <Switch
              checked={settings.desktop}
              onCheckedChange={(checked) => updateSetting('desktop', checked)}
              disabled={!settings.enabled || !hasPermission}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Volume2 className="w-4 h-4 text-accent-primary" />
              <div>
                <Label className="text-sm font-medium">Звуковые уведомления</Label>
                <p className="text-xs text-text-muted">Воспроизводить звуки при уведомлениях</p>
              </div>
            </div>
            <Switch
              checked={settings.sound}
              onCheckedChange={(checked) => updateSetting('sound', checked)}
              disabled={!settings.enabled}
            />
          </div>

          {settings.sound && (
            <div className="ml-7">
              <Label className="text-sm font-medium mb-2 block">Громкость звука</Label>
              <div className="flex items-center gap-3">
                <VolumeX className="w-4 h-4 text-text-muted" />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.soundVolume}
                  onChange={(e) => updateSetting('soundVolume', parseInt(e.target.value))}
                  className="flex-1 h-2 bg-bg-secondary rounded-lg appearance-none slider"
                />
                <Volume2 className="w-4 h-4 text-text-muted" />
                <span className="text-sm text-text-primary min-w-[3rem]">
                  {settings.soundVolume}%
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-border-color">
          <div className="text-center">
            <p className="text-sm text-text-secondary mb-4 leading-relaxed">
              Проверьте ваши настройки, отправив пробное уведомление
            </p>
            <Button 
              onClick={sendTestNotification}
              disabled={!hasPermission || !settings.enabled || testNotification}
              className="px-8 shadow-sm hover:shadow-md transition-shadow"
              size="lg"
            >
              {testNotification ? '✓ Отправлено!' : 'Отправить тестовое уведомление'}
            </Button>
          </div>
        </div>
      </div>

      {/* Режим "Не беспокоить" */}
      <div className="card p-6">
        <h3 className="text-lg font-medium text-text-primary mb-4">
          Режим "Не беспокоить"
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Включить режим "Не беспокоить"</Label>
              <p className="text-xs text-text-muted">Отключать уведомления в определенное время</p>
            </div>
            <Switch
              checked={settings.doNotDisturb}
              onCheckedChange={(checked) => updateSetting('doNotDisturb', checked)}
            />
          </div>

          {settings.doNotDisturb && (
            <div className="ml-0 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Начало</Label>
                  <input
                    type="time"
                    value={settings.dndStart}
                    onChange={(e) => updateSetting('dndStart', e.target.value)}
                    className="w-full p-2 bg-bg-secondary border border-border-color rounded-md text-text-primary"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium mb-2 block">Конец</Label>
                  <input
                    type="time"
                    value={settings.dndEnd}
                    onChange={(e) => updateSetting('dndEnd', e.target.value)}
                    className="w-full p-2 bg-bg-secondary border border-border-color rounded-md text-text-primary"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Уведомления сообщений */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <MessageSquare className="w-5 h-5 text-accent-primary" />
          <h3 className="text-lg font-medium text-text-primary">Сообщения</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Личные сообщения</Label>
              <p className="text-xs text-text-muted">Уведомления о прямых сообщениях</p>
            </div>
            <Switch
              checked={settings.messages.direct}
              onCheckedChange={(checked) => 
                updateNestedSetting('messages', 'direct', checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Упоминания</Label>
              <p className="text-xs text-text-muted">Когда вас упоминают в канале</p>
            </div>
            <Switch
              checked={settings.messages.mentions}
              onCheckedChange={(checked) => 
                updateNestedSetting('messages', 'mentions', checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Ключевые слова</Label>
              <p className="text-xs text-text-muted">Сообщения с важными словами</p>
            </div>
            <Switch
              checked={settings.messages.keywords}
              onCheckedChange={(checked) => 
                updateNestedSetting('messages', 'keywords', checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Все сообщения</Label>
              <p className="text-xs text-text-muted">Уведомления о всех сообщениях в каналах</p>
            </div>
            <Switch
              checked={settings.messages.allMessages}
              onCheckedChange={(checked) => 
                updateNestedSetting('messages', 'allMessages', checked)
              }
            />
          </div>
        </div>
      </div>

      {/* Голосовые уведомления */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Phone className="w-5 h-5 text-accent-primary" />
          <h3 className="text-lg font-medium text-text-primary">Голосовые каналы</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Подключения</Label>
              <p className="text-xs text-text-muted">Когда кто-то заходит в голосовой канал</p>
            </div>
            <Switch
              checked={settings.voice.joins}
              onCheckedChange={(checked) => 
                updateNestedSetting('voice', 'joins', checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Отключения</Label>
              <p className="text-xs text-text-muted">Когда кто-то покидает голосовой канал</p>
            </div>
            <Switch
              checked={settings.voice.leaves}
              onCheckedChange={(checked) => 
                updateNestedSetting('voice', 'leaves', checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Перемещения</Label>
              <p className="text-xs text-text-muted">Когда кто-то переходит между каналами</p>
            </div>
            <Switch
              checked={settings.voice.moves}
              onCheckedChange={(checked) => 
                updateNestedSetting('voice', 'moves', checked)
              }
            />
          </div>
        </div>
      </div>

      {/* Системные уведомления */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="w-5 h-5 text-accent-primary" />
          <h3 className="text-lg font-medium text-text-primary">Система</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Обновления</Label>
              <p className="text-xs text-text-muted">Уведомления о новых версиях</p>
            </div>
            <Switch
              checked={settings.system.updates}
              onCheckedChange={(checked) => 
                updateNestedSetting('system', 'updates', checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Техническое обслуживание</Label>
              <p className="text-xs text-text-muted">Плановые работы и перерывы в работе</p>
            </div>
            <Switch
              checked={settings.system.maintenance}
              onCheckedChange={(checked) => 
                updateNestedSetting('system', 'maintenance', checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Ошибки</Label>
              <p className="text-xs text-text-muted">Критические ошибки и проблемы</p>
            </div>
            <Switch
              checked={settings.system.errors}
              onCheckedChange={(checked) => 
                updateNestedSetting('system', 'errors', checked)
              }
            />
          </div>
        </div>
      </div>

      {/* Звуки уведомлений */}
      <div className="card p-6">
        <h3 className="text-lg font-medium text-text-primary mb-4">
          Звуки уведомлений
        </h3>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">Звук сообщений</Label>
            <Select
              value={settings.customSounds.message}
              onValueChange={(value) => 
                updateNestedSetting('customSounds', 'message', value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOUND_OPTIONS.map((sound) => (
                  <SelectItem key={sound.value} value={sound.value}>
                    {sound.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium mb-2 block">Звук упоминаний</Label>
            <Select
              value={settings.customSounds.mention}
              onValueChange={(value) => 
                updateNestedSetting('customSounds', 'mention', value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOUND_OPTIONS.map((sound) => (
                  <SelectItem key={sound.value} value={sound.value}>
                    {sound.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium mb-2 block">Звук голосовых каналов</Label>
            <Select
              value={settings.customSounds.voice}
              onValueChange={(value) => 
                updateNestedSetting('customSounds', 'voice', value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOUND_OPTIONS.map((sound) => (
                  <SelectItem key={sound.value} value={sound.value}>
                    {sound.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Сброс настроек */}
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-text-primary mb-1">
              Сброс настроек
            </h3>
            <p className="text-sm text-text-secondary">
              Вернуть все настройки уведомлений к значениям по умолчанию
            </p>
          </div>
          
          <Button
            variant="outline"
            onClick={() => {
              setSettings({
                enabled: true,
                desktop: true,
                sound: true,
                soundVolume: 50,
                doNotDisturb: false,
                dndStart: '22:00',
                dndEnd: '08:00',
                messages: {
                  direct: true,
                  mentions: true,
                  keywords: true,
                  allMessages: false,
                },
                voice: {
                  joins: true,
                  leaves: false,
                  moves: false,
                },
                system: {
                  updates: true,
                  maintenance: true,
                  errors: true,
                },
                customSounds: {
                  message: 'default',
                  mention: 'default',
                  voice: 'default',
                },
              });
            }}
          >
            Сбросить
          </Button>
        </div>
      </div>
    </div>
  );
}

export default NotificationSettings;