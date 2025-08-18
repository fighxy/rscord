import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import VoiceChannelList from './VoiceChannelList';
import VoiceRoom from './VoiceRoom';
import useVoiceRooms from '@/hooks/useVoiceRooms';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface VoiceManagerProps {
  guildId: string;
  userId: string;
  username: string;
  className?: string;
}

export const VoiceManager: React.FC<VoiceManagerProps> = ({
  guildId,
  userId,
  username,
  className,
}) => {
  const [isVoiceDialogOpen, setIsVoiceDialogOpen] = useState(false);
  
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
  } = useVoiceRooms(guildId, userId);

  const handleCreateChannel = async (name: string) => {
    await createVoiceRoom(name, 'default-channel');
  };

  const handleJoinChannel = async (channelId: string) => {
    await joinVoiceRoom(channelId);
    setIsVoiceDialogOpen(true);
  };

  const handleLeaveChannel = async () => {
    await leaveVoiceRoom();
    setIsVoiceDialogOpen(false);
  };

  const handleDeleteChannel = async (channelId: string) => {
    await deleteVoiceRoom(channelId);
  };

  const handleVoiceRoomError = (error: Error) => {
    console.error('Voice room error:', error);
    // Keep dialog open but show error state
  };

  if (error) {
    return (
      <div className={className}>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load voice channels. 
            <Button variant="link" className="p-0 h-auto" onClick={() => window.location.reload()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Voice Channels List */}
      <VoiceChannelList
        guildId={guildId}
        userId={userId}
        channels={voiceRooms}
        currentUserSession={currentSession}
        onJoinChannel={handleJoinChannel}
        onLeaveChannel={handleLeaveChannel}
        onCreateChannel={handleCreateChannel}
        onDeleteChannel={handleDeleteChannel}
        isLoading={isLoading}
      />

      {/* Voice Room Dialog */}
      <Dialog open={isVoiceDialogOpen} onOpenChange={setIsVoiceDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0" hideCloseButton>
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>Voice Chat</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 min-h-0">
            {joinData ? (
              <VoiceRoom
                roomId={joinData.roomId}
                roomName={joinData.roomName}
                serverUrl={joinData.serverUrl}
                token={joinData.token}
                onLeave={handleLeaveChannel}
                onError={handleVoiceRoomError}
              />
            ) : (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {isJoining ? 'Joining voice channel...' : 'Loading voice room...'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Loading Overlay */}
      {(isCreating || isLeaving) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg shadow-lg">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>
                {isCreating && 'Creating voice channel...'}
                {isLeaving && 'Leaving voice channel...'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceManager;
