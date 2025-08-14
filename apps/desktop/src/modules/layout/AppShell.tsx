import "../../styles/theme.css";
import { ReactNode } from "react";

export function AppShell({ guildBar, sidebar, chat, members }: { guildBar: ReactNode; sidebar: ReactNode; chat: ReactNode; members: ReactNode }) {
  return (
    <div className="flex h-screen bg-discord-darker text-white">
      {/* Guild Bar - левая панель с серверами */}
      <div className="w-16 bg-discord-darker border-r border-gray-800 flex flex-col items-center py-3 space-y-2">
        {guildBar}
      </div>
      
      {/* Sidebar - панель с каналами */}
      <aside className="w-60 bg-discord-dark flex flex-col">
        {sidebar}
      </aside>
      
      {/* Main Chat Area */}
      <main className="flex-1 bg-discord-lighter-dark flex flex-col">
        {chat}
      </main>
      
      {/* Members List - правая панель с участниками */}
      <aside className="w-60 bg-discord-dark border-l border-gray-800">
        {members}
      </aside>
    </div>
  );
}


