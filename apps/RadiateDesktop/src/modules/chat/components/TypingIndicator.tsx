import { useRealTime } from "../../events/hooks/useRealTime";

interface TypingIndicatorProps {
  channelId: string;
}

export function TypingIndicator({ channelId }: TypingIndicatorProps) {
  const { getTypingUsers } = useRealTime();
  const typingUsers = getTypingUsers(channelId);

  if (typingUsers.length === 0) {
    return null;
  }

  const formatTypingText = (users: typeof typingUsers) => {
    if (users.length === 1) {
      return `${users[0].display_name} печатает...`;
    } else if (users.length === 2) {
      return `${users[0].display_name} и ${users[1].display_name} печатают...`;
    } else {
      return `${users[0].display_name} и еще ${users.length - 1} печатают...`;
    }
  };

  return (
    <div className="px-4 py-2 text-gray-400 text-xs italic flex items-center gap-2">
      <div className="flex gap-0.5">
        <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" />
        <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
        <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
      </div>
      <span>{formatTypingText(typingUsers)}</span>
    </div>
  );
}
