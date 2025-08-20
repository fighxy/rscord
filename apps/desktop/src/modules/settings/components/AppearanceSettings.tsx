import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Palette, Monitor, Sun, Moon, Zap, Eye } from 'lucide-react';

interface AppearanceSettingsProps {
  onSettingsChange?: (settings: AppearanceConfig) => void;
}

export interface AppearanceConfig {
  theme: 'light' | 'dark' | 'system';
  colorScheme: 'default' | 'warm' | 'cool' | 'high-contrast';
  fontSize: 'small' | 'medium' | 'large';
  density: 'compact' | 'comfortable' | 'spacious';
  animationsEnabled: boolean;
  systemTitleBar: boolean;
  reducedMotion: boolean;
  accentColor: string;
}

const THEME_OPTIONS = [
  { value: 'light', label: 'Светлая', icon: Sun },
  { value: 'dark', label: 'Темная', icon: Moon },
  { value: 'system', label: 'Как в системе', icon: Monitor },
] as const;

const COLOR_SCHEMES = [
  { value: 'default', label: 'По умолчанию', description: 'Стандартная цветовая схема' },
  { value: 'warm', label: 'Теплая', description: 'Теплые тона для комфорта' },
  { value: 'cool', label: 'Холодная', description: 'Холодные тона для фокуса' },
  { value: 'high-contrast', label: 'Высокий контраст', description: 'Для лучшей читаемости' },
] as const;

const FONT_SIZES = [
  { value: 'small', label: 'Маленький', size: '14px' },
  { value: 'medium', label: 'Средний', size: '16px' },
  { value: 'large', label: 'Большой', size: '18px' },
] as const;

const DENSITY_OPTIONS = [
  { value: 'compact', label: 'Компактный', description: 'Больше информации на экране' },
  { value: 'comfortable', label: 'Удобный', description: 'Баланс между информацией и пространством' },
  { value: 'spacious', label: 'Просторный', description: 'Больше пространства между элементами' },
] as const;

const ACCENT_COLORS = [
  { name: 'Anthropic Orange', value: '#b05730' },
  { name: 'Claude Warm', value: '#d97706' },
  { name: 'Синий', value: '#3498db' },
  { name: 'Зеленый', value: '#2ecc71' },
  { name: 'Фиолетовый', value: '#6c5dac' },
  { name: 'Красный', value: '#e74c3c' },
  { name: 'Розовый', value: '#e91e63' },
  { name: 'Бирюзовый', value: '#1abc9c' },
];

