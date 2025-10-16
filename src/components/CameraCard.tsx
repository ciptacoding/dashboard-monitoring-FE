import { useEffect, useRef, useState } from 'react';
import { Play, MoreVertical } from 'lucide-react';
import { Camera } from '@/types/camera';
import { HlsPlayer } from '@/lib/hlsPlayer';
import { Button } from '@/components/ui/button';
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
}

export const CameraCard = ({
  camera,
  autoPlay,
  onEdit,
  onDelete,
  onFocusOnMap,
}: CameraCardProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HlsPlayer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlayButton, setShowPlayButton] = useState(!autoPlay);

  useEffect(() => {
    if (!videoRef.current || !camera.hls_url) return;

    if (autoPlay) {
      playerRef.current = new HlsPlayer(videoRef.current);
      playerRef.current.load(camera.hls_url);
      setIsPlaying(true);
      setShowPlayButton(false);
    }

    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [camera.hls_url, autoPlay]);

  const handlePlay = () => {
    if (!videoRef.current || playerRef.current || !camera.hls_url) return;

    playerRef.current = new HlsPlayer(videoRef.current);
    playerRef.current.load(camera.hls_url);
    setIsPlaying(true);
    setShowPlayButton(false);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="grid-cell group">
          <div className="absolute top-2 left-2 right-2 z-10 flex items-center justify-between">
            <div className="flex items-center gap-2 bg-card/80 backdrop-blur px-2 py-1 rounded">
              <div className={`status-dot ${camera.status.toLowerCase()}`} />
              <span className="text-xs font-medium">{camera.name}</span>
            </div>
          </div>

          <div className="video-container">
            {camera.snapshot_url && !isPlaying && (
              <img
                src={camera.snapshot_url}
                alt={camera.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}

            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              muted
              playsInline
            />

            {showPlayButton && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Button
                  size="lg"
                  className="rounded-full w-16 h-16"
                  onClick={handlePlay}
                >
                  <Play className="h-8 w-8" />
                </Button>
              </div>
            )}
          </div>

          {camera.status === 'OFFLINE' && (
            <div className="absolute inset-0 flex items-center justify-center bg-destructive/20">
              <span className="text-sm font-medium text-destructive">OFFLINE</span>
            </div>
          )}
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent>
        <ContextMenuItem onClick={() => onFocusOnMap(camera)}>
          Open in Map
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onEdit(camera)}>
          Edit Camera
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onDelete(camera)}>
          Delete Camera
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
