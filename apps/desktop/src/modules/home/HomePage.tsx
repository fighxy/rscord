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
  };

  const handleChannelSelect = (channelId: string) => {
    setSelectedChannel(channelId);
  };

  if (!user) {
    return (
      <div style={{ 
        display: "grid", 
        placeItems: "center", 
        height: "100vh", 
        color: "var(--text-500)",
        fontSize: "18px"
      }}>
        Загрузка...
      </div>
    );
  }

  return (
    <AppShell
      guildBar={<GuildBar />}
      sidebar={
        <>
          <div className="sidebar-header">Сервера</div>
          <div className="sidebar-list">
            <GuildList 
              selectedGuildId={selectedGuild}
              onGuildSelect={handleGuildSelect}
            />
            
            {selectedGuild && (
              <div style={{ marginTop: 16 }}>
                <ChannelSidebar 
                  guildId={selectedGuild}
                  selectedChannelId={selectedChannel}
                  onChannelSelect={handleChannelSelect}
                />
              </div>
            )}
          </div>
        </>
      }
      chat={
        <ChatPane channelId={selectedChannel} />
      }
      members={
        <MemberList />
      }
    />
  );
}


