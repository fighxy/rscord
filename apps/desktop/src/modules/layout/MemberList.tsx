import { Crown, Shield, Users, Mic, MicOff, HeadphonesIcon, Settings } from "lucide-react";
import { useState } from "react";

interface Member {
  id: string;
  name: string;
  avatar: string;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  role?: string;
  roleColor?: string;
  activity?: string;
  isInVoice?: boolean;
  isMuted?: boolean;
  isDeafened?: boolean;
}

interface MemberListProps {
  guildId: string;
}

export function MemberList({ guildId }: MemberListProps) {
  const [members] = useState<Member[]>([
    {
      id: "1",
      name: "Alice",
      avatar: "A",
      status: "online",
      role: "Admin",
      roleColor: "from-red-500 to-pink-600",
      activity: "Coding RSCORD",
      isInVoice: true,
    },
    {
      id: "2", 
      name: "Bob",
      avatar: "B",
      status: "online", 
      role: "Developer",
      roleColor: "from-blue-500 to-purple-600",
      activity: "Listening to Spotify",
      isInVoice: true,
      isMuted: true,
    },
    {
      id: "3",
      name: "Charlie", 
      avatar: "C",
      status: "idle",
      role: "Designer",
      roleColor: "from-green-500 to-teal-600",
      activity: "Away",
      isInVoice: true,
    },
    {
      id: "4",
      name: "Diana",
      avatar: "D", 
      status: "dnd",
      role: "Moderator",
      roleColor: "from-orange-500 to-red-600",
      activity: "Do not disturb",
    },
    {
      id: "5",
      name: "Elena",
      avatar: "E",
      status: "online",
      activity: "Playing Cyberpunk 2077",
    },
    {
      id: "6",
      name: "Frank", 
      avatar: "F",
      status: "offline",
    },
  ]);

  const onlineMembers = members.filter(m => m.status !== 'offline');
  const offlineMembers = members.filter(m => m.status === 'offline');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500 shadow-green-500/50';
      case 'idle': return 'bg-yellow-500 shadow-yellow-500/50';
      case 'dnd': return 'bg-red-500 shadow-red-500/50';
      case 'offline': return 'bg-gray-500 shadow-gray-500/50';
      default: return 'bg-gray-500';
    }
  };

  const getRoleIcon = (role?: string) => {
    switch (role) {
      case 'Admin': return <Crown size={14} className="text-red-400" />;
      case 'Moderator': return <Shield size={14} className="text-orange-400" />;
      default: return null;
    }
  };

  return (
    <div className="glass-panel w-70 h-full overflow-hidden rounded-3xl border border-white/15 backdrop-blur-xl bg-white/8">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="glass-member-list-header">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-white/60" />
            <span className="font-bold text-white">Участники</span>
            <span className="text-white/60 text-sm ml-auto">{onlineMembers.length} онлайн</span>
          </div>
        </div>

        {/* Members List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
          {/* Online Members */}
          {onlineMembers.length > 0 && (
            <div className="mb-6">
              <div className="glass-member-section-header">
                <span className="text-xs font-bold uppercase tracking-wider text-white/60">
                  Онлайн — {onlineMembers.length}
                </span>
              </div>
              
              <div className="space-y-2 mt-3">
                {onlineMembers.map((member) => (
                  <div key={member.id} className="glass-member-item group">
                    <div className="flex items-center gap-3 flex-1">
                      {/* Avatar with Status */}
                      <div className="relative flex-shrink-0">
                        <div className={`glass-member-avatar ${member.roleColor ? `bg-gradient-to-br ${member.roleColor}` : 'bg-gradient-to-br from-gray-500 to-gray-600'}`}>
                          <span className="text-white font-bold">{member.avatar}</span>
                        </div>
                        {/* Status Indicator */}
                        <div className={`glass-status-indicator ${getStatusColor(member.status)}`}></div>
                        
                        {/* Voice Status */}
                        {member.isInVoice && (
                          <div className="glass-voice-status">
                            {member.isMuted ? (
                              <MicOff size={10} className="text-red-400" />
                            ) : (
                              <Mic size={10} className="text-green-400" />
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* Member Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-semibold truncate">{member.name}</span>
                          {member.role && getRoleIcon(member.role)}
                        </div>
                        
                        {member.activity && (
                          <div className="glass-activity-text">
                            {member.activity}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {member.isInVoice && (
                        <button className="glass-member-action">
                          <HeadphonesIcon size={14} className="text-white/60 hover:text-white transition-colors" />
                        </button>
                      )}
                      <button className="glass-member-action">
                        <Settings size={14} className="text-white/60 hover:text-white transition-colors" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Offline Members */}
          {offlineMembers.length > 0 && (
            <div>
              <div className="glass-member-section-header">
                <span className="text-xs font-bold uppercase tracking-wider text-white/60">
                  Оффлайн — {offlineMembers.length}
                </span>
              </div>
              
              <div className="space-y-2 mt-3">
                {offlineMembers.map((member) => (
                  <div key={member.id} className="glass-member-item offline group">
                    <div className="flex items-center gap-3 flex-1">
                      {/* Avatar with Status */}
                      <div className="relative flex-shrink-0">
                        <div className="glass-member-avatar bg-gradient-to-br from-gray-500 to-gray-600 opacity-50">
                          <span className="text-white font-bold">{member.avatar}</span>
                        </div>
                        {/* Status Indicator */}
                        <div className={`glass-status-indicator ${getStatusColor(member.status)}`}></div>
                      </div>
                      
                      {/* Member Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white/50 font-semibold truncate">{member.name}</span>
                          {member.role && (
                            <div className="opacity-50">
                              {getRoleIcon(member.role)}
                            </div>
                          )}
                        </div>
                        
                        <div className="glass-activity-text opacity-50">
                          Последний раз был онлайн
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="glass-member-list-footer">
          <button className="glass-footer-button">
            <Users size={16} className="text-white/60" />
            <span className="text-white/60 text-sm font-medium">Пригласить</span>
          </button>
        </div>
      </div>
    </div>
  );
}