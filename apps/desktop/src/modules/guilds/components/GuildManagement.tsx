import { useState } from "react";
import { RoleManager } from "../../roles/components/RoleManager";
import { MemberList } from "../../layout/MemberList";
import "./GuildManagement.css";

interface GuildManagementProps {
  guildId: string;
}

type TabType = "roles" | "members";

export function GuildManagement({ guildId }: GuildManagementProps) {
  const [activeTab, setActiveTab] = useState<TabType>("roles");

  return (
    <div className="guild-management">
      {/* Вкладки */}
      <div className="management-tabs">
        <button
          className={`tab-button ${activeTab === "roles" ? "active" : ""}`}
          onClick={() => setActiveTab("roles")}
        >
          Роли
        </button>
        <button
          className={`tab-button ${activeTab === "members" ? "active" : ""}`}
          onClick={() => setActiveTab("members")}
        >
          Участники
        </button>
      </div>

      {/* Содержимое вкладок */}
      <div className="tab-content">
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
