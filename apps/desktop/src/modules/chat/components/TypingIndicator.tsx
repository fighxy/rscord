import { useRealTime } from "../../events/hooks/useRealTime";

interface TypingIndicatorProps {
  channelId: string;
}

export function TypingIndicator({ channelId }: TypingIndicatorProps) {
  const { getTypingUsers } = useRealTime();
  const typingUsers = getTypingUsers(channelId);

  if (typingUsers.length === 0) {
    return null;
  }

  const formatTypingText = (users: typeof typingUsers) => {
    if (users.length === 1) {
      return `${users[0].display_name} печатает...`;
    } else if (users.length === 2) {
      return `${users[0].display_name} и ${users[1].display_name} печатают...`;
    } else {
      return `${users[0].display_name} и еще ${users.length - 1} печатают...`;
    }
  };

  return (
    <div style={{
      padding: "8px 16px",
      color: "var(--text-500)",
      fontSize: "12px",
      fontStyle: "italic",
      display: "flex",
      alignItems: "center",
      gap: "8px"
    }}>
      <div style={{
        display: "flex",
        gap: "2px"
      }}>
        <div style={{
          width: "4px",
          height: "4px",
          backgroundColor: "var(--text-500)",
          borderRadius: "50%",
          animation: "typing-dot 1.4s infinite ease-in-out"
        }} />
        <div style={{
          width: "4px",
          height: "4px",
          backgroundColor: "var(--text-500)",
          borderRadius: "50%",
          animation: "typing-dot 1.4s infinite ease-in-out",
          animationDelay: "0.2s"
        }} />
        <div style={{
          width: "4px",
          height: "4px",
          backgroundColor: "var(--text-500)",
          borderRadius: "50%",
          animation: "typing-dot 1.4s infinite ease-in-out",
          animationDelay: "0.4s"
        }} />
      </div>
      <span>{formatTypingText(typingUsers)}</span>
    </div>
  );
}

// Добавляем CSS анимацию для точек
const style = document.createElement('style');
style.textContent = `
  @keyframes typing-dot {
    0%, 60%, 100% {
      transform: translateY(0);
      opacity: 0.4;
    }
    30% {
      transform: translateY(-6px);
      opacity: 1;
    }
  }
`;
document.head.appendChild(style);
