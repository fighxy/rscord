import { useState, useEffect } from "react";
import { useAuth } from "../auth/store";
import { getGuildMembers, getUserRoles, assignRole, removeRole, getGuildRoles } from "../roles/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface Member {
  id: string;
  display_name: string;
  email: string;
  joined_at: string;
  roles: Role[];
}

interface Role {
  id: string;
  name: string;
  color: string;
  permissions: string[];
  position: number;
  mentionable: boolean;
  hoist: boolean;
}

interface MemberListProps {
  guildId: string;
}

export function MemberList({ guildId }: MemberListProps) {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showRoleAssignment, setShowRoleAssignment] = useState(false);

  useEffect(() => {
    if (guildId) {
      loadMembers();
      loadRoles();
    }
  }, [guildId]);

  const loadMembers = async () => {
    try {
      setIsLoading(true);
      const data = await getGuildMembers(guildId);
      setMembers(data);
    } catch (error) {
      console.error('Failed to load members:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      const data = await getGuildRoles(guildId);
      setRoles(data.sort((a: Role, b: Role) => b.position - a.position));
    } catch (error) {
      console.error('Failed to load roles:', error);
    }
  };

  const handleAssignRole = async (memberId: string, roleId: string) => {
    try {
      await assignRole(guildId, memberId, roleId);
      await loadMembers(); // Перезагружаем список участников
    } catch (error) {
      console.error('Failed to assign role:', error);
    }
  };

  const handleRemoveRole = async (memberId: string, roleId: string) => {
    try {
      await removeRole(guildId, memberId, roleId);
      await loadMembers(); // Перезагружаем список участников
    } catch (error) {
      console.error('Failed to remove role:', error);
    }
  };

  const filteredMembers = members.filter(member =>
    member.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const hasPermission = (permission: string) => {
    // Здесь должна быть проверка прав пользователя
    return true; // Временно возвращаем true для демонстрации
  };

  if (!user || !hasPermission('view_members')) return null;

  return (
    <div className="flex flex-col h-full bg-discord-dark">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-gray-200">Участники ({members.length})</h3>
        {hasPermission('manage_roles') && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRoleAssignment(!showRoleAssignment)}
            className="text-xs bg-gray-700 hover:bg-gray-600 border-gray-600 text-gray-300 hover:text-white"
            title="Нажмите на 'Назначить роль' для управления ролями участников"
          >
            Управление ролями
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="p-3 border-b border-gray-700">
        <Input
          placeholder="Поиск участников..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-discord-blurple focus:border-transparent"
        />
      </div>

      {/* Members List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="text-center text-gray-400 py-4">Загрузка участников...</div>
        ) : filteredMembers.length === 0 ? (
          <div className="text-center text-gray-400 py-4">
            {searchQuery ? 'Участники не найдены' : 'Нет участников'}
          </div>
        ) : (
          filteredMembers.map((member) => (
            <div key={member.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-700 transition-colors duration-150">
              {/* Avatar */}
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-discord-blurple text-white text-sm font-medium">
                  {member.display_name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              {/* Member Info */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{member.display_name}</div>
                <div className="text-xs text-gray-400 truncate">{member.email}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {member.roles.map((role) => (
                    <Badge
                      key={role.id}
                      variant="secondary"
                      className="text-xs"
                      style={{ backgroundColor: role.color, color: 'white' }}
                    >
                      {role.name}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Actions */}
              {hasPermission('manage_roles') && (
                <div className="flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedMember(member)}
                    className="text-xs bg-gray-600 hover:bg-gray-500 border-gray-500 text-gray-300 hover:text-white"
                  >
                    Назначить роль
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Role Assignment Modal */}
      {selectedMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setSelectedMember(null)}>
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">Управление ролями для {selectedMember.display_name}</h3>
            
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-2">Текущие роли:</h4>
                {selectedMember.roles.length === 0 ? (
                  <p className="text-gray-400 text-sm">Нет назначенных ролей</p>
                ) : (
                  <div className="space-y-2">
                    {selectedMember.roles.map((role) => (
                      <div key={role.id} className="flex items-center justify-between p-2 bg-gray-700 rounded">
                        <Badge
                          variant="secondary"
                          className="text-xs"
                          style={{ backgroundColor: role.color, color: 'white' }}
                        >
                          {role.name}
                        </Badge>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemoveRole(selectedMember.id, role.id)}
                          className="text-xs"
                        >
                          Убрать
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-2">Доступные роли:</h4>
                <div className="space-y-2">
                  {roles
                    .filter(role => !selectedMember.roles.find(r => r.id === role.id))
                    .map((role) => (
                      <div key={role.id} className="flex items-center justify-between p-2 bg-gray-700 rounded">
                        <Badge
                          variant="secondary"
                          className="text-xs"
                          style={{ backgroundColor: role.color, color: 'white' }}
                        >
                          {role.name}
                        </Badge>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleAssignRole(selectedMember.id, role.id)}
                          className="text-xs bg-green-600 hover:bg-green-500"
                        >
                          Назначить
                        </Button>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full mt-6 bg-gray-600 hover:bg-gray-500 border-gray-500 text-white"
              onClick={() => setSelectedMember(null)}
            >
              Закрыть
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}


