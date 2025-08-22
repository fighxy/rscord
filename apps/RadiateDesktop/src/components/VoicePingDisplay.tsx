// Voice Ping Display Component for Radiate Desktop

import React, { useState, useEffect, useRef } from 'react';
import { VoipPingManager } from '../services/voip-ping-manager';
import { PingResult, ConnectionQuality, PING_COLORS } from '../types/voice-stats';

interface VoicePingDisplayProps {
  signalingUrl: string;
  showGraph?: boolean;
  showNumeric?: boolean;
  showIcon?: boolean;
  className?: string;
  size?: 'small' | 'medium' | 'large';
}

export const VoicePingDisplay: React.FC<VoicePingDisplayProps> = ({
  signalingUrl,
  showGraph = false,
  showNumeric = true,
  showIcon = true,
  className = '',
  size = 'medium'
}) => {
  const [currentPing, setCurrentPing] = useState<number | null>(null);
  const [averagePing, setAveragePing] = useState<number | null>(null);
  const [quality, setQuality] = useState<ConnectionQuality>('disconnected');
  const [packetLoss, setPacketLoss] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [pingHistory, setPingHistory] = useState<PingResult[]>([]);
  
  const pingManager = useRef<VoipPingManager | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Initialize ping manager
    pingManager.current = new VoipPingManager(signalingUrl);
    
    // Subscribe to ping updates
    const unsubscribe = pingManager.current.onPingUpdate((ping: PingResult) => {
      setCurrentPing(ping.rtt > 0 ? ping.rtt : null);
      setQuality(ping.quality);
      setIsConnected(ping.rtt > 0);
      
      // Update stats
      if (pingManager.current) {
        const stats = pingManager.current.getStats();
        setAveragePing(stats.average);
        setPacketLoss(stats.packetLoss);
        
        if (showGraph) {
          setPingHistory(pingManager.current.getPingHistory());
        }
      }
    });

    // Start ping monitoring
    pingManager.current.startPing();

    return () => {
      unsubscribe();
      if (pingManager.current) {
        pingManager.current.stopPing();
      }
    };
  }, [signalingUrl, showGraph]);

  // Draw ping graph
  useEffect(() => {
    if (!showGraph || !canvasRef.current || pingHistory.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const maxPing = 200; // Max ping for scaling

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // Draw grid lines
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw ping line
    if (pingHistory.length > 1) {
      ctx.strokeStyle = PING_COLORS[quality];
      ctx.lineWidth = 2;
      ctx.beginPath();

      pingHistory.forEach((ping, index) => {
        if (ping.rtt <= 0) return; // Skip disconnected pings

        const x = (width / (pingHistory.length - 1)) * index;
        const y = height - (ping.rtt / maxPing) * height;
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();

      // Draw points
      ctx.fillStyle = PING_COLORS[quality];
      pingHistory.forEach((ping, index) => {
        if (ping.rtt <= 0) return;

        const x = (width / (pingHistory.length - 1)) * index;
        const y = height - (ping.rtt / maxPing) * height;
        
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, 2 * Math.PI);
        ctx.fill();
      });
    }
  }, [pingHistory, quality, showGraph]);

  const getIconForQuality = (quality: ConnectionQuality): string => {
    switch (quality) {
      case 'excellent': return '🟢';
      case 'good': return '🟡';
      case 'fair': return '🟠';
      case 'poor': return '🔴';
      case 'disconnected': return '⚫';
      default: return '❓';
    }
  };

  const getSizeClasses = (size: string): string => {
    switch (size) {
      case 'small': return 'text-xs';
      case 'large': return 'text-lg';
      default: return 'text-sm';
    }
  };

  return (
    <div className={`voice-ping-display ${className} ${getSizeClasses(size)}`}>
      <div className="flex items-center gap-2">
        {showIcon && (
          <span 
            className="ping-icon"
            title={`Connection: ${quality}`}
          >
            {getIconForQuality(quality)}
          </span>
        )}
        
        {showNumeric && (
          <div className="ping-stats">
            {isConnected ? (
              <div className="flex gap-2">
                <span 
                  className="ping-current font-mono"
                  style={{ color: PING_COLORS[quality] }}
                  title="Current ping"
                >
                  {currentPing}ms
                </span>
                {averagePing && averagePing !== currentPing && (
                  <span 
                    className="ping-average text-gray-400 font-mono"
                    title="Average ping"
                  >
                    (avg: {averagePing}ms)
                  </span>
                )}
                {packetLoss > 0 && (
                  <span 
                    className="packet-loss text-red-400 font-mono text-xs"
                    title="Packet loss"
                  >
                    {packetLoss}% loss
                  </span>
                )}
              </div>
            ) : (
              <span className="ping-disconnected text-red-400">
                Disconnected
              </span>
            )}
          </div>
        )}
      </div>

      {showGraph && (
        <div className="ping-graph mt-2">
          <canvas
            ref={canvasRef}
            width={200}
            height={60}
            className="border border-gray-600 rounded bg-black"
            title="Ping history graph"
          />
          <div className="graph-labels flex justify-between text-xs text-gray-400 mt-1">
            <span>0ms</span>
            <span>50ms</span>
            <span>100ms</span>
            <span>150ms</span>
            <span>200ms</span>
          </div>
        </div>
      )}
    </div>
  );
};

// Hook for using VoIP ping in other components
export const useVoipPing = (signalingUrl: string) => {
  const [stats, setStats] = useState({
    current: null as number | null,
    average: null as number | null,
    quality: 'disconnected' as ConnectionQuality,
    isConnected: false
  });

  const pingManager = useRef<VoipPingManager | null>(null);

  useEffect(() => {
    pingManager.current = new VoipPingManager(signalingUrl);
    
    const unsubscribe = pingManager.current.onPingUpdate(() => {
      if (pingManager.current) {
        const pingStats = pingManager.current.getStats();
        setStats({
          current: pingStats.current,
          average: pingStats.average,
          quality: pingStats.quality,
          isConnected: pingStats.current !== null
        });
      }
    });

    pingManager.current.startPing();

    return () => {
      unsubscribe();
      if (pingManager.current) {
        pingManager.current.stopPing();
      }
    };
  }, [signalingUrl]);

  return stats;
};