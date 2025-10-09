import { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import type { LatLngExpression, DivIcon } from 'leaflet';
import { Camera } from '@/types/camera';
import { renderToString } from 'react-dom/server';
import { DivIcon as LeafletDivIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER: LatLngExpression = [-0.973351, 116.708536];

const createCameraIcon = (status: Camera['status']): DivIcon => {
  const iconHtml = renderToString(
    <div className={`cam-pin ${status.toLowerCase()}`} />
  );
  return new LeafletDivIcon({ html: iconHtml, className: '', iconSize: [16, 16], iconAnchor: [8, 8] });
};

interface MapLeafletProps {
  cameras: Camera[];
  focusedCameraId?: string;
  onEditCamera: (camera: Camera) => void;
  onShowInGrid: (camera: Camera) => void;
}

export const MapLeaflet = ({ cameras, onEditCamera, onShowInGrid }: MapLeafletProps) => {
  const markers = useMemo(() => (
    cameras.map((camera) => (
      <Marker
        key={camera.id}
        position={[camera.latitude, camera.longitude]}
        icon={createCameraIcon(camera.status)}
      >
        <Popup maxWidth={400}>
          <div className="w-64">
            <h3 className="font-semibold text-base">{camera.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <div className={`status-dot ${camera.status.toLowerCase()}`} />
              <span className="text-sm text-muted-foreground">{camera.status}</span>
            </div>
            <div className="space-y-1 text-sm my-2">
              {camera.building && (
                <div>
                  <span className="text-muted-foreground">Building:</span> {camera.building}
                </div>
              )}
              {camera.zone && (
                <div>
                  <span className="text-muted-foreground">Zone:</span> {camera.zone}
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
                onClick={() => onEditCamera(camera)}
                className="flex-1 px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded hover:bg-secondary/80"
              >
                Edit
              </button>
            </div>
          </div>
        </Popup>
      </Marker>
    ))
  ), [cameras, onEditCamera, onShowInGrid]);

  return (
    <div className="h-full w-full">
      <MapContainer center={DEFAULT_CENTER} zoom={13} className="h-full w-full" zoomControl>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers}
      </MapContainer>
    </div>
  );
};
