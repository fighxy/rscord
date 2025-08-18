        </div>
      </div>

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

      {/* Enhanced Voice Room Dialog */}
      <Dialog open={isVoiceDialogOpen} onOpenChange={setIsVoiceDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[95vh] p-0" hideCloseButton>
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
                vadSettings={joinData.vadSettings || vadSettings}
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
        <Alert className="mt-4" variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
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
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default EnhancedVoiceManager;
