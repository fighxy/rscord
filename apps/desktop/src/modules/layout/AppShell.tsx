import { ReactNode } from "react";

interface AppShellProps {
  guildBar: ReactNode;
  sidebar: ReactNode;
  chat: ReactNode;
  members: ReactNode;
}

export function AppShell({ guildBar, sidebar, chat, members }: AppShellProps) {
  return (
    <div className="app-container">
      {/* Guild Bar - Server list */}
      <div className="guild-bar">
        {guildBar}
      </div>
      
      {/* Channel Sidebar */}
      <aside className="channel-sidebar">
        {sidebar}
      </aside>
      
      {/* Main Chat Area */}
      <main className="chat-area">
        {chat}
      </main>
      
      {/* Members List */}
      <aside className="member-list">
        {members}
      </aside>
    </div>
  );
}
