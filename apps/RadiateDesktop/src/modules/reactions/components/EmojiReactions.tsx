import { useState, useEffect } from "react";
import { useAuth } from "../../auth/store";
import { addReaction, removeReaction, getReactions } from "../api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Reaction {
  emoji: string;
  count: number;
  users: string[];
}

interface EmojiReactionsProps {
  messageId: string;
}

const COMMON_EMOJIS = ['👍', '👎', '❤️', '😄', '😢', '😡', '🎉', '🚀', '👀', '🔥'];

export function EmojiReactions({ messageId }: EmojiReactionsProps) {
  const { user } = useAuth();
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Загружаем реакции при монтировании
  useEffect(() => {
    loadReactions();
  }, [messageId]);

  const loadReactions = async () => {
    try {
      const data = await getReactions(messageId);
      setReactions(data);
    } catch (error) {
      console.error('Failed to load reactions:', error);
    }
  };

  const handleAddReaction = async (emoji: string) => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      await addReaction(messageId, user.id, emoji);
      await loadReactions(); // Перезагружаем реакции
    } catch (error) {
      console.error('Failed to add reaction:', error);
    } finally {
      setIsLoading(false);
    }
    setShowEmojiPicker(false);
  };

  const handleRemoveReaction = async (emoji: string) => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      await removeReaction(messageId, user.id, emoji);
      await loadReactions(); // Перезагружаем реакции
    } catch (error) {
      console.error('Failed to remove reaction:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleReaction = async (emoji: string) => {
    if (!user?.id) return;

    const existingReaction = reactions.find(r => r.emoji === emoji);
    const hasUserReacted = existingReaction?.users.includes(user.id);

    if (hasUserReacted) {
      await handleRemoveReaction(emoji);
    } else {
      await handleAddReaction(emoji);
    }
  };

  const isUserReacted = (emoji: string) => {
    if (!user?.id) return false;
    const reaction = reactions.find(r => r.emoji === emoji);
    return reaction?.users.includes(user.id) || false;
  };

  if (!user) return null;

  return (
    <div className="relative">
      {/* Существующие реакции */}
      <div className="flex flex-wrap gap-1 mb-2">
        {reactions.map((reaction) => (
          <button
            key={reaction.emoji}
            onClick={() => toggleReaction(reaction.emoji)}
            disabled={isLoading}
            className={`px-2 py-1 rounded-full text-sm transition-all duration-200 flex items-center gap-1 ${
              isUserReacted(reaction.emoji)
                ? 'bg-discord-blurple text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white'
            } ${isLoading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
            title={`${reaction.emoji} ${reaction.count}`}
          >
            <span>{reaction.emoji}</span>
            <span className="text-xs">{reaction.count}</span>
          </button>
        ))}
      </div>

      {/* Кнопка добавления реакции */}
      <Button
        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
        variant="outline"
        size="sm"
        className="bg-gray-700 hover:bg-gray-600 border-gray-600 text-gray-300 hover:text-white"
        disabled={isLoading}
      >
        😀
      </Button>

      {/* Эмодзи пикер */}
      {showEmojiPicker && (
        <div className="absolute bottom-full left-0 bg-discord-dark border border-gray-700 rounded-lg p-3 shadow-xl z-50 mb-2">
          <div className="grid grid-cols-5 gap-2 max-w-48">
            {COMMON_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleAddReaction(emoji)}
                disabled={isLoading}
                className="w-8 h-8 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-md cursor-pointer text-base transition-all duration-200 flex items-center justify-center disabled:opacity-60"
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
          
          {/* Кастомный эмодзи */}
          <div className="mt-3 pt-3 border-t border-gray-700">
            <Input
              type="text"
              placeholder="Введите эмодзи..."
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  const emoji = e.currentTarget.value.trim();
                  if (emoji) {
                    handleAddReaction(emoji);
                    e.currentTarget.value = '';
                  }
                }
              }}
              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-discord-blurple focus:border-transparent text-xs"
            />
          </div>
        </div>
      )}

      {/* Индикатор загрузки */}
      {isLoading && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-gray-400 text-xs">
          Загрузка...
        </div>
      )}
    </div>
  );
}
