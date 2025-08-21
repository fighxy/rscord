import { useEffect, useRef, useState } from "react";
import { useWebSocket } from "../client";
import { TypingIndicator, MessageUpdate, ChannelUpdate, GuildUpdate, UserStatusUpdate } from "../client";
import { useQueryClient } from "@tanstack/react-query";

export function useRealTime() {
  const ws = useWebSocket();
  const qc = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Map<string, Set<TypingIndicator>>>(new Map());
  const typingTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    if (!ws) return;

    // Обработка подключения
    const handleConnected = () => {
      setIsConnected(true);
      console.log('Real-time connection established');
    };

    const handleDisconnected = () => {
      setIsConnected(false);
      console.log('Real-time connection lost');
    };

    // Обработка новых сообщений
    const handleNewMessage = (message: MessageUpdate) => {
      // Инвалидируем кэш сообщений для этого канала
      qc.invalidateQueries({ queryKey: ["messages", message.channel_id] });
      
      // Убираем индикатор печати для автора
      removeTypingIndicator(message.channel_id, message.author_id);
    };

    // Обработка индикатора печати
    const handleTypingIndicator = (typing: TypingIndicator) => {
      setTypingUsers(prev => {
        const newMap = new Map(prev);
        const channelTyping = new Set(newMap.get(typing.channel_id) || []);
        
        if (typing.is_typing) {
          channelTyping.add(typing);
        } else {
          channelTyping.delete(typing);
        }
        
        if (channelTyping.size > 0) {
          newMap.set(typing.channel_id, channelTyping);
        } else {
          newMap.delete(typing.channel_id);
        }
        
        return newMap;
      });

      // Устанавливаем таймаут для автоматического удаления индикатора
      if (typing.is_typing) {
        const key = `${typing.channel_id}-${typing.user_id}`;
        const existingTimeout = typingTimeouts.current.get(key);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }
        
        const timeout = setTimeout(() => {
          removeTypingIndicator(typing.channel_id, typing.user_id);
        }, 5000); // 5 секунд
        
        typingTimeouts.current.set(key, timeout);
      }
    };

    // Обработка обновлений каналов
    const handleChannelUpdate = (channel: ChannelUpdate) => {
      qc.invalidateQueries({ queryKey: ["channels", channel.guild_id] });
      qc.invalidateQueries({ queryKey: ["channel", channel.id] });
    };

    // Обработка обновлений серверов
    const handleGuildUpdate = (guild: GuildUpdate) => {
      qc.invalidateQueries({ queryKey: ["guilds"] });
      qc.invalidateQueries({ queryKey: ["guild", guild.id] });
    };

    // Обработка обновлений статуса пользователей
    const handleUserStatusUpdate = (status: UserStatusUpdate) => {
      // Здесь можно обновить статус пользователей в UI
      console.log('User status update:', status);
    };

    // Подписываемся на события
    ws.on('connected', handleConnected);
    ws.on('disconnected', handleDisconnected);
    ws.on('new_message', handleNewMessage);
    ws.on('typing_indicator', handleTypingIndicator);
    ws.on('channel_update', handleChannelUpdate);
    ws.on('guild_update', handleGuildUpdate);
    ws.on('user_status_update', handleUserStatusUpdate);

    return () => {
      ws.off('connected', handleConnected);
      ws.off('disconnected', handleDisconnected);
      ws.off('new_message', handleNewMessage);
      ws.off('typing_indicator', handleTypingIndicator);
      ws.off('channel_update', handleChannelUpdate);
      ws.off('guild_update', handleGuildUpdate);
      ws.off('user_status_update', handleUserStatusUpdate);
    };
  }, [ws, qc]);

  // Функция для отправки индикатора печати
  const sendTypingIndicator = (channelId: string, isTyping: boolean) => {
    if (ws && isConnected) {
      ws.sendTypingIndicator(channelId, isTyping);
    }
  };

  // Функция для получения пользователей, печатающих в канале
  const getTypingUsers = (channelId: string): TypingIndicator[] => {
    return Array.from(typingUsers.get(channelId) || []);
  };

  // Функция для удаления индикатора печати
  const removeTypingIndicator = (channelId: string, userId: string) => {
    setTypingUsers(prev => {
      const newMap = new Map(prev);
      const channelTyping = newMap.get(channelId);
      
      if (channelTyping) {
        const filtered = new Set(Array.from(channelTyping).filter(t => t.user_id !== userId));
        if (filtered.size > 0) {
          newMap.set(channelId, filtered);
        } else {
          newMap.delete(channelId);
        }
      }
      
      return newMap;
    });

    // Очищаем таймаут
    const key = `${channelId}-${userId}`;
    const timeout = typingTimeouts.current.get(key);
    if (timeout) {
      clearTimeout(timeout);
      typingTimeouts.current.delete(key);
    }
  };

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      typingTimeouts.current.forEach(timeout => clearTimeout(timeout));
      typingTimeouts.current.clear();
    };
  }, []);

  return {
    isConnected,
    sendTypingIndicator,
    getTypingUsers,
    removeTypingIndicator
  };
}
