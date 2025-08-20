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
  Volume2, 
  VolumeX, 
  Phone, 
  PhoneOff,
  Users,
  Settings,
  Headphones,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { VoiceActivationSettings, DEFAULT_VAD_SETTINGS } from './types';
import { getVADPreset } from './utils';

interface EnhancedVoiceRoomProps {
  roomId: string;
  roomName: string;
  serverUrl: string;
  token: string;
  vadSettings: VoiceActivationSettings;
  onLeave: () => void;
  onError?: (error: Error) => void;
}

// VoiceParticipant interface moved to types.ts

export const EnhancedVoiceRoom: React.FC<EnhancedVoiceRoomProps> = ({
  roomId, // Used for room identification
  roomName,
  serverUrl,
  token,
  vadSettings,
  onLeave,
  onError,
}) => {
  const [isConnected, setIsConnected] = useState(false); // Track connection state
  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [currentVadSettings, setCurrentVadSettings] = useState<VoiceActivationSettings>(
    vadSettings || DEFAULT_VAD_SETTINGS
  );

  const handleConnected = () => {
    setIsConnected(true);
    setIsConnecting(false);
    setConnectionError(null);
    toast.success(`Connected to ${roomName} with enhanced features`);
  };

  const handleDisconnected = () => {
    setIsConnected(false);
    setIsConnecting(false);
    toast.success('Disconnected from enhanced voice room');
    onLeave();
  };

  const handleError = (error: Error) => {
    console.error('Enhanced voice room error:', error);
    setConnectionError(error.message);
    setIsConnecting(false);
    toast.error(`Enhanced connection failed: ${error.message}`);
    onError?.(error);
  };

  const handleVadSettingsChange = (newSettings: VoiceActivationSettings) => {
    setCurrentVadSettings(newSettings);
    toast.success('Voice detection settings updated');
  };

  if (isConnecting) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            Connecting to Enhanced {roomName}...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Establishing enhanced voice connection with VAD support...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (connectionError) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-destructive">Enhanced Connection Failed</CardTitle>
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
      video={false}
      audio={true}
      token={token}
      serverUrl={serverUrl}
      onConnected={handleConnected}
      onDisconnected={handleDisconnected}
      onError={handleError}
      options={{
        adaptiveStream: true,
        dynacast: true,
      }}
      className="h-full"
    >
      <div className="flex flex-col h-full bg-background">
        {/* Enhanced Room Header */}
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
            {currentVadSettings.enabled && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Activity className="w-3 h-3" />
                VAD
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <VoiceSettings 
              vadSettings={currentVadSettings}
              onVadSettingsChange={handleVadSettingsChange}
            />
            <DisconnectButton 
              className="flex items-center gap-2 px-3 py-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-md"
            >
              <PhoneOff className="w-4 h-4" />
              Leave
            </DisconnectButton>
          </div>
        </div>

        {/* Enhanced Participants Area */}
        <div className="flex-1 p-4">
          <EnhancedVoiceParticipants vadSettings={currentVadSettings} />
        </div>

        {/* Enhanced Control Bar */}
        <div className="p-4 border-t bg-card">
          <EnhancedVoiceControls vadSettings={currentVadSettings} />
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

const EnhancedVoiceParticipants: React.FC<{
  vadSettings: VoiceActivationSettings;
}> = ({ vadSettings }) => {
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
          <EnhancedVoiceParticipantCard
            key={participant.identity}
            participant={participant}
            isSpeaking={isSpeaking || false}
            isMuted={isMuted}
            vadEnabled={vadSettings.enabled}
          />
        );
      })}
    </div>
  );
};

interface EnhancedVoiceParticipantCardProps {
  participant: any;
  isSpeaking: boolean;
  isMuted: boolean;
  vadEnabled: boolean;
}

