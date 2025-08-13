import { useState, useEffect } from "react";
import { useAuth } from "../../auth/store";
import { addReaction, removeReaction, getReactions } from "../api";

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
    <div style={{ position: 'relative' }}>
      {/* Существующие реакции */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px',
        marginBottom: '8px'
      }}>
        {reactions.map((reaction) => (
          <button
            key={reaction.emoji}
            onClick={() => toggleReaction(reaction.emoji)}
            disabled={isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              backgroundColor: isUserReacted(reaction.emoji) ? 'var(--brand)' : 'var(--bg-700)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              color: isUserReacted(reaction.emoji) ? 'white' : 'var(--text-300)',
              cursor: 'pointer',
              fontSize: '12px',
              transition: 'all 0.2s',
              opacity: isLoading ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (!isUserReacted(reaction.emoji)) {
                e.currentTarget.style.backgroundColor = 'var(--bg-600)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isUserReacted(reaction.emoji)) {
                e.currentTarget.style.backgroundColor = 'var(--bg-700)';
              }
            }}
          >
            <span style={{ fontSize: '14px' }}>{reaction.emoji}</span>
            <span>{reaction.count}</span>
          </button>
        ))}

        {/* Кнопка добавления реакции */}
        <button
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          disabled={isLoading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            backgroundColor: 'var(--bg-700)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            color: 'var(--text-400)',
            cursor: 'pointer',
            fontSize: '12px',
            transition: 'all 0.2s',
            opacity: isLoading ? 0.6 : 1
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-600)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-700)';
          }}
        >
          <span style={{ fontSize: '14px' }}>😊</span>
          <span>+</span>
        </button>
      </div>

      {/* Выбор эмодзи */}
      {showEmojiPicker && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '0',
          backgroundColor: 'var(--bg-800)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '12px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          zIndex: 1000,
          marginBottom: '8px'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '8px',
            maxWidth: '200px'
          }}>
            {COMMON_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleAddReaction(emoji)}
                disabled={isLoading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  backgroundColor: 'var(--bg-700)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  transition: 'all 0.2s',
                  opacity: isLoading ? 0.6 : 1
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-600)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-700)';
                }}
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
          
          {/* Кастомный эмодзи */}
          <div style={{
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid var(--border)'
          }}>
            <input
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
              style={{
                width: '100%',
                padding: '6px 8px',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                backgroundColor: 'var(--bg-700)',
                color: 'var(--text-100)',
                fontSize: '12px'
              }}
            />
          </div>
        </div>
      )}

      {/* Индикатор загрузки */}
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: 'var(--text-500)',
          fontSize: '12px'
        }}>
          Загрузка...
        </div>
      )}
    </div>
  );
}
