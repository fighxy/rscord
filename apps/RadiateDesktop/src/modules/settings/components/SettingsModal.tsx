import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, User, Shield, Bell, Lock, Palette, Mic, Settings } from 'lucide-react';
import { UserSettings } from './UserSettings';
import AppearanceSettings from './AppearanceSettings';
import NotificationSettings from './NotificationSettings';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 
  | 'account' 
  | 'privacy' 
  | 'notifications' 
  | 'appearance' 
  | 'voice' 
  | 'advanced'
  | 'about';

const SETTINGS_TABS = [
  { id: 'account', label: 'Аккаунт', icon: User, description: 'Профиль, безопасность, подписки' },
  { id: 'privacy', label: 'Конфиденциальность', icon: Shield, description: 'Управление данными и безопасностью' },
  { id: 'notifications', label: 'Уведомления', icon: Bell, description: 'Настройки уведомлений' },
  { id: 'appearance', label: 'Внешний вид', icon: Palette, description: 'Темы, масштабирование, языки' },
  { id: 'voice', label: 'Голос и видео', icon: Mic, description: 'Микрофон, камера, звук' },
  { id: 'advanced', label: 'Дополнительно', icon: Settings, description: 'Эксперименты, разработка' },
] as const;

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'account':
        return <UserSettings />;
      
      case 'privacy':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-text-primary mb-2">
                Конфиденциальность и безопасность
              </h2>
              <p className="text-text-secondary mb-6">
                Управляйте своими данными и настройками безопасности
              </p>
            </div>
            
            <div className="card p-6">
              <div className="text-center py-12">
                <Shield className="w-16 h-16 mx-auto mb-4 text-interactive-muted" />
                <h3 className="text-lg font-medium text-text-primary mb-2">
                  Настройки конфиденциальности
                </h3>
                <p className="text-text-secondary">
                  Эта функция будет доступна в следующих обновлениях
                </p>
              </div>
            </div>
          </div>
        );
      
      case 'notifications':
        return <NotificationSettings />;
      
      case 'appearance':
        return <AppearanceSettings />;
      
      case 'voice':
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
                <Mic className="w-16 h-16 mx-auto mb-4 text-interactive-muted" />
                <h3 className="text-lg font-medium text-text-primary mb-2">
                  Настройки голоса и видео
                </h3>
                <p className="text-text-secondary">
                  Эта функция будет доступна в следующих обновлениях
                </p>
              </div>
            </div>
          </div>
        );
      
      case 'advanced':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-text-primary mb-2">
                Дополнительные настройки
              </h2>
              <p className="text-text-secondary mb-6">
                Экспериментальные функции и инструменты разработчика
              </p>
            </div>
            
            <div className="card p-6">
              <div className="text-center py-12">
                <Settings className="w-16 h-16 mx-auto mb-4 text-interactive-muted" />
                <h3 className="text-lg font-medium text-text-primary mb-2">
                  Дополнительные настройки
                </h3>
                <p className="text-text-secondary">
                  Эта функция будет доступна в следующих обновлениях
                </p>
              </div>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0 overflow-hidden modal-paper">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold text-text-primary">
              Настройки
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 hover:bg-bg-tertiary"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <div className="w-64 bg-bg-secondary border-r border-border p-4 overflow-y-auto modal-paper">
            <nav className="space-y-1">
              {SETTINGS_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as SettingsTab)}
                    className={`
                      w-full text-left px-3 py-2 rounded-lg transition-all duration-200
                      ${isActive 
                        ? 'bg-brand-experiment text-white shadow-sm' 
                        : 'text-text-secondary hover:text-text-primary hover:bg-background-modifier-hover'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-interactive-muted'}`} />
                      <div>
                        <div className={`text-sm font-medium ${isActive ? 'text-white' : 'text-text-primary'}`}>
                          {tab.label}
                        </div>
                        <div className={`text-xs ${isActive ? 'text-orange-100' : 'text-interactive-muted'}`}>
                          {tab.description}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {renderTabContent()}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsModal;