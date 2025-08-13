import { useAuth } from "../../auth/store";

export function NotificationCenter() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div style={{ position: 'relative' }}>
      {/* Декоративная кнопка уведомлений */}
      <button
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-400)',
          padding: '8px',
          borderRadius: '4px',
          position: 'relative',
          fontSize: '16px',
          cursor: 'default'
        }}
        title="Уведомления (неактивно)"
      >
        🔔
      </button>
    </div>
  );
}
