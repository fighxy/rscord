import { ReactNode } from "react";

interface AppShellProps {
  guildBar: ReactNode;
  sidebar: ReactNode;
  chat: ReactNode;
  members: ReactNode;
}

export function AppShell({ guildBar, sidebar, chat, members }: AppShellProps) {
  return (
    <div className="app-shell-container">
      {/* Modern background with gradient mesh */}
      <div className="app-background" />
      
      {/* Main Content */}
      <div className="app-content">
        {/* Guild Bar - Server list */}
        <div className="guild-bar-wrapper">
          {guildBar}
        </div>
        
        {/* Channel Sidebar */}
        <aside className="channel-sidebar-wrapper">
          {sidebar}
        </aside>
        
        {/* Main Chat Area */}
        <main className="chat-area-wrapper">
          {chat}
        </main>
        
        {/* Members List */}
        <aside className="member-list-wrapper">
          {members}
        </aside>
      </div>
    </div>
  );
}