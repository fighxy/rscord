import "../../styles/theme.css";
import { ReactNode } from "react";

export function AppShell({ guildBar, sidebar, chat, members }: { guildBar: ReactNode; sidebar: ReactNode; chat: ReactNode; members: ReactNode }) {
  return (
    <div className="app-shell">
      <div className="guild-bar">{guildBar}</div>
      <aside className="sidebar">{sidebar}</aside>
      <main className="chat">{chat}</main>
      <aside className="members">{members}</aside>
    </div>
  );
}


