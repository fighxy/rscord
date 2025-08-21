import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../auth/store";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  LiveKitRoom, 
  useLocalParticipant, 
  useParticipants
} from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Mic, 
  MicOff, 
  HeadphonesIcon, 
  Video, 
  VideoOff, 
  Monitor, 
  MonitorOff,
  PhoneOff,
  Settings,
  Volume2,
  VolumeX,
  Users,
  Waves
} from "lucide-react";

// LiveKit configuration
const LIVEKIT_URL = 'ws://localhost:7880';

interface VoiceChannelPaneProps {
  channelId: string;
  channelName: string;
  autoJoin?: boolean;
}

// Glassmorphism Button Component
const GlassButton = ({ 
  children, 
  variant = "default", 
  size = "default", 
  active = false,
  disabled = false,
  onClick,
  className = "",
  ...props 
}: any) => {
  const baseClasses = `
    relative overflow-hidden transition-all duration-300 ease-out
    backdrop-blur-md border border-white/15
    rounded-2xl font-medium
    active:scale-95 hover:scale-105
    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
    group
  `;
  
  const variants = {
    default: active 
      ? "bg-white/20 text-white shadow-lg shadow-blue-500/20 border-blue-400/30" 
      : "bg-white/8 hover:bg-white/12 text-white/80 hover:text-white",
    danger: active 
      ? "bg-red-500/30 text-white shadow-lg shadow-red-500/20 border-red-400/30" 
      : "bg-red-500/10 hover:bg-red-500/20 text-red-200 hover:text-white",
    success: active 
      ? "bg-green-500/30 text-white shadow-lg shadow-green-500/20 border-green-400/30" 
      : "bg-green-500/10 hover:bg-green-500/20 text-green-200 hover:text-white",
    ghost: "bg-transparent hover:bg-white/5 text-white/60 hover:text-white border-transparent",
    primary: "bg-blue-500/20 hover:bg-blue-500/30 text-blue-100 hover:text-white border-blue-400/30 hover:border-blue-400/50"
  };
  
  const sizes = {
    sm: "px-3 py-2 text-sm",
    default: "px-4 py-3 text-base",
    lg: "px-6 py-4 text-lg",
    icon: "p-3"
  };
  
  return (
    <button
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {/* Glass shine effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      
      {/* Content */}
      <div className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </div>
      
      {/* Active indicator */}
      {active && (
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-2 h-1 bg-current rounded-full opacity-80" />
      )}
    </button>
  );
};

// Glass card component
const GlassCard = ({ children, className = "", blur = "md", intensity = "medium", ...props }: any) => {
  const blurClasses = {
    sm: "backdrop-blur-sm",
    md: "backdrop-blur-md", 
    lg: "backdrop-blur-lg",
    xl: "backdrop-blur-xl"
  };

  const intensityClasses = {
    light: "bg-white/5 border-white/10",
    medium: "bg-white/8 border-white/15",
    strong: "bg-white/12 border-white/20"
  };
  
  return (
    <div 
      className={`
        relative overflow-hidden border rounded-3xl
        shadow-2xl shadow-black/10 transition-all duration-300 ease-out
        hover:bg-white/12 hover:border-white/25 hover:shadow-glass-lg
        ${blurClasses[blur]} ${intensityClasses[intensity]} ${className}
      `}
      {...props}
    >
      {/* Glass shine effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

// Participant card with glassmorphism
const ParticipantCard = ({ participant, isMuted, isDeafened }: any) => {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <GlassCard 
      className={`
        p-4 transition-all duration-200 group
        ${isHovered ? 'bg-white/15 scale-105' : 'bg-white/8'}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <Avatar className="w-12 h-12 ring-2 ring-white/20">
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold text-lg">
              {participant.identity?.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          {/* Speaking indicator */}
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white/20 flex items-center justify-center">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white truncate text-lg">
            {participant.identity}
          </div>
          <div className="text-white/60 text-sm">
            {participant.isLocal ? "Вы" : "Участник"}
          </div>
        </div>
        
        <div className="flex gap-1">
          {participant.isLocal && isMuted && (
            <div className="w-6 h-6 bg-red-500/20 rounded-full flex items-center justify-center">
              <MicOff className="w-3 h-3 text-red-400" />
            </div>
          )}
          {participant.isLocal && isDeafened && (
            <div className="w-6 h-6 bg-red-500/20 rounded-full flex items-center justify-center">
              <VolumeX className="w-3 h-3 text-red-400" />
            </div>
          )}
        </div>
      </div>
    </GlassCard>
  );
};

