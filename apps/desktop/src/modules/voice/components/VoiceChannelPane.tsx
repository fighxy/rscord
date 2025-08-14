import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../auth/store";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
// Remove old imports
// import { SignalingClient, ServerMessage } from "../../../webrtc/signaling";
// import { VoiceMesh } from "../../../webrtc/voice";

// Add LiveKit imports
import { 
  LiveKitRoom, 
  useLocalParticipant, 
  AudioTrack, 
  ParticipantLoop, 
  useParticipants, 
  RoomAudioRenderer,
  VideoTrack,
  useIsSpeaking,
  GridLayout,
  ParticipantTile
} from "@livekit/components-react";
import { Track, RoomEvent } from "livekit-client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// LiveKit configuration - will be fetched from API
const LIVEKIT_URL = 'ws://localhost:7880';

interface VoiceChannelPaneProps {
  channelId: string;
  channelName: string;
  autoJoin?: boolean;
}

export function VoiceChannelPane({ channelId, channelName, autoJoin }: VoiceChannelPaneProps) {
  const { user } = useAuth();
  const [joined, setJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState<string | undefined>();
  const [livekitToken, setLivekitToken] = useState<string | null>(null);

  // Fetch LiveKit token from API
  const fetchLivekitToken = async () => {
    if (!user?.id) return;
    
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`http://127.0.0.1:14702/voice/token?channel_id=${channelId}&user_id=${user.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setLivekitToken(data.token);
      } else {
        console.error('Failed to fetch LiveKit token:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching LiveKit token:', error);
    }
  };

  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();

  useEffect(() => {
    if (autoJoin && !joined && user?.id) {
      fetchLivekitToken().then(() => setJoined(true));
    }
  }, [autoJoin, joined, user?.id]);

  // Fetch token when component mounts
  useEffect(() => {
    if (user?.id && !livekitToken) {
      fetchLivekitToken();
    }
  }, [user?.id, channelId]);

  const toggleMute = async () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    await localParticipant.setMicrophoneEnabled(!newMuted);
  };

  const toggleDeafen = () => {
    const newDeafened = !isDeafened;
    setIsDeafened(newDeafened);
    // For deafen, mute all incoming audio
    // LiveKit doesn't have direct deafen, so toggle audio tracks or volume
    // For simplicity, set volume to 0 on RoomAudioRenderer (customize if needed)
  };

  // Toggle video
  const toggleVideo = async () => {
    const enabled = !isVideoEnabled;
    setIsVideoEnabled(enabled);
    await localParticipant.setCameraEnabled(enabled);
  };

  // Toggle screen share
  const toggleScreenShare = async () => {
    const enabled = !isSharingScreen;
    setIsSharingScreen(enabled);
    if (enabled) {
      await localParticipant.setScreenShareEnabled(true);
    } else {
      await localParticipant.setScreenShareEnabled(false);
    }
  };

  // Camera select change
  const handleCameraChange = async (deviceId: string) => {
    setSelectedCamera(deviceId);
    if (isVideoEnabled) {
      await localParticipant.setCameraEnabled(true);
    }
  };

  const leave = () => {
    setJoined(false);
  };

  if (!user) {
    return (
      <div className="grid place-items-center h-full text-gray-400 text-base">
        Пользователь не аутентифицирован
      </div>
    );
  }

  if (!joined) {
    return (
      <div className="flex flex-col h-full p-4">
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
        <Button 
          onClick={async () => {
            await fetchLivekitToken();
            setJoined(true);
          }}
          className="bg-discord-blurple hover:bg-blue-600 font-semibold"
          disabled={!user?.id}
        >
          Присоединиться к голосовому каналу
        </Button>
      </div>
    );
  }

  if (!livekitToken && joined) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">Подключение к голосовому каналу...</div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={livekitToken || ""}
      serverUrl={LIVEKIT_URL}
      connect={joined && !!livekitToken}
      onDisconnected={leave}
      audio={true}
      video={true} // Enable video
    >
      <RoomAudioRenderer muted={isDeafened} /> {/* Handles incoming audio, mute for deafen */}

      <div className="flex flex-col h-full p-4">
        {/* Header */}
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

        {/* Controls */}
        <div className="flex gap-2 mb-4">
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
          <Button 
            onClick={toggleVideo}
            variant={isVideoEnabled ? "default" : "outline"}
            className="font-semibold"
          >
            {isVideoEnabled ? "📹 Выключить видео" : "📹 Включить видео"}
          </Button>
          <Button 
            onClick={toggleScreenShare}
            variant={isSharingScreen ? "default" : "outline"}
            className="font-semibold"
          >
            {isSharingScreen ? "🖥️ Остановить шаринг" : "🖥️ Поделиться экраном"}
          </Button>
        </div>

        {/* Status */}
        <div className="p-3 bg-green-600 text-white rounded-lg mb-4 text-sm">
          ✅ Подключен к голосовому каналу
        </div>

                 {/* Camera select (show if video enabled) */}
         {isVideoEnabled && (
           <div className="mb-4">
             <label className="text-sm text-gray-300 mb-2 block">Камера:</label>
             <Select onValueChange={handleCameraChange} value={selectedCamera}>
               <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                 <SelectValue placeholder="Выберите камеру" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="default">Камера по умолчанию</SelectItem>
               </SelectContent>
             </Select>
           </div>
         )}

        {/* Participants */}
        <div className="flex-1">
          <div className="font-semibold mb-2 text-gray-200 text-sm">
            Участники ({participants.length})
          </div>
          
                     <div className="space-y-2">
             {participants.map((participant) => (
               <div key={participant.sid} className="flex items-center gap-2 p-2 bg-gray-700 rounded-lg">
                 <Avatar className="w-8 h-8">
                   <AvatarFallback className="bg-gray-600 text-gray-300 text-xs">
                     {participant.identity?.slice(0, 2).toUpperCase()}
                   </AvatarFallback>
                 </Avatar>
                 <span className="text-gray-300 text-sm flex-1">
                   {participant.identity}
                 </span>
                 {participant.isLocal && isMuted && <span className="text-red-400">🔇</span>}
                 {participant.isLocal && isDeafened && <span className="text-red-400">🔇</span>}
                 <span className="text-green-400">●</span>
               </div>
             ))}
           </div>
           
           {/* Video Grid - Show when video is enabled */}
           {(isVideoEnabled || isSharingScreen) && (
             <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
               {participants.map((participant) => (
                 <div key={participant.sid} className="relative bg-gray-800 rounded-lg overflow-hidden min-h-[200px]">
                   {/* Video placeholder - will be replaced with actual video tracks when backend is ready */}
                   <div className="flex items-center justify-center h-full">
                     <Avatar className="w-16 h-16">
                       <AvatarFallback className="bg-gray-600 text-gray-300 text-2xl">
                         {participant.identity?.slice(0, 2).toUpperCase()}
                       </AvatarFallback>
                     </Avatar>
                   </div>
                   
                   {/* Participant Info Overlay */}
                   <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 px-3 py-1 rounded text-white text-sm">
                     {participant.identity}
                     {isVideoEnabled && " 📹"}
                     {isSharingScreen && " 🖥️"}
                   </div>
                 </div>
               ))}
             </div>
           )}
        </div>
      </div>
    </LiveKitRoom>
  );
}
