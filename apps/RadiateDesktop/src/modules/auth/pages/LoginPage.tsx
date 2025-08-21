import { useNavigate } from "react-router-dom";
import { Logo } from "../../../components/ui/Logo";

export default function LoginPage() {
  const navigate = useNavigate();

  const handleTelegramAuth = () => {
    navigate("/telegram-auth");
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--background-tertiary)' }}>
      <div className="w-full max-w-md">
        <div 
          className="rounded-lg p-8 space-y-6"
          style={{ background: 'var(--background-primary)' }}
        >
          {/* Logo and Title */}
          <div className="text-center space-y-4">
            <div className="flex justify-center mb-4">
              <Logo size="xxxl" />
            </div>
            <h1 className="text-3xl font-bold text-white">Добро пожаловать в Radiate</h1>
            <p className="text-muted">
              Войдите или зарегистрируйтесь через Telegram
            </p>
          </div>
          
          {/* Telegram Auth Button */}
          <button
            onClick={handleTelegramAuth}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-4 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-3"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
            Зарегистрироваться / Войти через Telegram
          </button>
          
          {/* Help section */}
          <div className="text-center text-sm text-muted space-y-2">
            <p>Быстро и безопасно</p>
            <p>Никаких паролей и подтверждений email</p>
          </div>
        </div>
      </div>
    </div>
  );
}
