// src/components/CameraCard.tsx - With Auto-Recovery and Lazy Loading

import { useEffect, useRef, useState } from 'react';
import { Play, MoreVertical, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Camera } from '@/types/camera';
import { HlsPlayer } from '@/lib/hlsPlayer';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

interface CameraCardProps {
  camera: Camera;
  autoPlay: boolean;
  onEdit: (camera: Camera) => void;
  onDelete: (camera: Camera) => void;
  onFocusOnMap: (camera: Camera) => void;
  onStatusChange?: (cameraId: string, status: Camera['status']) => void;
}

export const CameraCard = ({
  camera,
  autoPlay,
  onEdit,
  onDelete,
  onFocusOnMap,
  onStatusChange,
}: CameraCardProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HlsPlayer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlayButton, setShowPlayButton] = useState(!autoPlay);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryCount, setRecoveryCount] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const startStream = (url: string) => {
    if (!videoRef.current) return;

    setIsLoading(true);
    setHasError(false);

    try {
      // Create enhanced player with callbacks
      playerRef.current = new HlsPlayer(videoRef.current);

      // ✅ Setup recovery callbacks
      playerRef.current.onFreeze = () => {
        console.log('🔔 Stream frozen, auto-recovering...');
        setIsRecovering(true);
        setRecoveryCount(prev => prev + 1);
      };

      playerRef.current.onRecover = () => {
        console.log('✅ Stream recovered!');
        setIsRecovering(false);
        setIsLoading(false);
      };

      playerRef.current.onError = (error: string) => {
        console.error('❌ Stream error:', error);
        setHasError(true);
        setIsLoading(false);
        setIsRecovering(false);
        
        // If error indicates timeout or fatal error, mark camera as offline
        if (error.includes('timeout') || error.includes('offline') || error.includes('fatal')) {
          console.log('🔴 Marking camera as OFFLINE due to stream error:', error);
          
          // Determine error type for reporting
          let errorType: 'timeout' | 'hls_error' | 'network_error' | 'decode_error' | 'other' = 'other';
          if (error.includes('timeout')) {
            errorType = 'timeout';
          } else if (error.includes('HLS') || error.includes('hls')) {
            errorType = 'hls_error';
          } else if (error.includes('network') || error.includes('Network')) {
            errorType = 'network_error';
          } else if (error.includes('decode') || error.includes('media')) {
            errorType = 'decode_error';
          }
          
          // Report error to backend
          api.cameras.reportStreamError(camera.id, errorType, error)
            .then(() => {
              console.log('✅ Stream error reported to backend');
            })
            .catch((err) => {
              console.error('Failed to report stream error:', err);
            });
          
          // Update camera status to OFFLINE
          onStatusChange?.(camera.id, 'OFFLINE');
        }
      };

      // Load the stream
      playerRef.current.load(url);
      setIsPlaying(true);

      // ✅ Video event listeners
      const video = videoRef.current;

      const handleCanPlay = () => {
        setIsLoading(false);
        setIsRecovering(false);
      };

      const handlePlaying = () => {
        setIsLoading(false);
        setIsRecovering(false);
      };

      const handleWaiting = () => {
        console.log('⏳ Video waiting for data...');
      };

      const handleStalled = () => {
        console.log('⚠️ Video stalled');
      };

      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('playing', handlePlaying);
      video.addEventListener('waiting', handleWaiting);
      video.addEventListener('stalled', handleStalled);

      // Timeout fallback - if loading takes too long, mark as offline
      const timeout = setTimeout(() => {
        if (isLoading) {
          console.warn('⏱️ Loading timeout after 15 seconds, marking as offline');
          setHasError(true);
          setIsLoading(false);
          setIsRecovering(false);
          
          // Report timeout error to backend
          api.cameras.reportStreamError(camera.id, 'timeout', 'HLS stream loading timeout after 15 seconds')
            .then(() => {
              console.log('✅ Timeout error reported to backend');
            })
            .catch((err) => {
              console.error('Failed to report timeout error:', err);
            });
          
          onStatusChange?.(camera.id, 'OFFLINE');
          playerRef.current?.destroy();
          playerRef.current = null;
        }
      }, 15000);

      return () => {
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('playing', handlePlaying);
        video.removeEventListener('waiting', handleWaiting);
        video.removeEventListener('stalled', handleStalled);
        clearTimeout(timeout);
      };
    } catch (error) {
      console.error('Failed to initialize player:', error);
      setHasError(true);
      setIsLoading(false);
    }
  };

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsVisible(entry.isIntersecting);
        });
      },
      {
        rootMargin: '50px', // Start loading 50px before visible
        threshold: 0.1,
      }
    );

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!camera.hls_url) {
      setHasError(true);
      return;
    }

    // Only start stream if visible and autoPlay is enabled
    if (autoPlay && isVisible) {
      // If player exists and URL changed (e.g., after backend restart), reload
      if (playerRef.current) {
        const currentUrl = playerRef.current.getCurrentUrl();
        if (currentUrl && currentUrl !== camera.hls_url) {
          console.log('🔄 HLS URL changed, reloading stream...', {
            old: currentUrl,
            new: camera.hls_url,
          });
          playerRef.current.destroy();
          playerRef.current = null;
        }
      }
      
      // Start or restart stream
      const cleanup = startStream(camera.hls_url);
      setShowPlayButton(false);

      return () => {
        cleanup?.();
        playerRef.current?.destroy();
        playerRef.current = null;
      };
    } else if (autoPlay && !isVisible && playerRef.current) {
      // Stop stream if not visible to save resources
      playerRef.current.destroy();
      playerRef.current = null;
      setIsPlaying(false);
      setShowPlayButton(true);
    }

    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [camera.hls_url, autoPlay, isVisible]);

  const handlePlay = () => {
    if (!videoRef.current || playerRef.current || !camera.hls_url) return;
    startStream(camera.hls_url);
    setShowPlayButton(false);
  };

  const handleManualReload = () => {
    if (!camera.hls_url) return;

    console.log('🔄 Manual reload triggered');
    setHasError(false);
    setRecoveryCount(0);

    // Cleanup old player
    playerRef.current?.destroy();
    playerRef.current = null;

    // Restart stream
    startStream(camera.hls_url);
  };

  const getStatusLabel = (status: Camera['status']): string => {
    switch (status) {
      case 'READY': return 'Ready';
      case 'ONLINE': return 'Online';
      case 'OFFLINE': return 'Offline';
      case 'ERROR': return 'Error';
      case 'UNKNOWN': return 'Unknown';
      default: return status;
    }
  };

  const getStatusDescription = (status: Camera['status']): string => {
    // Use status_message from backend if available, otherwise use default description
    if (camera.status_message) {
      return camera.status_message;
    }
    
    switch (status) {
      case 'READY': return 'Kamera siap dan streaming aktif';
      case 'ONLINE': return 'Kamera online dan berfungsi normal';
      case 'OFFLINE': return 'Kamera offline atau tidak terhubung';
      case 'ERROR': return 'Kamera mengalami error';
      case 'FROZEN': return 'Stream kamera frozen';
      case 'UNKNOWN': return 'Status kamera tidak diketahui';
      default: return 'Status tidak valid';
    }
  };

  return (
    <TooltipProvider>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div ref={containerRef} className="grid-cell group relative">
            {/* Header with recovery indicator */}
            <div className="absolute top-2 left-2 right-2 z-10 flex items-center justify-between">
              <div className="flex items-center gap-2 bg-card/80 backdrop-blur px-2 py-1 rounded">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 cursor-help">
                      <div className={`status-dot ${camera.status.toLowerCase()}`} />
                      <span className="text-xs font-medium">{camera.name}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="font-medium">{getStatusLabel(camera.status)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {getStatusDescription(camera.status)}
                    </p>
                    {camera.last_seen && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Terakhir terlihat: {new Date(camera.last_seen).toLocaleString('id-ID')}
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              
                {/* Recovery indicator */}
                {isRecovering && (
                  <Badge variant="outline" className="text-xs gap-1 animate-pulse">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Recovering
                  </Badge>
                )}
              
                {/* Recovery count (if > 0) */}
                {recoveryCount > 0 && !isRecovering && (
                  <Badge variant="secondary" className="text-xs">
                    ↻ {recoveryCount}
                  </Badge>
                )}
              </div>

              {/* Manual reload button (visible on hover) */}
              <Button
                size="sm"
                variant="ghost"
                className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                onClick={handleManualReload}
                title="Reload stream"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>

          <div className="video-container">
            {/* Snapshot background */}
            {camera.snapshot_url && !isPlaying && (
              <img
                src={camera.snapshot_url}
                alt={camera.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}

            {/* Video element */}
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              muted
              playsInline
            />

            {/* Loading State */}
            {(isLoading || isRecovering) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
                <p className="text-sm text-white font-medium mt-3">
                  {isRecovering ? 'Recovering stream...' : 'Loading stream...'}
                </p>
                {isRecovering && recoveryCount > 0 && (
                  <p className="text-xs text-gray-300 mt-1">
                    Attempt {recoveryCount}/3
                  </p>
                )}
              </div>
            )}

            {/* Error State */}
            {hasError && !isLoading && !isRecovering && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                <AlertCircle className="h-12 w-12 text-destructive" />
                <p className="text-sm text-white font-medium mt-3">Stream Error</p>
                <p className="text-xs text-gray-300 mt-1">Failed to load stream</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleManualReload}
                  className="gap-2 mt-3"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </Button>
              </div>
            )}

            {/* Play Button */}
            {showPlayButton && !isLoading && !hasError && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Button
                  size="lg"
                  className="rounded-full w-16 h-16 shadow-xl hover:scale-110 transition-transform"
                  onClick={handlePlay}
                >
                  <Play className="h-8 w-8" />
                </Button>
              </div>
            )}
          </div>

          {/* Offline Overlay */}
          {camera.status === 'OFFLINE' && !isLoading && !isRecovering && (
            <div className="absolute inset-0 flex items-center justify-center bg-destructive/20 backdrop-blur-sm">
              <div className="text-center">
                <span className="text-sm font-medium text-destructive">OFFLINE</span>
                <p className="text-xs text-destructive/80 mt-1">Camera disconnected</p>
              </div>
            </div>
          )}

          {/* Debug info (only in dev) */}
          {/* {process.env.NODE_ENV === 'development' && playerRef.current && (
            <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
              Recoveries: {playerRef.current.getStats().recoveryAttempts}
            </div>
          )} */}
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent>
        <ContextMenuItem onClick={() => onFocusOnMap(camera)}>
          Open in Map
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onEdit(camera)}>
          Edit Camera
        </ContextMenuItem>
        <ContextMenuItem onClick={handleManualReload}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Reload Stream
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onDelete(camera)}>
          Delete Camera
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
    </TooltipProvider>
  );
};