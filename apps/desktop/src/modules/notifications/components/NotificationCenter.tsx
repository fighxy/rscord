import { useState, useEffect } from "react";
import { useRealTime } from "../../events/hooks/useRealTime";
import { useAuth } from "../../auth/store";

interface Notification {
  id: string;
  type: 'message' | 'mention' | 'guild_invite' | 'voice_call';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  data?: any;
}

export function NotificationCenter() {
  const { user } = useAuth();
  const { isConnected } = useRealTime();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Загружаем уведомления из localStorage
  useEffect(() => {
    const saved = localStorage.getItem('notifications');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setNotifications(parsed);
        updateUnreadCount(parsed);
      } catch (error) {
        console.error('Failed to parse notifications:', error);
      }
    }
  }, []);

  // Сохраняем уведомления в localStorage
  const saveNotifications = (newNotifications: Notification[]) => {
    setNotifications(newNotifications);
    localStorage.setItem('notifications', JSON.stringify(newNotifications));
    updateUnreadCount(newNotifications);
  };

  const updateUnreadCount = (notifs: Notification[]) => {
    setUnreadCount(notifs.filter(n => !n.read).length);
  };

  // Добавляем новое уведомление
  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date(),
      read: false
    };

    const updated = [newNotification, ...notifications].slice(0, 50); // Максимум 50 уведомлений
    saveNotifications(updated);

    // Показываем браузерное уведомление
    if (Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico'
      });
    }
  };

  // Отмечаем уведомление как прочитанное
  const markAsRead = (id: string) => {
    const updated = notifications.map(n => 
      n.id === id ? { ...n, read: true } : n
    );
    saveNotifications(updated);
  };

  // Отмечаем все как прочитанные
  const markAllAsRead = () => {
    const updated = notifications.map(n => ({ ...n, read: true }));
    saveNotifications(updated);
  };

  // Удаляем уведомление
  const removeNotification = (id: string) => {
    const updated = notifications.filter(n => n.id !== id);
    saveNotifications(updated);
  };

  // Очищаем все уведомления
  const clearAll = () => {
    saveNotifications([]);
  };

  // Запрашиваем разрешение на уведомления
  const requestNotificationPermission = async () => {
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('Notification permission granted');
      }
    }
  };

  // Форматируем время
  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'только что';
    if (minutes < 60) return `${minutes} мин назад`;
    if (hours < 24) return `${hours} ч назад`;
    return `${days} дн назад`;
  };

  // Получаем иконку для типа уведомления
  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'message': return '💬';
      case 'mention': return '🔔';
      case 'guild_invite': return '🎉';
      case 'voice_call': return '📞';
      default: return '📢';
    }
  };

  if (!user) return null;

  return (
    <div style={{ position: 'relative' }}>
      {/* Кнопка уведомлений */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-400)',
          cursor: 'pointer',
          padding: '8px',
          borderRadius: '4px',
          position: 'relative',
          fontSize: '16px'
        }}
        title="Уведомления"
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '0',
            right: '0',
            background: 'var(--danger)',
            color: 'white',
            borderRadius: '50%',
            width: '16px',
            height: '16px',
            fontSize: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold'
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Выпадающее меню уведомлений */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: '0',
          width: '400px',
          maxHeight: '500px',
          backgroundColor: 'var(--bg-800)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          zIndex: 1000,
          overflow: 'hidden'
        }}>
          {/* Заголовок */}
          <div style={{
            padding: '16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h3 style={{ margin: 0, color: 'var(--text-100)', fontSize: '16px' }}>
              Уведомления
            </h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={markAllAsRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-400)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  padding: '4px 8px',
                  borderRadius: '4px'
                }}
              >
                Отметить все
              </button>
              <button
                onClick={clearAll}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--danger)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  padding: '4px 8px',
                  borderRadius: '4px'
                }}
              >
                Очистить
              </button>
            </div>
          </div>

          {/* Список уведомлений */}
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{
                padding: '32px 16px',
                textAlign: 'center',
                color: 'var(--text-500)',
                fontSize: '14px'
              }}>
                Нет уведомлений
              </div>
            ) : (
              notifications.map(notification => (
                <div
                  key={notification.id}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border-200)',
                    backgroundColor: notification.read ? 'transparent' : 'var(--bg-700)',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onClick={() => markAsRead(notification.id)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-700)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = notification.read ? 'transparent' : 'var(--bg-700)';
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px'
                  }}>
                    <div style={{
                      fontSize: '20px',
                      marginTop: '2px'
                    }}>
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontWeight: '600',
                        color: 'var(--text-100)',
                        fontSize: '14px',
                        marginBottom: '4px'
                      }}>
                        {notification.title}
                      </div>
                      <div style={{
                        color: 'var(--text-300)',
                        fontSize: '13px',
                        marginBottom: '4px',
                        lineHeight: '1.4'
                      }}>
                        {notification.message}
                      </div>
                      <div style={{
                        color: 'var(--text-500)',
                        fontSize: '11px'
                      }}>
                        {formatTime(notification.timestamp)}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeNotification(notification.id);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-500)',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}
                      title="Удалить"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Футер */}
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--border)',
            textAlign: 'center'
          }}>
            <button
              onClick={requestNotificationPermission}
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                color: 'var(--text-400)',
                cursor: 'pointer',
                padding: '6px 12px',
                borderRadius: '4px',
                fontSize: '12px'
              }}
            >
              {Notification.permission === 'granted' ? 'Уведомления включены' : 'Включить уведомления'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
