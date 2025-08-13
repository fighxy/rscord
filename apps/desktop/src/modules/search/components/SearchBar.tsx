import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchMessages, searchChannels } from "../api";
import { useAuth } from "../../auth/store";

interface SearchResult {
  id: string;
  type: 'message' | 'channel';
  title: string;
  content: string;
  channel_name: string;
  guild_name: string;
  timestamp: string;
  author_name?: string;
}

export function SearchBar() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [searchType, setSearchType] = useState<'all' | 'messages' | 'channels'>('all');
  const searchRef = useRef<HTMLDivElement>(null);

  // Закрываем поиск при клике вне компонента
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Поиск сообщений
  const { data: messageResults, isLoading: messagesLoading } = useQuery({
    queryKey: ['search', 'messages', query],
    queryFn: () => searchMessages(query),
    enabled: !!query && (searchType === 'all' || searchType === 'messages'),
    staleTime: 5 * 60 * 1000, // 5 минут
  });

  // Поиск каналов
  const { data: channelResults, isLoading: channelsLoading } = useQuery({
    queryKey: ['search', 'channels', query],
    queryFn: () => searchChannels(query),
    enabled: !!query && (searchType === 'all' || searchType === 'channels'),
    staleTime: 5 * 60 * 1000, // 5 минут
  });

  const isLoading = messagesLoading || channelsLoading;
  const hasResults = (messageResults && messageResults.length > 0) || 
                    (channelResults && channelResults.length > 0);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setIsOpen(true);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    // Здесь можно добавить навигацию к результату
    console.log('Clicked result:', result);
    setIsOpen(false);
    setQuery("");
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'только что';
    if (minutes < 60) return `${minutes} мин назад`;
    if (hours < 24) return `${hours} ч назад`;
    return `${days} дн назад`;
  };

  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark style="background-color: var(--brand); color: white; padding: 0 2px; border-radius: 2px;">$1</mark>');
  };

  if (!user) return null;

  return (
    <div ref={searchRef} style={{ position: 'relative', width: '100%' }}>
      {/* Поисковая строка */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            type="text"
            placeholder="Поиск по сообщениям и каналам..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              backgroundColor: 'var(--bg-700)',
              color: 'var(--text-100)',
              fontSize: '14px'
            }}
          />
          <div style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-500)',
            fontSize: '16px'
          }}>
            🔍
          </div>
        </div>
        
        <select
          value={searchType}
          onChange={(e) => setSearchType(e.target.value as 'all' | 'messages' | 'channels')}
          style={{
            padding: '8px 12px',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            backgroundColor: 'var(--bg-700)',
            color: 'var(--text-100)',
            fontSize: '14px'
          }}
        >
          <option value="all">Все</option>
          <option value="messages">Сообщения</option>
          <option value="channels">Каналы</option>
        </select>
        
        <button
          type="submit"
          disabled={!query.trim()}
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--brand)',
            border: 'none',
            borderRadius: '6px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            opacity: query.trim() ? 1 : 0.6
          }}
        >
          Найти
        </button>
      </form>

      {/* Результаты поиска */}
      {isOpen && query.trim() && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          backgroundColor: 'var(--bg-800)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          zIndex: 1000,
          maxHeight: '500px',
          overflowY: 'auto',
          marginTop: '8px'
        }}>
          {/* Заголовок результатов */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h3 style={{ margin: 0, color: 'var(--text-100)', fontSize: '14px' }}>
              Результаты поиска
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-500)',
                cursor: 'pointer',
                fontSize: '16px',
                padding: '4px'
              }}
            >
              ✕
            </button>
          </div>

          {/* Состояние загрузки */}
          {isLoading && (
            <div style={{
              padding: '32px 16px',
              textAlign: 'center',
              color: 'var(--text-500)',
              fontSize: '14px'
            }}>
              🔍 Поиск...
            </div>
          )}

          {/* Нет результатов */}
          {!isLoading && !hasResults && (
            <div style={{
              padding: '32px 16px',
              textAlign: 'center',
              color: 'var(--text-500)',
              fontSize: '14px'
            }}>
              Ничего не найдено по запросу "{query}"
            </div>
          )}

          {/* Результаты поиска */}
          {!isLoading && hasResults && (
            <div>
              {/* Сообщения */}
              {messageResults && messageResults.length > 0 && (
                <div>
                  <div style={{
                    padding: '8px 16px',
                    backgroundColor: 'var(--bg-700)',
                    color: 'var(--text-400)',
                    fontSize: '12px',
                    fontWeight: '600',
                    textTransform: 'uppercase'
                  }}>
                    Сообщения ({messageResults.length})
                  </div>
                  {messageResults.map((result) => (
                    <div
                      key={`msg-${result.id}`}
                      onClick={() => handleResultClick(result)}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border-200)',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-700)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px'
                      }}>
                        <div style={{
                          fontSize: '16px',
                          color: 'var(--text-400)'
                        }}>
                          💬
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '4px'
                          }}>
                            <span style={{
                              fontWeight: '600',
                              color: 'var(--text-100)',
                              fontSize: '13px'
                            }}>
                              {result.author_name || 'Неизвестный'}
                            </span>
                            <span style={{
                              color: 'var(--text-500)',
                              fontSize: '11px'
                            }}>
                              в #{result.channel_name}
                            </span>
                            <span style={{
                              color: 'var(--text-500)',
                              fontSize: '11px'
                            }}>
                              {formatTime(result.timestamp)}
                            </span>
                          </div>
                          <div
                            style={{
                              color: 'var(--text-300)',
                              fontSize: '13px',
                              lineHeight: '1.4'
                            }}
                            dangerouslySetInnerHTML={{
                              __html: highlightText(result.content, query)
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Каналы */}
              {channelResults && channelResults.length > 0 && (
                <div>
                  <div style={{
                    padding: '8px 16px',
                    backgroundColor: 'var(--bg-700)',
                    color: 'var(--text-400)',
                    fontSize: '12px',
                    fontWeight: '600',
                    textTransform: 'uppercase'
                  }}>
                    Каналы ({channelResults.length})
                  </div>
                  {channelResults.map((result) => (
                    <div
                      key={`chan-${result.id}`}
                      onClick={() => handleResultClick(result)}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border-200)',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-700)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                      }}>
                        <div style={{
                          fontSize: '16px',
                          color: 'var(--text-400)'
                        }}>
                          {result.type === 'voice' ? '🎤' : '#'}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontWeight: '600',
                            color: 'var(--text-100)',
                            fontSize: '14px',
                            marginBottom: '4px'
                          }}>
                            {result.name}
                          </div>
                          <div style={{
                            color: 'var(--text-500)',
                            fontSize: '12px'
                          }}>
                            Сервер: {result.guild_name}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
