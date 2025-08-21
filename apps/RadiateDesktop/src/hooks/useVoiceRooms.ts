import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import toast from 'react-hot-toast';

// Types
interface VoiceRoom {
  id: string;
  name: string;
  guild_id: string;
  channel_id: string;
  created_by: string;
  created_at: string;
  current_participants: ParticipantInfo[];
  max_participants: number;
  is_active: boolean;
}

interface ParticipantInfo {
  user_id: string;
  username: string;
  joined_at: string;
  is_muted: boolean;
}

interface VoiceSession {
  id: string;
  user_id: string;
  username: string;
  room_id: string;
  livekit_room_name: string;
  joined_at: string;
  left_at?: string;
  is_muted: boolean;
  access_token: string;
}

interface JoinRoomResponse {
  access_token: string;
  livekit_url: string;
  room_name: string;
  session_id: string;
}

interface LiveKitConfig {
  host: string;
  ws_url: string;
}

export const useVoiceRooms = (guildId: string, userId: string) => {
  const queryClient = useQueryClient();
  const [currentSession, setCurrentSession] = useState<VoiceSession | null>(null);
  const [livekitConfig, setLivekitConfig] = useState<LiveKitConfig | null>(null);

  // Get API base URL from environment or default
  const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:14700';
  const VOICE_API_BASE = `${API_BASE}/api/voice`;

  // Get auth token (you'll need to adapt this to your auth system)
  const getAuthToken = () => {
    return localStorage.getItem('authToken') || '';
  };

  const authHeaders = {
    Authorization: `Bearer ${getAuthToken()}`,
  };

  // Fetch LiveKit configuration
  useEffect(() => {
    const fetchLiveKitConfig = async () => {
      try {
        const response = await axios.get<LiveKitConfig>(`${VOICE_API_BASE}/livekit-config`);
        setLivekitConfig(response.data);
      } catch (error) {
        console.error('Failed to fetch LiveKit config:', error);
        // Fallback config
        setLivekitConfig({
          host: 'http://localhost:7880',
          ws_url: 'ws://localhost:7880',
        });
      }
    };

    fetchLiveKitConfig();
  }, [VOICE_API_BASE]);

  // Fetch guild voice rooms
  const {
    data: voiceRooms = [],
    isLoading: isLoadingRooms,
    error: roomsError,
    refetch: refetchRooms,
  } = useQuery<VoiceRoom[]>({
    queryKey: ['voiceRooms', guildId],
    queryFn: async () => {
      const response = await axios.get<VoiceRoom[]>(
        `${VOICE_API_BASE}/guilds/${guildId}/rooms`,
        { headers: authHeaders }
      );
      return response.data;
    },
    enabled: !!guildId,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch current user session
  const {
    data: userSession,
    isLoading: isLoadingSession,
    refetch: refetchSession,
  } = useQuery<VoiceSession | null>({
    queryKey: ['userVoiceSession', userId],
    queryFn: async () => {
      try {
        const response = await axios.get<VoiceSession>(
          `${VOICE_API_BASE}/users/${userId}/session`,
          { headers: authHeaders }
        );
        return response.data;
      } catch (error: any) {
        if (error.response?.status === 404) {
          return null; // No active session
        }
        throw error;
      }
    },
    enabled: !!userId,
    refetchInterval: 3000, // Refresh every 3 seconds
  });

  // Update local session state when query data changes
  useEffect(() => {
    setCurrentSession(userSession || null);
  }, [userSession]);

  // Create voice room mutation
  const createRoomMutation = useMutation({
    mutationFn: async (data: { name: string; channelId: string }) => {
      const response = await axios.post<VoiceRoom>(
        `${VOICE_API_BASE}/rooms`,
        {
          name: data.name,
          guild_id: guildId,
          channel_id: data.channelId,
          max_participants: 50,
          enable_recording: false,
        },
        { headers: authHeaders }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voiceRooms', guildId] });
      toast.success('Voice channel created successfully!');
    },
    onError: (error: any) => {
      console.error('Failed to create voice room:', error);
      toast.error(error.response?.data?.message || 'Failed to create voice channel');
    },
  });

  // Join voice room mutation
  const joinRoomMutation = useMutation({
    mutationFn: async (roomId: string) => {
      const response = await axios.post<JoinRoomResponse>(
        `${VOICE_API_BASE}/rooms/${roomId}/join`,
        {
          user_id: userId,
          username: 'User', // You should get this from your auth context
        },
        { headers: authHeaders }
      );
      return { roomId, ...response.data };
    },
    onSuccess: (data) => {
      // Update session immediately
      queryClient.invalidateQueries({ queryKey: ['userVoiceSession', userId] });
      queryClient.invalidateQueries({ queryKey: ['voiceRooms', guildId] });
      
      // Set current session
      setCurrentSession({
        id: data.session_id,
        user_id: userId,
        username: 'User',
        room_id: data.roomId,
        livekit_room_name: data.room_name,
        joined_at: new Date().toISOString(),
        is_muted: false,
        access_token: data.access_token,
      });
    },
    onError: (error: any) => {
      console.error('Failed to join voice room:', error);
      toast.error(error.response?.data?.message || 'Failed to join voice channel');
    },
  });

  // Leave voice room mutation
  const leaveRoomMutation = useMutation({
    mutationFn: async (roomId: string) => {
      await axios.post(
        `${VOICE_API_BASE}/rooms/${roomId}/leave`,
        {},
        { headers: authHeaders }
      );
    },
    onSuccess: () => {
      setCurrentSession(null);
      queryClient.invalidateQueries({ queryKey: ['userVoiceSession', userId] });
      queryClient.invalidateQueries({ queryKey: ['voiceRooms', guildId] });
      toast.success('Left voice channel');
    },
    onError: (error: any) => {
      console.error('Failed to leave voice room:', error);
      toast.error(error.response?.data?.message || 'Failed to leave voice channel');
    },
  });

  // Delete voice room mutation
  const deleteRoomMutation = useMutation({
    mutationFn: async (roomId: string) => {
      await axios.delete(
        `${VOICE_API_BASE}/rooms/${roomId}`,
        { headers: authHeaders }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voiceRooms', guildId] });
      toast.success('Voice channel deleted');
    },
    onError: (error: any) => {
      console.error('Failed to delete voice room:', error);
      toast.error(error.response?.data?.message || 'Failed to delete voice channel');
    },
  });

  // Set participant mute mutation
  const setMuteMutation = useMutation({
    mutationFn: async (data: { roomId: string; userId: string; muted: boolean }) => {
      await axios.put(
        `${VOICE_API_BASE}/rooms/${data.roomId}/participants/${data.userId}/mute`,
        { muted: data.muted },
        { headers: authHeaders }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userVoiceSession', userId] });
      queryClient.invalidateQueries({ queryKey: ['voiceRooms', guildId] });
    },
    onError: (error: any) => {
      console.error('Failed to set mute status:', error);
      toast.error('Failed to update mute status');
    },
  });

  // Public API
  const createVoiceRoom = useCallback(
    async (name: string, channelId: string = 'default') => {
      return createRoomMutation.mutateAsync({ name, channelId });
    },
    [createRoomMutation]
  );

  const joinVoiceRoom = useCallback(
    async (roomId: string) => {
      return joinRoomMutation.mutateAsync(roomId);
    },
    [joinRoomMutation]
  );

  const leaveVoiceRoom = useCallback(async () => {
    if (currentSession) {
      return leaveRoomMutation.mutateAsync(currentSession.room_id);
    }
  }, [currentSession, leaveRoomMutation]);

  const deleteVoiceRoom = useCallback(
    async (roomId: string) => {
      return deleteRoomMutation.mutateAsync(roomId);
    },
    [deleteRoomMutation]
  );

  const setParticipantMute = useCallback(
    async (roomId: string, targetUserId: string, muted: boolean) => {
      return setMuteMutation.mutateAsync({ roomId, userId: targetUserId, muted });
    },
    [setMuteMutation]
  );

  const getJoinData = useCallback(() => {
    if (!currentSession || !livekitConfig) {
      return null;
    }

    return {
      roomId: currentSession.room_id,
      roomName: currentSession.livekit_room_name,
      token: currentSession.access_token,
      serverUrl: livekitConfig.ws_url,
    };
  }, [currentSession, livekitConfig]);

  return {
    // Data
    voiceRooms,
    currentSession,
    livekitConfig,
    joinData: getJoinData(),

    // Loading states
    isLoading: isLoadingRooms || isLoadingSession,
    isLoadingRooms,
    isLoadingSession,
    isCreating: createRoomMutation.isPending,
    isJoining: joinRoomMutation.isPending,
    isLeaving: leaveRoomMutation.isPending,
    isDeleting: deleteRoomMutation.isPending,

    // Actions
    createVoiceRoom,
    joinVoiceRoom,
    leaveVoiceRoom,
    deleteVoiceRoom,
    setParticipantMute,
    refetchRooms,
    refetchSession,

    // Errors
    error: roomsError,
  };
};

export default useVoiceRooms;
