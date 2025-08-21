import { Hash, Send, Smile, Paperclip, Gift, Sticker, Pin, Users, Search, MoreHorizontal } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface ChatPaneProps {
  channelId: string;
  autoJoinVoice?: boolean;
}

interface Message {
  id: string;
  author: {
    name: string;
    avatar: string;
    color: string;
    role?: string;
  };
  content: string;
  timestamp: string;
  reactions?: Array<{
    emoji: string;
    count: number;
    users: string[];
  }>;
}

export function ChatPane({ channelId, autoJoinVoice }: ChatPaneProps) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mock messages - replace with real data
  useEffect(() => {
    setMessages([
      {
        id: "1",
        author: { 
          name: "Alice", 
          avatar: "A", 
          color: "from-blue-500 to-purple-600",
          role: "Admin"
        },
        content: "Hey everyone! 👋 Just pushed the new glassmorphism design update. What do you all think?",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        reactions: [
          { emoji: "🔥", count: 3, users: ["Bob", "Charlie", "Diana"] },
          { emoji: "👍", count: 5, users: ["Bob", "Charlie", "Diana", "Elena", "Frank"] }
        ]
      },
      {
        id: "2",
        author: { 
          name: "Bob", 
          avatar: "B", 
          color: "from-green-500 to-teal-600",
          role: "Developer"
        },
        content: "Wow! This looks absolutely stunning! 🤩 The glassmorphism effects are so smooth. Love the new typography too!",
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        reactions: [
          { emoji: "💯", count: 2, users: ["Alice", "Charlie"] }
        ]
      },
      {
        id: "3",
        author: { 
          name: "Charlie", 
          avatar: "C", 
          color: "from-orange-500 to-red-600",
          role: "Designer"
        },
        content: "The voice channel integration with LiveKit is working perfectly now! 🎤 Great job on the UI improvements!",
        timestamp: new Date(Date.now() - 900000).toISOString(),
      },
      {
        id: "4",
        author: { 
          name: "Diana", 
          avatar: "D", 
          color: "from-pink-500 to-rose-600"
        },
        content: "This is exactly what modern Discord alternatives should look like! ✨ The animations are buttery smooth.",
        timestamp: new Date(Date.now() - 300000).toISOString(),
      }
    ]);
  }, [channelId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!message.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      author: { 
        name: "You", 
        avatar: "Y", 
        color: "from-blue-500 to-purple-600"
      },
      content: message,
      timestamp: new Date().toISOString(),
    };

    setMessages([...messages, newMessage]);
    setMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const addReaction = (messageId: string, emoji: string) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        const existingReaction = msg.reactions?.find(r => r.emoji === emoji);
        if (existingReaction) {
          return {
            ...msg,
            reactions: msg.reactions?.map(r => 
              r.emoji === emoji 
                ? { ...r, count: r.count + 1, users: [...r.users, "You"] }
                : r
            )
          };
        } else {
          return {
            ...msg,
            reactions: [...(msg.reactions || []), { emoji, count: 1, users: ["You"] }]
          };
        }
      }
      return msg;
    }));
  };

  if (!channelId) {
    return (
      <div className="glass-panel flex-1 flex items-center justify-center m-2 rounded-3xl">
        <div className="text-center space-y-4">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto">
            <Hash size={48} className="text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Добро пожаловать в RSCORD</h2>
            <p className="text-white/60 text-lg">Выберите канал, чтобы начать общение</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel flex flex-col h-full overflow-hidden rounded-3xl border border-white/15 backdrop-blur-xl bg-white/8 mx-2">
      {/* Channel Header */}
      <div className="glass-chat-header">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Hash size={16} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">general</h1>
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse ml-2"></div>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="glass-icon-button">
            <Pin size={18} className="text-white/60 hover:text-white transition-colors" />
          </button>
          <button className="glass-icon-button">
            <Users size={18} className="text-white/60 hover:text-white transition-colors" />
          </button>
          <button className="glass-icon-button">
            <Search size={18} className="text-white/60 hover:text-white transition-colors" />
          </button>
          <button className="glass-icon-button">
            <MoreHorizontal size={18} className="text-white/60 hover:text-white transition-colors" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4">
        {messages.map((msg, index) => (
          <div key={msg.id} className="glass-message-container group">
            {/* Avatar */}
            <div className={`glass-message-avatar bg-gradient-to-br ${msg.author.color}`}>
              <span className="text-white font-bold text-lg">{msg.author.avatar}</span>
            </div>
            
            {/* Message Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <span className={`glass-author-name bg-gradient-to-r ${msg.author.color} bg-clip-text text-transparent font-bold`}>
                  {msg.author.name}
                </span>
                {msg.author.role && (
                  <span className="glass-role-badge">
                    {msg.author.role}
                  </span>
                )}
                <span className="text-white/50 text-sm font-medium">{formatTime(msg.timestamp)}</span>
              </div>
              <div className="glass-message-content">
                {msg.content}
              </div>
              
              {/* Reactions */}
              {msg.reactions && msg.reactions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {msg.reactions.map((reaction, idx) => (
                    <button
                      key={idx}
                      onClick={() => addReaction(msg.id, reaction.emoji)}
                      className="glass-reaction-button"
                    >
                      <span className="text-lg">{reaction.emoji}</span>
                      <span className="text-white/80 font-medium ml-1">{reaction.count}</span>
                    </button>
                  ))}
                  <button 
                    onClick={() => addReaction(msg.id, "❤️")}
                    className="glass-add-reaction-button"
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicator */}
      {isTyping && (
        <div className="px-6 py-2">
          <div className="glass-typing-indicator">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
              <span className="text-white/60 text-sm">Кто-то печатает...</span>
            </div>
          </div>
        </div>
      )}

      {/* Message Input */}
      <div className="p-6">
        <div className="glass-message-input-wrapper">
          {/* Input Field */}
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Сообщение в #general"
            className="glass-message-input"
          />
          
          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button className="glass-input-action">
              <Gift size={20} className="text-white/60 hover:text-white transition-colors" />
            </button>
            <button className="glass-input-action">
              <Sticker size={20} className="text-white/60 hover:text-white transition-colors" />
            </button>
            <button className="glass-input-action">
              <Smile size={20} className="text-white/60 hover:text-white transition-colors" />
            </button>
            <button className="glass-input-action">
              <Paperclip size={20} className="text-white/60 hover:text-white transition-colors" />
            </button>
            {message.trim() && (
              <button 
                onClick={handleSend}
                className="glass-send-button"
              >
                <Send size={20} className="text-white" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}