import { GuildList } from "../guilds/components/GuildList";
import { useState } from "react";
import { AppShell } from "../layout/AppShell";
import { GuildBar } from "../layout/GuildBar";
import { ChannelSidebar } from "../layout/ChannelSidebar";
import { ChatPane } from "../layout/ChatPane";
import { MemberList } from "../layout/MemberList";

export default function HomePage() {
  const [selectedGuild, setSelectedGuild] = useState<string>("");
  const [selectedChannel] = useState<string>("");
  const [authorId] = useState<string>("");
  return (
    <AppShell
      guildBar={<GuildBar />}
      sidebar={
        <>
          <div className="sidebar-header">Сервера</div>
          <div className="sidebar-list">
            <GuildList />
            <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
              <input className="input" placeholder="Selected Guild ULID" value={selectedGuild} onChange={(e) => setSelectedGuild(e.target.value)} />
              <ChannelSidebar guildId={selectedGuild} />
            </div>
          </div>
        </>
      }
      chat={
        <ChatPane channelId={selectedChannel} authorId={authorId} />
      }
      members={<MemberList />}
    />
  );
}


