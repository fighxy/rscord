import { PropsWithChildren, useEffect } from "react";
import { useAuth } from "../store";
import { useNavigate } from "react-router-dom";

export function AuthGuard({ children }: PropsWithChildren) {
  const { token, isAuthenticated, checkAuth } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Проверяем аутентификацию при монтировании компонента
    const isAuth = checkAuth();
    
    if (!isAuth) {
      navigate("/login");
    }
  }, [checkAuth, navigate]);

  // Показываем компонент только если пользователь аутентифицирован
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}


