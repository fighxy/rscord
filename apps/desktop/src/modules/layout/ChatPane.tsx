import { MessageList } from "../chat/components/MessageList";
import { MessageComposer } from "../chat/components/MessageComposer";

export function ChatPane({ channelId, authorId }: { channelId: string; authorId: string }) {
  return (
    <>
      <div className="chat-header">#{channelId ? channelId.slice(0, 6) : "channel"}</div>
      <div className="chat-scroll">
        <MessageList channelId={channelId} />
      </div>
      <div className="chat-input">
        <MessageComposer channelId={channelId} authorId={authorId} />
      </div>
    </>
  );
}


