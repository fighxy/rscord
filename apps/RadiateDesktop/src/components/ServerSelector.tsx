import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const ServerSelector: React.FC = () => {
  const [serverStatus, setServerStatus] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    checkServerStatus();
  }, []);

  const checkServerStatus = async () => {
    setIsChecking(true);
    
    try {
      const response = await fetch('http://5.35.83.143:14700/health', {
        method: 'GET',
        mode: 'cors',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      
      setServerStatus(response.ok);
    } catch (error) {
      console.error('Error checking server status:', error);
      setServerStatus(false);
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Server Status</CardTitle>
        <CardDescription>
          Production server connection status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Production Server Status */}
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div>
            <div className="font-medium">Production Server</div>
            <div className="text-sm text-muted-foreground">
              5.35.83.143:14700
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Remote server accessible over internet
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={serverStatus ? "default" : "destructive"}>
              {serverStatus ? "🟢 Online" : "🔴 Offline"}
            </Badge>
          </div>
        </div>

        {/* Status Check Button */}
        <div className="pt-2">
          <button
            onClick={checkServerStatus}
            disabled={isChecking}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isChecking ? 'Checking...' : 'Check Server Status'}
          </button>
        </div>

        {/* Connection Info */}
        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          Connected to: <strong>Production Server (5.35.83.143:14700)</strong>
        </div>
      </CardContent>
    </Card>
  );
};

export default ServerSelector;