export function VoiceChannelPane({ channelId, channelName, autoJoin }: VoiceChannelPaneProps) {
  const { user } = useAuth();
  const [joined, setJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState<string | undefined>();
  const [livekitToken, setLivekitToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch LiveKit token from API
  const fetchLivekitToken = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  };

  const localParticipant = useLocalParticipant()?.localParticipant;
  const participants = useParticipants() || [];

  useEffect(() => {
    if (autoJoin && !joined && user?.id) {
      fetchLivekitToken().then(() => setJoined(true));
    }
  }, [autoJoin, joined, user?.id]);

  useEffect(() => {
    if (user?.id && !livekitToken) {
      fetchLivekitToken();
    }
  }, [user?.id, channelId]);

  const toggleMute = async () => {
    if (!localParticipant) return;
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    try {
      await localParticipant.setMicrophoneEnabled(!newMuted);
    } catch (error) {
      console.error('Failed to toggle microphone:', error);
      setIsMuted(!newMuted);
    }
  };

  const toggleDeafen = () => {
    const newDeafened = !isDeafened;
    setIsDeafened(newDeafened);
  };

  const toggleVideo = async () => {
    if (!localParticipant) return;
    const enabled = !isVideoEnabled;
    setIsVideoEnabled(enabled);
    try {
      await localParticipant.setCameraEnabled(enabled);
    } catch (error) {
      console.error('Failed to toggle camera:', error);
      setIsVideoEnabled(!enabled);
    }
  };

  const toggleScreenShare = async () => {
    if (!localParticipant) return;
    const enabled = !isSharingScreen;
    setIsSharingScreen(enabled);
    try {
      await localParticipant.setScreenShareEnabled(enabled);
    } catch (error) {
      console.error('Failed to toggle screen share:', error);
      setIsSharingScreen(!enabled);
    }
  };

  const leave = () => {
    setJoined(false);
  };

  if (!user) {
    return (
      <div className="h-full bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-8">
        <GlassCard className="p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-red-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Требуется аутентификация</h3>
          <p className="text-white/60">Войдите в систему для доступа к голосовым каналам</p>
        </GlassCard>
      </div>
    );
  }

  if (!joined) {
    return (
      <div className="h-full bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
        <div className="h-full flex flex-col justify-between">
          {/* Header */}
          <GlassCard className="p-6 mb-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
                <Waves className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">
                  {channelName}
                </h2>
                <p className="text-white/60 font-medium">
                  Голосовой канал
                </p>
              </div>
            </div>
          </GlassCard>

          {/* Join Controls */}
          <div className="flex-1 flex items-center justify-center">
            <GlassCard className="p-8 text-center max-w-md">
              <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Mic className="w-10 h-10 text-white" />
              </div>
              
              <h3 className="text-2xl font-bold text-white mb-3">
                Готовы начать общение?
              </h3>
              
              <p className="text-white/60 mb-8 leading-relaxed">
                Присоединитесь к голосовому каналу, чтобы общаться с другими участниками в реальном времени.
              </p>
              
              <GlassButton 
                size="lg"
                variant="success"
                onClick={async () => {
                  await fetchLivekitToken();
                  setJoined(true);
                }}
                disabled={!user?.id || isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Подключение...
                  </>
                ) : (
                  <>
                    <Mic className="w-5 h-5" />
                    Присоединиться к каналу
                  </>
                )}
              </GlassButton>
            </GlassCard>
          </div>
        </div>
      </div>
    );
  }

  if (!livekitToken && joined) {
    return (
      <div className="h-full bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-8">
        <GlassCard className="p-8 text-center">
          <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Подключение</h3>
          <p className="text-white/60">Устанавливаем соединение с голосовым каналом...</p>
        </GlassCard>
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
      video={true}
    >
      <div className="h-full bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
        <div className="h-full flex flex-col gap-6">
          {/* Header */}
          <GlassCard className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-blue-500 rounded-xl flex items-center justify-center">
                  <Waves className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {channelName}
                  </h2>
                  <p className="text-white/60 text-sm">
                    🟢 Подключен • {participants.length} участник{participants.length !== 1 ? 'ов' : ''}
                  </p>
                </div>
              </div>
              
              <GlassButton 
                variant="ghost"
                size="icon"
                onClick={() => {/* Settings handler */}}
              >
                <Settings className="w-5 h-5" />
              </GlassButton>
            </div>
          </GlassCard>

          {/* Control Panel */}
          <GlassCard className="p-6">
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              <GlassButton 
                variant={isMuted ? "danger" : "default"}
                active={!isMuted}
                onClick={toggleMute}
                size="icon"
                className="aspect-square"
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </GlassButton>
              
              <GlassButton 
                variant={isDeafened ? "danger" : "default"}
                active={!isDeafened}
                onClick={toggleDeafen}
                size="icon"
                className="aspect-square"
              >
                {isDeafened ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </GlassButton>
              
              <GlassButton 
                variant="default"
                active={isVideoEnabled}
                onClick={toggleVideo}
                size="icon"
                className="aspect-square"
              >
                {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </GlassButton>
              
              <GlassButton 
                variant="default"
                active={isSharingScreen}
                onClick={toggleScreenShare}
                size="icon"
                className="aspect-square"
              >
                {isSharingScreen ? <Monitor className="w-5 h-5" /> : <MonitorOff className="w-5 h-5" />}
              </GlassButton>
              
              <div className="md:col-span-2">
                <GlassButton 
                  variant="danger"
                  onClick={leave}
                  className="w-full"
                >
                  <PhoneOff className="w-4 h-4" />
                  Покинуть
                </GlassButton>
              </div>
            </div>
          </GlassCard>

          {/* Participants */}
          <div className="flex-1 min-h-0">
            <GlassCard className="h-full p-6">
              <div className="flex items-center gap-3 mb-6">
                <Users className="w-5 h-5 text-white/60" />
                <h3 className="text-lg font-bold text-white">
                  Участники ({participants.length})
                </h3>
              </div>
              
              <div className="space-y-3 h-full overflow-y-auto custom-scrollbar">
                {participants.map((participant) => (
                  <ParticipantCard
                    key={participant.sid}
                    participant={participant}
                    isMuted={participant.isLocal ? isMuted : false}
                    isDeafened={participant.isLocal ? isDeafened : false}
                  />
                ))}
              </div>
            </GlassCard>
          </div>

          {/* Video Grid */}
          {(isVideoEnabled || isSharingScreen) && (
            <GlassCard className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {participants.map((participant) => (
                  <div key={participant.sid} className="relative">
                    <GlassCard className="aspect-video bg-slate-800/50 overflow-hidden">
                      <div className="h-full flex items-center justify-center">
                        <Avatar className="w-16 h-16">
                          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-2xl font-bold">
                            {participant.identity?.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      
                      <div className="absolute bottom-3 left-3 right-3">
                        <GlassCard className="px-3 py-2">
                          <div className="flex items-center justify-between">
                            <span className="text-white font-medium text-sm truncate">
                              {participant.identity}
                            </span>
                            <div className="flex gap-1 ml-2">
                              {isVideoEnabled && <Video className="w-3 h-3 text-green-400" />}
                              {isSharingScreen && <Monitor className="w-3 h-3 text-blue-400" />}
                            </div>
                          </div>
                        </GlassCard>
                      </div>
                    </GlassCard>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>
      </div>

      {/* Hidden audio renderer */}
      <div style={{ display: 'none' }} data-audio-renderer />
    </LiveKitRoom>
  );
}