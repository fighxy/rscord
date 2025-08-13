import { MessageList } from "../chat/components/MessageList";
import { MessageComposer } from "../chat/components/MessageComposer";
import { TypingIndicator } from "../chat/components/TypingIndicator";
import { VoiceChannelPane } from "../voice/components/VoiceChannelPane";
import { useQuery } from "@tanstack/react-query";
import { getChannel } from "../channels/api";

interface ChatPaneProps {
  channelId: string;
  autoJoinVoice?: boolean;
}

export function ChatPane({ channelId, autoJoinVoice }: ChatPaneProps) {
  const { data: channel } = useQuery({
    queryKey: ["channel", channelId],
    queryFn: () => getChannel(channelId),
    enabled: !!channelId
  });

  console.log('ChatPane render:', { channelId, autoJoinVoice, channelType: channel?.channel_type });

  if (!channelId) {
    return (
      <div style={{ 
        display: "grid", 
        placeItems: "center", 
        height: "100%", 
        color: "var(--text-500)",
        fontSize: "18px"
      }}>
        Выберите канал для начала общения
      </div>
    );
  }

  // Определяем тип канала
  const isVoiceChannel = channel?.channel_type === 'voice';

  return (
    <>
      <div className="chat-header">
        {channel ? (
          <>
            {isVoiceChannel ? '🎤' : '#'} {channel.name}
            {isVoiceChannel && (
              <span style={{ 
                fontSize: "12px", 
                color: "var(--text-500)", 
                marginLeft: "8px",
                fontWeight: "normal"
              }}>
                Голосовой канал
              </span>
            )}
          </>
        ) : (
          `# ${channelId.slice(0, 8)}`
        )}
      </div>
      
      {isVoiceChannel ? (
        <VoiceChannelPane 
          channelId={channelId} 
          channelName={channel?.name || ''} 
          autoJoin={autoJoinVoice}
        />
      ) : (
        <>
          <div className="chat-scroll">
            <MessageList channelId={channelId} />
            <TypingIndicator channelId={channelId} />
          </div>
          <MessageComposer channelId={channelId} />
        </>
      )}
    </>
  );
}


