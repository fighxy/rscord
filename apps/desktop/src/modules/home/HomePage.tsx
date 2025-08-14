import { GuildList } from "../guilds/components/GuildList";
import { useState, useEffect } from "react";
import { AppShell } from "../layout/AppShell";
import { GuildBar } from "../layout/GuildBar";
import { ChannelSidebar } from "../layout/ChannelSidebar";
import { ChatPane } from "../layout/ChatPane";
import { MemberList } from "../layout/MemberList";
import { useAuth } from "../auth/store";
import { useQuery } from "@tanstack/react-query";
import { listGuilds } from "../guilds/api";

export default function HomePage() {
  const { user } = useAuth();
  const [selectedGuild, setSelectedGuild] = useState<string>("");
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [joinedVoiceChannel, setJoinedVoiceChannel] = useState<string>("");

  const { data: guilds } = useQuery({ 
    queryKey: ["guilds"], 
    queryFn: listGuilds,
    enabled: !!user
  });

  // Автоматически выбираем первый сервер, если он есть
  useEffect(() => {
    if (guilds && guilds.length > 0 && !selectedGuild) {
      setSelectedGuild(guilds[0].id);
    }
  }, [guilds, selectedGuild]);

  const handleGuildSelect = (guildId: string) => {
    setSelectedGuild(guildId);
    setSelectedChannel(""); // Сбрасываем выбранный канал при смене сервера
    setJoinedVoiceChannel(""); // Сбрасываем голосовой канал при смене сервера
  };

  const handleChannelSelect = (channelId: string) => {
    setSelectedChannel(channelId);
    setJoinedVoiceChannel(""); // Сбрасываем автоподключение при обычном выборе канала
  };

  const handleVoiceChannelJoin = (channelId: string) => {
    console.log('Voice channel join requested:', channelId);
    setSelectedChannel(channelId);
    setJoinedVoiceChannel(channelId);
  };

  if (!user) {
    return (
      <div className="grid place-items-center h-screen text-gray-400 text-lg">
        Загрузка...
      </div>
    );
  }

  return (
    <AppShell
      guildBar={<GuildBar />}
      sidebar={
        <div className="flex flex-col h-full">
          {/* Guilds Section */}
          <div className="flex flex-col">
            <div className="px-4 py-3 border-b border-gray-700 bg-discord-dark">
              <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">Сервера</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              <GuildList 
                selectedGuildId={selectedGuild}
                onGuildSelect={handleGuildSelect}
              />
            </div>
          </div>
          
          {/* Channels Section */}
          {selectedGuild && (
            <div className="flex-1">
              <ChannelSidebar 
                guildId={selectedGuild}
                selectedChannelId={selectedChannel}
                onChannelSelect={handleChannelSelect}
                onVoiceChannelJoin={handleVoiceChannelJoin}
              />
            </div>
          )}
        </div>
      }
      chat={
        <ChatPane 
          channelId={selectedChannel} 
          autoJoinVoice={joinedVoiceChannel === selectedChannel}
        />
      }
      members={
        <MemberList guildId={selectedGuild} />
      }
    />
  );
}


