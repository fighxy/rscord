import { useState } from "react";
import { RoleManager } from "../../roles/components/RoleManager";
import { MemberList } from "../../layout/MemberList";

interface GuildManagementProps {
  guildId: string;
}

type TabType = "roles" | "members";

export function GuildManagement({ guildId }: GuildManagementProps) {
  const [activeTab, setActiveTab] = useState<TabType>("roles");

  return (
    <div className="p-6 bg-discord-dark rounded-lg">
      {/* Вкладки */}
      <div className="flex gap-1 mb-6 bg-gray-700 p-1 rounded-lg">
        <button
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
            activeTab === "roles"
              ? 'bg-discord-blurple text-white'
              : 'text-gray-300 hover:text-white hover:bg-gray-600'
          }`}
          onClick={() => setActiveTab("roles")}
        >
          Роли
        </button>
        <button
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
            activeTab === "members"
              ? 'bg-discord-blurple text-white'
              : 'text-gray-300 hover:text-white hover:bg-gray-600'
          }`}
          onClick={() => setActiveTab("members")}
        >
          Участники
        </button>
      </div>

      {/* Содержимое вкладок */}
      <div>
        {activeTab === "roles" && (
          <RoleManager guildId={guildId} />
        )}
        {activeTab === "members" && (
          <MemberList guildId={guildId} />
        )}
      </div>
    </div>
  );
}
