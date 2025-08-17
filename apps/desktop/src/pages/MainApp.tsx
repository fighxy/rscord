import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';

// Components
import ServerSidebar from '../components/ServerSidebar';
import ChannelSidebar from '../components/ChannelSidebar';
import ChatArea from '../components/ChatArea';
import MembersSidebar from '../components/MembersSidebar';
import VoiceOverlay from '../components/VoiceOverlay';

// Hooks
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useServers } from '../hooks/useServers';
import { useChannels } from '../hooks/useChannels';

// Types
import { Server, Channel, User } from '../types';

// Styles
import '../styles/glassmorphism.css';
import './MainApp.css';

const MainApp: React.FC = () => {
  const { user } = useAuth();
  const { isConnected } = useWebSocket();
  
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [showMembers, setShowMembers] = useState(true);
  const [isVoiceConnected, setIsVoiceConnected] = useState(false);
  
  const { servers, isLoading: serversLoading } = useServers();
  const { channels, isLoading: channelsLoading } = useChannels(selectedServer?.id);

  // Load last selected server/channel from Tauri storage
  useEffect(() => {
    const loadLastSelection = async () => {
      try {
        const lastServerId = await invoke<string>('get_storage', { key: 'last_server' });
        const lastChannelId = await invoke<string>('get_storage', { key: 'last_channel' });
        
        if (lastServerId && servers) {
          const server = servers.find(s => s.id === lastServerId);
          if (server) setSelectedServer(server);
        }
        
        if (lastChannelId && channels) {
          const channel = channels.find(c => c.id === lastChannelId);
          if (channel) setSelectedChannel(channel);
        }
      } catch (error) {
        console.error('Failed to load last selection:', error);
      }
    };
    
    if (servers && servers.length > 0 && !selectedServer) {
      loadLastSelection();
    }
  }, [servers, channels]);

  // Save selection to Tauri storage
  useEffect(() => {
    if (selectedServer) {
      invoke('set_storage', { 
        key: 'last_server', 
        value: selectedServer.id 
      }).catch(console.error);
    }
    
    if (selectedChannel) {
      invoke('set_storage', { 
        key: 'last_channel', 
        value: selectedChannel.id 
      }).catch(console.error);
    }
  }, [selectedServer, selectedChannel]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle members sidebar: Ctrl/Cmd + U
      if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
        setShowMembers(prev => !prev);
      }
      
      // Quick switcher: Ctrl/Cmd + K
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        // Open quick switcher modal
        console.log('Open quick switcher');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="main-app-container">
      {/* Background orbs are in App.tsx */}
      
      {/* Server Sidebar */}
      <ServerSidebar
        servers={servers || []}
        selectedServer={selectedServer}
        onServerSelect={setSelectedServer}
        isLoading={serversLoading}
      />
      
      {/* Channel Sidebar */}
      <ChannelSidebar
        server={selectedServer}
        channels={channels || []}
        selectedChannel={selectedChannel}
        onChannelSelect={setSelectedChannel}
        isLoading={channelsLoading}
        user={user}
        isVoiceConnected={isVoiceConnected}
        onVoiceConnect={setIsVoiceConnected}
      />
      
      {/* Main Content Area */}
      <div className="main-content-wrapper">
        {selectedChannel ? (
          <ChatArea
            channel={selectedChannel}
            server={selectedServer}
            showMembers={showMembers}
            onToggleMembers={() => setShowMembers(!showMembers)}
          />
        ) : (
          <div className="no-channel-selected glass-panel">
            <div className="empty-state">
              <div className="empty-icon">💬</div>
              <h2>Select a channel to start chatting</h2>
              <p>Choose a channel from the sidebar to view messages</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Members Sidebar */}
      {showMembers && selectedChannel && (
        <MembersSidebar
          serverId={selectedServer?.id}
          channelId={selectedChannel.id}
        />
      )}
      
      {/* Voice Overlay */}
      {isVoiceConnected && (
        <VoiceOverlay
          onDisconnect={() => setIsVoiceConnected(false)}
        />
      )}
      
      {/* Connection Status */}
      {!isConnected && (
        <div className="connection-status">
          <div className="status-indicator offline"></div>
          <span>Reconnecting...</span>
        </div>
      )}
    </div>
  );
};

export default MainApp;
