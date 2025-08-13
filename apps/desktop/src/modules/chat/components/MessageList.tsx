import { useQuery } from "@tanstack/react-query";
import { listMessages } from "../api";
import { useAuth } from "../../auth/store";

interface MessageListProps {
  channelId: string;
}

export function MessageList({ channelId }: MessageListProps) {
  const { data: messages } = useQuery({ 
    queryKey: ["messages", channelId], 
    queryFn: () => listMessages(channelId), 
    enabled: !!channelId 
  });

  if (!channelId) {
    return (
      <div style={{ 
        display: "grid", 
        placeItems: "center", 
        height: "100%", 
        color: "var(--text-500)",
        fontSize: "16px"
      }}>
        Выберите канал для начала общения
      </div>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <div style={{ 
        display: "grid", 
        placeItems: "center", 
        height: "100%", 
        color: "var(--text-500)",
        fontSize: "16px"
      }}>
        Нет сообщений в этом канале
      </div>
    );
  }

  return (
    <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
      {messages.map((message) => (
        <div key={message.id} style={{ display: "flex", gap: "12px" }}>
          {/* Аватар пользователя */}
          <div style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            backgroundColor: "var(--brand)",
            display: "grid",
            placeItems: "center",
            color: "white",
            fontSize: "16px",
            fontWeight: "bold"
          }}>
            {message.author_id.slice(0, 2).toUpperCase()}
          </div>
          
          {/* Содержимое сообщения */}
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span style={{ 
                fontWeight: "600", 
                color: "var(--text-100)",
                fontSize: "14px"
              }}>
                {message.author_id.slice(0, 8)}
              </span>
              <span style={{ 
                color: "var(--text-500)", 
                fontSize: "12px"
              }}>
                {new Date(message.created_at).toLocaleString('ru-RU', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
            <div style={{ 
              color: "var(--text-300)", 
              fontSize: "14px",
              lineHeight: "1.4"
            }}>
              {message.content}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}


