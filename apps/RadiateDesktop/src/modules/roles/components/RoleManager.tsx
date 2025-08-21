import { useState, useEffect } from "react";
import { useAuth } from "../../auth/store";
import { getGuildRoles, createRole, updateRole, deleteRole, assignRole, removeRole } from "../../roles/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      color: role.color,
      permissions: [...role.permissions],
      mentionable: role.mentionable,
      hoist: role.hoist
    });
    setShowCreateForm(true);
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

  if (!user) return null;

  return (
    <>
      <div className="p-6 bg-discord-dark rounded-lg">
        {/* Заголовок и кнопка создания */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Управление ролями</h2>
          <Button
            onClick={() => setShowCreateForm(true)}
            className="bg-discord-blurple hover:bg-blue-600"
          >
            + Создать роль
          </Button>
        </div>

        {/* Форма создания/редактирования роли */}
        {showCreateForm && (
          <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">
              {editingRole ? 'Редактировать роль' : 'Создать новую роль'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Название роли */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Название роли
                </label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-discord-blurple focus:border-transparent"
                  placeholder="Введите название роли"
                  required
                />
              </div>

              {/* Цвет роли */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Цвет роли
                </label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, color }))}
                      className={`w-8 h-8 rounded-full border-2 transition-all duration-200 ${
                        formData.color === color ? 'border-white scale-110' : 'border-gray-600 hover:border-gray-400'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Права */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Права
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-3 bg-gray-700 rounded border border-gray-600">
                  {Object.entries(PERMISSIONS).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer hover:text-white">
                      <input
                        type="checkbox"
                        checked={formData.permissions.includes(key)}
                        onChange={() => togglePermission(key)}
                        className="text-discord-blurple focus:ring-discord-blurple"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Дополнительные опции */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.mentionable}
                    onChange={(e) => setFormData(prev => ({ ...prev, mentionable: e.target.checked }))}
                    className="text-discord-blurple focus:ring-discord-blurple"
                  />
                  Упоминаемая
                </label>
                
                <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.hoist}
                    onChange={(e) => setFormData(prev => ({ ...prev, hoist: e.target.checked }))}
                    className="text-discord-blurple focus:ring-discord-blurple"
                  />
                  Отдельно в списке участников
                </label>
              </div>

              {/* Кнопки действий */}
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="bg-discord-blurple hover:bg-blue-600 disabled:opacity-60"
                >
                  {isLoading ? 'Сохранение...' : (editingRole ? 'Сохранить' : 'Создать')}
                </Button>
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  className="bg-gray-600 hover:bg-gray-500 border-gray-500 text-gray-300"
                >
                  Отмена
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Список ролей */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">
            Роли сервера ({roles.length})
          </h3>
          
          {isLoading ? (
            <div className="text-center text-gray-400 py-4">
              Загрузка ролей...
            </div>
          ) : (
            <div className="space-y-2">
              {roles.map((role) => (
                <div
                  key={role.id}
                  className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors duration-200"
                >
                  {/* Цвет роли */}
                  <div 
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: role.color }}
                  />
                  
                  {/* Название роли */}
                  <div className="flex-1">
                    <div className="font-medium text-white">
                      {role.name}
                    </div>
                    <div className="text-sm text-gray-400">
                      {role.permissions.length} прав • Позиция: {role.position}
                    </div>
                  </div>
                  
                  {/* Действия */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditRole(role)}
                      className="bg-gray-600 hover:bg-gray-500 border-gray-500 text-gray-300"
                    >
                      ✏️
                    </Button>
                    
                    {role.position > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteRole(role.id)}
                        className="text-xs"
                      >
                        🗑️
                      </Button>
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
