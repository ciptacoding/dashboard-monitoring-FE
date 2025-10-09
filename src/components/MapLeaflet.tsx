import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Icon, LatLngExpression, DivIcon } from 'leaflet';
import { Camera } from '@/types/camera';
import { HlsPlayer } from '@/lib/hlsPlayer';
import { renderToString } from 'react-dom/server';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER: LatLngExpression = [-0.973351, 116.708536];

// Custom camera pin icon
const createCameraIcon = (status: Camera['status']) => {
  const iconHtml = renderToString(
    <div className={`cam-pin ${status.toLowerCase()}`} />
  );

  return new DivIcon({
    html: iconHtml,
    className: '',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
};

interface MapLeafletProps {
  cameras: Camera[];
  focusedCameraId?: string;
  onEditCamera: (camera: Camera) => void;
  onShowInGrid: (camera: Camera) => void;
}

const MapController = ({
  cameras,
  focusedCameraId,
}: {
  cameras: Camera[];
  focusedCameraId?: string;
}) => {
  const map = useMap();

  useEffect(() => {
    if (focusedCameraId) {
      const camera = cameras.find((c) => c.id === focusedCameraId);
      if (camera) {
        map.flyTo([camera.latitude, camera.longitude], 16, {
          duration: 1,
        });
      }
    }
  }, [focusedCameraId, cameras, map]);

  useEffect(() => {
    if (cameras.length > 0) {
      const bounds = cameras.map((c) => [c.latitude, c.longitude] as [number, number]);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [cameras, map]);

  return null;
};

const CameraPopup = ({ camera, onEdit, onShowInGrid }: {
  camera: Camera;
  onEdit: (camera: Camera) => void;
  onShowInGrid: (camera: Camera) => void;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HlsPlayer | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      playerRef.current = new HlsPlayer(videoRef.current);
      playerRef.current.load(camera.streamUrlHls);
    }

    return () => {
      playerRef.current?.destroy();
    };
  }, [camera.streamUrlHls]);

  return (
    <div className="w-80">
      <div className="mb-2">
        <h3 className="font-semibold text-base">{camera.name}</h3>
        <div className="flex items-center gap-2 mt-1">
          <div className={`status-dot ${camera.status.toLowerCase()}`} />
          <span className="text-sm text-muted-foreground">
            {camera.status}
          </span>
        </div>
      </div>

      <div className="video-container h-48 mb-3 rounded-lg overflow-hidden">
        <video ref={videoRef} className="w-full h-full" muted playsInline />
      </div>

      <div className="space-y-1 text-sm mb-3">
        {camera.building && (
          <div>
            <span className="text-muted-foreground">Building:</span>{' '}
            {camera.building}
          </div>
        )}
        {camera.zone && (
          <div>
            <span className="text-muted-foreground">Zone:</span> {camera.zone}
          </div>
        )}
        {camera.lastSeen && (
          <div>
            <span className="text-muted-foreground">Last seen:</span>{' '}
            {new Date(camera.lastSeen).toLocaleString()}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onShowInGrid(camera)}
          className="flex-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
        >
          Show in Grid
        </button>
        <button
          onClick={() => onEdit(camera)}
          className="flex-1 px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded hover:bg-secondary/80"
        >
          Edit
        </button>
      </div>
    </div>
  );
};

export const MapLeaflet = ({
  cameras,
  focusedCameraId,
  onEditCamera,
  onShowInGrid,
}: MapLeafletProps) => {
  return (
    <div className="h-full w-full">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={13}
        className="h-full w-full"
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController cameras={cameras} focusedCameraId={focusedCameraId} />

        {cameras.map((camera) => (
          <Marker
            key={camera.id}
            position={[camera.latitude, camera.longitude]}
            icon={createCameraIcon(camera.status)}
          >
            <Popup maxWidth={400}>
              <CameraPopup
                camera={camera}
                onEdit={onEditCamera}
                onShowInGrid={onShowInGrid}
              />
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};
