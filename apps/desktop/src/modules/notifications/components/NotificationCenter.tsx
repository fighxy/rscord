import { useAuth } from "../../auth/store";

export function NotificationCenter() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="relative">
      {/* Декоративная кнопка уведомлений */}
      <button
        className="bg-transparent border-none text-gray-400 p-2 rounded cursor-default text-base"
        title="Уведомления (неактивно)"
      >
        🔔
      </button>
    </div>
  );
}
