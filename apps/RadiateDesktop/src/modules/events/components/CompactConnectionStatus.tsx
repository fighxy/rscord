import { useRealTime } from "../hooks/useRealTime";
import { useState, useEffect } from "react";

export function CompactConnectionStatus() {
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
      <div className="flex items-center gap-1 text-xs text-green-400" title="Live real-time connection">
        <div className="w-1 h-1 bg-green-400 rounded-full animate-pulse" />
        Live
      </div>
    );
  }

  if (fallbackMode) {
    return (
      <div className="flex items-center gap-1 text-xs text-yellow-400" title="Polling mode - updates every 30s">
        <div className="w-1 h-1 bg-yellow-400 rounded-full animate-pulse" />
        Poll
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-xs text-red-400" title="Connecting...">
      <div className="w-1 h-1 bg-red-400 rounded-full" />
      Conn
    </div>
  );
}
