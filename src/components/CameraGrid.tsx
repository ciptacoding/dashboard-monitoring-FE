import { useMemo } from 'react';
import { Plus, Grid2x2, Settings } from 'lucide-react';
import { Camera, GRID_LAYOUTS } from '@/types/camera';
import { useLayoutPrefs } from '@/state/useLayoutPrefs';
import { CameraCard } from './CameraCard';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface CameraGridProps {
  cameras: Camera[];
  selectedCameraIds: string[];
  onAddCamera: () => void;
  onSelectCameras: () => void;
  onEditCamera: (camera: Camera) => void;
  onDeleteCamera: (camera: Camera) => void;
  onFocusCameraOnMap: (camera: Camera) => void;
}

export const CameraGrid = ({
  cameras,
  selectedCameraIds,
  onAddCamera,
  onSelectCameras,
  onEditCamera,
  onDeleteCamera,
  onFocusCameraOnMap,
}: CameraGridProps) => {
  const { gridLayout, autoPlayPreview, setGridLayout, setAutoPlayPreview } =
    useLayoutPrefs();

  const selectedCameras = useMemo(() => {
    return cameras.filter((cam) => selectedCameraIds.includes(cam.id));
  }, [cameras, selectedCameraIds]);

  const { cols, rows } = GRID_LAYOUTS[gridLayout];
  const totalCells = cols * rows;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 p-4 border-b border-border bg-card/50">
        <div className="flex items-center gap-3">
          <Grid2x2 className="h-5 w-5 text-primary" />
          <span className="font-semibold">Camera Grid</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="auto-play" className="text-sm">
              Auto-play
            </Label>
            <Switch
              id="auto-play"
              checked={autoPlayPreview}
              onCheckedChange={setAutoPlayPreview}
            />
          </div>

          <Select value={gridLayout} onValueChange={(val) => setGridLayout(val as any)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2x2">2×2</SelectItem>
              <SelectItem value="4x4">4×4</SelectItem>
              <SelectItem value="2x4">2×4</SelectItem>
              <SelectItem value="6x4">6×4</SelectItem>
              <SelectItem value="3x6">3×6</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={onSelectCameras}>
            <Settings className="h-4 w-4 mr-2" />
            Select Cameras
          </Button>

          <Button size="sm" onClick={onAddCamera}>
            <Plus className="h-4 w-4 mr-2" />
            Add Camera
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 p-4 overflow-auto">
        <div
          className="grid gap-4 h-full"
          style={{
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gridTemplateRows: `repeat(${rows}, 1fr)`,
          }}
        >
          {Array.from({ length: totalCells }).map((_, index) => {
            const camera = selectedCameras[index];

            if (!camera) {
              return (
                <div
                  key={`empty-${index}`}
                  className="grid-cell flex items-center justify-center opacity-50"
                >
                  <span className="text-sm text-muted-foreground">Empty</span>
                </div>
              );
            }

            return (
              <CameraCard
                key={camera.id}
                camera={camera}
                autoPlay={autoPlayPreview}
                onEdit={onEditCamera}
                onDelete={onDeleteCamera}
                onFocusOnMap={onFocusCameraOnMap}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
