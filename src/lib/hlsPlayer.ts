// src/lib/hlsPlayer.ts - Enhanced with Auto-Recovery

import Hls from 'hls.js';

export class HlsPlayer {
  private hls: Hls | null = null;
  private video: HTMLVideoElement;
  private lastUpdateTime: number = 0;
  private freezeCheckInterval: NodeJS.Timeout | null = null;
  private timeoutId: NodeJS.Timeout | null = null;
  private recoveryAttempts: number = 0;
  private maxRecoveryAttempts: number = 3;
  private isRecovering: boolean = false;
  private url: string = '';
  
  // Enhanced freeze detection tracking
  private lastVideoTime: number | null = null;
  private lastVideoTimeCheck: number | null = null;
  private consecutiveFreezeDetections: number = 0;
  
  // Event listener handlers for cleanup
  private playingHandler?: () => void;
  private timeupdateHandler?: () => void;

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
    this.consecutiveFreezeDetections = 0;
    this.lastVideoTime = null;
    this.lastVideoTimeCheck = null;

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
      this.consecutiveFreezeDetections = 0; // Reset freeze counter
    });

    // Track when video actually plays (not just buffered)
    this.playingHandler = () => {
      this.lastUpdateTime = Date.now();
      this.lastVideoTime = this.video.currentTime;
      this.lastVideoTimeCheck = Date.now();
    };
    this.video.addEventListener('playing', this.playingHandler);

    this.timeupdateHandler = () => {
      // Update tracking on time updates
      if (this.lastVideoTime === null || Math.abs(this.video.currentTime - this.lastVideoTime) > 0.5) {
        this.lastVideoTime = this.video.currentTime;
        this.lastVideoTimeCheck = Date.now();
      }
    };
    this.video.addEventListener('timeupdate', this.timeupdateHandler);
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

    // Timeout detection - if no updates for 30 seconds, mark as offline
    const timeoutDuration = 30000; // 30 seconds

    const resetTimeout = () => {
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
      }
      this.timeoutId = setTimeout(() => {
        const timeSinceLastUpdate = Date.now() - this.lastUpdateTime;
        if (timeSinceLastUpdate > timeoutDuration && !this.isRecovering) {
          console.error('❌ Stream timeout - no updates for 30+ seconds, marking as offline');
          this.onError?.('Stream timeout - camera offline');
          this.destroy();
        }
      }, timeoutDuration);
    };

    resetTimeout();

    this.freezeCheckInterval = setInterval(() => {
      this.checkForFreeze();
      // Reset timeout on each check if stream is active
      if (!this.isRecovering && this.video.readyState > 0) {
        resetTimeout();
      }
    }, 3000); // Check every 3 seconds
  }

  private stopFreezeDetection(): void {
    if (this.freezeCheckInterval) {
      clearInterval(this.freezeCheckInterval);
      this.freezeCheckInterval = null;
    }
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  // ✅ Enhanced: Smart Freeze Detection with multiple strategies
  private checkForFreeze(): void {
    if (this.isRecovering) return;

    const now = Date.now();
    const timeSinceLastUpdate = now - this.lastUpdateTime;
    const currentTime = this.video.currentTime;
    
    // Check if video is supposed to be playing
    const isPlaying = !this.video.paused && 
                      !this.video.ended && 
                      this.video.readyState > 2;

    // Strategy 1: No buffer updates for extended period
    if (isPlaying && timeSinceLastUpdate > 8000) {
      console.warn('⚠️ Stream freeze detected (no buffer updates)! Time since last update:', timeSinceLastUpdate, 'ms');
      this.onFreeze?.();
      this.attemptRecovery();
      return;
    }

    // Strategy 2: Video time not progressing (stuck at same timestamp)
    if (isPlaying && this.video.readyState >= 3) {
      // Store last known time to detect if video is stuck
      if (!this.lastVideoTime) {
        this.lastVideoTime = currentTime;
        this.lastVideoTimeCheck = now;
      } else {
        const timeSinceLastTimeCheck = now - (this.lastVideoTimeCheck || now);
        const timeDifference = Math.abs(currentTime - this.lastVideoTime);
        
        // If video time hasn't changed significantly in 5+ seconds while playing
        if (timeSinceLastTimeCheck > 5000 && timeDifference < 0.1) {
          console.warn('⚠️ Stream freeze detected (video time not progressing)!', {
            currentTime,
            lastVideoTime: this.lastVideoTime,
            timeDifference,
            timeSinceLastTimeCheck,
          });
          this.onFreeze?.();
          this.attemptRecovery();
          return;
        }
        
        // Update if time is progressing
        if (timeDifference > 0.5) {
          this.lastVideoTime = currentTime;
          this.lastVideoTimeCheck = now;
        }
      }
    }

    // Strategy 3: Check for stalled state (buffering but not playing)
    if (this.video.readyState === 1 || this.video.readyState === 2) {
      // HAVE_METADATA or HAVE_CURRENT_DATA (stalled)
      if (timeSinceLastUpdate > 10000) {
        console.warn('⚠️ Video stalled detected (low readyState)!');
        this.attemptRecovery();
        return;
      }
    }

    // Strategy 4: Check buffered ranges (empty buffer while playing)
    if (isPlaying && this.video.buffered.length > 0) {
      const bufferedEnd = this.video.buffered.end(this.video.buffered.length - 1);
      const timeUntilBufferEnd = bufferedEnd - currentTime;
      
      // If buffer is about to run out (< 1 second) and no new data coming
      if (timeUntilBufferEnd < 1 && timeSinceLastUpdate > 5000) {
        console.warn('⚠️ Stream freeze detected (buffer running out)!', {
          currentTime,
          bufferedEnd,
          timeUntilBufferEnd,
          timeSinceLastUpdate,
        });
        this.onFreeze?.();
        this.attemptRecovery();
        return;
      }
    }
  }

  // ✅ Enhanced: Auto-Recovery System with exponential backoff
  private attemptRecovery(): void {
    if (this.isRecovering) return;
    
    this.consecutiveFreezeDetections++;
    
    // If we've detected multiple freezes in quick succession, be more aggressive
    if (this.consecutiveFreezeDetections > 3 && this.recoveryAttempts < this.maxRecoveryAttempts) {
      console.warn(`⚠️ Multiple freezes detected (${this.consecutiveFreezeDetections}), forcing recovery...`);
    }
    
    if (this.recoveryAttempts >= this.maxRecoveryAttempts) {
      console.error('❌ Max recovery attempts reached');
      this.onError?.('Stream recovery failed after multiple attempts');
      return;
    }

    this.isRecovering = true;
    this.recoveryAttempts++;

    // Calculate exponential backoff delay
    const backoffDelay = Math.min(1000 * Math.pow(2, this.recoveryAttempts - 1), 10000);

    console.log(`🔄 Attempting recovery (${this.recoveryAttempts}/${this.maxRecoveryAttempts}) after ${backoffDelay}ms delay...`);

    // Wait with exponential backoff before attempting recovery
    setTimeout(() => {
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
    }, backoffDelay);
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
          // Check if it's a timeout or connection error
          if (data.details === 'manifestLoadTimeOut' || 
              data.details === 'manifestLoadError' ||
              data.details === 'levelLoadTimeOut' ||
              data.details === 'fragLoadTimeOut') {
            console.error('❌ Stream timeout detected - marking as offline');
            this.onError?.('Stream timeout - camera offline');
            this.destroy();
            return;
          }
          this.attemptRecovery();
          break;

        case Hls.ErrorTypes.MEDIA_ERROR:
          console.error('❌ Fatal media error');
          if (this.hls) {
            this.hls.recoverMediaError();
          }
          setTimeout(() => {
            if (this.hls && data.fatal) {
              // If still fatal after recovery attempt, mark as offline
              console.error('❌ Media error recovery failed - marking as offline');
              this.onError?.('Media error - camera offline');
              this.destroy();
            }
          }, 2000);
          break;

        default:
          console.error('❌ Fatal error, cannot recover');
          this.onError?.('Fatal stream error - camera offline');
          this.destroy();
          break;
      }
    } else {
      // Non-fatal errors - log but continue
      console.warn('⚠️ Non-fatal HLS error:', data);
    }
  }

  private handleVideoError(): void {
    console.error('❌ Video element error');
    // Check if video has error code
    const video = this.video;
    if (video.error) {
      const errorCode = video.error.code;
      console.error('Video error code:', errorCode);
      
      // MEDIA_ERR_SRC_NOT_SUPPORTED (4) or MEDIA_ERR_NETWORK (2) = offline
      if (errorCode === 2 || errorCode === 4) {
        console.error('❌ Video source error - marking as offline');
        this.onError?.('Video source error - camera offline');
        this.destroy();
        return;
      }
    }
    
    // Try recovery first
    this.attemptRecovery();
  }

  // ✅ Enhanced cleanup
  private cleanup(): void {
    this.stopFreezeDetection();
    
    // Remove video event listeners
    if (this.playingHandler) {
      this.video.removeEventListener('playing', this.playingHandler);
      this.playingHandler = undefined;
    }
    if (this.timeupdateHandler) {
      this.video.removeEventListener('timeupdate', this.timeupdateHandler);
      this.timeupdateHandler = undefined;
    }
    
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    
    // Reset tracking
    this.lastVideoTime = null;
    this.lastVideoTimeCheck = null;
    this.consecutiveFreezeDetections = 0;
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

  // Get current URL being played
  public getCurrentUrl(): string {
    return this.url;
  }
}