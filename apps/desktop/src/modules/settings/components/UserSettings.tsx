import { useState, useEffect } from "react";
import { useAuth } from "../../auth/store";
import { updateUserProfile, changePassword } from "../api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface UserSettingsForm {
  display_name: string;
  email: string;
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export function UserSettings() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState<UserSettingsForm>({
    display_name: user?.displayName || '',
    email: user?.email || '',
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications' | 'privacy'>('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      setForm(prev => ({
        ...prev,
        display_name: user.displayName || '',
        email: user.email || ''
      }));
    }
  }, [user]);

  const handleInputChange = (field: keyof UserSettingsForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setMessage(null);
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setIsLoading(true);
    setMessage(null);

    try {
      const updatedUser = await updateUserProfile(user.id, {
        display_name: form.display_name,
        email: form.email
      });

      setUser({
        id: updatedUser.id,
        email: updatedUser.email,
        displayName: updatedUser.display_name
      });
      setMessage({ type: 'success', text: 'Профиль успешно обновлен!' });
      
      // Очищаем пароли
      setForm(prev => ({
        ...prev,
        current_password: '',
        new_password: '',
        confirm_password: ''
      }));
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Ошибка при обновлении профиля' });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    if (form.new_password !== form.confirm_password) {
      setMessage({ type: 'error', text: 'Новые пароли не совпадают' });
      return;
    }

    if (form.new_password.length < 6) {
      setMessage({ type: 'error', text: 'Новый пароль должен содержать минимум 6 символов' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      await changePassword(user.id, {
        current_password: form.current_password,
        new_password: form.new_password
      });

      setMessage({ type: 'success', text: 'Пароль успешно изменен!' });
      
      // Очищаем пароли
      setForm(prev => ({
        ...prev,
        current_password: '',
        new_password: '',
        confirm_password: ''
      }));
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Ошибка при изменении пароля' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="grid place-items-center h-full text-gray-400">
        Загрузка...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Настройки пользователя</h1>

      {/* Сообщения */}
      {message && (
        <div className={`p-3 mb-4 rounded-md ${
          message.type === 'success' 
            ? 'bg-green-900/20 border border-green-800 text-green-300' 
            : 'bg-red-900/20 border border-red-800 text-red-300'
        }`}>
          {message.text}
        </div>
      )}

      {/* Навигация по вкладкам */}
      <div className="flex gap-1 mb-6 bg-gray-700 p-1 rounded-lg">
        {(['profile', 'security', 'notifications', 'privacy'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
              activeTab === tab
                ? 'bg-discord-blurple text-white'
                : 'text-gray-300 hover:text-white hover:bg-gray-600'
            }`}
          >
            {tab === 'profile' && 'Профиль'}
            {tab === 'security' && 'Безопасность'}
            {tab === 'notifications' && 'Уведомления'}
            {tab === 'privacy' && 'Приватность'}
          </button>
        ))}
      </div>

      {/* Содержимое вкладок */}
      <div className="bg-discord-dark rounded-lg p-6">
        {/* Профиль */}
        {activeTab === 'profile' && (
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Имя пользователя
              </label>
              <Input
                type="text"
                value={form.display_name}
                onChange={(e) => handleInputChange('display_name', e.target.value)}
                className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-discord-blurple focus:border-transparent"
                placeholder="Введите имя пользователя"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-discord-blurple focus:border-transparent"
                placeholder="Введите email"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="bg-discord-blurple hover:bg-blue-600 disabled:opacity-60"
            >
              {isLoading ? 'Обновление...' : 'Обновить профиль'}
            </Button>
          </form>
        )}

        {/* Безопасность */}
        {activeTab === 'security' && (
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Текущий пароль
              </label>
              <Input
                type="password"
                value={form.current_password}
                onChange={(e) => handleInputChange('current_password', e.target.value)}
                className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-discord-blurple focus:border-transparent"
                placeholder="Введите текущий пароль"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Новый пароль
              </label>
              <Input
                type="password"
                value={form.new_password}
                onChange={(e) => handleInputChange('new_password', e.target.value)}
                className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-discord-blurple focus:border-transparent"
                placeholder="Введите новый пароль"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Подтвердите новый пароль
              </label>
              <Input
                type="password"
                value={form.confirm_password}
                onChange={(e) => handleInputChange('confirm_password', e.target.value)}
                className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-discord-blurple focus:border-transparent"
                placeholder="Повторите новый пароль"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              variant="destructive"
              className="disabled:opacity-60"
            >
              {isLoading ? 'Изменение...' : 'Изменить пароль'}
            </Button>
          </form>
        )}

        {/* Уведомления */}
        {activeTab === 'notifications' && (
          <div>
            <div className="p-5 bg-gray-700 rounded-lg text-center">
              <div className="text-5xl mb-4">
                🔔
              </div>
              <h3 className="text-lg font-semibold text-gray-200 mb-2">
                Настройки уведомлений
              </h3>
              <p className="text-gray-400 text-sm">
                Функция находится в разработке
              </p>
            </div>
          </div>
        )}

        {/* Приватность */}
        {activeTab === 'privacy' && (
          <div>
            <div className="p-5 bg-gray-700 rounded-lg text-center">
              <div className="text-5xl mb-4">
                🛡️
              </div>
              <h3 className="text-lg font-semibold text-gray-200 mb-2">
                Настройки приватности
              </h3>
              <p className="text-gray-400 text-sm">
                Функция находится в разработке
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
