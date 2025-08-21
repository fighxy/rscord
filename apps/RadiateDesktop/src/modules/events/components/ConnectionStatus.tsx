import { useRealTime } from "../hooks/useRealTime";
import { useState, useEffect } from "react";

export function ConnectionStatus() {
  const { isConnected } = useRealTime();
  const [fallbackMode, setFallbackMode] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

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

  if (isConnected) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-green-400" title="Live real-time connection">
        <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
        Live real-time
      </div>
    );
  }

  if (fallbackMode) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-yellow-400" title={`Polling mode - Last update: ${lastUpdate.toLocaleTimeString()}`}>
        <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />
        Polling
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-red-400" title="Disconnected - Attempting to reconnect...">
      <div className="w-1.5 h-1.5 bg-red-400 rounded-full" />
      Connecting...
    </div>
  );
}
