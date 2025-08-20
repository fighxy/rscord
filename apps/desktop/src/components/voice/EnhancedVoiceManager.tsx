import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, Activity } from 'lucide-react';
import VoiceChannelList from './VoiceChannelList';
import EnhancedVoiceRoom from './EnhancedVoiceRoom';
import useEnhancedVoiceRooms from '@/hooks/useEnhancedVoiceRooms';
import { VoiceActivationSettings, VoiceMetrics, DEFAULT_VAD_SETTINGS } from './types';
import { validateVADSettings } from './utils';
import toast from 'react-hot-toast';

interface EnhancedVoiceManagerProps {
  guildId: string;
  userId: string;
  username: string;
  className?: string;
}

export const EnhancedVoiceManager: React.FC<EnhancedVoiceManagerProps> = ({
  guildId,
  userId,
  username, // Used in useEnhancedVoiceRooms hook
  className,
}) => {
  const [isVoiceDialogOpen, setIsVoiceDialogOpen] = useState(false);
  const [vadSettings, setVadSettings] = useState<VoiceActivationSettings>(DEFAULT_VAD_SETTINGS);
  const [voiceMetrics, setVoiceMetrics] = useState<VoiceMetrics | null>(null);
  const [connectionRetries, setConnectionRetries] = useState(0);
  const [isUpdatingVad, setIsUpdatingVad] = useState(false);
  
  const {
    voiceRooms,
    currentSession,
    joinData,
    isLoading,
    isCreating,
    isJoining,
    isLeaving,
    createVoiceRoom,
    joinVoiceRoom,
    leaveVoiceRoom,
    deleteVoiceRoom,
    error,
  } = useEnhancedVoiceRooms(guildId, userId, username);

  useEffect(() => {
    // Load VAD settings from localStorage
    const savedSettings = localStorage.getItem(`voice-settings-${userId}`);
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        if (validateVADSettings(parsed)) {
          setVadSettings(parsed);
        }
      } catch (e) {
        console.warn('Failed to parse saved VAD settings');
      }
    }
  }, [userId]);

  // Mock voice metrics update (in real implementation, this would come from LiveKit)
  useEffect(() => {
    if (currentSession && isVoiceDialogOpen) {
      const interval = setInterval(() => {
        setVoiceMetrics({
          participantCount: Math.floor(Math.random() * 8) + 1,
          speakingParticipants: Math.floor(Math.random() * 3),
          connection_quality: ['excellent', 'good', 'poor'][Math.floor(Math.random() * 3)] as any,
          latency: Math.floor(Math.random() * 100) + 20,
          packetLoss: Math.random() * 2,
        });
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [currentSession, isVoiceDialogOpen]);

  const handleCreateChannel = async (name: string) => {
    try {
      await createVoiceRoom(name, 'enhanced-channel');
      toast.success('Enhanced voice channel created');
    } catch (error) {
      toast.error('Failed to create enhanced voice channel');
      handleConnectionError();
    }
  };

  const handleJoinChannel = async (channelId: string) => {
    try {
      await joinVoiceRoom(channelId);
      setIsVoiceDialogOpen(true);
      setConnectionRetries(0);
    } catch (error) {
      toast.error('Failed to join enhanced voice channel');
      handleConnectionError();
    }
  };

  const handleLeaveChannel = async () => {
    try {
      await leaveVoiceRoom();
      setIsVoiceDialogOpen(false);
      setVoiceMetrics(null);
      setConnectionRetries(0);
    } catch (error) {
      toast.error('Failed to leave voice channel');
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    try {
      await deleteVoiceRoom(channelId);
      toast.success('Enhanced voice channel deleted');
    } catch (error) {
      toast.error('Failed to delete voice channel');
    }
  };

  const handleVoiceRoomError = (error: Error) => {
    console.error('Enhanced voice room error:', error);
    handleConnectionError();
  };

  const handleConnectionError = () => {
    setConnectionRetries(prev => Math.min(prev + 1, 3));
  };

  const handleVadSettingsChange = async (newSettings: VoiceActivationSettings) => {
    if (!validateVADSettings(newSettings)) {
      toast.error('Invalid VAD settings');
      return;
    }

    setIsUpdatingVad(true);
    try {
      setVadSettings(newSettings);
      // Save to localStorage
      localStorage.setItem(`voice-settings-${userId}`, JSON.stringify(newSettings));
      
      // If in a voice session, apply settings immediately
      if (currentSession) {
        // In real implementation, this would update the LiveKit settings
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call
      }
      
      toast.success('Voice detection settings updated');
    } catch (error) {
      toast.error('Failed to update VAD settings');
    } finally {
      setIsUpdatingVad(false);
    }
  };

  if (error) {
    return (
      <div className={className}>
        <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <div className="text-red-700">
            Failed to load enhanced voice channels. 
            <Button variant="link" className="p-0 h-auto" onClick={() => window.location.reload()}>
              Try again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Voice Channels List */}
      <VoiceChannelList
        guildId={guildId}
        userId={userId}
        channels={voiceRooms as any}
        currentUserSession={currentSession as any}
        onJoinChannel={handleJoinChannel}
        onLeaveChannel={handleLeaveChannel}
        onCreateChannel={handleCreateChannel}
        onDeleteChannel={handleDeleteChannel}
        isLoading={isLoading}
      />

      {/* Enhanced Voice Room Dialog */}
      <Dialog open={isVoiceDialogOpen} onOpenChange={setIsVoiceDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[95vh] p-0" showCloseButton={false}>
          <DialogHeader className="p-6 pb-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                Enhanced Voice Chat
                {vadSettings.enabled && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Activity className="w-3 h-3" />
                    VAD Active
                  </Badge>
                )}
              </DialogTitle>
              
              {voiceMetrics && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{voiceMetrics.participantCount} participants</span>
                  <span>•</span>
                  <span>{voiceMetrics.speakingParticipants} speaking</span>
                  <span>•</span>
                  <span className="capitalize">{voiceMetrics.connection_quality}</span>
                </div>
              )}
            </div>
          </DialogHeader>
          
          <div className="flex-1 min-h-0">
            {joinData ? (
              <EnhancedVoiceRoom
                roomId={joinData.roomId}
                roomName={joinData.roomName}
                serverUrl={joinData.serverUrl}
                token={joinData.token}
                vadSettings={vadSettings}
                onLeave={handleLeaveChannel}
                onError={handleVoiceRoomError}
              />
            ) : (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {isJoining ? 'Joining enhanced voice channel...' : 'Loading voice room...'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Initializing Voice Activity Detection...
                  </p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* VAD Settings Quick Access */}
      {currentSession && (
        <div className="mt-4 p-3 bg-accent/50 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium">Voice Detection Settings</h4>
            <Badge variant={vadSettings.enabled ? "default" : "outline"}>
              {vadSettings.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Sensitivity</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="-60"
                  max="-10"
                  step="1"
                  value={vadSettings.threshold}
                  onChange={(e) => handleVadSettingsChange({
                    ...vadSettings,
                    threshold: parseFloat(e.target.value)
                  })}
                  className="flex-1 h-2"
                  disabled={isUpdatingVad}
                />
                <span className="text-xs w-12 text-right">
                  {vadSettings.threshold}dB
                </span>
              </div>
            </div>
            
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Noise Gate</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="-80"
                  max="-30"
                  step="1"
                  value={vadSettings.gateThreshold}
                  onChange={(e) => handleVadSettingsChange({
                    ...vadSettings,
                    gateThreshold: parseFloat(e.target.value)
                  })}
                  className="flex-1 h-2"
                  disabled={isUpdatingVad}
                />
                <span className="text-xs w-12 text-right">
                  {vadSettings.gateThreshold}dB
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-3">
            <Button
              variant={vadSettings.enabled ? "default" : "outline"}
              size="sm"
              onClick={() => handleVadSettingsChange({
                ...vadSettings,
                enabled: !vadSettings.enabled
              })}
              disabled={isUpdatingVad}
            >
              {vadSettings.enabled ? 'Disable VAD' : 'Enable VAD'}
            </Button>
            
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleVadSettingsChange({
                  ...vadSettings,
                  threshold: -50,
                  gateThreshold: -70,
                })}
                disabled={isUpdatingVad}
              >
                Sensitive
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleVadSettingsChange({
                  ...vadSettings,
                  threshold: -35,
                  gateThreshold: -50,
                })}
                disabled={isUpdatingVad}
              >
                Robust
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlays */}
      {(isCreating || isLeaving || isUpdatingVad) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg shadow-lg">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>
                {isCreating && 'Creating enhanced voice channel...'}
                {isLeaving && 'Leaving voice channel...'}
                {isUpdatingVad && 'Updating voice detection settings...'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Connection Issues Alert */}
      {connectionRetries > 0 && (
        <div className="mt-4 p-4 border border-red-200 bg-red-50 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <div className="text-red-700">
            Voice service connection unstable. Retrying... ({connectionRetries}/3)
            {connectionRetries >= 3 && (
              <Button 
                variant="link" 
                className="p-0 h-auto ml-2"
                onClick={() => window.location.reload()}
              >
                Refresh Page
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedVoiceManager;