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
      <div style={{ padding: "8px", color: "var(--text-500)", fontSize: "14px" }}>
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
    <div>
      {channels.map((channel) => (
        <div
          key={channel.id}
          className={`sidebar-item ${selectedChannelId === channel.id ? 'active' : ''}`}
          onClick={() => handleChannelClick(channel)}
          onDoubleClick={() => handleChannelDoubleClick(channel)}
          style={{ 
            cursor: 'pointer',
            position: 'relative'
          }}
          title={channel.channel_type === 'voice' ? 'Двойной клик для подключения к голосовому каналу' : undefined}
        >
          {channel.channel_type === 'voice' ? '🎤' : '#'} {channel.name}
          {channel.channel_type === 'voice' && (
            <span style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '10px',
              color: 'var(--text-500)',
              opacity: 0.7
            }}>
              2x
            </span>
          )}
        </div>
      ))}
    </div>
  );
}


