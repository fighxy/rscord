import { useQuery } from "@tanstack/react-query";
import { listChannels } from "../api";

export function ChannelList({ guildId }: { guildId: string }) {
  const { data } = useQuery({ queryKey: ["channels", guildId], queryFn: () => listChannels(guildId), enabled: !!guildId });
  return (
    <div>
      <h3>Channels</h3>
      <ul>
        {data?.map((c) => (
          <li key={c.id}>{c.name}</li>
        ))}
      </ul>
    </div>
  );
}


