import { useState, useEffect } from "react";
import { useAuth } from "../store";
import { Link, useNavigate } from "react-router-dom";
import { AuthError } from "../components/AuthError";
import { Logo } from "../../../components/ui/Logo";
import { ArrowLeft } from "lucide-react";

export default function TelegramAuthPage() {
  const [code, setCode] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const { setToken, setUser } = useAuth();
  const navigate = useNavigate();

  const validateForm = () => {
    if (!username || username.length < 3) {
      setError("Введите имя пользователя (минимум 3 символа)");
      return false;
    }
    
    if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) {
      setError("Username может содержать только буквы, цифры и _ (3-32 символа)");
      return false;
    }
    
    if (!code || code.length !== 6) {
      setError("Введите 6-значный код подтверждения");
      return false;
    }
    
    if (!/^\d{6}$/.test(code)) {
      setError("Код должен содержать только цифры");
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
      // Импортируем authAPI
      const { authAPI } = await import('../api');
      
      // Проверяем код через auth-service
      const response = await authAPI.verifyTelegramCode({ code });
      
      // Сохраняем токен и пользователя
      setToken(response.access_token);
      if (response.user) {
        setUser({
          ...response.user,
          displayName: response.user.display_name
        });
      }
      
      // Переходим к главному экрану
      navigate("/initialization");
      
    } catch (error: any) {
      console.error("Telegram auth error:", error);
      setError(error.message || "Неправильный код подтверждения. Попробуйте снова.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--background-tertiary)' }}>
      <div className="w-full max-w-4xl">
        <div className="max-w-md mx-auto">
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
              <h2 className="text-2xl font-bold text-white">Вход через Telegram</h2>
              <p className="text-muted text-sm">
                Получите код подтверждения в Telegram боте и введите его ниже
              </p>
            </div>
            
            {/* Instructions and QR Code Side by Side */}
            <div className="flex gap-4 items-start">
              <div className="flex-1 bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <h3 className="text-blue-400 font-semibold mb-2">Инструкция:</h3>
                <ol className="text-sm text-blue-300 space-y-1">
                  <li>1. Откройте Telegram</li>
                  <li>2. Найдите бота @RadiateAuth_bot</li>
                  <li>3. Нажмите /start</li>
                  <li>4. Выберите "Регистрация" или "Вход"</li>
                  <li>5. Получите 6-значный код</li>
                  <li>6. Введите код ниже</li>
                </ol>
              </div>
              
              {/* QR Code next to instructions */}
              <div className="flex-shrink-0 text-center">
                <h4 className="text-sm font-semibold text-white mb-2">QR код</h4>
                <div className="rounded-lg p-2 inline-block" style={{ background: 'var(--background-secondary)' }}>
                  <img 
                    src="/qr/QR.png" 
                    alt="QR код для Telegram бота" 
                    className="w-20 h-20 object-contain"
                  />
                </div>
                <p className="text-xs text-muted mt-1">
                  Быстрый переход
                </p>
              </div>
            </div>

            {/* Success Notice */}
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                  </svg>
                </div>
                <div>
                  <h4 className="text-green-400 font-semibold text-sm mb-1">Готово к использованию</h4>
                  <p className="text-green-300 text-xs">
                    Telegram-бот подключен к серверу. 
                    Получите код в боте и введите его ниже.
                  </p>
                </div>
              </div>
            </div>
            
            {/* Error message */}
            <AuthError error={error} />
            
            {/* Form fields */}
            <div className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-xs font-semibold uppercase mb-2 text-muted">
                  Имя пользователя
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                  className="form-input"
                  placeholder="wind"
                  autoComplete="username"
                />
              </div>
              <div>
                <label htmlFor="code" className="block text-xs font-semibold uppercase mb-2 text-muted">
                  Код подтверждения
                </label>
                <input
                  id="code"
                  type="text"
                  value={code}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setCode(value);
                  }}
                  disabled={isLoading}
                  className="form-input text-center text-2xl tracking-widest"
                  placeholder="123456"
                  maxLength={6}
                  autoComplete="one-time-code"
                />
              </div>
            </div>
            
            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading || code.length !== 6 || username.length < 3}
              className="btn-primary w-full"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Проверка кода...
                </span>
              ) : (
                "Войти"
              )}
            </button>
            
            {/* Telegram Links with Back Button */}
            <div className="space-y-3">
              <div className="flex gap-3">
                {/* Back Button */}
                <Link 
                  to="/auth" 
                  className="flex-shrink-0 border-2 font-medium py-3 px-3 rounded-lg transition-colors duration-200 flex items-center justify-center hover:opacity-90"
                  style={{ 
                    borderColor: 'var(--text-muted)', 
                    color: 'var(--text-muted)',
                    background: 'transparent'
                  }}
                >
                  <ArrowLeft size={20} />
                </Link>
                
                {/* Bot Button */}
                <a 
                  href="https://t.me/RadiateAuth_bot" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex-1 font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 text-sm text-white hover:opacity-90"
                  style={{ background: 'var(--discord-blurple)' }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                  </svg>
                  Перейти к боту
                </a>
                
                {/* Channel Button */}
                <a 
                  href="https://t.me/RadiateChat" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex-1 border-2 font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 text-sm hover:opacity-90"
                  style={{ 
                    borderColor: 'var(--discord-blurple)', 
                    color: 'var(--discord-blurple)',
                    background: 'transparent'
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                  </svg>
                  Перейти в канал
                </a>
              </div>
              <p className="text-center text-xs text-muted">
                Нужна помощь с ботом или хотите присоединиться к сообществу?
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}