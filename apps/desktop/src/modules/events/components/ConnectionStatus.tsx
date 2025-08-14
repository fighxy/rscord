import { useRealTime } from "../hooks/useRealTime";

export function ConnectionStatus() {
  const { isConnected } = useRealTime();

  if (isConnected) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-green-400">
        <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
        Подключено
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-red-400">
      <div className="w-1.5 h-1.5 bg-red-400 rounded-full" />
      Отключено
    </div>
  );
}
