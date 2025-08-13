import { useState, useEffect } from "react";
import { useAuth } from "../auth/store";
import { getGuildMembers, getUserRoles, assignRole, removeRole, getGuildRoles } from "../roles/api";
import "./MemberList.css";

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
    <div className="member-list-container">
      {/* Заголовок */}
      <div className="members-header">
        <h3>Участники ({members.length})</h3>
        {hasPermission('manage_roles') && (
          <button
            className="manage-roles-btn"
            onClick={() => setShowRoleAssignment(!showRoleAssignment)}
          >
            {showRoleAssignment ? 'Скрыть' : 'Управление ролями'}
          </button>
        )}
      </div>

      {/* Поиск */}
      <div className="member-search">
        <input
          type="text"
          placeholder="Поиск участников..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Список участников */}
      <div className="members-list">
        {isLoading ? (
          <div className="loading">Загрузка участников...</div>
        ) : filteredMembers.length === 0 ? (
          <div className="no-members">
            {searchQuery ? 'Участники не найдены' : 'Нет участников'}
          </div>
        ) : (
          filteredMembers.map((member) => (
            <div key={member.id} className="member-item">
              {/* Аватар */}
              <div className="member-avatar">
                {member.display_name.charAt(0).toUpperCase()}
              </div>

              {/* Информация об участнике */}
              <div className="member-info">
                <div className="member-name">{member.display_name}</div>
                <div className="member-email">{member.email}</div>
                <div className="member-roles">
                  {member.roles.map((role) => (
                    <span
                      key={role.id}
                      className="role-badge"
                      style={{ backgroundColor: role.color }}
                    >
                      {role.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Действия */}
              {hasPermission('manage_roles') && (
                <div className="member-actions">
                  <button
                    className="assign-role-btn"
                    onClick={() => setSelectedMember(member)}
                  >
                    Назначить роль
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Модальное окно назначения ролей */}
      {selectedMember && (
        <div className="modal-overlay" onClick={() => setSelectedMember(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Управление ролями для {selectedMember.display_name}</h3>
            
            <div className="current-roles">
              <h4>Текущие роли:</h4>
              {selectedMember.roles.length === 0 ? (
                <p>Нет назначенных ролей</p>
              ) : (
                <div className="role-list">
                  {selectedMember.roles.map((role) => (
                    <div key={role.id} className="role-item">
                      <span
                        className="role-badge"
                        style={{ backgroundColor: role.color }}
                      >
                        {role.name}
                      </span>
                      <button
                        className="remove-role-btn"
                        onClick={() => handleRemoveRole(selectedMember.id, role.id)}
                      >
                        Убрать
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="available-roles">
              <h4>Доступные роли:</h4>
              <div className="role-list">
                {roles
                  .filter(role => !selectedMember.roles.find(r => r.id === role.id))
                  .map((role) => (
                    <div key={role.id} className="role-item">
                      <span
                        className="role-badge"
                        style={{ backgroundColor: role.color }}
                      >
                        {role.name}
                      </span>
                      <button
                        className="assign-role-btn"
                        onClick={() => handleAssignRole(selectedMember.id, role.id)}
                      >
                        Назначить
                      </button>
                    </div>
                  ))}
              </div>
            </div>

            <button
              className="close-modal-btn"
              onClick={() => setSelectedMember(null)}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

    </div>
  );
}


