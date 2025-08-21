import { useState, useEffect } from "react";
import { useAuth } from "../store";
import { useNavigate } from "react-router-dom";
import { Logo } from "../../../components/ui/Logo";

interface InitStep {
  id: string;
  name: string;
  description: string;
  completed: boolean;
  error?: string;
}

export default function InitializationPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<InitStep[]>([
    {
      id: "token",
      name: "Проверка сессии",
      description: "Валидация токена авторизации...",
      completed: false
    },
    {
      id: "profile",
      name: "Загрузка профиля",
      description: "Получение данных пользователя...",
      completed: false
    },
    {
      id: "servers", 
      name: "Подключение к серверам",
      description: "Установка соединения с gateway...",
      completed: false
    },
    {
      id: "guilds",
      name: "Загрузка серверов",
      description: "Синхронизация ваших серверов...",
      completed: false
    },
    {
      id: "audio",
      name: "Настройка аудио",
      description: "Инициализация аудио устройств...",
      completed: false
    },
    {
      id: "cache",
      name: "Загрузка данных",
      description: "Кэширование последних сообщений...",
      completed: false
    }
  ]);

  useEffect(() => {
    if (!user || !token) {
      navigate("/login");
      return;
    }

    // Проверяем, нужна ли инициализация (флаг в localStorage)
    const needsInitialization = !localStorage.getItem('app-initialized');
    
    if (!needsInitialization) {
      // Если уже инициализировано, сразу переходим в основное приложение
      navigate("/app");
      return;
    }

    initializeApp();
  }, [user, token, navigate]);

  const initializeApp = async () => {
    for (let i = 0; i < steps.length; i++) {
      setCurrentStep(i);
      
      try {
        // Симуляция инициализации каждого шага
        await performStep(steps[i]);
        
        setSteps(prev => prev.map((step, index) => 
          index === i ? { ...step, completed: true } : step
        ));

        // Небольшая задержка для визуального эффекта
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        setSteps(prev => prev.map((step, index) => 
          index === i ? { 
            ...step, 
            error: error instanceof Error ? error.message : "Неизвестная ошибка" 
          } : step
        ));
        return;
      }
    }

    // Все шаги завершены успешно
    // Устанавливаем флаг, что приложение инициализировано
    localStorage.setItem('app-initialized', 'true');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    navigate("/app");
  };

  const performStep = async (step: InitStep): Promise<void> => {
    // Симуляция различных этапов инициализации
    const delay = Math.random() * 1000 + 500; // 0.5-1.5 секунды
    
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Симуляция случайной ошибки (5% вероятность)
        if (Math.random() < 0.05) {
          reject(new Error(`Ошибка при выполнении: ${step.name}`));
        } else {
          resolve();
        }
      }, delay);
    });
  };

  const progress = Math.round((steps.filter(s => s.completed).length / steps.length) * 100);
  const hasError = steps.some(s => s.error);

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--background-tertiary)' }}>
      <div className="w-full max-w-md">
        <div 
          className="rounded-lg p-8 space-y-6"
          style={{ background: 'var(--background-primary)' }}
        >
          {/* Logo and Welcome */}
          <div className="text-center space-y-4">
            <div className="flex justify-center mb-6">
              <div className="scale-150">
                <Logo size="xxxl" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white">
              Добро пожаловать в Radiate
            </h1>
            {user && (
              <p className="text-muted text-sm">
                Привет, {user.displayName || user.username}!
              </p>
            )}
          </div>

          {/* Progress Bar */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-white font-medium">Инициализация</span>
              <span className="text-sm text-muted">{progress}%</span>
            </div>
            
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className="h-2 rounded-full transition-all duration-300 ease-out"
                style={{ 
                  width: `${progress}%`,
                  background: hasError ? 'var(--status-danger)' : 'var(--discord-blurple)'
                }}
              />
            </div>
          </div>

          {/* Current Step */}
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div 
                key={step.id}
                className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${
                  index === currentStep ? 'bg-blue-500/10 border border-blue-500/20' :
                  step.completed ? 'bg-green-500/10' :
                  step.error ? 'bg-red-500/10' :
                  'opacity-50'
                }`}
              >
                {/* Status Icon */}
                <div className="flex-shrink-0">
                  {step.completed ? (
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                        <polyline points="20,6 9,17 4,12"/>
                      </svg>
                    </div>
                  ) : step.error ? (
                    <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </div>
                  ) : index === currentStep ? (
                    <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"/>
                  ) : (
                    <div className="w-6 h-6 border-2 border-gray-600 rounded-full"/>
                  )}
                </div>

                {/* Step Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{step.name}</p>
                  <p className="text-xs text-muted">
                    {step.error || step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Error Handling */}
          {hasError && (
            <div className="text-center space-y-3">
              <p className="text-sm text-red-400">
                Произошла ошибка при инициализации
              </p>
              <button
                onClick={() => window.location.reload()}
                className="btn-primary text-sm px-6 py-2"
              >
                Попробовать снова
              </button>
            </div>
          )}

          {/* Completion Message */}
          {progress === 100 && !hasError && (
            <div className="text-center">
              <p className="text-sm text-green-400 font-medium">
                ✨ Инициализация завершена! Переход в приложение...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}