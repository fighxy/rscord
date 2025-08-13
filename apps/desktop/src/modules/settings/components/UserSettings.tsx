import { useState, useEffect } from "react";
import { useAuth } from "../../auth/store";
import { updateUserProfile, changePassword } from "../api";

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

      setUser(updatedUser);
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
      setMessage({ type: 'error', text: error.message || 'Ошибка при смене пароля' });
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Профиль', icon: '👤' },
    { id: 'security', label: 'Безопасность', icon: '🔒' },
    { id: 'notifications', label: 'Уведомления', icon: '🔔' },
    { id: 'privacy', label: 'Приватность', icon: '🛡️' }
  ] as const;

  if (!user) return null;

  return (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      padding: '24px',
      backgroundColor: 'var(--bg-800)',
      borderRadius: '8px',
      border: '1px solid var(--border)'
    }}>
      {/* Заголовок */}
      <div style={{
        marginBottom: '24px',
        textAlign: 'center'
      }}>
        <h1 style={{
          margin: 0,
          color: 'var(--text-100)',
          fontSize: '24px',
          fontWeight: '600'
        }}>
          Настройки пользователя
        </h1>
        <p style={{
          margin: '8px 0 0 0',
          color: 'var(--text-500)',
          fontSize: '14px'
        }}>
          Управляйте своим профилем и настройками
        </p>
      </div>

      {/* Сообщения */}
      {message && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: message.type === 'success' ? 'var(--success)' : 'var(--error-600)',
          color: 'white',
          borderRadius: '6px',
          marginBottom: '16px',
          fontSize: '14px'
        }}>
          {message.text}
        </div>
      )}

      {/* Табы */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        marginBottom: '24px'
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: 'none',
              border: 'none',
              padding: '12px 24px',
              color: activeTab === tab.id ? 'var(--brand)' : 'var(--text-400)',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === tab.id ? '600' : '400',
              borderBottom: activeTab === tab.id ? '2px solid var(--brand)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Содержимое табов */}
      <div>
        {/* Профиль */}
        {activeTab === 'profile' && (
          <form onSubmit={handleProfileUpdate}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: 'var(--text-100)',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                Отображаемое имя
              </label>
              <input
                type="text"
                value={form.display_name}
                onChange={(e) => handleInputChange('display_name', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-700)',
                  color: 'var(--text-100)',
                  fontSize: '14px'
                }}
                placeholder="Введите отображаемое имя"
                required
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: 'var(--text-100)',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-700)',
                  color: 'var(--text-100)',
                  fontSize: '14px'
                }}
                placeholder="Введите email"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                padding: '10px 24px',
                backgroundColor: 'var(--brand)',
                border: 'none',
                borderRadius: '6px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                opacity: isLoading ? 0.6 : 1
              }}
            >
              {isLoading ? 'Сохранение...' : 'Сохранить изменения'}
            </button>
          </form>
        )}

        {/* Безопасность */}
        {activeTab === 'security' && (
          <form onSubmit={handlePasswordChange}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: 'var(--text-100)',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                Текущий пароль
              </label>
              <input
                type="password"
                value={form.current_password}
                onChange={(e) => handleInputChange('current_password', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-700)',
                  color: 'var(--text-100)',
                  fontSize: '14px'
                }}
                placeholder="Введите текущий пароль"
                required
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: 'var(--text-100)',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                Новый пароль
              </label>
              <input
                type="password"
                value={form.new_password}
                onChange={(e) => handleInputChange('new_password', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-700)',
                  color: 'var(--text-100)',
                  fontSize: '14px'
                }}
                placeholder="Введите новый пароль (минимум 6 символов)"
                required
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: 'var(--text-100)',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                Подтвердите новый пароль
              </label>
              <input
                type="password"
                value={form.confirm_password}
                onChange={(e) => handleInputChange('confirm_password', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-700)',
                  color: 'var(--text-100)',
                  fontSize: '14px'
                }}
                placeholder="Повторите новый пароль"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                padding: '10px 24px',
                backgroundColor: 'var(--danger)',
                border: 'none',
                borderRadius: '6px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                opacity: isLoading ? 0.6 : 1
              }}
            >
              {isLoading ? 'Изменение...' : 'Изменить пароль'}
            </button>
          </form>
        )}

        {/* Уведомления */}
        {activeTab === 'notifications' && (
          <div>
            <div style={{
              padding: '20px',
              backgroundColor: 'var(--bg-700)',
              borderRadius: '6px',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: '48px',
                marginBottom: '16px'
              }}>
                🔔
              </div>
              <h3 style={{
                margin: '0 0 8px 0',
                color: 'var(--text-100)',
                fontSize: '18px'
              }}>
                Настройки уведомлений
              </h3>
              <p style={{
                margin: 0,
                color: 'var(--text-500)',
                fontSize: '14px'
              }}>
                Функция находится в разработке
              </p>
            </div>
          </div>
        )}

        {/* Приватность */}
        {activeTab === 'privacy' && (
          <div>
            <div style={{
              padding: '20px',
              backgroundColor: 'var(--bg-700)',
              borderRadius: '6px',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: '48px',
                marginBottom: '16px'
              }}>
                🛡️
              </div>
              <h3 style={{
                margin: '0 0 8px 0',
                color: 'var(--text-100)',
                fontSize: '18px'
              }}>
                Настройки приватности
              </h3>
              <p style={{
                margin: 0,
                color: 'var(--text-500)',
                fontSize: '14px'
              }}>
                Функция находится в разработке
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
