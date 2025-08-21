import { useQuery } from "@tanstack/react-query";
import { listChannels } from "../api";
import { useState } from "react";

interface ChannelListProps {
  guildId: string;
  selectedChannelId?: string;
  onChannelSelect?: (channelId: string) => void;
  onVoiceChannelJoin?: (channelId: string) => void;
}

export function ChannelList({ guildId, selectedChannelId, onChannelSelect, onVoiceChannelJoin }: ChannelListProps) {
  const { data: channels } = useQuery({ 
    queryKey: ["channels", guildId], 
    queryFn: () => listChannels(guildId), 
    enabled: !!guildId 
  });

  if (!channels || channels.length === 0) {
    return (
      <div className="p-2 text-gray-400 text-sm">
        Нет каналов
      </div>
    );
  }

  const handleChannelClick = (channel: any) => {
    onChannelSelect?.(channel.id);
  };

  const handleChannelDoubleClick = (channel: any) => {
    console.log('Double click on channel:', channel.name, channel.channel_type);
    if (channel.channel_type === 'voice') {
      console.log('Calling onVoiceChannelJoin for channel:', channel.id);
      onVoiceChannelJoin?.(channel.id);
    }
  };

  return (
    <div className="space-y-1">
      {channels.map((channel) => (
        <div
          key={channel.id}
          className={`px-3 py-2 rounded-md cursor-pointer transition-colors duration-150 relative ${
            selectedChannelId === channel.id 
              ? 'bg-gray-700 text-white' 
              : 'text-gray-300 hover:bg-gray-700 hover:text-white'
          }`}
          onClick={() => handleChannelClick(channel)}
          onDoubleClick={() => handleChannelDoubleClick(channel)}
          title={channel.channel_type === 'voice' ? 'Двойной клик для подключения к голосовому каналу' : undefined}
        >
          {channel.channel_type === 'voice' ? '🎤' : '#'} {channel.name}
          {channel.channel_type === 'voice' && (
            <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-gray-400 opacity-70">
              2x
            </span>
          )}
        </div>
      ))}
    </div>
  );
}


