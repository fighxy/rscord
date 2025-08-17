import { Hash, Volume2, ChevronDown, ChevronRight, Settings, Plus } from "lucide-react";
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
  const guildName = "My Server";
  const categories = [
    {
      id: "text",
      name: "TEXT CHANNELS",
      channels: [
        { id: "general", name: "general", type: "text" },
        { id: "random", name: "random", type: "text" },
        { id: "memes", name: "memes", type: "text" },
      ]
    },
    {
      id: "voice",
      name: "VOICE CHANNELS",
      channels: [
        { id: "general-voice", name: "General", type: "voice", members: 2 },
        { id: "gaming", name: "Gaming", type: "voice", members: 0 },
        { id: "music", name: "Music", type: "voice", members: 1 },
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
    <div className="flex flex-col h-full">
      {/* Server Header */}
      <div className="h-12 px-4 flex items-center justify-between shadow-sm cursor-pointer hover:bg-background-accent/50"
           style={{ borderBottom: '1px solid var(--background-tertiary)' }}>
        <span className="font-semibold">{guildName}</span>
        <ChevronDown size={18} />
      </div>

      {/* Channel List */}
      <div className="flex-1 overflow-y-auto pt-3">
        {categories.map(category => (
          <div key={category.id} className="mb-2">
            {/* Category Header */}
            <div 
              className="flex items-center px-2 py-1 cursor-pointer hover:text-interactive-hover group"
              onClick={() => toggleCategory(category.id)}
            >
              {collapsedCategories.has(category.id) ? (
                <ChevronRight size={12} className="mr-0.5" />
              ) : (
                <ChevronDown size={12} className="mr-0.5" />
              )}
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                {category.name}
              </span>
              <Plus size={16} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            {/* Channels */}
            {!collapsedCategories.has(category.id) && (
              <div className="space-y-0.5 mt-1">
                {category.channels.map(channel => (
                  <div
                    key={channel.id}
                    onClick={() => handleChannelClick(channel)}
                    className={`channel-item ${selectedChannelId === channel.id ? 'active' : ''}`}
                  >
                    <div className="flex items-center gap-1.5">
                      {channel.type === "text" ? (
                        <Hash size={18} className="opacity-60" />
                      ) : (
                        <Volume2 size={18} className="opacity-60" />
                      )}
                      <span className="text-sm font-medium">{channel.name}</span>
                    </div>
                    {channel.type === "voice" && channel.members > 0 && (
                      <span className="ml-auto text-xs text-muted">{channel.members}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* User Panel */}
      <div className="h-14 px-2 flex items-center gap-2"
           style={{ borderTop: '1px solid var(--background-tertiary)' }}>
        <div className="flex items-center gap-2 flex-1">
          {/* User Avatar */}
          <div className="w-8 h-8 rounded-full bg-discord-blurple flex items-center justify-center">
            <span className="text-xs font-semibold">U</span>
          </div>
          {/* User Info */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">Username</div>
            <div className="text-xs text-muted truncate">#1234</div>
          </div>
        </div>
        {/* Settings Button */}
        <button className="p-1.5 rounded hover:bg-background-accent">
          <Settings size={18} />
        </button>
      </div>
    </div>
  );
}