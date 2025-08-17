import { Plus, Home, Compass } from "lucide-react";
import { useState } from "react";

export function GuildBar() {
  const [activeGuild, setActiveGuild] = useState<string>("home");
  
  // Mock guilds data - replace with real data
  const guilds = [
    { id: "1", name: "React Dev", icon: "R" },
    { id: "2", name: "TypeScript", icon: "TS" },
    { id: "3", name: "Gaming", icon: "G" },
  ];

  return (
    <>
      {/* Home Button */}
      <div className="relative group">
        <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 bg-white rounded-r transition-all duration-200 
                      group-hover:h-5 h-2" />
        <button
          onClick={() => setActiveGuild("home")}
          className={`guild-pill ${activeGuild === "home" ? "active" : ""}`}
          aria-label="Home"
        >
          <Home size={24} />
        </button>
      </div>
      
      {/* Separator */}
      <div className="divider mx-5" />
      
      {/* Guild List */}
      {guilds.map((guild) => (
        <div key={guild.id} className="relative group">
          <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 bg-white rounded-r transition-all duration-200 
                        group-hover:h-5 h-0" />
          <button
            onClick={() => setActiveGuild(guild.id)}
            className={`guild-pill ${activeGuild === guild.id ? "active" : ""}`}
            aria-label={guild.name}
          >
            <span className="text-lg font-semibold">{guild.icon}</span>
          </button>
          
          {/* Tooltip */}
          <div className="absolute left-16 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 
                        pointer-events-none transition-opacity duration-200">
            <div className="px-3 py-2 rounded-md whitespace-nowrap text-sm font-medium"
                 style={{ background: 'var(--background-floating)', color: 'var(--text-normal)' }}>
              {guild.name}
            </div>
          </div>
        </div>
      ))}
      
      {/* Add Guild Button */}
      <div className="relative group">
        <button
          className="guild-pill hover:bg-discord-green"
          aria-label="Add a Server"
        >
          <Plus size={24} className="text-discord-green group-hover:text-white" />
        </button>
        
        {/* Tooltip */}
        <div className="absolute left-16 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 
                      pointer-events-none transition-opacity duration-200">
          <div className="px-3 py-2 rounded-md whitespace-nowrap text-sm font-medium"
               style={{ background: 'var(--background-floating)', color: 'var(--text-normal)' }}>
            Добавить сервер
          </div>
        </div>
      </div>
      
      {/* Separator */}
      <div className="divider mx-5" />
      
      {/* Explore Public Servers */}
      <div className="relative group">
        <button
          className="guild-pill hover:bg-discord-green"
          aria-label="Explore Public Servers"
        >
          <Compass size={24} className="text-discord-green group-hover:text-white" />
        </button>
        
        {/* Tooltip */}
        <div className="absolute left-16 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 
                      pointer-events-none transition-opacity duration-200">
          <div className="px-3 py-2 rounded-md whitespace-nowrap text-sm font-medium"
               style={{ background: 'var(--background-floating)', color: 'var(--text-normal)' }}>
            Исследовать сервера
          </div>
        </div>
      </div>
    </>
  );
}