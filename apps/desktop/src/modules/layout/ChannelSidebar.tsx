import { ChannelList } from "../channels/components/ChannelList";

export function ChannelSidebar({ guildId }: { guildId: string }) {
  return (
    <>
      <div className="sidebar-header">Каналы</div>
      <div className="sidebar-list">
        <ChannelList guildId={guildId} />
      </div>
    </>
  );
}


