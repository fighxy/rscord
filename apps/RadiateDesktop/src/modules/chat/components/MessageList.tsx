import { useQuery } from "@tanstack/react-query";
import { listMessages } from "../api";
import { useAuth } from "../../auth/store";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

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
      <div className="grid place-items-center h-full text-gray-400 text-base">
        Выберите канал для начала общения
      </div>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <div className="grid place-items-center h-full text-gray-400 text-base">
        Нет сообщений в этом канале
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      {messages.map((message) => (
        <div key={message.id} className="flex gap-3">
          {/* Аватар пользователя */}
          <Avatar className="w-10 h-10">
            <AvatarFallback className="bg-discord-blurple text-white text-base font-bold">
              {message.author_id.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          {/* Содержимое сообщения */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-gray-200 text-sm">
                {message.author_id.slice(0, 8)}
              </span>
              <span className="text-gray-400 text-xs">
                {new Date(message.created_at).toLocaleString('ru-RU', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
            <div className="text-gray-300 text-sm leading-relaxed">
              {message.content}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}