export function AppearanceSettings({ onSettingsChange }: AppearanceSettingsProps) {
  const [settings, setSettings] = useState<AppearanceConfig>({
    theme: 'system',
    colorScheme: 'default',
    fontSize: 'medium',
    density: 'comfortable',
    animationsEnabled: true,
    systemTitleBar: false,
    reducedMotion: false,
    accentColor: '#b05730',
  });

  useEffect(() => {
    // Загружаем настройки из localStorage
    const savedSettings = localStorage.getItem('rscord-appearance-settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsed }));
      } catch (error) {
        console.error('Ошибка при загрузке настроек внешнего вида:', error);
      }
    }
  }, []);

  useEffect(() => {
    // Сохраняем настройки в localStorage
    localStorage.setItem('rscord-appearance-settings', JSON.stringify(settings));
    
    // Применяем настройки к документу
    applySettings(settings);
    
    // Уведомляем родительский компонент
    onSettingsChange?.(settings);
  }, [settings, onSettingsChange]);

  const applySettings = (config: AppearanceConfig) => {
    const root = document.documentElement;
    
    // Применяем тему
    if (config.theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    } else {
      root.classList.toggle('dark', config.theme === 'dark');
    }
    
    // Применяем цветовую схему
    root.setAttribute('data-color-scheme', config.colorScheme);
    
    // Применяем размер шрифта
    root.style.fontSize = FONT_SIZES.find(f => f.value === config.fontSize)?.size || '16px';
    
    // Применяем плотность
    root.setAttribute('data-density', config.density);
    
    // Применяем цвет акцента
    root.style.setProperty('--accent-primary', config.accentColor);
    root.style.setProperty('--brand-experiment', config.accentColor);
    
    // Применяем настройки анимации
    if (!config.animationsEnabled || config.reducedMotion) {
      root.style.setProperty('--animation-duration', '0s');
      root.style.setProperty('--transition-duration', '0s');
    } else {
      root.style.removeProperty('--animation-duration');
      root.style.removeProperty('--transition-duration');
    }
  };

  const updateSetting = <K extends keyof AppearanceConfig>(
    key: K,
    value: AppearanceConfig[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-anthropic">
      <div className="content-block">
        <h2 className="text-xl font-semibold text-text-primary mb-2">
          Настройки внешнего вида
        </h2>
        <p className="text-text-secondary leading-relaxed">
          Настройте интерфейс под свои предпочтения в соответствии с принципами 
          человечного дизайна и академической строгости
        </p>
      </div>

      {/* Тема */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Palette className="w-5 h-5 text-accent-primary" />
          <h3 className="text-lg font-medium text-text-primary">Тема оформления</h3>
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          {THEME_OPTIONS.map((theme) => {
            const Icon = theme.icon;
            return (
              <button
                key={theme.value}
                onClick={() => updateSetting('theme', theme.value)}
                className={`
                  p-6 rounded-xl border-2 transition-all duration-300 ease-out
                  ${settings.theme === theme.value
                    ? 'border-accent-primary bg-background-modifier-selected shadow-md scale-105'
                    : 'border-border-color hover:border-border-secondary hover:bg-background-modifier-hover hover:shadow-sm hover:scale-102'
                  }
                `}
              >
                <Icon className="w-6 h-6 mx-auto mb-2 text-text-primary" />
                <div className="text-sm font-medium text-text-primary">
                  {theme.label}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Цветовая схема */}
      <div className="card p-6">
        <h3 className="text-lg font-medium text-text-primary mb-4">
          Цветовая схема
        </h3>
        
        <Select
          value={settings.colorScheme}
          onValueChange={(value: typeof settings.colorScheme) => 
            updateSetting('colorScheme', value)
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COLOR_SCHEMES.map((scheme) => (
              <SelectItem key={scheme.value} value={scheme.value}>
                <div>
                  <div className="font-medium">{scheme.label}</div>
                  <div className="text-xs text-text-muted">{scheme.description}</div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Акцентный цвет */}
      <div className="card p-6">
        <h3 className="text-lg font-medium text-text-primary mb-4">
          Акцентный цвет
        </h3>
        
        <div className="grid grid-cols-4 gap-4">
          {ACCENT_COLORS.map((color) => (
            <button
              key={color.value}
              onClick={() => updateSetting('accentColor', color.value)}
              className={`
                relative w-full aspect-square rounded-xl border-3 transition-all duration-300 ease-out
                ${settings.accentColor === color.value
                  ? 'border-text-primary scale-110 shadow-lg ring-2 ring-offset-2 ring-accent-primary/20'
                  : 'border-border-color hover:border-border-secondary hover:scale-105 hover:shadow-md'
                }
              `}
              style={{ backgroundColor: color.value }}
              title={color.name}
            >
              {settings.accentColor === color.value && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-3 h-3 bg-white rounded-full shadow-md" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Размер текста */}
      <div className="card p-6">
        <h3 className="text-lg font-medium text-text-primary mb-4">
          Размер текста
        </h3>
        
        <Select
          value={settings.fontSize}
          onValueChange={(value: typeof settings.fontSize) => 
            updateSetting('fontSize', value)
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_SIZES.map((font) => (
              <SelectItem key={font.value} value={font.value}>
                <span style={{ fontSize: font.size }}>
                  {font.label} ({font.size})
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Плотность интерфейса */}
      <div className="card p-6">
        <h3 className="text-lg font-medium text-text-primary mb-4">
          Плотность интерфейса
        </h3>
        
        <Select
          value={settings.density}
          onValueChange={(value: typeof settings.density) => 
            updateSetting('density', value)
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DENSITY_OPTIONS.map((density) => (
              <SelectItem key={density.value} value={density.value}>
                <div>
                  <div className="font-medium">{density.label}</div>
                  <div className="text-xs text-text-muted">{density.description}</div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Переключатели */}
      <div className="card space-y-6">
        <h3 className="text-lg font-medium text-text-primary">
          Дополнительные настройки
        </h3>
        <p className="text-sm text-text-secondary leading-relaxed -mt-2">
          Тонкая настройка взаимодействия с интерфейсом
        </p>

        <div className="flex items-start justify-between py-2">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-accent-primary/10 mt-1">
              <Zap className="w-4 h-4 text-accent-primary" />
            </div>
            <div className="flex-1">
              <Label htmlFor="animations" className="text-sm font-semibold text-text-primary">
                Включить анимации
              </Label>
              <p className="text-sm text-text-secondary leading-relaxed mt-1">
                Плавные переходы и анимации интерфейса для лучшего пользовательского опыта.
                Отключите для повышения производительности.
              </p>
            </div>
          </div>
          <Switch
            id="animations"
            checked={settings.animationsEnabled}
            onCheckedChange={(checked) => updateSetting('animationsEnabled', checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Eye className="w-4 h-4 text-accent-primary" />
            <div>
              <Label htmlFor="reduced-motion" className="text-sm font-medium">
                Уменьшить движение
              </Label>
              <p className="text-xs text-text-muted">
                Минимизировать анимации для комфорта
              </p>
            </div>
          </div>
          <Switch
            id="reduced-motion"
            checked={settings.reducedMotion}
            onCheckedChange={(checked) => updateSetting('reducedMotion', checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Monitor className="w-4 h-4 text-accent-primary" />
            <div>
              <Label htmlFor="system-titlebar" className="text-sm font-medium">
                Системная строка заголовка
              </Label>
              <p className="text-xs text-text-muted">
                Использовать стандартную строку заголовка ОС
              </p>
            </div>
          </div>
          <Switch
            id="system-titlebar"
            checked={settings.systemTitleBar}
            onCheckedChange={(checked) => updateSetting('systemTitleBar', checked)}
          />
        </div>
      </div>

      {/* Предпросмотр в стиле Anthropic */}
      <div className="content-block">
        <h3 className="text-lg font-medium text-text-primary mb-4">
          Предпросмотр настроек
        </h3>
        <p className="text-sm text-text-secondary mb-6 leading-relaxed">
          Живой предпросмотр того, как будет выглядеть интерфейс с выбранными настройками.
        </p>
        
        <div className="bg-bg-secondary rounded-xl p-6 space-y-4 border border-border-muted modal-paper">
          <div className="flex items-start gap-4">
            <div 
              className="w-10 h-10 rounded-xl shadow-sm border-2 border-white/20"
              style={{ 
                backgroundColor: settings.accentColor,
                boxShadow: `0 4px 12px ${settings.accentColor}20`
              }}
            />
            <div className="flex-1">
              <div className="font-semibold text-text-primary mb-1">Пример заголовка</div>
              <div className="text-sm text-text-secondary leading-relaxed">
                Этот предпросмотр демонстрирует выбранную цветовую схему, размер текста 
                и общую атмосферу интерфейса в соответствии с принципами дизайна.
              </div>
            </div>
          </div>
          
          <div className="flex gap-3 pt-4 border-t border-border-muted">
            <Button 
              size="sm" 
              style={{ backgroundColor: settings.accentColor }}
              className="text-white shadow-sm hover:shadow-md transition-shadow"
            >
              Основная кнопка
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              className="border-2 hover:shadow-sm transition-shadow"
            >
              Вторичная кнопка
            </Button>
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
              Вернуть все настройки внешнего вида к значениям по умолчанию
            </p>
          </div>
          
          <Button
            variant="outline"
            onClick={() => {
              setSettings({
                theme: 'system',
                colorScheme: 'default',
                fontSize: 'medium',
                density: 'comfortable',
                animationsEnabled: true,
                systemTitleBar: false,
                reducedMotion: false,
                accentColor: '#b05730',
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

export default AppearanceSettings;