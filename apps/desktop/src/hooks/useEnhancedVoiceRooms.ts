import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import toast from 'react-hot-toast';

// Enhanced types with VAD support
interface VoiceActivationSettings {
  enabled: boolean;
  threshold: number;
  gateThreshold: number;
  attackTime: number;
  releaseTime: number;
  minSpeechDuration: number;
}

interface EnhancedVoiceRoom {
  id: string;
  name: string;
  guild_id: string;
  channel_id: string;
  created_by: string;
  created_at: string;
  current_participants: ParticipantInfo[];
  max_participants: number;
  is_active: boolean;
  voice_activation?: VoiceActivationSettings;
}

interface ParticipantInfo {
  user_id: string;
  username: string;
  joined_at: string;
  is_muted: boolean;
  is_speaking?: boolean;
  audio_level?: number;
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
  voice_settings?: VoiceActivationSettings;
}

interface JoinRoomResponse {
  access_token: string;
  livekit_url: string;
  room_name: string;
  session_id: string;
  voice_settings?: VoiceActivationSettings;
}

interface LiveKitConfig {
  host: string;
  ws_url: string;
}

interface CreateRoomRequest {
  name: string;
  channelId: string;
  vadSettings?: VoiceActivationSettings;
}

interface VoiceMetrics {
  participantCount: number;
  averageAudioLevel: number;
  speakingParticipants: number;
  connectionQuality: 'excellent' | 'good' | 'poor';
  bandwidth: {
    incoming: number;
    outgoing: number;
  };
}

const DEFAULT_VAD_SETTINGS: VoiceActivationSettings = {
  enabled: true,
  threshold: -45,
  gateThreshold: -60,
  attackTime: 10,
  releaseTime: 100,
  minSpeechDuration: 150,
};

