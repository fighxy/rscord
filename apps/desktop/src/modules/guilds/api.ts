import httpClient from "../../shared/api/http";

export type Guild = { id: string; name: string; owner_id: string; created_at: string };

export async function listGuilds() {
  const res = await httpClient.get<Guild[]>("/guilds");
  return res.data;
}

export async function createGuild(name: string, owner_id: string) {
  const res = await httpClient.post<{ guild: Guild }>("/guilds", { name, owner_id });
  return res.data.guild;
}


