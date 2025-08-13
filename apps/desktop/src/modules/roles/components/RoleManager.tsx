import { useState, useEffect } from "react";
import { useAuth } from "../../auth/store";
import { getGuildRoles, createRole, updateRole, deleteRole, assignRole, removeRole } from "../../roles/api";
import "./RoleManager.css";

interface Role {
  id: string;
  name: string;
  color: string;
  permissions: string[];
  position: number;
  mentionable: boolean;
  hoist: boolean;
  created_at: string;
}

interface RoleManagerProps {
  guildId: string;
}

const PERMISSIONS = {
  // Общие права
  'view_channels': 'Просмотр каналов',
  'send_messages': 'Отправка сообщений',
  'read_message_history': 'Чтение истории сообщений',
  'use_external_emojis': 'Использование внешних эмодзи',
  'add_reactions': 'Добавление реакций',
  'attach_files': 'Прикрепление файлов',
  'embed_links': 'Встраивание ссылок',
  
  // Модерация
  'manage_messages': 'Управление сообщениями',
  'manage_channels': 'Управление каналами',
  'manage_roles': 'Управление ролями',
  'manage_guild': 'Управление сервером',
  'ban_members': 'Бан участников',
  'kick_members': 'Кик участников',
  'mute_members': 'Муты участников',
  'deafen_members': 'Отключение звука участников',
  
  // Голосовые каналы
  'connect': 'Подключение к голосовым каналам',
  'speak': 'Разговор в голосовых каналах',
  'stream': 'Стриминг',
  'use_vad': 'Использование VAD',
  
  // Специальные
  'administrator': 'Администратор',
  'mention_everyone': 'Упоминание @everyone',
  'priority_speaker': 'Приоритетный спикер'
};

const COLORS = [
  '#99AAB5', '#95A5A6', '#E67E22', '#E74C3C', '#9B59B6', '#3498DB', '#1ABC9C',
  '#F1C40F', '#2ECC71', '#34495E', '#E91E63', '#00BCD4', '#FF9800', '#795548'
];

export function RoleManager({ guildId }: RoleManagerProps) {
  const { user } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    color: '#99AAB5',
    permissions: [] as string[],
    mentionable: false,
    hoist: false
  });

  useEffect(() => {
    loadRoles();
  }, [guildId]);

  const loadRoles = async () => {
    try {
      setIsLoading(true);
      const data = await getGuildRoles(guildId);
      setRoles(data.sort((a: Role, b: Role) => b.position - a.position));
    } catch (error) {
      console.error('Failed to load roles:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      setIsLoading(true);
      if (editingRole) {
        await updateRole(guildId, editingRole.id, formData);
      } else {
        await createRole(guildId, formData);
      }
      
      await loadRoles();
      resetForm();
    } catch (error) {
      console.error('Failed to save role:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm('Вы уверены, что хотите удалить эту роль?')) return;

    try {
      setIsLoading(true);
      await deleteRole(guildId, roleId);
      await loadRoles();
    } catch (error) {
      console.error('Failed to delete role:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      color: role.color,
      permissions: role.permissions,
      mentionable: role.mentionable,
      hoist: role.hoist
    });
    setShowCreateForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      color: '#99AAB5',
      permissions: [],
      mentionable: false,
      hoist: false
    });
    setEditingRole(null);
    setShowCreateForm(false);
  };

  const togglePermission = (permission: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }));
  };

  const hasPermission = (permission: string) => {
    // Здесь должна быть проверка прав пользователя
    return true; // Временно возвращаем true для демонстрации
  };

  if (!user || !hasPermission('manage_roles')) return null;

  return (
    <>
      <div className="role-manager">
        {/* Заголовок */}
        <div className="role-manager-header">
          <h2>Управление ролями</h2>
          
          {!showCreateForm && (
            <button
              className="create-role-btn"
              onClick={() => setShowCreateForm(true)}
            >
              + Создать роль
            </button>
          )}
        </div>

      {/* Форма создания/редактирования роли */}
      {showCreateForm && (
        <div className="role-form">
          <h3>
            {editingRole ? 'Редактировать роль' : 'Создать новую роль'}
          </h3>
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>
                Название роли
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Введите название роли"
                required
              />
            </div>

            <div className="form-group">
              <label>
                Цвет роли
              </label>
              <div className="color-picker">
                {COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    className={`color-option ${formData.color === color ? 'selected' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData(prev => ({ ...prev, color }))}
                  />
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>
                Права доступа
              </label>
              <div className="permissions-grid">
                {Object.entries(PERMISSIONS).map(([key, label]) => (
                  <label key={key} className="permission-item">
                    <input
                      type="checkbox"
                      checked={formData.permissions.includes(key)}
                      onChange={() => togglePermission(key)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div className="form-checkboxes">
              <label className="checkbox-item">
                <input
                  type="checkbox"
                  checked={formData.mentionable}
                  onChange={(e) => setFormData(prev => ({ ...prev, mentionable: e.target.checked }))}
                />
                Упоминаемая
              </label>
              
              <label className="checkbox-item">
                <input
                  type="checkbox"
                  checked={formData.hoist}
                  onChange={(e) => setFormData(prev => ({ ...prev, hoist: e.target.checked }))}
                />
                Отдельно в списке участников
              </label>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                disabled={isLoading}
                className="submit-btn"
              >
                {isLoading ? 'Сохранение...' : (editingRole ? 'Сохранить' : 'Создать')}
              </button>
              
              <button
                type="button"
                onClick={resetForm}
                className="cancel-btn"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Список ролей */}
      <div className="roles-list">
        <h3>Роли сервера ({roles.length})</h3>
        
        {isLoading ? (
          <div className="loading">
            Загрузка ролей...
          </div>
        ) : (
          <div className="roles-container">
            {roles.map((role) => (
              <div
                key={role.id}
                className="role-item"
              >
                {/* Цвет роли */}
                <div 
                  className="role-color"
                  style={{ backgroundColor: role.color }}
                />
                
                {/* Название роли */}
                <div className="role-info">
                  <div className="role-name">
                    {role.name}
                  </div>
                  <div className="role-details">
                    {role.permissions.length} прав • Позиция: {role.position}
                  </div>
                </div>
                
                {/* Действия */}
                <div className="role-actions">
                  <button
                    className="edit-role-btn"
                    onClick={() => handleEditRole(role)}
                  >
                    ✏️
                  </button>
                  
                  {role.position > 0 && (
                    <button
                      className="delete-role-btn"
                      onClick={() => handleDeleteRole(role.id)}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  );
}
