import { ChannelList } from "../channels/components/ChannelList";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createChannel } from "../channels/api";
import { useAuth } from "../auth/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ChannelSidebarProps {
  guildId: string;
  selectedChannelId?: string;
  onChannelSelect?: (channelId: string) => void;
  onVoiceChannelJoin?: (channelId: string) => void;
}

export function ChannelSidebar({ guildId, selectedChannelId, onChannelSelect, onVoiceChannelJoin }: ChannelSidebarProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [channelName, setChannelName] = useState("");

  const createChannelMutation = useMutation({
    mutationFn: () => {
      if (!user?.id) {
        throw new Error("Пользователь не аутентифицирован");
      }
      
      // Получаем выбранный тип канала
      const channelTypeInput = document.querySelector('input[name="channelType"]:checked') as HTMLInputElement;
      const channelType = channelTypeInput?.value as 'text' | 'voice' || 'text';
      
      return createChannel(guildId, channelName, channelType);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["channels", guildId] });
      setChannelName("");
      setIsCreating(false);
    },
    onError: (error: any) => {
      console.error("Ошибка создания канала:", error);
    },
  });

  const handleCreateChannel = () => {
    if (!channelName.trim()) return;
    createChannelMutation.mutate();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-discord-dark">
        <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">Каналы</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCreating(true)}
          className="w-6 h-6 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-full hover:scale-105 transition-all duration-200"
          title="Создать канал"
        >
          +
        </Button>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {isCreating && (
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 space-y-3">
            <Input
              placeholder="Название канала"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-discord-blurple focus:border-transparent"
            />
            
            {/* Channel Type Selection */}
            <div className="flex gap-3 text-sm">
              <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                <input
                  type="radio"
                  name="channelType"
                  value="text"
                  defaultChecked
                  className="text-discord-blurple focus:ring-discord-blurple"
                />
                💬 Текстовый
              </label>
              <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                <input
                  type="radio"
                  name="channelType"
                  value="voice"
                  className="text-discord-blurple focus:ring-discord-blurple"
                />
                🎤 Голосовой
              </label>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handleCreateChannel}
                disabled={createChannelMutation.isPending || !channelName.trim()}
                className="flex-1 bg-discord-blurple hover:bg-blue-600 disabled:bg-gray-600"
                size="sm"
              >
                {createChannelMutation.isPending ? "Создание..." : "Создать"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreating(false);
                  setChannelName("");
                }}
                size="sm"
                className="bg-gray-700 hover:bg-gray-600 border-gray-600 text-gray-300"
              >
                Отмена
              </Button>
            </div>
          </div>
        )}
        
        <ChannelList 
          guildId={guildId} 
          selectedChannelId={selectedChannelId}
          onChannelSelect={onChannelSelect}
          onVoiceChannelJoin={onVoiceChannelJoin}
        />
      </div>
    </div>
  );
}


