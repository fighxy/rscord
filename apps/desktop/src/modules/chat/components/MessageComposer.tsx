import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { sendMessage } from "../api";

export function MessageComposer({ channelId, authorId }: { channelId: string; authorId: string }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const m = useMutation({
    mutationFn: () => sendMessage(channelId, authorId, text),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["messages", channelId] });
    },
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) m.mutate();
      }}
      style={{ display: "flex", gap: 8, marginTop: 8 }}
    >
      <input style={{ flex: 1 }} placeholder="Write a message" value={text} onChange={(e) => setText(e.target.value)} />
      <button type="submit" disabled={m.isPending || !channelId}>
        Send
      </button>
    </form>
  );
}


