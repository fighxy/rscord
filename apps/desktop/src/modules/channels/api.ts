import { http } from "../../shared/api/http";

export type Channel = { 
  id: string; 
  guild_id: string; 
  name: string; 
  channel_type: string; // "text" или "voice"
  created_at: string 
};

export interface CreateChannelRequest {
  guild_id: string;
  name: string;
}

export async function listChannels(guild_id: string) {
  const res = await http.get<Channel[]>(`/guilds/${guild_id}/channels`);
  return res.data;
}

export async function createChannel(guild_id: string, name: string, channelType: 'text' | 'voice' = 'text') {
  const res = await http.post<Channel>('/guilds/' + guild_id + '/channels', {
    guild_id,
    name,
    channel_type: channelType
  });
  return res.data;
}

export async function getChannel(channel_id: string) {
  const res = await http.get<Channel>(`/channels/${channel_id}`);
  return res.data;
}