const EnhancedVoiceParticipantCard: React.FC<EnhancedVoiceParticipantCardProps> = ({
  participant,
  isSpeaking,
  isMuted,
  vadEnabled,
}) => {
  return (
    <Card className={cn(
      "transition-all duration-200",
      isSpeaking && "ring-2 ring-green-500 shadow-lg",
      vadEnabled && isSpeaking && "ring-blue-500"
    )}>
      <CardContent className="p-4 flex flex-col items-center space-y-3">
        {/* Enhanced Avatar */}
        <div className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center text-lg font-medium transition-all relative",
          isSpeaking 
            ? "bg-green-500 text-white shadow-lg scale-110" 
            : "bg-muted text-muted-foreground"
        )}>
          {participant.name?.charAt(0)?.toUpperCase() || 
           participant.identity?.charAt(0)?.toUpperCase() || '?'}
          
          {/* VAD Indicator */}
          {vadEnabled && isSpeaking && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
              <Activity className="w-2 h-2 text-white" />
            </div>
          )}
        </div>

        {/* Name */}
        <div className="text-center">
          <ParticipantName participant={participant} className="text-sm font-medium" />
          {participant.isLocal && (
            <Badge variant="outline" className="text-xs mt-1">You</Badge>
          )}
        </div>

        {/* Enhanced Status Icons */}
        <div className="flex items-center gap-2">
          {isMuted ? (
            <MicOff className="w-4 h-4 text-destructive" />
          ) : (
            <Mic className={cn(
              "w-4 h-4",
              isSpeaking ? "text-green-500" : "text-muted-foreground"
            )} />
          )}
          
          {/* Enhanced Connection Quality */}
          <div className="flex gap-1">
            <div className="w-1 h-3 bg-green-500 rounded-full"></div>
            <div className="w-1 h-3 bg-green-500 rounded-full"></div>
            <div className="w-1 h-3 bg-muted rounded-full"></div>
          </div>
          
          {/* VAD Status */}
          {vadEnabled && (
            <Activity className={cn(
              "w-3 h-3",
              isSpeaking ? "text-blue-500" : "text-muted-foreground"
            )} />
          )}
        </div>

        {/* Audio Track - handled by LiveKit automatically */}
      </CardContent>
    </Card>
  );
};

const EnhancedVoiceControls: React.FC<{
  vadSettings: VoiceActivationSettings;
}> = ({ vadSettings }) => {
  const { localParticipant } = useLocalParticipant();
  const [isMuted, setIsMuted] = useState(true);
  const [isDeafened, setIsDeafened] = useState(false);
  const [vadEnabled, setVadEnabled] = useState(vadSettings.enabled);
  const [isPushToTalk, setIsPushToTalk] = useState(false);
  const [pttKey] = useState('Space'); // Push-to-talk key (Space)

  useEffect(() => {
    if (localParticipant) {
      const audioTrack = localParticipant.getTrackPublication(Track.Source.Microphone);
      setIsMuted(audioTrack?.isMuted ?? true);
    }
  }, [localParticipant]);

  // Push-to-talk implementation
  useEffect(() => {
    if (!isPushToTalk) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === pttKey && !event.repeat) {
        if (isMuted) {
          toggleMute();
        }
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === pttKey) {
        if (!isMuted) {
          toggleMute();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isPushToTalk, pttKey, isMuted]);

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
    toast.success(isDeafened ? 'Audio enabled' : 'Audio deafened');
  };

  const toggleVAD = () => {
    setVadEnabled(!vadEnabled);
    toast.success(vadEnabled ? 'VAD disabled' : 'VAD enabled');
  };

  const togglePushToTalk = () => {
    setIsPushToTalk(!isPushToTalk);
    if (!isPushToTalk) {
      if (!isMuted) {
        toggleMute();
      }
    }
    toast.success(isPushToTalk ? 'Push-to-talk disabled' : `Push-to-talk enabled (${pttKey})`);
  };

  return (
    <div className="space-y-4">
      {/* Main Controls */}
      <div className="flex items-center justify-center gap-4">
        {/* Mute/Unmute */}
        <Button
          variant={isMuted ? "destructive" : "default"}
          size="lg"
          onClick={toggleMute}
          className="flex items-center gap-2"
          disabled={isPushToTalk}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          {isPushToTalk ? `Hold ${pttKey}` : (isMuted ? 'Unmute' : 'Mute')}
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

        {/* Push to Talk Toggle */}
        <Button
          variant={isPushToTalk ? "default" : "outline"}
          size="lg"
          onClick={togglePushToTalk}
          className="flex items-center gap-2"
        >
          <Phone className="w-5 h-5" />
          PTT
        </Button>
      </div>

      {/* Advanced Controls */}
      <div className="flex items-center justify-center gap-2">
        {/* VAD Toggle */}
        <Button
          variant={vadEnabled ? "default" : "outline"}
          size="sm"
          onClick={toggleVAD}
          className="flex items-center gap-2"
        >
          <Activity className="w-4 h-4" />
          Voice Detection
        </Button>

        {/* Audio Quality Indicator */}
        <Badge variant="outline" className="flex items-center gap-1">
          <Volume2 className="w-3 h-3" />
          64kbps
        </Badge>
      </div>

      {/* Status Messages */}
      {isPushToTalk && (
        <div className="text-center text-sm text-muted-foreground">
          Hold <kbd className="px-2 py-1 bg-muted rounded text-xs">{pttKey}</kbd> to speak
        </div>
      )}
      
      {vadEnabled && !isPushToTalk && (
        <div className="text-center text-sm text-muted-foreground">
          Voice Activity Detection enabled (Threshold: {vadSettings.threshold}dB)
        </div>
      )}
    </div>
  );
};

