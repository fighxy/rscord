import { http } from "../../shared/api/http";

export type Message = { id: string; channel_id: string; author_id: string; content: string; created_at: string };

export async function listMessages(channel_id: string) {
  const res = await http.get<Message[]>(`/channels/${channel_id}/messages`);
  return res.data;
}

export async function sendMessage(channel_id: string, author_id: string, content: string) {
  const res = await http.post<{ message: Message }>(`/channels/${channel_id}/messages`, { author_id, content });
  return res.data.message;
}


