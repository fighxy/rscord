import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchMessages, searchChannels } from "../api";
import { useAuth } from "../../auth/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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

  // Функции для преобразования типов результатов поиска
  const messageToSearchResult = (msg: any): SearchResult => ({
    id: msg.id,
    type: 'message',
    title: msg.author_name,
    content: msg.content,
    channel_name: msg.channel_name,
    guild_name: msg.guild_name,
    timestamp: msg.timestamp,
    author_name: msg.author_name
  });

  const channelToSearchResult = (channel: any): SearchResult => ({
    id: channel.id,
    type: 'channel',
    title: channel.name,
    content: `Канал ${channel.type}`,
    channel_name: channel.name,
    guild_name: channel.guild_name,
    timestamp: new Date().toISOString()
  });

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
    if (days < 7) return `${days} дн назад`;
    return date.toLocaleDateString('ru-RU');
  };

  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200 text-black px-1 rounded">$1</mark>');
  };

  if (!user) return null;

  return (
    <div className="relative" ref={searchRef}>
      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          type="text"
          placeholder="Поиск сообщений и каналов..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-discord-blurple focus:border-transparent"
        />
        <Button 
          type="submit" 
          size="sm"
          className="bg-discord-blurple hover:bg-blue-600"
        >
          🔍
        </Button>
      </form>

      {/* Выпадающее меню поиска */}
      {isOpen && query.trim() && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-discord-dark border border-gray-700 rounded-lg shadow-xl max-h-96 overflow-y-auto z-50">
          {/* Заголовок */}
          <div className="p-3 border-b border-gray-700 bg-discord-dark">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-200">
                Результаты поиска для "{query}"
              </span>
              <div className="flex gap-1">
                <Button
                  variant={searchType === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSearchType('all')}
                  className="text-xs px-2 py-1 h-6"
                >
                  Все
                </Button>
                <Button
                  variant={searchType === 'messages' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSearchType('messages')}
                  className="text-xs px-2 py-1 h-6"
                >
                  Сообщения
                </Button>
                <Button
                  variant={searchType === 'channels' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSearchType('channels')}
                  className="text-xs px-2 py-1 h-6"
                >
                  Каналы
                </Button>
              </div>
            </div>
          </div>

          {/* Результаты */}
          {isLoading ? (
            <div className="p-4 text-center text-gray-400">
              Поиск...
            </div>
          ) : !hasResults ? (
            <div className="p-4 text-center text-gray-400">
              Ничего не найдено
            </div>
          ) : (
            <div>
              {/* Сообщения */}
              {messageResults && messageResults.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-gray-700 text-gray-300 text-xs font-semibold uppercase">
                    Сообщения ({messageResults.length})
                  </div>
                  {messageResults.map((result) => (
                    <div
                      key={`msg-${result.id}`}
                      onClick={() => handleResultClick(messageToSearchResult(result))}
                      className="p-3 border-b border-gray-700 cursor-pointer hover:bg-gray-700 transition-colors duration-200"
                    >
                      <div className="flex gap-3">
                        <div className="w-8 h-8 bg-discord-blurple rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                          {result.author_name?.slice(0, 2).toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-200 text-sm">
                              {result.author_name || 'Неизвестный'}
                            </span>
                            <span className="text-gray-400 text-xs">
                              в #{result.channel_name}
                            </span>
                            <span className="text-gray-400 text-xs">
                              {formatTime(result.timestamp)}
                            </span>
                          </div>
                          <div
                            className="text-gray-300 text-sm leading-relaxed"
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
                  <div className="px-4 py-2 bg-gray-700 text-gray-300 text-xs font-semibold uppercase">
                    Каналы ({channelResults.length})
                  </div>
                  {channelResults.map((result) => (
                    <div
                      key={`chan-${result.id}`}
                      onClick={() => handleResultClick(channelToSearchResult(result))}
                      className="p-3 border-b border-gray-700 cursor-pointer hover:bg-gray-700 transition-colors duration-200"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-base text-gray-400">
                          {result.type === 'voice' ? '🎤' : '#'}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-gray-200 text-sm mb-1">
                            {result.name}
                          </div>
                          <div className="text-gray-400 text-xs">
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
