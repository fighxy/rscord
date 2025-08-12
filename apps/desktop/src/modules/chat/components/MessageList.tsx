import { useQuery } from "@tanstack/react-query";
import { listMessages } from "../api";

export function MessageList({ channelId }: { channelId: string }) {
  const { data } = useQuery({ queryKey: ["messages", channelId], queryFn: () => listMessages(channelId), enabled: !!channelId });
  return (
    <div style={{ height: 400, overflow: "auto", border: "1px solid #ccc", padding: 8 }}>
      {(data ?? []).map((m) => (
        <div key={m.id}>
          <strong>{m.author_id.slice(0, 6)}</strong>: {m.content}
        </div>
      ))}
    </div>
  );
}


