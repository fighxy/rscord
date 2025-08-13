import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { sendMessage } from "../api";
import { useAuth } from "../../auth/store";
import { useRealTime } from "../../events/hooks/useRealTime";

interface MessageComposerProps {
  channelId: string;
}

export function MessageComposer({ channelId }: MessageComposerProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { sendTypingIndicator } = useRealTime();
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      if (!user?.id) {
        throw new Error("Пользователь не аутентифицирован");
      }
      return sendMessage(channelId, user.id, text);
    },
    onSuccess: () => {
      setText("");
      setError("");
      qc.invalidateQueries({ queryKey: ["messages", channelId] });
    },
    onError: (error: any) => {
      setError(error.message || "Ошибка при отправке сообщения");
    },
  });

  // Отправляем индикатор печати при вводе
  useEffect(() => {
    if (!text.trim() || !channelId) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        sendTypingIndicator(channelId, false);
      }
      return;
    }

    // Отправляем индикатор печати
    sendTypingIndicator(channelId, true);

    // Очищаем предыдущий таймаут
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Устанавливаем таймаут для остановки индикатора
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingIndicator(channelId, false);
    }, 2000); // 2 секунды после остановки печати

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [text, channelId, sendTypingIndicator]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    if (!user?.id) {
      setError("Пользователь не аутентифицирован");
      return;
    }
    
    // Останавливаем индикатор печати при отправке
    sendTypingIndicator(channelId, false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    mutation.mutate();
  };

  if (!channelId) {
    return (
      <div style={{ 
        padding: "16px", 
        textAlign: "center", 
        color: "var(--text-500)",
        fontSize: "14px"
      }}>
        Выберите канал для отправки сообщения
      </div>
    );
  }

  return (
    <div className="chat-input">
      {error && (
        <div style={{ 
          padding: "8px 12px", 
          backgroundColor: "var(--error-100)", 
          color: "var(--error-600)",
          borderRadius: "4px",
          fontSize: "14px",
          marginBottom: "8px"
        }}>
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: "8px" }}>
        <input 
          style={{ flex: 1 }} 
          placeholder="Написать сообщение..." 
          value={text} 
          onChange={(e) => setText(e.target.value)}
          disabled={mutation.isPending}
        />
        <button 
          type="submit" 
          disabled={mutation.isPending || !text.trim() || !user?.id}
          style={{ 
            minWidth: "80px",
            opacity: mutation.isPending || !text.trim() || !user?.id ? 0.6 : 1
          }}
        >
          {mutation.isPending ? "Отправка..." : "Отправить"}
        </button>
      </form>
    </div>
  );
}


