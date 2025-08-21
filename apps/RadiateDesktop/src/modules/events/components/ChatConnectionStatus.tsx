import { useRealTime } from "../hooks/useRealTime";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";

export function ChatConnectionStatus() {
  const { isConnected } = useRealTime();
  const [fallbackMode, setFallbackMode] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor'>('good');

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

  // Симуляция качества соединения (в реальном приложении это должно приходить с сервера)
  useEffect(() => {
    if (isConnected) {
      const interval = setInterval(() => {
        const random = Math.random();
        if (random > 0.8) {
          setConnectionQuality('excellent');
        } else if (random > 0.4) {
          setConnectionQuality('good');
        } else {
          setConnectionQuality('poor');
        }
      }, 10000);
      
      return () => clearInterval(interval);
    }
  }, [isConnected]);

  const getStatusColor = () => {
    if (isConnected) {
      switch (connectionQuality) {
        case 'excellent': return 'bg-green-500';
        case 'good': return 'bg-green-400';
        case 'poor': return 'bg-yellow-400';
        default: return 'bg-green-400';
      }
    }
    if (fallbackMode) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getStatusText = () => {
    if (isConnected) {
      return `Live real-time (${connectionQuality})`;
    }
    if (fallbackMode) {
      return `Polling - Last: ${lastUpdate.toLocaleTimeString()}`;
    }
    return 'Connecting...';
  };

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

  return (
    <Badge 
      variant="secondary" 
      className={`flex items-center gap-2 px-3 py-1 text-xs font-medium ${getStatusColor()} text-white border-0`}
      title={getStatusText()}
    >
      <span className="text-sm">{getStatusIcon()}</span>
      <span className="hidden sm:inline">
        {isConnected ? 'Live real-time' : fallbackMode ? 'Polling' : 'Connecting...'}
      </span>
      {isConnected && (
        <span className="hidden md:inline text-xs opacity-80">
          ({connectionQuality})
        </span>
      )}
      {fallbackMode && (
        <span className="hidden md:inline text-xs opacity-80">
          {lastUpdate.toLocaleTimeString()}
        </span>
      )}
    </Badge>
  );
}
