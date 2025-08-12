import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createGuild, listGuilds } from "../api";
import { useState } from "react";

export function GuildList() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["guilds"], queryFn: listGuilds });
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const m = useMutation({
    mutationFn: () => createGuild(name, owner),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["guilds"] }),
  });
  return (
    <div>
      <h3>Guilds</h3>
      <ul>
        {data?.map((g) => (
          <li key={g.id}>{g.name}</li>
        ))}
      </ul>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input placeholder="Guild name" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="Owner ULID" value={owner} onChange={(e) => setOwner(e.target.value)} />
        <button onClick={() => m.mutate()} disabled={m.isPending}>Create</button>
      </div>
    </div>
  );
}


