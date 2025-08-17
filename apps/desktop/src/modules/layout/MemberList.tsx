import { Crown, Shield } from "lucide-react";

interface MemberListProps {
  guildId: string;
}

export function MemberList({ guildId }: MemberListProps) {
  // Mock members data - replace with real data
  const members = {
    online: [
      { id: "1", name: "Admin", role: "admin", status: "online" },
      { id: "2", name: "Moderator", role: "moderator", status: "idle" },
      { id: "3", name: "Alice", role: "member", status: "online" },
      { id: "4", name: "Bob", role: "member", status: "dnd" },
    ],
    offline: [
      { id: "5", name: "Charlie", role: "member", status: "offline" },
      { id: "6", name: "David", role: "member", status: "offline" },
    ],
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin":
        return <Crown size={14} className="text-yellow-500" />;
      case "moderator":
        return <Shield size={14} className="text-blue-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "var(--discord-green)";
      case "idle":
        return "var(--discord-yellow)";
      case "dnd":
        return "var(--discord-red)";
      default:
        return "var(--text-muted)";
    }
  };

  const MemberItem = ({ member }: { member: any }) => (
    <div className="flex items-center px-2 py-1.5 mx-2 rounded cursor-pointer hover:bg-background-accent/50 group">
      {/* Avatar with status */}
      <div className="relative mr-3">
        <div className="w-8 h-8 rounded-full bg-discord-blurple flex items-center justify-center">
          <span className="text-xs font-semibold text-white">
            {member.name[0].toUpperCase()}
          </span>
        </div>
        {/* Status indicator */}
        <div 
          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
          style={{ 
            backgroundColor: getStatusColor(member.status),
            borderColor: 'var(--background-secondary)'
          }}
        />
      </div>
      
      {/* Name and role */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          {getRoleIcon(member.role)}
          <span className={`text-sm font-medium truncate ${
            member.status === "offline" ? "opacity-50" : ""
          }`}>
            {member.name}
          </span>
        </div>
      </div>
    </div>
  );

  if (!guildId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted text-sm">Выберите сервер</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Members Header */}
      <div className="h-12 px-4 flex items-center"
           style={{ borderBottom: '1px solid var(--background-tertiary)' }}>
        <span className="font-semibold text-sm">Участники</span>
      </div>

      {/* Members List */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Online Members */}
        {members.online.length > 0 && (
          <div className="mb-4">
            <h3 className="px-4 py-1 text-xs font-semibold uppercase text-muted">
              В сети — {members.online.length}
            </h3>
            {members.online.map(member => (
              <MemberItem key={member.id} member={member} />
            ))}
          </div>
        )}

        {/* Offline Members */}
        {members.offline.length > 0 && (
          <div>
            <h3 className="px-4 py-1 text-xs font-semibold uppercase text-muted">
              Не в сети — {members.offline.length}
            </h3>
            {members.offline.map(member => (
              <MemberItem key={member.id} member={member} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}