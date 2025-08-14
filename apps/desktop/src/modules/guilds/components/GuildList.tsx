import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createGuild, listGuilds, updateGuild, deleteGuild } from "../api";
import { useState } from "react";
import { useAuth } from "../../auth/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

interface GuildListProps {
  selectedGuildId?: string;
  onGuildSelect?: (guildId: string) => void;
}

export function GuildList({ selectedGuildId, onGuildSelect }: GuildListProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: guilds } = useQuery({ queryKey: ["guilds"], queryFn: listGuilds });
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedGuild, setSelectedGuild] = useState<Guild | null>(null);
  const [newName, setNewName] = useState("");

  const createGuildMutation = useMutation({
    mutationFn: () => {
      if (!user?.id) {
        throw new Error("Пользователь не аутентифицирован");
      }
      return createGuild(name, user.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guilds"] });
      setName("");
      setIsCreating(false);
    },
    onError: (error: any) => {
      console.error("Ошибка создания сервера:", error);
    },
  });

  const updateGuildMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateGuild(id, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guilds"] });
      setShowRenameDialog(false);
      setNewName("");
      setSelectedGuild(null);
    },
  });

  const deleteGuildMutation = useMutation({
    mutationFn: (id: string) => deleteGuild(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guilds"] });
      setShowDeleteDialog(false);
      setSelectedGuild(null);
      if (selectedGuildId === selectedGuild?.id) {
        onGuildSelect?.(guilds[0]?.id || "");
      }
    },
  });

  const handleCreateGuild = () => {
    if (!name.trim()) return;
    createGuildMutation.mutate();
  };

  const handleRename = (guild: Guild) => {
    setSelectedGuild(guild);
    setNewName(guild.name);
    setShowRenameDialog(true);
  };

  const handleDelete = (guild: Guild) => {
    setSelectedGuild(guild);
    setShowDeleteDialog(true);
  };

  const confirmRename = () => {
    if (selectedGuild && newName.trim()) {
      updateGuildMutation.mutate({ id: selectedGuild.id, name: newName });
    }
  };

  const confirmDelete = () => {
    if (selectedGuild) {
      deleteGuildMutation.mutate(selectedGuild.id);
    }
  };

  if (!guilds || guilds.length === 0) {
    return (
      <div className="p-3">
        <div className="text-gray-400 text-sm mb-3">
          Нет серверов
        </div>
        
        {!isCreating ? (
          <Button 
            onClick={() => setIsCreating(true)}
            variant="outline"
            size="sm"
            className="w-full bg-gray-700 hover:bg-gray-600 border-gray-600 text-gray-300 hover:text-white"
          >
            + Создать сервер
          </Button>
        ) : (
          <div className="space-y-2">
            <Input 
              placeholder="Название сервера" 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-discord-blurple focus:border-transparent"
            />
            <div className="flex gap-2">
              <Button 
                onClick={handleCreateGuild} 
                disabled={createGuildMutation.isPending || !name.trim()}
                size="sm"
                className="flex-1 bg-discord-blurple hover:bg-blue-600 disabled:bg-gray-600"
              >
                {createGuildMutation.isPending ? "Создание..." : "Создать"}
              </Button>
              <Button 
                variant="outline"
                onClick={() => {
                  setIsCreating(false);
                  setName("");
                }}
                size="sm"
                className="bg-gray-600 hover:bg-gray-500 border-gray-500 text-gray-300"
              >
                Отмена
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2">
      {guilds.map((guild) => (
        <ContextMenu key={guild.id}>
          <ContextMenuTrigger>
            <div
              className={`px-3 py-2 rounded-md cursor-pointer transition-colors duration-150 ${
                selectedGuildId === guild.id 
                  ? 'bg-gray-700 text-white' 
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
              onClick={() => onGuildSelect?.(guild.id)}
            >
              🏠 {guild.name}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onSelect={() => handleRename(guild)}>
              Переименовать
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => handleDelete(guild)} className="text-red-600">
              Удалить
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      ))}
      
      {!isCreating ? (
        <Button 
          onClick={() => setIsCreating(true)}
          variant="outline"
          size="sm"
          className="w-full mt-2 bg-gray-700 hover:bg-gray-600 border-gray-600 text-gray-300 hover:text-white"
        >
          + Создать сервер
        </Button>
      ) : (
        <div className="space-y-2 mt-2">
          <Input 
            placeholder="Название сервера" 
            value={name} 
            onChange={(e) => setName(e.target.value)}
            className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-discord-blurple focus:border-transparent"
          />
          <div className="flex gap-2">
            <Button 
              onClick={handleCreateGuild} 
              disabled={createGuildMutation.isPending || !name.trim()}
              size="sm"
              className="flex-1 bg-discord-blurple hover:bg-blue-600 disabled:bg-gray-600"
            >
              {createGuildMutation.isPending ? "Создание..." : "Создать"}
            </Button>
            <Button 
              variant="outline"
              onClick={() => {
                setIsCreating(false);
                setName("");
              }}
              size="sm"
              className="bg-gray-600 hover:bg-gray-500 border-gray-500 text-gray-300"
            >
              Отмена
            </Button>
          </div>
        </div>
      )}

      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Переименовать сервер</DialogTitle>
          </DialogHeader>
          <Input 
            value={newName} 
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Новое название"
          />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowRenameDialog(false)}>
              Отмена
            </Button>
            <Button onClick={confirmRename} disabled={!newName.trim() || updateGuildMutation.isPending}>
              {updateGuildMutation.isPending ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить сервер</DialogTitle>
          </DialogHeader>
          <p>Вы уверены, что хотите удалить сервер "{selectedGuild?.name}"? Это действие нельзя отменить.</p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowDeleteDialog(false)}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteGuildMutation.isPending}>
              {deleteGuildMutation.isPending ? "Удаление..." : "Удалить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


