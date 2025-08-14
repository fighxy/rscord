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
      <div className="grid place-items-center h-full text-gray-400 text-lg">
        Выберите канал для начала общения
      </div>
    );
  }

  // Определяем тип канала
  const isVoiceChannel = channel?.channel_type === 'voice';

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="flex items-center px-4 py-3 border-b border-gray-700 bg-discord-dark">
        {channel ? (
          <div className="flex items-center">
            <span className="text-xl mr-2">
              {isVoiceChannel ? '🎤' : '#'}
            </span>
            <span className="text-white font-medium">{channel.name}</span>
            {isVoiceChannel && (
              <span className="ml-3 text-xs text-gray-400 font-normal">
                Голосовой канал
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center">
            <span className="text-xl mr-2">#</span>
            <span className="text-white font-medium">{channelId.slice(0, 8)}</span>
          </div>
        )}
      </div>
      
      {/* Chat Content */}
      {isVoiceChannel ? (
        <VoiceChannelPane 
          channelId={channelId} 
          channelName={channel?.name || ''} 
          autoJoin={autoJoinVoice}
        />
      ) : (
        <div className="flex flex-col flex-1">
          <div className="flex-1 overflow-y-auto">
            <MessageList channelId={channelId} />
            <TypingIndicator channelId={channelId} />
          </div>
          <MessageComposer channelId={channelId} />
        </div>
      )}
    </div>
  );
}


