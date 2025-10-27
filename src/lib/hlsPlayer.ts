// src/lib/hlsPlayer.ts - Enhanced with Auto-Recovery

import Hls from 'hls.js';

export class HlsPlayer {
  private hls: Hls | null = null;
  private video: HTMLVideoElement;
  private lastUpdateTime: number = 0;
  private freezeCheckInterval: NodeJS.Timeout | null = null;
  private recoveryAttempts: number = 0;
  private maxRecoveryAttempts: number = 3;
  private isRecovering: boolean = false;
  private url: string = '';

  // Callbacks
  public onFreeze?: () => void;
  public onRecover?: () => void;
  public onError?: (error: string) => void;

  constructor(video: HTMLVideoElement) {
    this.video = video;
  }

  public load(url: string): void {
    this.url = url;
    this.cleanup();
    this.recoveryAttempts = 0;

    if (Hls.isSupported()) {
      this.loadHLS(url);
    } else if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      this.loadNative(url);
    } else {
      console.error('HLS is not supported in this browser');
      this.onError?.('HLS not supported');
    }

    // Start freeze detection
    this.startFreezeDetection();
  }

  private loadHLS(url: string): void {
    this.hls = new Hls({
      // ✅ Enhanced HLS.js configuration for stability
      enableWorker: true,
      lowLatencyMode: false,
      backBufferLength: 90,
      
      // Manifest loading
      manifestLoadingTimeOut: 10000,
      manifestLoadingMaxRetry: 3,
      manifestLoadingRetryDelay: 1000,
      
      // Level loading
      levelLoadingTimeOut: 10000,
      levelLoadingMaxRetry: 4,
      levelLoadingRetryDelay: 1000,
      
      // Fragment loading
      fragLoadingTimeOut: 20000,
      fragLoadingMaxRetry: 6,
      fragLoadingRetryDelay: 1000,
      
      // Optimizations
      maxBufferLength: 30,
      maxBufferSize: 60 * 1000 * 1000, // 60MB
      maxMaxBufferLength: 600,
      
      // Live streaming settings
      liveSyncDurationCount: 3,
      liveMaxLatencyDurationCount: 10,
      
      // Error recovery
      startFragPrefetch: true,
      testBandwidth: true,
    });

    this.hls.attachMedia(this.video);

    // ✅ Event listeners for better error handling
    this.hls.on(Hls.Events.MEDIA_ATTACHED, () => {
      console.log('✓ HLS: Media attached');
      this.hls!.loadSource(url);
    });

    this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
      console.log('✓ HLS: Manifest parsed, starting playback');
      this.video.play().catch(err => {
        console.warn('Auto-play prevented:', err);
      });
    });

    this.hls.on(Hls.Events.ERROR, (event, data) => {
      this.handleHLSError(event, data);
    });

    // ✅ Track buffer events
    this.hls.on(Hls.Events.BUFFER_APPENDING, () => {
      this.lastUpdateTime = Date.now();
    });

    this.hls.on(Hls.Events.FRAG_LOADED, () => {
      this.lastUpdateTime = Date.now();
      this.recoveryAttempts = 0; // Reset on success
    });
  }

  private loadNative(url: string): void {
    this.video.src = url;
    this.video.addEventListener('loadedmetadata', () => {
      this.video.play().catch(err => {
        console.warn('Auto-play prevented:', err);
      });
    });

    this.video.addEventListener('error', () => {
      this.handleVideoError();
    });

    this.video.addEventListener('timeupdate', () => {
      this.lastUpdateTime = Date.now();
    });
  }

  // ✅ NEW: Freeze Detection System
  private startFreezeDetection(): void {
    this.stopFreezeDetection(); // Clear any existing interval

    this.lastUpdateTime = Date.now();

    this.freezeCheckInterval = setInterval(() => {
      this.checkForFreeze();
    }, 3000); // Check every 3 seconds
  }

  private stopFreezeDetection(): void {
    if (this.freezeCheckInterval) {
      clearInterval(this.freezeCheckInterval);
      this.freezeCheckInterval = null;
    }
  }

  // ✅ NEW: Smart Freeze Detection
  private checkForFreeze(): void {
    if (this.isRecovering) return;

    const now = Date.now();
    const timeSinceLastUpdate = now - this.lastUpdateTime;
    
    // Check if video is supposed to be playing
    const isPlaying = !this.video.paused && 
                      !this.video.ended && 
                      this.video.readyState > 2;

    // ✅ Detect freeze: No updates for 8+ seconds while "playing"
    if (isPlaying && timeSinceLastUpdate > 8000) {
      console.warn('⚠️ Stream freeze detected! Time since last update:', timeSinceLastUpdate, 'ms');
      this.onFreeze?.();
      this.attemptRecovery();
    }

    // ✅ Check for stalled state
    if (this.video.readyState === 1 || this.video.readyState === 2) {
      // HAVE_METADATA or HAVE_CURRENT_DATA (stalled)
      if (timeSinceLastUpdate > 10000) {
        console.warn('⚠️ Video stalled detected!');
        this.attemptRecovery();
      }
    }
  }

  // ✅ NEW: Auto-Recovery System
  private attemptRecovery(): void {
    if (this.isRecovering) return;
    if (this.recoveryAttempts >= this.maxRecoveryAttempts) {
      console.error('❌ Max recovery attempts reached');
      this.onError?.('Stream recovery failed after multiple attempts');
      return;
    }

    this.isRecovering = true;
    this.recoveryAttempts++;

    console.log(`🔄 Attempting recovery (${this.recoveryAttempts}/${this.maxRecoveryAttempts})...`);

    // Strategy based on attempt number
    if (this.recoveryAttempts === 1) {
      // First attempt: Soft reload (just reload source)
      this.softReload();
    } else if (this.recoveryAttempts === 2) {
      // Second attempt: Hard reload (recreate HLS instance)
      this.hardReload();
    } else {
      // Third attempt: Full reset (clear video and reload)
      this.fullReset();
    }

    // Reset recovery flag after delay
    setTimeout(() => {
      this.isRecovering = false;
    }, 5000);
  }

  // ✅ NEW: Soft Reload (lightest recovery)
  private softReload(): void {
    console.log('🔄 Soft reload: Reloading source...');
    
    if (this.hls) {
      this.hls.stopLoad();
      this.hls.startLoad();
      this.lastUpdateTime = Date.now();
    } else {
      // Native HLS
      const currentTime = this.video.currentTime;
      this.video.load();
      this.video.currentTime = currentTime;
      this.video.play().catch(console.warn);
    }
  }

  // ✅ NEW: Hard Reload (recreate HLS)
  private hardReload(): void {
    console.log('🔄 Hard reload: Recreating HLS instance...');
    
    const wasPlaying = !this.video.paused;
    
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    
    // Small delay before recreating
    setTimeout(() => {
      this.loadHLS(this.url);
      if (wasPlaying) {
        this.video.play().catch(console.warn);
      }
      this.onRecover?.();
    }, 500);
  }

  // ✅ NEW: Full Reset (nuclear option)
  private fullReset(): void {
    console.log('🔄 Full reset: Complete video reset...');
    
    // Save state
    const wasPlaying = !this.video.paused;
    
    // Complete cleanup
    this.cleanup();
    
    // Clear video
    this.video.src = '';
    this.video.load();
    
    // Wait a bit then reload
    setTimeout(() => {
      this.load(this.url);
      if (wasPlaying) {
        setTimeout(() => {
          this.video.play().catch(console.warn);
        }, 1000);
      }
      this.onRecover?.();
    }, 1000);
  }

  // ✅ Enhanced Error Handling
  private handleHLSError(event: string, data: any): void {
    console.error('HLS Error:', data);

    if (data.fatal) {
      switch (data.type) {
        case Hls.ErrorTypes.NETWORK_ERROR:
          console.error('❌ Fatal network error');
          this.attemptRecovery();
          break;

        case Hls.ErrorTypes.MEDIA_ERROR:
          console.error('❌ Fatal media error');
          if (this.hls) {
            this.hls.recoverMediaError();
          }
          setTimeout(() => {
            if (this.hls && data.fatal) {
              this.attemptRecovery();
            }
          }, 2000);
          break;

        default:
          console.error('❌ Fatal error, cannot recover');
          this.onError?.('Fatal stream error');
          this.destroy();
          break;
      }
    }
  }

  private handleVideoError(): void {
    console.error('❌ Video element error');
    this.attemptRecovery();
  }

  // ✅ Enhanced cleanup
  private cleanup(): void {
    this.stopFreezeDetection();
    
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
  }

  public destroy(): void {
    this.cleanup();
    this.video.src = '';
    this.video.load();
  }

  // ✅ Public methods for manual control
  public forceReload(): void {
    console.log('🔄 Manual reload requested');
    this.recoveryAttempts = 0;
    this.hardReload();
  }

  public getStats(): { recoveryAttempts: number; lastUpdateTime: number; isRecovering: boolean } {
    return {
      recoveryAttempts: this.recoveryAttempts,
      lastUpdateTime: this.lastUpdateTime,
      isRecovering: this.isRecovering,
    };
  }
}