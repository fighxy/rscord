  vadSettings: VoiceActivationSettings;
}> = ({ vadSettings }) => {
  const { localParticipant } = useLocalParticipant();
  const [isMuted, setIsMuted] = useState(true);
  const [isDeafened, setIsDeafened] = useState(false);
  const [vadEnabled, setVadEnabled] = useState(vadSettings.enabled);
  const [isPushToTalk, setIsPushToTalk] = useState(false);
  const [pttKey, setPttKey] = useState('Space');

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
    // Implement deafen logic by muting all remote tracks
    toast.success(isDeafened ? 'Audio enabled' : 'Audio deafened');
  };

  const toggleVAD = () => {
    setVadEnabled(!vadEnabled);
    toast.success(vadEnabled ? 'VAD disabled' : 'VAD enabled');
  };

  const togglePushToTalk = () => {
    setIsPushToTalk(!isPushToTalk);
    if (!isPushToTalk) {
      // When enabling PTT, ensure user is muted initially
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
              <CardTitle>Voice Settings</CardTitle>
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
                      threshold: -50,
                      gateThreshold: -70,
                      attackTime: 5,
                      releaseTime: 50,
                    })}
                  >
                    Sensitive
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onVadSettingsChange(DEFAULT_VAD_SETTINGS)}
                  >
                    Normal
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onVadSettingsChange({
                      ...vadSettings,
                      threshold: -35,
                      gateThreshold: -50,
                      attackTime: 20,
                      releaseTime: 200,
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
