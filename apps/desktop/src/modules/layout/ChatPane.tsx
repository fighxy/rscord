import { Hash, Send, Smile, Paperclip, Gift, Sticker } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface ChatPaneProps {
  channelId: string;
  autoJoinVoice?: boolean;
}

export function ChatPane({ channelId, autoJoinVoice }: ChatPaneProps) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mock messages - replace with real data
  useEffect(() => {
    setMessages([
      {
        id: "1",
        author: { name: "Alice", avatar: "A", color: "#5865f2" },
        content: "Hey everyone! How's it going?",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: "2",
        author: { name: "Bob", avatar: "B", color: "#3ba55d" },
        content: "Pretty good! Just working on some code.",
        timestamp: new Date(Date.now() - 1800000).toISOString(),
      },
      {
        id: "3",
        author: { name: "Charlie", avatar: "C", color: "#faa61a" },
        content: "Same here. Anyone up for a game later?",
        timestamp: new Date(Date.now() - 900000).toISOString(),
      },
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

    // Add message to local state (in real app, send to server)
    const newMessage = {
      id: Date.now().toString(),
      author: { name: "You", avatar: "Y", color: "#5865f2" },
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

  if (!channelId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold text-header">Добро пожаловать в RSCORD</h2>
          <p className="text-muted">Выберите канал, чтобы начать общение</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Channel Header */}
      <div className="h-12 px-4 flex items-center shadow-sm"
           style={{ borderBottom: '1px solid var(--background-tertiary)' }}>
        <Hash size={20} className="mr-2 opacity-60" />
        <span className="font-semibold">general</span>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.map((msg, index) => (
          <div key={msg.id} className="message-container group">
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full mr-4 flex-shrink-0 flex items-center justify-center"
                 style={{ backgroundColor: msg.author.color }}>
              <span className="text-white font-semibold">{msg.author.avatar}</span>
            </div>
            
            {/* Message Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-medium" style={{ color: msg.author.color }}>
                  {msg.author.name}
                </span>
                <span className="text-xs text-muted">{formatTime(msg.timestamp)}</span>
              </div>
              <div className="text-sm break-words">{msg.content}</div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="px-4 pb-6">
        <div className="relative flex items-center rounded-lg"
             style={{ background: 'var(--input-background)' }}>
          {/* Input Field */}
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`Message #general`}
            className="flex-1 bg-transparent px-4 py-3 outline-none"
            style={{ color: 'var(--text-normal)' }}
          />
          
          {/* Action Buttons */}
          <div className="flex items-center gap-3 px-3">
            <button className="opacity-60 hover:opacity-100 transition-opacity">
              <Gift size={20} />
            </button>
            <button className="opacity-60 hover:opacity-100 transition-opacity">
              <Sticker size={20} />
            </button>
            <button className="opacity-60 hover:opacity-100 transition-opacity">
              <Smile size={20} />
            </button>
            <button className="opacity-60 hover:opacity-100 transition-opacity">
              <Paperclip size={20} />
            </button>
            {message.trim() && (
              <button 
                onClick={handleSend}
                className="opacity-100 hover:text-discord-blurple transition-colors"
              >
                <Send size={20} />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}