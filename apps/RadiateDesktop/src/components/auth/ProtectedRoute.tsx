import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../modules/auth/store';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, token, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Если пользователь не авторизован, перенаправляем на страницу логина
    if (!isAuthenticated || !token || !user) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, token, user, navigate]);

  // Если пользователь не авторизован, не рендерим защищенный контент
  if (!isAuthenticated || !token || !user) {
    return null;
  }

  return <>{children}</>;
}