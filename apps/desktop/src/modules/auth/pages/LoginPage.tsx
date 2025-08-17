import { useState } from "react";
import { useAuth } from "../store";
import { authAPI } from "../api";
import { Link, useNavigate } from "react-router-dom";
import { AuthError } from "../components/AuthError";
import { Logo } from "../../../components/ui/Logo";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const { setToken, setUser } = useAuth();
  const navigate = useNavigate();

  const validateForm = () => {
    if (!email || !password) {
      setError("Все поля обязательны для заполнения");
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
      const response = await authAPI.login({ email, password });
      
      // Save tokens
      setToken(response.access_token);
      if (response.refresh_token) {
        localStorage.setItem('refresh_token', response.refresh_token);
      }
      
      // Get user info
      try {
        const userInfo = await authAPI.getCurrentUser();
        setUser({
          id: userInfo.id,
          email: userInfo.email,
          displayName: userInfo.display_name || userInfo.username
        });
      } catch (userError) {
        console.warn("Could not fetch user info:", userError);
        // Create basic user info from email
        setUser({
          id: "temp-" + Date.now(),
          email: email,
          displayName: email.split('@')[0]
        });
      }
      
      navigate("/");
    } catch (error: any) {
      console.error("Login error:", error);
      setError(error.message || "Ошибка при входе. Попробуйте снова.");
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
            <div className="flex justify-center mb-4">
              <Logo size="xxxl" />
            </div>
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
                autoComplete="current-password"
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
                Вход...
              </span>
            ) : (
              "Войти"
            )}
          </button>
          
          {/* Register link */}
          <div className="text-center text-sm">
            <span className="text-muted">Нужен аккаунт? </span>
            <Link 
              to="/register" 
              className="font-medium hover:underline"
              style={{ color: 'var(--discord-blurple)' }}
            >
              Зарегистрироваться
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
