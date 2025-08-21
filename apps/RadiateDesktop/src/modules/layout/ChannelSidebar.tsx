import { Hash, Volume2, ChevronDown, ChevronRight, Settings, Plus, Crown } from "lucide-react";
import { useState } from "react";

interface ChannelSidebarProps {
  guildId: string;
  selectedChannelId: string;
  onChannelSelect: (channelId: string) => void;
  onVoiceChannelJoin: (channelId: string) => void;
}

export function ChannelSidebar({ 
  guildId, 
  selectedChannelId, 
  onChannelSelect,
  onVoiceChannelJoin 
}: ChannelSidebarProps) {
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  // Mock data - replace with real data
  const guildName = "✨ My Awesome Server";
  const categories = [
    {
      id: "text",
      name: "TEXT CHANNELS",
      channels: [
        { id: "general", name: "general", type: "text", unread: 3 },
        { id: "random", name: "random", type: "text", unread: 0 },
        { id: "development", name: "development", type: "text", unread: 12 },
        { id: "design", name: "design", type: "text", unread: 0 },
      ]
    },
    {
      id: "voice",
      name: "VOICE CHANNELS",
      channels: [
        { id: "general-voice", name: "General Voice", type: "voice", members: 3, active: true },
        { id: "gaming", name: "Gaming Lounge", type: "voice", members: 0 },
        { id: "music", name: "Music & Chill", type: "voice", members: 1 },
        { id: "study", name: "Study Hall", type: "voice", members: 0 },
      ]
    }
  ];

  const toggleCategory = (categoryId: string) => {
    const newCollapsed = new Set(collapsedCategories);
    if (newCollapsed.has(categoryId)) {
      newCollapsed.delete(categoryId);
    } else {
      newCollapsed.add(categoryId);
    }
    setCollapsedCategories(newCollapsed);
  };

  const handleChannelClick = (channel: any) => {
    if (channel.type === "voice") {
      onVoiceChannelJoin(channel.id);
    } else {
      onChannelSelect(channel.id);
    }
  };

  return (
    <div className="glass-panel flex flex-col h-full overflow-hidden rounded-3xl border border-white/15 backdrop-blur-xl bg-white/8">
      {/* Server Header */}
      <div className="server-header glass-panel-header">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Crown className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg text-white truncate">{guildName}</span>
        </div>
        <ChevronDown size={18} className="text-white/60 group-hover:text-white transition-colors" />
      </div>

      {/* Channel List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pt-6">
        {categories.map(category => (
          <div key={category.id} className="mb-6">
            {/* Category Header */}
            <div 
              className="category-header glass-category-header"
              onClick={() => toggleCategory(category.id)}
            >
              <div className="flex items-center gap-2">
                {collapsedCategories.has(category.id) ? (
                  <ChevronRight size={12} className="text-white/60" />
                ) : (
                  <ChevronDown size={12} className="text-white/60" />
                )}
                <span className="text-xs font-bold uppercase tracking-wider text-white/60">
                  {category.name}
                </span>
              </div>
              <Plus size={16} className="text-white/40 opacity-0 group-hover:opacity-100 transition-opacity hover:text-white/80" />
            </div>

            {/* Channels */}
            {!collapsedCategories.has(category.id) && (
              <div className="space-y-1 mt-2 px-2">
                {category.channels.map(channel => (
                  <div
                    key={channel.id}
                    onClick={() => handleChannelClick(channel)}
                    className={`glass-channel-item ${selectedChannelId === channel.id ? 'active' : ''} ${channel.active ? 'voice-active' : ''}`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {channel.type === "text" ? (
                        <Hash size={18} className="text-white/60 flex-shrink-0" />
                      ) : (
                        <Volume2 size={18} className={`flex-shrink-0 ${channel.active ? 'text-green-400 animate-voice-pulse' : 'text-white/60'}`} />
                      )}
                      <span className="text-white font-medium truncate">{channel.name}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {channel.type === "voice" && channel.members > 0 && (
                        <div className="glass-member-count">
                          {channel.members}
                        </div>
                      )}
                      {channel.type === "text" && channel.unread > 0 && (
                        <div className="glass-unread-badge">
                          {channel.unread > 99 ? '99+' : channel.unread}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* User Panel - без переключателя темы */}
      <div className="glass-user-panel">
        <div className="flex items-center gap-3 flex-1">
          {/* User Avatar */}
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/30">
              U
            </div>
            {/* Status Indicator */}
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-3 border-white/20 shadow-lg shadow-green-500/50"></div>
          </div>
          
          {/* User Info */}
          <div className="flex-1 min-w-0">
            <div className="text-white font-semibold truncate">YourUsername</div>
            <div className="text-white/60 text-sm truncate">#1337</div>
          </div>
        </div>
        
        {/* Settings Button */}
        <button className="glass-icon-button">
          <Settings size={18} className="text-white/60 hover:text-white transition-colors" />
        </button>
      </div>
    </div>
  );
}