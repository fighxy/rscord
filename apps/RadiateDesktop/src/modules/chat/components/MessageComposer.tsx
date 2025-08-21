import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { sendMessage } from "../api";
import { useAuth } from "../../auth/store";
import { useRealTime } from "../../events/hooks/useRealTime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
      <div className="p-4 text-center text-gray-400 text-sm">
        Выберите канал для отправки сообщения
      </div>
    );
  }

  return (
    <div className="p-4 border-t border-gray-700 bg-discord-dark">
      {error && (
        <div className="p-3 mb-3 bg-red-900/20 border border-red-800 text-red-300 rounded-md text-sm">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input 
          className="flex-1 bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-discord-blurple focus:border-transparent"
          placeholder="Написать сообщение..." 
          value={text} 
          onChange={(e) => setText(e.target.value)}
          disabled={mutation.isPending}
        />
        <Button 
          type="submit" 
          disabled={mutation.isPending || !text.trim() || !user?.id}
          className="min-w-[80px] bg-discord-blurple hover:bg-blue-600 disabled:opacity-60"
        >
          {mutation.isPending ? "Отправка..." : "Отправить"}
        </Button>
      </form>
    </div>
  );
}


