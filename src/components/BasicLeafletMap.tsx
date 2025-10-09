import { useEffect, useRef } from 'react';
import L, { Map as LeafletMap, Marker as LeafletMarker } from 'leaflet';
import { Camera } from '@/types/camera';
import { renderToString } from 'react-dom/server';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER: [number, number] = [-0.973351, 116.708536];

const createCameraIcon = (status: Camera['status']) =>
  L.divIcon({
    html: renderToString(<div className={`cam-pin ${status.toLowerCase()}`} />),
    className: '',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

interface BasicLeafletMapProps {
  cameras: Camera[];
  focusedCameraId?: string;
  onEditCamera: (camera: Camera) => void;
  onShowInGrid: (camera: Camera) => void;
}

export const BasicLeafletMap = ({ cameras, focusedCameraId, onEditCamera, onShowInGrid }: BasicLeafletMapProps) => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Record<string, LeafletMarker>>({});

  // Initialize map once
  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;

    const map = L.map(mapRef.current, {
      center: DEFAULT_CENTER,
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    leafletMapRef.current = map;

    return () => {
      map.remove();
      leafletMapRef.current = null;
    };
  }, []);

  // Sync markers
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    // Remove markers not present anymore
    Object.keys(markersRef.current).forEach((id) => {
      if (!cameras.find((c) => c.id === id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    // Add/update markers
    cameras.forEach((camera) => {
      const existing = markersRef.current[camera.id];
      if (existing) {
        existing.setLatLng([camera.latitude, camera.longitude]);
        existing.setIcon(createCameraIcon(camera.status));
      } else {
        const marker = L.marker([camera.latitude, camera.longitude], {
          icon: createCameraIcon(camera.status),
        });

        marker.bindPopup(() => {
          const div = L.DomUtil.create('div', 'w-72');
          div.innerHTML = `
            <div class="mb-2">
              <h3 class="font-semibold text-base">${camera.name}</h3>
              <div class="flex items-center gap-2 mt-1">
                <span class="status-dot ${camera.status.toLowerCase()}"></span>
                <span class="text-sm text-muted-foreground">${camera.status}</span>
              </div>
            </div>
            <div class="space-y-1 text-sm mb-3">
              ${camera.building ? `<div><span class="text-muted-foreground">Building:</span> ${camera.building}</div>` : ''}
              ${camera.zone ? `<div><span class="text-muted-foreground">Zone:</span> ${camera.zone}</div>` : ''}
            </div>
            <div class="flex gap-2">
              <button id="show-${camera.id}" class="flex-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded">Show in Grid</button>
              <button id="edit-${camera.id}" class="flex-1 px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded">Edit</button>
            </div>
          `;
          setTimeout(() => {
            const showBtn = div.querySelector(`#show-${camera.id}`) as HTMLButtonElement | null;
            const editBtn = div.querySelector(`#edit-${camera.id}`) as HTMLButtonElement | null;
            showBtn?.addEventListener('click', () => onShowInGrid(camera));
            editBtn?.addEventListener('click', () => onEditCamera(camera));
          }, 0);
          return div;
        });

        marker.addTo(map);
        markersRef.current[camera.id] = marker;
      }
    });

    // Fit bounds initially
    if (cameras.length > 0) {
      const bounds = L.latLngBounds(cameras.map((c) => [c.latitude, c.longitude]) as [number, number][]);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [cameras, onEditCamera, onShowInGrid]);

  // Focus camera
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map || !focusedCameraId) return;
    const cam = cameras.find((c) => c.id === focusedCameraId);
    if (cam) map.flyTo([cam.latitude, cam.longitude], 16, { duration: 1 });
  }, [focusedCameraId, cameras]);

  return <div ref={mapRef} className="h-full w-full" />;
};
