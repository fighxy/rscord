import { useQuery } from "@tanstack/react-query";
import { listChannels } from "../api";
import { useState } from "react";

interface ChannelListProps {
  guildId: string;
  selectedChannelId?: string;
  onChannelSelect?: (channelId: string) => void;
}

export function ChannelList({ guildId, selectedChannelId, onChannelSelect }: ChannelListProps) {
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

  return (
    <div>
              {channels.map((channel) => (
          <div
            key={channel.id}
            className={`sidebar-item ${selectedChannelId === channel.id ? 'active' : ''}`}
            onClick={() => onChannelSelect?.(channel.id)}
            style={{ cursor: 'pointer' }}
          >
            {channel.channel_type === 'voice' ? '🎤' : '#'} {channel.name}
          </div>
        ))}
    </div>
  );
}


