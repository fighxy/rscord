import { useRealTime } from "../hooks/useRealTime";

export function ConnectionStatus() {
  const { isConnected } = useRealTime();

  if (isConnected) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "12px",
        color: "var(--success)"
      }}>
        <div style={{
          width: "6px",
          height: "6px",
          backgroundColor: "var(--success)",
          borderRadius: "50%",
          animation: "pulse 2s infinite"
        }} />
        Подключено
      </div>
    );
  }

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "6px",
      fontSize: "12px",
      color: "var(--danger)"
    }}>
      <div style={{
        width: "6px",
        height: "6px",
        backgroundColor: "var(--danger)",
        borderRadius: "50%"
      }} />
      Отключено
    </div>
  );
}

// Добавляем CSS анимацию
const style = document.createElement('style');
style.textContent = `
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
`;
document.head.appendChild(style);
