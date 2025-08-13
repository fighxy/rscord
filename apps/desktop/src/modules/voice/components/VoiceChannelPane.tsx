import { useEffect, useMemo, useRef, useState } from "react";
import { SignalingClient, ServerMessage } from "../../../webrtc/signaling";
import { VoiceMesh } from "../../../webrtc/voice";
import { useAuth } from "../../auth/store";

interface VoiceChannelPaneProps {
  channelId: string;
  channelName: string;
}

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

export function VoiceChannelPane({ channelId, channelName }: VoiceChannelPaneProps) {
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
  }, [channelId, user?.id, signaling, voice]);

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
      <div style={{ 
        display: "grid", 
        placeItems: "center", 
        height: "100%", 
        color: "var(--text-500)",
        fontSize: "16px"
      }}>
        Пользователь не аутентифицирован
      </div>
    );
  }

  return (
    <div style={{ 
      display: "flex", 
      flexDirection: "column", 
      height: "100%",
      padding: "16px"
    }}>
      {/* Заголовок голосового канала */}
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        gap: "12px", 
        marginBottom: "16px",
        padding: "12px",
        backgroundColor: "var(--bg-700)",
        borderRadius: "8px"
      }}>
        <div style={{ 
          width: "32px", 
          height: "32px", 
          borderRadius: "50%", 
          backgroundColor: "var(--brand)",
          display: "grid",
          placeItems: "center",
          color: "white",
          fontSize: "16px"
        }}>
          🎤
        </div>
        <div>
          <div style={{ fontWeight: "600", color: "var(--text-100)" }}>
            {channelName}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-500)" }}>
            Голосовой канал
          </div>
        </div>
      </div>

      {/* Кнопки управления */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        {!joined ? (
          <button 
            onClick={join}
            style={{
              padding: "8px 16px",
              backgroundColor: "var(--brand)",
              border: "none",
              color: "white",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "600"
            }}
          >
            Присоединиться к голосовому каналу
          </button>
        ) : (
          <>
            <button 
              onClick={leave}
              style={{
                padding: "8px 16px",
                backgroundColor: "var(--danger)",
                border: "none",
                color: "white",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "600"
              }}
            >
              Покинуть канал
            </button>
            
            <button 
              onClick={toggleMute}
              style={{
                padding: "8px 16px",
                backgroundColor: isMuted ? "var(--danger)" : "var(--bg-600)",
                border: "1px solid var(--border)",
                color: "white",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "600"
              }}
            >
              {isMuted ? "🔇 Размутить" : "🔊 Замутить"}
            </button>
            
            <button 
              onClick={toggleDeafen}
              style={{
                padding: "8px 16px",
                backgroundColor: isDeafened ? "var(--danger)" : "var(--bg-600)",
                border: "1px solid var(--border)",
                color: "white",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "600"
              }}
            >
              {isDeafened ? "🔇 Включить звук" : "🔇 Отключить звук"}
            </button>
          </>
        )}
      </div>

      {/* Статус подключения */}
      {joined && (
        <div style={{ 
          padding: "12px", 
          backgroundColor: "var(--success)", 
          color: "white",
          borderRadius: "6px",
          marginBottom: "16px",
          fontSize: "14px"
        }}>
          ✅ Подключен к голосовому каналу
        </div>
      )}

      {/* Список участников */}
      <div style={{ flex: 1 }}>
        <div style={{ 
          fontWeight: "600", 
          marginBottom: "8px", 
          color: "var(--text-100)",
          fontSize: "14px"
        }}>
          Участники ({peers.length + (joined ? 1 : 0)})
        </div>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {joined && (
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "8px",
              padding: "8px",
              backgroundColor: "var(--bg-700)",
              borderRadius: "6px"
            }}>
              <div style={{ 
                width: "24px", 
                height: "24px", 
                borderRadius: "50%", 
                backgroundColor: "var(--brand)",
                display: "grid",
                placeItems: "center",
                color: "white",
                fontSize: "12px"
              }}>
                {user.displayName?.slice(0, 2).toUpperCase() || "U"}
              </div>
              <span style={{ color: "var(--text-100)", fontSize: "14px" }}>
                {user.displayName || user.email}
              </span>
              {isMuted && <span style={{ color: "var(--danger)" }}>🔇</span>}
              {isDeafened && <span style={{ color: "var(--danger)" }}>🔇</span>}
              <span style={{ color: "var(--success)" }}>●</span>
            </div>
          )}
          
          {peers.map((peerId) => (
            <div key={peerId} style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "8px",
              padding: "8px",
              backgroundColor: "var(--bg-700)",
              borderRadius: "6px"
            }}>
              <div style={{ 
                width: "24px", 
                height: "24px", 
                borderRadius: "50%", 
                backgroundColor: "var(--bg-600)",
                display: "grid",
                placeItems: "center",
                color: "var(--text-300)",
                fontSize: "12px"
              }}>
                {peerId.slice(0, 2).toUpperCase()}
              </div>
              <span style={{ color: "var(--text-300)", fontSize: "14px" }}>
                {peerId.slice(0, 8)}
              </span>
              <span style={{ color: "var(--success)" }}>●</span>
            </div>
          ))}
        </div>
      </div>

      {/* Контейнер для аудио элементов */}
      <div ref={audioContainer} style={{ display: "none" }} />
    </div>
  );
}
