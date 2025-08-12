import { http } from "../../shared/api/http";

export type Channel = { id: string; guild_id: string; name: string; created_at: string };

export async function listChannels(guild_id: string) {
  const res = await http.get<Channel[]>(`/guilds/${guild_id}/channels`);
  return res.data;
}


