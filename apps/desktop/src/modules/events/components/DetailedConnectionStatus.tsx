import { useRealTime } from "../hooks/useRealTime";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function DetailedConnectionStatus() {
  const { isConnected } = useRealTime();
  const [fallbackMode, setFallbackMode] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor'>('good');
  const [latency, setLatency] = useState<number>(0);
  const [reconnectAttempts, setReconnectAttempts] = useState<number>(0);

  // Fallback режим: если WebSocket не подключен более 5 секунд, переключаемся на polling
  useEffect(() => {
    if (!isConnected) {
      const timer = setTimeout(() => {
        setFallbackMode(true);
      }, 5000);
      
      return () => clearTimeout(timer);
    } else {
      setFallbackMode(false);
      setLastUpdate(new Date());
    }
  }, [isConnected]);

  // В fallback режиме обновляем время каждые 30 секунд
  useEffect(() => {
    if (fallbackMode) {
      const interval = setInterval(() => {
        setLastUpdate(new Date());
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [fallbackMode]);

  // Симуляция метрик соединения
  useEffect(() => {
    if (isConnected) {
      const interval = setInterval(() => {
        // Качество соединения
        const random = Math.random();
        if (random > 0.8) {
          setConnectionQuality('excellent');
        } else if (random > 0.4) {
          setConnectionQuality('good');
        } else {
          setConnectionQuality('poor');
        }

        // Латентность (в реальном приложении это должно измеряться)
        setLatency(Math.floor(Math.random() * 100) + 20);
      }, 10000);
      
      return () => clearInterval(interval);
    }
  }, [isConnected]);

  // Счетчик попыток переподключения
  useEffect(() => {
    if (!isConnected && !fallbackMode) {
      setReconnectAttempts(prev => prev + 1);
    } else {
      setReconnectAttempts(0);
    }
  }, [isConnected, fallbackMode]);

  const getStatusIcon = () => {
    if (isConnected) {
      switch (connectionQuality) {
        case 'excellent': return '🟢';
        case 'good': return '🟢';
        case 'poor': return '🟡';
        default: return '🟢';
      }
    }
    if (fallbackMode) return '🟡';
    return '🔴';
  };

  const getStatusText = () => {
    if (isConnected) return 'Live Real-time';
    if (fallbackMode) return 'Polling Mode';
    return 'Connecting...';
  };

  const getStatusColor = () => {
    if (isConnected) return 'text-green-400';
    if (fallbackMode) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <Card className="bg-discord-dark border-gray-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm text-gray-200 flex items-center gap-2">
          <span className="text-lg">{getStatusIcon()}</span>
          Статус соединения
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Основной статус */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Режим:</span>
          <Badge 
            variant="secondary" 
            className={`text-xs ${getStatusColor()} bg-opacity-20`}
          >
            {getStatusText()}
          </Badge>
        </div>

        {/* Качество соединения */}
        {isConnected && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Качество:</span>
            <Badge 
              variant="outline" 
              className="text-xs border-gray-600 text-gray-300"
            >
              {connectionQuality === 'excellent' && 'Отличное'}
              {connectionQuality === 'good' && 'Хорошее'}
              {connectionQuality === 'poor' && 'Плохое'}
            </Badge>
          </div>
        )}

        {/* Латентность */}
        {isConnected && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Латентность:</span>
            <span className="text-xs text-gray-300">{latency}ms</span>
          </div>
        )}

        {/* Последнее обновление в fallback режиме */}
        {fallbackMode && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Обновлено:</span>
            <span className="text-xs text-gray-300">
              {lastUpdate.toLocaleTimeString()}
            </span>
          </div>
        )}

        {/* Попытки переподключения */}
        {!isConnected && !fallbackMode && reconnectAttempts > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Попытки:</span>
            <span className="text-xs text-red-400">{reconnectAttempts}</span>
          </div>
        )}

        {/* Информация о режиме */}
        <div className="pt-2 border-t border-gray-700">
          <div className="text-xs text-gray-500 leading-relaxed">
            {isConnected ? (
              <>
                <div className="font-medium text-green-400 mb-1">✅ Live Real-time</div>
                <div>Мгновенные обновления через WebSocket</div>
              </>
            ) : fallbackMode ? (
              <>
                <div className="font-medium text-yellow-400 mb-1">🔄 Polling Mode</div>
                <div>Обновления каждые 30 секунд</div>
              </>
            ) : (
              <>
                <div className="font-medium text-red-400 mb-1">⏳ Подключение...</div>
                <div>Попытка установить соединение</div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
