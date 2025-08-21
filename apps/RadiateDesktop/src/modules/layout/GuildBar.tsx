import { Plus, Home, Compass } from "lucide-react";
import { useState } from "react";
import { Logo } from "../../components/ui/Logo";
import { ThemeToggle } from "../../components/ui/ThemeToggle";

export function GuildBar() {
  const [activeGuild, setActiveGuild] = useState<string>("home");
  
  // Mock guilds data - replace with real data
  const guilds = [
    { id: "1", name: "React Dev", icon: "R", color: "from-blue-500 to-purple-600" },
    { id: "2", name: "TypeScript", icon: "TS", color: "from-green-500 to-teal-600" },
    { id: "3", name: "Gaming", icon: "G", color: "from-orange-500 to-red-600" },
  ];

  return (
    <div className="guild-bar-container flex flex-col items-center py-4 gap-3 h-full">
      {/* Radiate Logo */}
      <div className="relative group">
        <div className="guild-indicator" />
        <div className="guild-pill logo bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25">
          <Logo size="sm" showBorder={false} />
        </div>
        
        {/* Enhanced Tooltip */}
        <div className="guild-tooltip">
          <div className="glass-tooltip">
            Radiate
          </div>
        </div>
      </div>
      
      {/* Glass Separator */}
      <div className="glass-divider" />
      
      {/* Home Button */}
      <div className="relative group">
        <div className={`guild-indicator ${activeGuild === "home" ? "active" : ""}`} />
        <button
          onClick={() => setActiveGuild("home")}
          className={`guild-pill ${activeGuild === "home" ? "active" : ""} bg-gradient-to-br from-indigo-500 to-blue-600`}
          aria-label="Home"
        >
          <Home size={20} className="text-white" />
        </button>
        
        <div className="guild-tooltip">
          <div className="glass-tooltip">
            Home
          </div>
        </div>
      </div>
      
      {/* Glass Separator */}
      <div className="glass-divider" />
      
      {/* Guild List */}
      <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
        {guilds.map((guild) => (
          <div key={guild.id} className="relative group">
            <div className={`guild-indicator ${activeGuild === guild.id ? "active" : ""}`} />
            <button
              onClick={() => setActiveGuild(guild.id)}
              className={`guild-pill ${activeGuild === guild.id ? "active" : ""} bg-gradient-to-br ${guild.color} text-white font-bold`}
              aria-label={guild.name}
            >
              <span className="text-lg font-extrabold">{guild.icon}</span>
            </button>
            
            {/* Enhanced Tooltip */}
            <div className="guild-tooltip">
              <div className="glass-tooltip">
                {guild.name}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Bottom Section */}
      <div className="flex flex-col gap-3 mt-auto">
        {/* Add Guild Button */}
        <div className="relative group">
          <button
            className="guild-pill add-guild bg-gradient-to-br from-green-500 to-emerald-600 text-white hover:from-green-400 hover:to-emerald-500"
            aria-label="Add a Server"
          >
            <Plus size={20} className="text-white" />
          </button>
          
          <div className="guild-tooltip">
            <div className="glass-tooltip">
              Добавить сервер
            </div>
          </div>
        </div>
        
        {/* Explore Public Servers */}
        <div className="relative group">
          <button
            className="guild-pill explore-guild bg-gradient-to-br from-purple-500 to-pink-600 text-white hover:from-purple-400 hover:to-pink-500"
            aria-label="Explore Public Servers"
          >
            <Compass size={20} className="text-white" />
          </button>
          
          <div className="guild-tooltip">
            <div className="glass-tooltip">
              Исследовать сервера
            </div>
          </div>
        </div>
        
        {/* Glass Separator */}
        <div className="glass-divider" />
        
        {/* Theme Toggle - Positioned at bottom */}
        <div className="relative group">
          <ThemeToggle 
            variant="minimal" 
            size="md"
            className="guild-pill theme-toggle"
          />
          
          <div className="guild-tooltip">
            <div className="glass-tooltip">
              Переключить тему
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}