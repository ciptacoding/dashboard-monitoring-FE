import { useEffect, useState } from 'react';
import { Camera, CameraStatus } from '@/types/camera';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface CameraCrudDialogProps {
  open: boolean;
  camera?: Camera;
  onClose: () => void;
  onSave: (camera: Omit<Camera, 'id'> | Camera) => void;
  onDelete?: (id: string) => void;
}

export const CameraCrudDialog = ({
  open,
  camera,
  onClose,
  onSave,
  onDelete,
}: CameraCrudDialogProps) => {
  const [formData, setFormData] = useState<Partial<Camera>>({
    name: '',
    rtsp_url: '',
    description: '',
    latitude: -0.973351,
    longitude: 116.708536,
    building: '',
    zone: '',
    tags: [],
    status: 'UNKNOWN',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (camera) {
      setFormData(camera);
    } else {
      setFormData({
        name: '',
        rtsp_url: '',
        description: '',
        latitude: -0.973351,
        longitude: 116.708536,
        building: '',
        zone: '',
        tags: [],
        status: 'UNKNOWN',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    setErrors({});
  }, [camera, open]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name || formData.name.length < 3) {
      newErrors.name = 'Name must be at least 3 characters';
    }

    if (
      formData.latitude === undefined ||
      formData.latitude < -90 ||
      formData.latitude > 90
    ) {
      newErrors.latitude = 'Latitude must be between -90 and 90';
    }

    if (
      formData.longitude === undefined ||
      formData.longitude < -180 ||
      formData.longitude > 180
    ) {
      newErrors.longitude = 'Longitude must be between -180 and 180';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) {
      return;
    }

    if (camera) {
      onSave({ ...camera, ...formData, updated_at: new Date().toISOString() } as Camera);
      toast.success('Camera updated successfully');
    } else {
      onSave({ 
        ...formData, 
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: true,
        status: 'UNKNOWN'
      } as Omit<Camera, 'id'>);
      toast.success('Camera created successfully');
    }

    onClose();
  };

  const handleDelete = () => {
    if (camera && onDelete) {
      if (confirm(`Are you sure you want to delete ${camera.name}?`)) {
        onDelete(camera.id);
        toast.success('Camera deleted successfully');
        onClose();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{camera ? 'Edit Camera' : 'Add New Camera'}</DialogTitle>
          <DialogDescription>
            {camera
              ? 'Update camera details below'
              : 'Fill in the camera information'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">
              Camera Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Main Entrance"
            />
            {errors.name && (
              <span className="text-sm text-destructive">{errors.name}</span>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Camera description"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="rtspUrl">
              RTSP URL <span className="text-destructive">*</span>
            </Label>
            <Input
              id="rtspUrl"
              value={formData.rtsp_url}
              onChange={(e) =>
                setFormData({ ...formData, rtsp_url: e.target.value })
              }
              placeholder="rtsp://username:password@camera-ip:554/stream"
            />
            {errors.rtsp_url && (
              <span className="text-sm text-destructive">{errors.rtsp_url}</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="latitude">
                Latitude <span className="text-destructive">*</span>
              </Label>
              <Input
                id="latitude"
                type="number"
                step="0.000001"
                value={formData.latitude}
                onChange={(e) =>
                  setFormData({ ...formData, latitude: parseFloat(e.target.value) })
                }
              />
              {errors.latitude && (
                <span className="text-sm text-destructive">{errors.latitude}</span>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="longitude">
                Longitude <span className="text-destructive">*</span>
              </Label>
              <Input
                id="longitude"
                type="number"
                step="0.000001"
                value={formData.longitude}
                onChange={(e) =>
                  setFormData({ ...formData, longitude: parseFloat(e.target.value) })
                }
              />
              {errors.longitude && (
                <span className="text-sm text-destructive">{errors.longitude}</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="building">Building</Label>
              <Input
                id="building"
                value={formData.building}
                onChange={(e) =>
                  setFormData({ ...formData, building: e.target.value })
                }
                placeholder="Building A"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="zone">Zone</Label>
              <Input
                id="zone"
                value={formData.zone}
                onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                placeholder="Entrance"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) =>
                setFormData({ ...formData, status: value as CameraStatus })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="READY">Ready</SelectItem>
                <SelectItem value="OFFLINE">Offline</SelectItem>
                <SelectItem value="ERROR">Error</SelectItem>
                <SelectItem value="UNKNOWN">Unknown</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              value={formData.tags?.join(', ')}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  tags: e.target.value.split(',').map((t) => t.trim()),
                })
              }
              placeholder="entrance, outdoor"
            />
          </div>
        </div>

        <DialogFooter>
          {camera && onDelete && (
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
