import { ChannelList } from "../channels/components/ChannelList";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createChannel } from "../channels/api";
import { useAuth } from "../auth/store";

interface ChannelSidebarProps {
  guildId: string;
  selectedChannelId?: string;
  onChannelSelect?: (channelId: string) => void;
}

export function ChannelSidebar({ guildId, selectedChannelId, onChannelSelect }: ChannelSidebarProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [channelName, setChannelName] = useState("");

  const createChannelMutation = useMutation({
    mutationFn: () => {
      if (!user?.id) {
        throw new Error("Пользователь не аутентифицирован");
      }
      
      // Получаем выбранный тип канала
      const channelTypeInput = document.querySelector('input[name="channelType"]:checked') as HTMLInputElement;
      const channelType = channelTypeInput?.value as 'text' | 'voice' || 'text';
      
      return createChannel(guildId, channelName, channelType);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["channels", guildId] });
      setChannelName("");
      setIsCreating(false);
    },
    onError: (error: any) => {
      console.error("Ошибка создания канала:", error);
    },
  });

  const handleCreateChannel = () => {
    if (!channelName.trim()) return;
    createChannelMutation.mutate();
  };

  return (
    <>
      <div className="sidebar-header">
        Каналы
        <button
          onClick={() => setIsCreating(true)}
          style={{
            float: "right",
            background: "none",
            border: "none",
            color: "var(--text-400)",
            cursor: "pointer",
            fontSize: "16px",
            padding: "0",
            width: "20px",
            height: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
          title="Создать канал"
        >
          +
        </button>
      </div>
      <div className="sidebar-list">
        {isCreating && (
          <div style={{ 
            padding: "8px", 
            backgroundColor: "var(--bg-700)", 
            borderRadius: "4px",
            marginBottom: "8px"
          }}>
            <input
              placeholder="Название канала"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              className="input"
              style={{ fontSize: "12px", padding: "6px 8px", marginBottom: "8px" }}
            />
            
            {/* Выбор типа канала */}
            <div style={{ 
              display: "flex", 
              gap: "8px", 
              marginBottom: "8px",
              fontSize: "12px"
            }}>
              <label style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "4px",
                color: "var(--text-300)",
                cursor: "pointer"
              }}>
                <input
                  type="radio"
                  name="channelType"
                  value="text"
                  defaultChecked
                  style={{ margin: 0 }}
                />
                💬 Текстовый
              </label>
              <label style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "4px",
                color: "var(--text-300)",
                cursor: "pointer"
              }}>
                <input
                  type="radio"
                  name="channelType"
                  value="voice"
                  style={{ margin: 0 }}
                />
                🎤 Голосовой
              </label>
            </div>
            
            <div style={{ display: "flex", gap: "4px" }}>
              <button
                onClick={handleCreateChannel}
                disabled={createChannelMutation.isPending || !channelName.trim()}
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
                {createChannelMutation.isPending ? "Создание..." : "Создать"}
              </button>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setChannelName("");
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
        
        <ChannelList 
          guildId={guildId} 
          selectedChannelId={selectedChannelId}
          onChannelSelect={onChannelSelect}
        />
      </div>
    </>
  );
}