export const useEnhancedVoiceRooms = (guildId: string, userId: string, username: string) => {
  const queryClient = useQueryClient();
  const [currentSession, setCurrentSession] = useState<VoiceSession | null>(null);
  const [livekitConfig, setLivekitConfig] = useState<LiveKitConfig | null>(null);
  const [voiceMetrics, setVoiceMetrics] = useState<VoiceMetrics | null>(null);
  const [connectionRetries, setConnectionRetries] = useState(0);
  const [vadSettings, setVadSettings] = useState<VoiceActivationSettings>(DEFAULT_VAD_SETTINGS);
  
  // Reconnection logic
  const maxRetries = 3;
  const retryDelay = 1000; // 1 second base delay
  const retryTimeoutRef = useRef<NodeJS.Timeout>();

  // Get API configuration
  const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:14700';
  const VOICE_API_BASE = `${API_BASE}/api/voice`;

  const getAuthToken = () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      toast.error('Authentication required');
      throw new Error('No auth token available');
    }
    return token;
  };

  const authHeaders = {
    get Authorization() {
      return `Bearer ${getAuthToken()}`;
    },
  };

  // Fetch LiveKit configuration with retry
  useEffect(() => {
    const fetchLiveKitConfig = async () => {
      try {
        const response = await axios.get<LiveKitConfig>(`${VOICE_API_BASE}/livekit-config`);
        setLivekitConfig(response.data);
        setConnectionRetries(0); // Reset on success
      } catch (error) {
        console.error('Failed to fetch LiveKit config:', error);
        
        if (connectionRetries < maxRetries) {
          const delay = retryDelay * Math.pow(2, connectionRetries); // Exponential backoff
          retryTimeoutRef.current = setTimeout(() => {
            setConnectionRetries(prev => prev + 1);
          }, delay);
        } else {
          // Fallback config after max retries
          setLivekitConfig({
            host: 'http://localhost:7880',
            ws_url: 'ws://localhost:7880',
          });
          toast.error('Using fallback voice configuration');
        }
      }
    };

    fetchLiveKitConfig();

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [VOICE_API_BASE, connectionRetries]);

  // Enhanced voice rooms query with VAD support
  const {
    data: voiceRooms = [],
    isLoading: isLoadingRooms,
    error: roomsError,
    refetch: refetchRooms,
  } = useQuery<EnhancedVoiceRoom[]>({
    queryKey: ['enhancedVoiceRooms', guildId],
    queryFn: async () => {
      const response = await axios.get<EnhancedVoiceRoom[]>(
        `${VOICE_API_BASE}/guilds/${guildId}/rooms`,
        { headers: authHeaders }
      );
      return response.data;
    },
    enabled: !!guildId,
    refetchInterval: 3000, // Faster refresh for real-time experience
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 401) return false; // Don't retry auth errors
      return failureCount < 3;
    },
  });

  // Enhanced user session query
  const {
    data: userSession,
    isLoading: isLoadingSession,
    refetch: refetchSession,
  } = useQuery<VoiceSession | null>({
    queryKey: ['enhancedUserVoiceSession', userId],
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
    refetchInterval: 2000,
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 401) return false;
      return failureCount < 2;
    },
  });

  // Update local session state
  useEffect(() => {
    setCurrentSession(userSession || null);
    if (userSession?.voice_settings) {
      setVadSettings(userSession.voice_settings);
    }
  }, [userSession]);

  // Enhanced create room mutation with VAD settings
  const createRoomMutation = useMutation({
    mutationFn: async (data: CreateRoomRequest) => {
      const response = await axios.post<EnhancedVoiceRoom>(
        `${VOICE_API_BASE}/rooms`,
        {
          name: data.name,
          guild_id: guildId,
          channel_id: data.channelId,
          max_participants: 50,
          enable_recording: false,
          voice_activation: data.vadSettings || vadSettings,
        },
        { headers: authHeaders }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enhancedVoiceRooms', guildId] });
      toast.success('Voice channel created with enhanced features!');
    },
    onError: (error: any) => {
      console.error('Failed to create voice room:', error);
      const message = error.response?.data?.message || 'Failed to create voice channel';
      toast.error(message);
    },
  });

  // Enhanced join room mutation
  const joinRoomMutation = useMutation({
    mutationFn: async (data: { roomId: string; vadSettings?: VoiceActivationSettings }) => {
      const response = await axios.post<JoinRoomResponse>(
        `${VOICE_API_BASE}/rooms/${data.roomId}/join`,
        {
          user_id: userId,
          username: username,
          voice_settings: data.vadSettings || vadSettings,
        },
        { headers: authHeaders }
      );
      return { roomId: data.roomId, ...response.data };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['enhancedUserVoiceSession', userId] });
      queryClient.invalidateQueries({ queryKey: ['enhancedVoiceRooms', guildId] });
      
      // Update VAD settings from server response
      if (data.voice_settings) {
        setVadSettings(data.voice_settings);
      }
      
      setCurrentSession({
        id: data.session_id,
        user_id: userId,
        username: username,
        room_id: data.roomId,
        livekit_room_name: data.room_name,
        joined_at: new Date().toISOString(),
        is_muted: false,
        access_token: data.access_token,
        voice_settings: data.voice_settings,
      });

      toast.success('Joined voice channel with enhanced audio!');
    },
    onError: (error: any) => {
      console.error('Failed to join voice room:', error);
      const message = error.response?.data?.message || 'Failed to join voice channel';
      toast.error(message);
    },
  });

  // Enhanced leave room mutation
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
      setVoiceMetrics(null);
      queryClient.invalidateQueries({ queryKey: ['enhancedUserVoiceSession', userId] });
      queryClient.invalidateQueries({ queryKey: ['enhancedVoiceRooms', guildId] });
      toast.success('Left voice channel');
    },
    onError: (error: any) => {
      console.error('Failed to leave voice room:', error);
      toast.error('Failed to leave voice channel');
    },
  });

  // Delete room mutation
  const deleteRoomMutation = useMutation({
    mutationFn: async (roomId: string) => {
      await axios.delete(
        `${VOICE_API_BASE}/rooms/${roomId}`,
        { headers: authHeaders }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enhancedVoiceRooms', guildId] });
      toast.success('Voice channel deleted');
    },
    onError: (error: any) => {
      console.error('Failed to delete voice room:', error);
      toast.error('Failed to delete voice channel');
    },
  });

  // Update VAD settings mutation
  const updateVadSettingsMutation = useMutation({
    mutationFn: async (settings: VoiceActivationSettings) => {
      if (!currentSession) throw new Error('No active session');
      
      await axios.put(
        `${VOICE_API_BASE}/rooms/${currentSession.room_id}/vad-settings`,
        { settings },
        { headers: authHeaders }
      );
      return settings;
    },
    onSuccess: (settings) => {
      setVadSettings(settings);
      toast.success('Voice detection settings updated');
    },
    onError: (error: any) => {
      console.error('Failed to update VAD settings:', error);
      toast.error('Failed to update voice settings');
    },
  });

  // Voice metrics monitoring
  const startVoiceMetricsMonitoring = useCallback(() => {
    if (!currentSession) return;

    const interval = setInterval(async () => {
      try {
        const response = await axios.get<VoiceMetrics>(
          `${VOICE_API_BASE}/rooms/${currentSession.room_id}/metrics`,
          { headers: authHeaders }
        );
        setVoiceMetrics(response.data);
      } catch (error) {
        console.warn('Failed to fetch voice metrics:', error);
      }
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [currentSession, VOICE_API_BASE]);

  useEffect(() => {
    if (currentSession) {
      const cleanup = startVoiceMetricsMonitoring();
      return cleanup;
    }
  }, [currentSession, startVoiceMetricsMonitoring]);

  // Public API
  const createVoiceRoom = useCallback(
    async (name: string, channelId: string = 'default', customVadSettings?: VoiceActivationSettings) => {
      return createRoomMutation.mutateAsync({ 
        name, 
        channelId, 
        vadSettings: customVadSettings 
      });
    },
    [createRoomMutation]
  );

  const joinVoiceRoom = useCallback(
    async (roomId: string, customVadSettings?: VoiceActivationSettings) => {
      return joinRoomMutation.mutateAsync({ roomId, vadSettings: customVadSettings });
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

  const updateVadSettings = useCallback(
    async (settings: VoiceActivationSettings) => {
      return updateVadSettingsMutation.mutateAsync(settings);
    },
    [updateVadSettingsMutation]
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
      vadSettings: currentSession.voice_settings || vadSettings,
    };
  }, [currentSession, livekitConfig, vadSettings]);

  // Connection health monitoring
  const checkConnectionHealth = useCallback(async () => {
    try {
      await axios.get(`${VOICE_API_BASE}/health`, { headers: authHeaders });
      return true;
    } catch (error) {
      console.warn('Voice service health check failed:', error);
      return false;
    }
  }, [VOICE_API_BASE]);

  return {
    // Data
    voiceRooms,
    currentSession,
    livekitConfig,
    voiceMetrics,
    vadSettings,
    joinData: getJoinData(),

    // Loading states
    isLoading: isLoadingRooms || isLoadingSession,
    isLoadingRooms,
    isLoadingSession,
    isCreating: createRoomMutation.isPending,
    isJoining: joinRoomMutation.isPending,
    isLeaving: leaveRoomMutation.isPending,
    isDeleting: deleteRoomMutation.isPending,
    isUpdatingVad: updateVadSettingsMutation.isPending,

    // Actions
    createVoiceRoom,
    joinVoiceRoom,
    leaveVoiceRoom,
    deleteVoiceRoom,
    updateVadSettings,
    refetchRooms,
    refetchSession,
    checkConnectionHealth,

    // Settings
    setVadSettings,

    // Errors & Connection Info
    error: roomsError,
    connectionRetries,
    isConnected: !!livekitConfig && connectionRetries < maxRetries,
  };
};

export default useEnhancedVoiceRooms;
