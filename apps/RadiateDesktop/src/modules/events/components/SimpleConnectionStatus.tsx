import { useRealTime } from "../hooks/useRealTime";
import { useState, useEffect } from "react";

export function SimpleConnectionStatus() {
  const { isConnected } = useRealTime();
  const [fallbackMode, setFallbackMode] = useState(false);

  // Fallback режим: если WebSocket не подключен более 5 секунд, переключаемся на polling
  useEffect(() => {
    if (!isConnected) {
      const timer = setTimeout(() => {
        setFallbackMode(true);
      }, 5000);
      
      return () => clearTimeout(timer);
    } else {
      setFallbackMode(false);
    }
  }, [isConnected]);

  if (isConnected) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-400" title="Live real-time connection - все работает отлично">
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        <span className="font-medium">Live real-time</span>
      </div>
    );
  }

  if (fallbackMode) {
    return (
      <div className="flex items-center gap-2 text-sm text-yellow-400" title="Polling mode - обновления каждые 30 секунд">
        <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
        <span className="font-medium">Polling</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-red-400" title="Подключение...">
      <div className="w-2 h-2 bg-red-400 rounded-full" />
      <span className="font-medium">Connecting...</span>
    </div>
  );
}
