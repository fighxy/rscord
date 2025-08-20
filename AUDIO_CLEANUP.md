# Cleaning up RSCORD Audio Architecture

## 🎯 Decision: LiveKit Only Approach

After analysis, we've decided to remove the native Opus/WebRTC implementation and focus entirely on LiveKit for the following reasons:

### ✅ Why LiveKit is Sufficient:

1. **Complete Audio Solution**
   - Built-in Opus codec with optimizations
   - WebRTC with all modern features
   - DTX, FEC, adaptive bitrate
   - Up to 510kbps stereo audio quality

2. **Production Grade**
   - Zoom-level optimizations
   - Auto-scaling to thousands of users
   - Built-in simulcast and congestion control
   - 99.99% uptime on LiveKit Cloud

3. **Developer Experience**
   - Well-documented APIs
   - Active development and support
   - Consistent cross-platform behavior
   - No need to manage low-level audio

4. **Feature Completeness**
   - Voice channels ✅
   - Video calls ✅
   - Screen sharing ✅
   - Recording ✅
   - AI integration ✅

### ❌ Problems with Dual System:

1. **Unnecessary Complexity**
   - Two audio systems to maintain
   - Potential device conflicts
   - Mode switching complexity

2. **Limited Benefits**
   - LiveKit already provides low latency
   - Audio effects can be done with Web Audio API
   - No significant performance gains

3. **Development Overhead**
   - More code to test and debug
   - Larger bundle size
   - More potential failure points

## 🧹 Cleanup Plan

### Files to Remove:
```
apps/desktop/src-tauri/src/audio/              # Entire native audio module
apps/desktop/src-tauri/src/commands/audio.rs   # Tauri audio commands
apps/desktop/src/lib/audio/audioManager.ts     # Native audio manager
apps/desktop/src/lib/audio/webrtc.ts          # Custom WebRTC implementation
apps/desktop/src/lib/audio/audioCoordinator.ts # Mode coordinator
apps/desktop/src/components/AudioTestComponent.tsx # Test component
```

### Dependencies to Remove from Cargo.toml:
```toml
audiopus = "0.3"
cpal = "0.15" 
hound = "3.5"
ringbuf = "0.4"
```

### Keep and Enhance:
```
LiveKit integration (already working)
Voice channel UI components
Device selection (LiveKit handles this)
Audio/video controls
```

## 🎯 Simplified Architecture

```
RSCORD Audio System (LiveKit Only)
├── LiveKit Server (Docker)
├── LiveKit Client SDK (Frontend)
├── Voice Channel Components
├── Device Management (LiveKit)
└── Audio Effects (Web Audio API)
```

### Benefits:
- ✅ Single source of truth for audio
- ✅ Production-proven stability  
- ✅ Simpler codebase
- ✅ Better maintainability
- ✅ Focus on LiveKit optimizations

## 🚀 Next Steps

1. **Remove native audio code**
2. **Enhance LiveKit integration** 
3. **Add Web Audio API effects**
4. **Optimize LiveKit configuration**
5. **Focus on UI/UX improvements**

This decision simplifies the project significantly while maintaining all required functionality.