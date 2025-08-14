import { useEffect, useMemo, useRef, useState } from "react";
import { SignalingClient, ServerMessage } from "../../../webrtc/signaling";
import { VoiceMesh } from "../../../webrtc/voice";
import { useAuth } from "../../auth/store";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface VoiceChannelPaneProps {
  channelId: string;
  channelName: string;
  autoJoin?: boolean;
}

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

export function VoiceChannelPane({ channelId, channelName, autoJoin }: VoiceChannelPaneProps) {
  const { user } = useAuth();
  const [joined, setJoined] = useState(false);
  const [peers, setPeers] = useState<string[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const audioContainer = useRef<HTMLDivElement>(null);

  const signaling = useMemo(() => new SignalingClient(), []);
  const voice = useMemo(() => new VoiceMesh(), []);

  useEffect(() => {
    if (!user?.id) return;

    const selfId = user.id;
    const room = channelId;

    signaling.connect();
    signaling.onMessage(async (msg: ServerMessage) => {
      if (msg.type === "joined") setJoined(true);
      if (msg.type === "peer_joined") {
        const remote = msg.peer_id;
        setPeers((p) => Array.from(new Set([...p, remote])));
        
        // Make offer to new peer
        const offer = await voice.makeOffer(
          remote,
          (cand) => signaling.send({ type: "signal", room, from: selfId, to: remote, data: { candidate: cand } }),
          (audio) => audioContainer.current?.appendChild(audio),
        );
        signaling.send({ type: "signal", room, from: selfId, to: remote, data: { offer } });
      }
      if (msg.type === "peer_left") {
        setPeers((p) => p.filter((id) => id !== msg.peer_id));
      }
      if (msg.type === "signal") {
        const { from, to, data } = msg;
        if (to !== selfId) return;
        if (data.offer) {
          const answer = await voice.handleOffer(
            from,
            data.offer,
            (cand) => signaling.send({ type: "signal", room, from: selfId, to: from, data: { candidate: cand } }),
            (audio) => audioContainer.current?.appendChild(audio),
          );
          signaling.send({ type: "signal", room, from: selfId, to: from, data: { answer } });
        } else if (data.answer) {
          await voice.handleAnswer(from, data.answer);
        } else if (data.candidate) {
          await voice.handleIce(from, data.candidate);
        }
      }
    });

    return () => {
      voice.leave();
    };
  }, [user?.id, channelId, signaling, voice]);

  // Автоматическое подключение при двойном клике
  useEffect(() => {
    console.log('VoiceChannelPane autoJoin effect:', { autoJoin, joined, userId: user?.id });
    if (autoJoin && !joined && user?.id) {
      console.log('Auto-joining voice channel:', channelId);
      join();
    }
  }, [autoJoin, joined, user?.id]);

  const join = () => {
    if (!user?.id) return;
    signaling.send({ type: "join", room: channelId, peer_id: user.id });
  };

  const leave = () => {
    if (!user?.id) return;
    signaling.send({ type: "leave", room: channelId, peer_id: user.id });
    setJoined(false);
    setPeers([]);
    voice.leave();
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    voice.setMuted(!isMuted);
  };

  const toggleDeafen = () => {
    setIsDeafened(!isDeafened);
    voice.setDeafened(!isDeafened);
  };

  if (!user) {
    return (
      <div className="grid place-items-center h-full text-gray-400 text-base">
        Пользователь не аутентифицирован
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4">
      {/* Заголовок голосового канала */}
      <div className="flex items-center gap-3 mb-4 p-3 bg-gray-700 rounded-lg">
        <Avatar className="w-8 h-8">
          <AvatarFallback className="bg-discord-blurple text-white text-base">
            🎤
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="font-semibold text-gray-200">
            {channelName}
          </div>
          <div className="text-xs text-gray-400">
            Голосовой канал
          </div>
        </div>
      </div>

      {/* Кнопки управления */}
      <div className="flex gap-2 mb-4">
        {!joined ? (
          <Button 
            onClick={join}
            className="bg-discord-blurple hover:bg-blue-600 font-semibold"
          >
            Присоединиться к голосовому каналу
          </Button>
        ) : (
          <>
            <Button 
              onClick={leave}
              variant="destructive"
              className="font-semibold"
            >
              Покинуть канал
            </Button>
            
            <Button 
              onClick={toggleMute}
              variant={isMuted ? "destructive" : "outline"}
              className="font-semibold"
            >
              {isMuted ? "🔇 Размутить" : "🔊 Замутить"}
            </Button>
            
            <Button 
              onClick={toggleDeafen}
              variant={isDeafened ? "destructive" : "outline"}
              className="font-semibold"
            >
              {isDeafened ? "🔇 Включить звук" : "🔇 Отключить звук"}
            </Button>
          </>
        )}
      </div>

      {/* Статус подключения */}
      {joined && (
        <div className="p-3 bg-green-600 text-white rounded-lg mb-4 text-sm">
          ✅ Подключен к голосовому каналу
        </div>
      )}

      {/* Список участников */}
      <div className="flex-1">
        <div className="font-semibold mb-2 text-gray-200 text-sm">
          Участники ({peers.length + (joined ? 1 : 0)})
        </div>
        
        <div className="flex flex-col gap-2">
          {joined && (
            <div className="flex items-center gap-2 p-2 bg-gray-700 rounded-lg">
              <Avatar className="w-6 h-6">
                <AvatarFallback className="bg-discord-blurple text-white text-xs">
                  {user.displayName?.slice(0, 2).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <span className="text-gray-200 text-sm">
                {user.displayName || user.email}
              </span>
              {isMuted && <span className="text-red-400">🔇</span>}
              {isDeafened && <span className="text-red-400">🔇</span>}
              <span className="text-green-400">●</span>
            </div>
          )}
          
          {peers.map((peerId) => (
            <div key={peerId} className="flex items-center gap-2 p-2 bg-gray-700 rounded-lg">
              <Avatar className="w-6 h-6">
                <AvatarFallback className="bg-gray-600 text-gray-300 text-xs">
                  {peerId.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-gray-300 text-sm">
                {peerId.slice(0, 8)}
              </span>
              <span className="text-green-400">●</span>
            </div>
          ))}
        </div>
      </div>

      {/* Контейнер для аудио элементов */}
      <div ref={audioContainer} className="hidden" />
    </div>
  );
}
