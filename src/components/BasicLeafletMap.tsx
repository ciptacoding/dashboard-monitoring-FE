import { useEffect, useRef } from 'react';
import L, { Map as LeafletMap, Marker as LeafletMarker } from 'leaflet';
import { Camera } from '@/types/camera';
import { api } from '@/lib/api';
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
          
          // Get status label and description
          const getStatusLabel = (status: string) => {
            switch (status) {
              case 'READY': return 'Ready';
              case 'ONLINE': return 'Online';
              case 'OFFLINE': return 'Offline';
              case 'ERROR': return 'Error';
              case 'UNKNOWN': return 'Unknown';
              default: return status;
            }
          };
          
          const getStatusDescription = (status: string) => {
            switch (status) {
              case 'READY': return 'Kamera siap dan streaming aktif';
              case 'ONLINE': return 'Kamera online dan berfungsi normal';
              case 'OFFLINE': return 'Kamera offline atau tidak terhubung';
              case 'ERROR': return 'Kamera mengalami error';
              case 'UNKNOWN': return 'Status kamera tidak diketahui';
              default: return 'Status tidak valid';
            }
          };
          
          const statusLabel = getStatusLabel(camera.status);
          const statusDescription = getStatusDescription(camera.status);
          const statusMessage = camera.status_message || statusDescription;
          const lastSeen = camera.last_seen 
            ? new Date(camera.last_seen).toLocaleString('id-ID', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : 'Tidak diketahui';
          
          div.innerHTML = `
            <div class="mb-3">
              <h3 class="font-semibold text-base mb-2">${camera.name}</h3>
              <div class="space-y-2">
                <div class="flex items-center gap-2">
                  <span class="status-dot ${camera.status.toLowerCase()}"></span>
                  <div class="flex-1">
                    <div class="text-sm font-medium">${statusLabel}</div>
                    <div class="text-xs text-muted-foreground">${statusMessage}</div>
                  </div>
                </div>
                ${camera.last_seen ? `
                  <div class="text-xs text-muted-foreground">
                    <span class="font-medium">Terakhir terlihat:</span> ${lastSeen}
                  </div>
                ` : ''}
              </div>
            </div>
            <div class="space-y-1 text-sm mb-3 pt-2 border-t border-border">
              ${camera.building ? `<div><span class="text-muted-foreground font-medium">Building:</span> <span class="text-foreground">${camera.building}</span></div>` : ''}
              ${camera.zone ? `<div><span class="text-muted-foreground font-medium">Zone:</span> <span class="text-foreground">${camera.zone}</span></div>` : ''}
              ${camera.description ? `<div class="mt-2 text-xs text-muted-foreground">${camera.description}</div>` : ''}
            </div>
            <div class="flex gap-2">
              <button id="show-${camera.id}" class="flex-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors">Show in Grid</button>
              <button id="edit-${camera.id}" class="flex-1 px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 transition-colors">Edit</button>
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
