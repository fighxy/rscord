import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createGuild, listGuilds } from "../api";
import { useState } from "react";
import { useAuth } from "../../auth/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

  const handleCreateGuild = () => {
    if (!name.trim()) return;
    createGuildMutation.mutate();
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
        <div
          key={guild.id}
          className={`px-3 py-2 rounded-md cursor-pointer transition-colors duration-150 ${
            selectedGuildId === guild.id 
              ? 'bg-gray-700 text-white' 
              : 'text-gray-300 hover:bg-gray-700 hover:text-white'
          }`}
          onClick={() => onGuildSelect?.(guild.id)}
        >
          🏠 {guild.name}
        </div>
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
    </div>
  );
}


