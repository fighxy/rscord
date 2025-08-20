import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Volume2, 
  Plus, 
  Users, 
  Crown, 
  LogIn, 
  Trash2, 
  Mic 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { VoiceChannel, VoiceSession } from './types';

interface VoiceChannelListProps {
  guildId: string;
  userId: string;
  channels: VoiceChannel[];
  currentUserSession: VoiceSession | null;
  onJoinChannel: (channelId: string) => void;
  onLeaveChannel: () => void;
  onCreateChannel: (name: string) => void;
  onDeleteChannel: (channelId: string, channelName: string) => void;
  isLoading: boolean;
}

export const VoiceChannelList: React.FC<VoiceChannelListProps> = ({
  guildId,
  userId,
  channels,
  currentUserSession,
  onJoinChannel,
  onLeaveChannel,
  onCreateChannel,
  onDeleteChannel,
  isLoading,
}) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) return;
    
    setIsCreating(true);
    try {
      await onCreateChannel(newChannelName.trim());
      setNewChannelName('');
      setShowCreateForm(false);
    } finally {
      setIsCreating(false);
    }
  };

  const handleLeaveChannel = async () => {
    await onLeaveChannel();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="w-5 h-5" />
            Voice Channels
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-md"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="w-5 h-5" />
            Voice Channels
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Create Channel Form */}
        {showCreateForm && (
          <Card className="p-3 bg-muted/50">
            <div className="space-y-3">
              <div>
                <label htmlFor="channel-name" className="text-sm font-medium">Channel Name</label>
                <Input
                  id="channel-name"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="General Voice"
                  maxLength={32}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateChannel();
                    } else if (e.key === 'Escape') {
                      setShowCreateForm(false);
                    }
                  }}
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={handleCreateChannel}
                  disabled={isCreating || !newChannelName.trim()}
                >
                  {isCreating ? 'Creating...' : 'Create'}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Current Session Info */}
        {currentUserSession && (
          <Card className="p-3 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">
                  Connected to voice
                </span>
              </div>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={handleLeaveChannel}
              >
                Leave
              </Button>
            </div>
          </Card>
        )}

        {/* Voice Channels List */}
        {channels.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Volume2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No voice channels yet</p>
            <p className="text-sm">Create one to get started!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {channels.map((channel) => (
              <VoiceChannelCard
                key={channel.id}
                channel={channel}
                userId={userId}
                isCurrentChannel={currentUserSession?.room_id === channel.id}
                onJoin={() => onJoinChannel(channel.id)}
                onDelete={() => onDeleteChannel(channel.id, channel.name)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface VoiceChannelCardProps {
  channel: VoiceChannel;
  userId: string;
  isCurrentChannel: boolean;
  onJoin: () => void;
  onDelete: () => void;
}

const VoiceChannelCard: React.FC<VoiceChannelCardProps> = ({
  channel,
  userId,
  isCurrentChannel,
  onJoin,
  onDelete,
}) => {
  const isOwner = channel.created_by === userId;
  const participantCount = channel.current_participants.length;
  const hasParticipants = participantCount > 0;

  return (
    <Card className={cn(
      "transition-all duration-200 hover:shadow-md cursor-pointer group",
      isCurrentChannel && "ring-2 ring-primary shadow-lg",
      hasParticipants && "bg-accent/50"
    )}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          {/* Channel Info */}
          <div className="flex-1" onClick={onJoin}>
            <div className="flex items-center gap-2 mb-2">
              <Volume2 className={cn(
                "w-4 h-4",
                hasParticipants ? "text-green-500" : "text-muted-foreground"
              )} />
              <span className="font-medium">{channel.name}</span>
              {isOwner && (
                <Crown className="w-3 h-3 text-yellow-500" />
              )}
            </div>

            {/* Participants Count */}
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                <span>{participantCount}/{channel.max_participants}</span>
              </div>
              
              {hasParticipants && (
                <Badge variant="secondary" className="text-xs">
                  Active
                </Badge>
              )}
            </div>

            {/* Current Participants */}
            {hasParticipants && (
              <div className="mt-2 space-y-1">
                {channel.current_participants.slice(0, 3).map((participant) => (
                  <div key={participant.user_id} className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className={cn(
                      participant.user_id === userId && "font-medium text-primary"
                    )}>
                      {participant.username}
                      {participant.user_id === userId && " (You)"}
                    </span>
                    {participant.is_muted && (
                      <Mic className="w-3 h-3 text-muted-foreground" />
                    )}
                  </div>
                ))}
                
                {channel.current_participants.length > 3 && (
                  <div className="text-xs text-muted-foreground">
                    +{channel.current_participants.length - 3} more
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 ml-2">
            {!isCurrentChannel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onJoin}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <LogIn className="w-4 h-4" />
              </Button>
            )}
            
            {isOwner && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default VoiceChannelList;