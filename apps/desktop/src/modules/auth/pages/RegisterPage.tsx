import { useState } from "react";
import { useAuth } from "../store";
import { authAPI } from "../api";
import { Link, useNavigate } from "react-router-dom";
import { AuthError } from "../components/AuthError";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const { setToken, setUser } = useAuth();
  const navigate = useNavigate();

  const validateForm = () => {
    if (!email || !displayName || !password || !confirmPassword) {
      setError("Все поля обязательны для заполнения");
      return false;
    }
    
    if (password.length < 6) {
      setError("Пароль должен содержать минимум 6 символов");
      return false;
    }
    
    if (password !== confirmPassword) {
      setError("Пароли не совпадают");
      return false;
    }
    
    if (!email.includes('@')) {
      setError("Введите корректный email");
      return false;
    }
    
    return true;
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    
    try {
      // Register user
      const registerResponse = await authAPI.register({
        email,
        display_name: displayName,
        password
      });
      
      // Auto-login after registration
      const loginResponse = await authAPI.login({ email, password });
      
      // Save token and refresh token
      setToken(loginResponse.access_token);
      if (loginResponse.refresh_token) {
        localStorage.setItem('refresh_token', loginResponse.refresh_token);
      }
      
      // Set user info
      setUser({
        id: registerResponse.user.id,
        email: registerResponse.user.email,
        displayName: registerResponse.user.display_name
      });
      
      navigate("/");
    } catch (error: any) {
      setError(error.message || "Ошибка при регистрации. Попробуйте снова.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--background-tertiary)' }}>
      <div className="w-full max-w-md">
        <form 
          onSubmit={submit} 
          className="rounded-lg p-8 space-y-6"
          style={{ background: 'var(--background-primary)' }}
        >
          {/* Logo and Title */}
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold tracking-tight" style={{ color: 'var(--discord-blurple)' }}>
              RSCORD
            </h1>
            <p className="text-muted">Создайте аккаунт</p>
          </div>
          
          {/* Error message */}
          <AuthError error={error} />
          
          {/* Form fields */}
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold uppercase mb-2 text-muted">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="form-input"
                placeholder="name@example.com"
                autoComplete="email"
              />
            </div>
            
            <div>
              <label htmlFor="displayName" className="block text-xs font-semibold uppercase mb-2 text-muted">
                Имя пользователя
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={isLoading}
                className="form-input"
                placeholder="Ваше имя"
                autoComplete="username"
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-xs font-semibold uppercase mb-2 text-muted">
                Пароль
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="form-input"
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
            
            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-semibold uppercase mb-2 text-muted">
                Подтвердите пароль
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                className="form-input"
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
          </div>
          
          {/* Submit button */}
          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Регистрация...
              </span>
            ) : (
              "Зарегистрироваться"
            )}
          </button>
          
          {/* Login link */}
          <div className="text-center text-sm">
            <span className="text-muted">Уже есть аккаунт? </span>
            <Link 
              to="/login" 
              className="font-medium hover:underline"
              style={{ color: 'var(--discord-blurple)' }}
            >
              Войти
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}