import React, { useState, useEffect } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  ParticipantName,
  DisconnectButton,
  useParticipants,
  useTracks,
  useLocalParticipant,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Mic, 
  MicOff, 
  VolumeX, 
  Phone, 
  PhoneOff,
  Users,
  Settings,
  Headphones
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface VoiceRoomProps {
  roomId: string;
  roomName: string;
  serverUrl: string;
  token: string;
  onLeave: () => void;
  onError?: (error: Error) => void;
}

// VoiceParticipant interface moved to types.ts

export const VoiceRoom: React.FC<VoiceRoomProps> = ({
  roomId, // Used for room identification
  roomName,
  serverUrl,
  token,
  onLeave,
  onError,
}) => {
  const [isConnected, setIsConnected] = useState(false); // Track connection state
  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const handleConnected = () => {
    setIsConnected(true);
    setIsConnecting(false);
    setConnectionError(null);
    toast.success(`Connected to ${roomName}`);
  };

  const handleDisconnected = () => {
    setIsConnected(false);
    setIsConnecting(false);
    toast.success('Disconnected from voice room');
    onLeave();
  };

  const handleError = (error: Error) => {
    console.error('Voice room error:', error);
    setConnectionError(error.message);
    setIsConnecting(false);
    toast.error(`Connection failed: ${error.message}`);
    onError?.(error);
  };

  if (isConnecting) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            Connecting to {roomName}...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Establishing voice connection...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (connectionError) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-destructive">Connection Failed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{connectionError}</p>
          <div className="flex gap-2">
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
            <Button variant="outline" onClick={onLeave}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <LiveKitRoom
      video={false} // Voice only for now
      audio={true}
      token={token}
      serverUrl={serverUrl}
      onConnected={handleConnected}
      onDisconnected={handleDisconnected}
      onError={handleError}
      options={{
        // Connection settings
        adaptiveStream: true,
        dynacast: true,
      }}
      className="h-full"
    >
      <div className="flex flex-col h-full bg-background">
        {/* Room Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <h2 className="text-lg font-semibold">{roomName}</h2>
            </div>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              <ParticipantCount />
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <VoiceSettings />
            <DisconnectButton 
              className="flex items-center gap-2 px-3 py-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-md"
            >
              <PhoneOff className="w-4 h-4" />
              Leave
            </DisconnectButton>
          </div>
        </div>

        {/* Participants Area */}
        <div className="flex-1 p-4">
          <VoiceParticipants />
        </div>

        {/* Control Bar */}
        <div className="p-4 border-t bg-card">
          <VoiceControls />
        </div>

        {/* Audio Renderer */}
        <RoomAudioRenderer />
      </div>
    </LiveKitRoom>
  );
};

const ParticipantCount: React.FC = () => {
  const participants = useParticipants();
  return <span>{participants.length}</span>;
};

const VoiceParticipants: React.FC = () => {
  const participants = useParticipants();
  const audioTracks = useTracks([Track.Source.Microphone]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {participants.map((participant) => {
        const audioTrack = audioTracks.find(
          (track) => track.participant.identity === participant.identity
        );
        
        const isSpeaking = audioTrack?.publication?.isMuted === false && 
                          audioTrack?.publication?.track?.mediaStreamTrack?.enabled;
        const isMuted = audioTrack?.publication?.isMuted ?? true;

        return (
          <VoiceParticipantCard
            key={participant.identity}
            participant={participant}
            isSpeaking={isSpeaking || false}
            isMuted={isMuted}
          />
        );
      })}
    </div>
  );
};

interface VoiceParticipantCardProps {
  participant: any;
  isSpeaking: boolean;
  isMuted: boolean;
}

const VoiceParticipantCard: React.FC<VoiceParticipantCardProps> = ({
  participant,
  isSpeaking,
  isMuted,
}) => {
  return (
    <Card className={cn(
      "transition-all duration-200",
      isSpeaking && "ring-2 ring-green-500 shadow-lg"
    )}>
      <CardContent className="p-4 flex flex-col items-center space-y-3">
        {/* Avatar */}
        <div className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center text-lg font-medium transition-all",
          isSpeaking 
            ? "bg-green-500 text-white shadow-lg scale-110" 
            : "bg-muted text-muted-foreground"
        )}>
          {participant.name?.charAt(0)?.toUpperCase() || 
           participant.identity?.charAt(0)?.toUpperCase() || '?'}
        </div>

        {/* Name */}
        <div className="text-center">
          <ParticipantName participant={participant} className="text-sm font-medium" />
          {participant.isLocal && (
            <Badge variant="outline" className="text-xs mt-1">You</Badge>
          )}
        </div>

        {/* Status Icons */}
        <div className="flex items-center gap-2">
          {isMuted ? (
            <MicOff className="w-4 h-4 text-destructive" />
          ) : (
            <Mic className={cn(
              "w-4 h-4",
              isSpeaking ? "text-green-500" : "text-muted-foreground"
            )} />
          )}
          
          {/* Connection Quality Indicator */}
          <div className="flex gap-1">
            <div className="w-1 h-3 bg-green-500 rounded-full"></div>
            <div className="w-1 h-3 bg-green-500 rounded-full"></div>
            <div className="w-1 h-3 bg-muted rounded-full"></div>
          </div>
        </div>

        {/* Audio Track - handled by LiveKit automatically */}
      </CardContent>
    </Card>
  );
};

const VoiceControls: React.FC = () => {
  const { localParticipant } = useLocalParticipant();
  const [isMuted, setIsMuted] = useState(true);
  const [isDeafened, setIsDeafened] = useState(false);

  useEffect(() => {
    if (localParticipant) {
      const audioTrack = localParticipant.getTrackPublication(Track.Source.Microphone);
      setIsMuted(audioTrack?.isMuted ?? true);
    }
  }, [localParticipant]);

  const toggleMute = async () => {
    if (localParticipant) {
      const newMutedState = !isMuted;
      await localParticipant.setMicrophoneEnabled(!newMutedState);
      setIsMuted(newMutedState);
      
      toast.success(newMutedState ? 'Microphone muted' : 'Microphone unmuted');
    }
  };

  const toggleDeafen = () => {
    setIsDeafened(!isDeafened);
    // Note: Deafening would require additional logic to mute all remote tracks
    toast.success(isDeafened ? 'Audio enabled' : 'Audio deafened');
  };

  return (
    <div className="flex items-center justify-center gap-4">
      {/* Mute/Unmute */}
      <Button
        variant={isMuted ? "destructive" : "default"}
        size="lg"
        onClick={toggleMute}
        className="flex items-center gap-2"
      >
        {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        {isMuted ? 'Unmute' : 'Mute'}
      </Button>

      {/* Deafen */}
      <Button
        variant={isDeafened ? "destructive" : "outline"}
        size="lg"
        onClick={toggleDeafen}
        className="flex items-center gap-2"
      >
        {isDeafened ? <VolumeX className="w-5 h-5" /> : <Headphones className="w-5 h-5" />}
        {isDeafened ? 'Undeafen' : 'Deafen'}
      </Button>

      {/* Push to Talk (Future feature) */}
      <Button
        variant="outline"
        size="lg"
        disabled
        className="flex items-center gap-2 opacity-50"
      >
        <Phone className="w-5 h-5" />
        PTT (Soon)
      </Button>
    </div>
  );
};

const VoiceSettings: React.FC = () => {
  return (
    <Button variant="ghost" size="sm">
      <Settings className="w-4 h-4" />
    </Button>
  );
};

export default VoiceRoom;
