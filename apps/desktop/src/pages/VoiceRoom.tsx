import { useEffect, useMemo, useRef, useState } from "react";
// import { SignalingClient, ServerMessage } from "../webrtc/signaling";
// import { VoiceMesh } from "../webrtc/voice";

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function VoiceRoom() {
  const [room, setRoom] = useState("lobby");
  const [selfId] = useState(() => randomId());
  const [joined, setJoined] = useState(false);
  const [peers, setPeers] = useState<string[]>([]);
  const audioContainer = useRef<HTMLDivElement>(null);

  // const signaling = useMemo(() => new SignalingClient(), []);
  // const voice = useMemo(() => new VoiceMesh(), []);

  // useEffect(() => {
  //   signaling.connect();
  //   signaling.onMessage(async (msg: ServerMessage) => {
  //     if (msg.type === "joined") setJoined(true);
  //     if (msg.type === "peer_joined") {
  //       const remote = msg.peer_id;
  //       setPeers((p) => Array.from(new Set([...p, remote])));
  //       // Make offer to new peer
  //       const offer = await voice.makeOffer(
  //         remote,
  //         (cand) => signaling.send({ type: "signal", room, from: selfId, to: remote, data: { candidate: cand } }),
  //       (audio) => audioContainer.current?.appendChild(audio),
  //       );
  //       signaling.send({ type: "signal", room, from: selfId, to: remote, data: { offer } });
  //     }
  //     if (msg.type === "peer_left") {
  //       setPeers((p) => p.filter((id) => id !== msg.peer_id));
  //     }
  //     if (msg.type === "signal") {
  //       const { from, to, data } = msg;
  //       if (to !== selfId) return;
  //       if (data.offer) {
  //         const answer = await voice.handleOffer(
  //           from,
  //           data.offer,
  //           (cand) => signaling.send({ type: "signal", room, from: selfId, to: from, data: { candidate: cand } }),
  //           (audio) => audioContainer.current?.appendChild(audio),
  //         );
  //         signaling.send({ type: "signal", room, from: selfId, to: from, data: { answer } });
  //       } else if (data.answer) {
  //         await voice.handleAnswer(from, data.answer);
  //       } else if (data.candidate) {
  //         await voice.handleIce(from, data.candidate);
  //       }
  //     }
  //   });
  //   return () => {
  //     voice.leave();
  //     };
  // }, [room, selfId, signaling, voice]);

  const join = () => {
    // signaling.send({ type: "join", room, peer_id: selfId });
    console.log("Join functionality disabled - WebRTC modules not available");
  };

  const leave = () => {
    // signaling.send({ type: "leave", room, peer_id: selfId });
    setJoined(false);
    setPeers([]);
    // voice.leave();
    console.log("Leave functionality disabled - WebRTC modules not available");
  };

  return (
    <div style={{ padding: 24 }}>
      <h2>Voice Room</h2>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Room id" />
        {!joined ? (
          <button onClick={join}>Join</button>
        ) : (
          <button onClick={leave}>Leave</button>
        )}
      </div>
      <div style={{ marginTop: 16 }}>
        <strong>Peers:</strong> {peers.join(", ") || "none"}
      </div>
      <div ref={audioContainer} />
    </div>
  );
}


