import { PropsWithChildren, useEffect } from "react";
import { useAuth } from "../store";
import { useNavigate } from "react-router-dom";

export function AuthGuard({ children }: PropsWithChildren) {
  const { isAuthenticated, initialize } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Инициализируем аутентификацию при монтировании
    initialize();
  }, [initialize]);

  useEffect(() => {
    // Если не аутентифицирован, перенаправляем на логин
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  // Показываем загрузку пока проверяем аутентификацию
  if (!isAuthenticated) {
    return (
      <div className="grid place-items-center h-screen bg-discord-darker text-gray-400 text-lg">
        Проверка аутентификации...
      </div>
    );
  }

  return <>{children}</>;
}