const VoiceSettings: React.FC<{
  vadSettings: VoiceActivationSettings;
  onVadSettingsChange: (settings: VoiceActivationSettings) => void;
}> = ({ vadSettings, onVadSettingsChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setIsOpen(true)}>
        <Settings className="w-4 h-4" />
      </Button>

      {/* Settings Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Enhanced Voice Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* VAD Enable/Disable */}
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Voice Activity Detection</label>
                <Button
                  variant={vadSettings.enabled ? "default" : "outline"}
                  size="sm"
                  onClick={() => onVadSettingsChange({
                    ...vadSettings,
                    enabled: !vadSettings.enabled
                  })}
                >
                  {vadSettings.enabled ? 'Enabled' : 'Disabled'}
                </Button>
              </div>

              {vadSettings.enabled && (
                <>
                  {/* Threshold Slider */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Sensitivity: {vadSettings.threshold}dB
                    </label>
                    <input
                      type="range"
                      min="-60"
                      max="-10"
                      step="1"
                      value={vadSettings.threshold}
                      onChange={(e) => onVadSettingsChange({
                        ...vadSettings,
                        threshold: parseFloat(e.target.value)
                      })}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Less Sensitive</span>
                      <span>More Sensitive</span>
                    </div>
                  </div>

                  {/* Gate Threshold */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Noise Gate: {vadSettings.gateThreshold}dB
                    </label>
                    <input
                      type="range"
                      min="-80"
                      max="-30"
                      step="1"
                      value={vadSettings.gateThreshold}
                      onChange={(e) => onVadSettingsChange({
                        ...vadSettings,
                        gateThreshold: parseFloat(e.target.value)
                      })}
                      className="w-full"
                    />
                  </div>

                  {/* Attack/Release Times */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Attack: {vadSettings.attackTime}ms
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="50"
                        step="1"
                        value={vadSettings.attackTime}
                        onChange={(e) => onVadSettingsChange({
                          ...vadSettings,
                          attackTime: parseFloat(e.target.value)
                        })}
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Release: {vadSettings.releaseTime}ms
                      </label>
                      <input
                        type="range"
                        min="50"
                        max="500"
                        step="10"
                        value={vadSettings.releaseTime}
                        onChange={(e) => onVadSettingsChange({
                          ...vadSettings,
                          releaseTime: parseFloat(e.target.value)
                        })}
                        className="w-full"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Preset Buttons */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Presets</label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onVadSettingsChange({
                      ...vadSettings,
                      ...getVADPreset('sensitive')
                    })}
                  >
                    Sensitive
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onVadSettingsChange({
                      ...vadSettings,
                      ...getVADPreset('normal')
                    })}
                  >
                    Normal
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onVadSettingsChange({
                      ...vadSettings,
                      ...getVADPreset('robust')
                    })}
                  >
                    Robust
                  </Button>
                </div>
              </div>

              {/* Close Button */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
};

export default EnhancedVoiceRoom;