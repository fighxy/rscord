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
import { API_CONFIG } from "../../config/api";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { ServerSelector } from "../../components/ServerSelector";

export default function HomePage() {
  const { user } = useAuth();
  const [selectedGuild, setSelectedGuild] = useState<string>("");
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [joinedVoiceChannel, setJoinedVoiceChannel] = useState<string>("");
  const [showServerSelector, setShowServerSelector] = useState(false);
  const [serverStatus, setServerStatus] = useState<'online' | 'offline'>('offline');

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

  // Check server status
  useEffect(() => {
    const checkServerStatus = async () => {
      try {
        const response = await fetch('http://5.35.83.143:14700/health');
        setServerStatus(response.ok ? 'online' : 'offline');
      } catch (error) {
        setServerStatus('offline');
      }
    };

    checkServerStatus();
    const interval = setInterval(checkServerStatus, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

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
    <>
      {/* Server Selector Modal */}
      {showServerSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-discord-dark border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Server Status</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowServerSelector(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </Button>
            </div>
            <ServerSelector />
          </div>
        </div>
      )}

      <AppShell
        guildBar={<GuildBar />}
        sidebar={
          <div className="flex flex-col h-full">
            {/* Server Status Bar */}
            <div className="px-4 py-2 border-b border-gray-700 bg-discord-dark">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant={serverStatus === 'online' ? 'default' : 'destructive'}>
                    {serverStatus === 'online' ? '🟢 Online' : '🔴 Offline'}
                  </Badge>
                  <span className="text-xs text-gray-400">
                    5.35.83.143:14700
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowServerSelector(true)}
                  className="text-gray-400 hover:text-white text-xs"
                >
                  ⚙️
                </Button>
              </div>
            </div>
            
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
      </>
    );
  }


