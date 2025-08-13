import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createGuild, listGuilds } from "../api";
import { useState } from "react";
import { useAuth } from "../../auth/store";

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
      <div>
        <div style={{ 
          padding: "8px", 
          color: "var(--text-500)", 
          fontSize: "14px",
          marginBottom: "12px"
        }}>
          Нет серверов
        </div>
        
        {!isCreating ? (
          <button 
            onClick={() => setIsCreating(true)}
            style={{ 
              width: "100%", 
              padding: "8px", 
              fontSize: "12px",
              backgroundColor: "var(--bg-700)",
              border: "1px solid var(--border)",
              color: "var(--text-300)",
              borderRadius: "4px",
              cursor: "pointer"
            }}
          >
            + Создать сервер
          </button>
        ) : (
          <div style={{ display: "grid", gap: "8px" }}>
            <input 
              placeholder="Название сервера" 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              className="input"
              style={{ fontSize: "12px", padding: "6px 8px" }}
            />
            <div style={{ display: "flex", gap: "4px" }}>
              <button 
                onClick={handleCreateGuild} 
                disabled={createGuildMutation.isPending || !name.trim()}
                style={{ 
                  flex: 1, 
                  fontSize: "12px", 
                  padding: "6px 8px",
                  backgroundColor: "var(--brand)",
                  border: "none",
                  color: "white",
                  borderRadius: "4px",
                  cursor: "pointer"
                }}
              >
                {createGuildMutation.isPending ? "Создание..." : "Создать"}
              </button>
              <button 
                onClick={() => {
                  setIsCreating(false);
                  setName("");
                }}
                style={{ 
                  fontSize: "12px", 
                  padding: "6px 8px",
                  backgroundColor: "var(--bg-600)",
                  border: "1px solid var(--border)",
                  color: "var(--text-300)",
                  borderRadius: "4px",
                  cursor: "pointer"
                }}
              >
                Отмена
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {guilds.map((guild) => (
        <div
          key={guild.id}
          className={`sidebar-item ${selectedGuildId === guild.id ? 'active' : ''}`}
          onClick={() => onGuildSelect?.(guild.id)}
          style={{ cursor: 'pointer' }}
        >
          🏠 {guild.name}
        </div>
      ))}
      
      {!isCreating ? (
        <button 
          onClick={() => setIsCreating(true)}
          style={{ 
            width: "100%", 
            padding: "8px", 
            fontSize: "12px",
            backgroundColor: "var(--bg-700)",
            border: "1px solid var(--border)",
            color: "var(--text-300)",
            borderRadius: "4px",
            cursor: "pointer",
            marginTop: "8px"
          }}
        >
          + Создать сервер
        </button>
      ) : (
        <div style={{ display: "grid", gap: "8px", marginTop: "8px" }}>
          <input 
            placeholder="Название сервера" 
            value={name} 
            onChange={(e) => setName(e.target.value)}
            className="input"
            style={{ fontSize: "12px", padding: "6px 8px" }}
          />
          <div style={{ display: "flex", gap: "4px" }}>
            <button 
              onClick={handleCreateGuild} 
              disabled={createGuildMutation.isPending || !name.trim()}
              style={{ 
                flex: 1, 
                fontSize: "12px", 
                padding: "6px 8px",
                backgroundColor: "var(--brand)",
                border: "none",
                color: "white",
                borderRadius: "4px",
                cursor: "pointer"
              }}
            >
              {createGuildMutation.isPending ? "Создание..." : "Создать"}
            </button>
            <button 
              onClick={() => {
                setIsCreating(false);
                setName("");
              }}
              style={{ 
                fontSize: "12px", 
                padding: "6px 8px",
                backgroundColor: "var(--bg-600)",
                border: "1px solid var(--border)",
                color: "var(--text-300)",
                borderRadius: "4px",
                cursor: "pointer"
              }}
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


