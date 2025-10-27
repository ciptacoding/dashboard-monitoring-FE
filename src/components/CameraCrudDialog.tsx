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
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface CameraCrudDialogProps {
  open: boolean;
  camera?: Camera;
  onClose: () => void;
  onSave: (camera: Camera) => void;
  onDelete?: (id: string) => void;
}

interface FormData {
  name: string;
  description: string;
  rtsp_url: string;
  latitude: number;
  longitude: number;
  building: string;
  zone: string;
  model: string;
  status: CameraStatus;
}

export const CameraCrudDialog = ({
  open,
  camera,
  onClose,
  onSave,
  onDelete,
}: CameraCrudDialogProps) => {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    rtsp_url: '',
    latitude: -0.966523,
    longitude: 116.720768,
    building: '',
    zone: '',
    model: 'PTZ Camera',
    status: 'UNKNOWN',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (camera) {
      setFormData({
        name: camera.name,
        description: camera.description || '',
        rtsp_url: camera.rtsp_url,
        latitude: camera.latitude,
        longitude: camera.longitude,
        building: camera.building || '',
        zone: camera.zone || '',
        model: camera.model || 'PTZ Camera',
        status: camera.status,
      });
    } else {
      // Reset form untuk create mode
      setFormData({
        name: '',
        description: '',
        rtsp_url: '',
        latitude: -0.966523,
        longitude: 116.720768,
        building: '',
        zone: '',
        model: 'PTZ Camera',
        status: 'UNKNOWN',
      });
    }
    setErrors({});
  }, [camera, open]);

  // Parse RTSP URL untuk extract IP dan Port
  const parseRTSPUrl = (url: string): { ip: string; port: number } => {
    try {
      // Format: rtsp://username:password@IP:PORT/path
      const match = url.match(/rtsp:\/\/[^@]+@([^:]+):(\d+)/);
      if (match) {
        return {
          ip: match[1],
          port: parseInt(match[2], 10),
        };
      }
    } catch (e) {
      console.error('Failed to parse RTSP URL:', e);
    }
    return { ip: '', port: 554 };
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name || formData.name.trim().length < 3) {
      newErrors.name = 'Name must be at least 3 characters';
    }

    if (!formData.rtsp_url || !formData.rtsp_url.startsWith('rtsp://')) {
      newErrors.rtsp_url = 'Valid RTSP URL is required (e.g., rtsp://user:pass@ip:port/path)';
    }

    if (formData.latitude < -90 || formData.latitude > 90) {
      newErrors.latitude = 'Latitude must be between -90 and 90';
    }

    if (formData.longitude < -180 || formData.longitude > 180) {
      newErrors.longitude = 'Longitude must be between -180 and 180';
    }

    if (!formData.building || formData.building.trim().length === 0) {
      newErrors.building = 'Building is required';
    }

    if (!formData.zone || formData.zone.trim().length === 0) {
      newErrors.zone = 'Zone is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      toast.error('Please fix validation errors');
      return;
    }

    setLoading(true);

    try {
      // Parse RTSP URL untuk get IP dan Port
      const { ip, port } = parseRTSPUrl(formData.rtsp_url);

      // Prepare payload dengan static values
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        rtsp_url: formData.rtsp_url.trim(),
        latitude: formData.latitude,
        longitude: formData.longitude,
        building: formData.building.trim(),
        zone: formData.zone.trim(),
        model: formData.model.trim(),
        status: formData.status,
        // Static values
        ip_address: ip,
        port: port,
        manufacturer: 'Hikvision',
        resolution: '1920x1080',
        fps: 25,
        tags: ['rest-area', 'indoor', 'ptz', 'metro-e', 'pln'],
      };

      let savedCamera: Camera;

      if (camera) {
        // UPDATE existing camera
        savedCamera = await api.cameras.update(camera.id, payload);
        toast.success('Camera updated successfully');
      } else {
        // CREATE new camera
        savedCamera = await api.cameras.create(payload);
        toast.success('Camera created successfully');
      }

      onSave(savedCamera);
      onClose();
    } catch (error: any) {
      console.error('Failed to save camera:', error);
      toast.error(error.message || 'Failed to save camera');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!camera || !onDelete) return;

    if (confirm(`Are you sure you want to delete "${camera.name}"?`)) {
      setLoading(true);
      try {
        await api.cameras.delete(camera.id);
        onDelete(camera.id);
        toast.success('Camera deleted successfully');
        onClose();
      } catch (error: any) {
        console.error('Failed to delete camera:', error);
        toast.error(error.message || 'Failed to delete camera');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {camera ? 'Edit Camera' : 'Add New Camera'}
          </DialogTitle>
          <DialogDescription>
            {camera
              ? 'Update camera details below'
              : 'Fill in the camera information. IP, Port, and Tags will be set automatically.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Camera Name */}
          <div className="grid gap-2">
            <Label htmlFor="name">
              Camera Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="D9 - Rest Area 4 Indoor PTZ"
              disabled={loading}
            />
            {errors.name && (
              <span className="text-sm text-destructive">{errors.name}</span>
            )}
          </div>

          {/* Description */}
          <div className="grid gap-2">
            <Label htmlFor="description">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Kamera PTZ indoor di Rest Area 4, Area Persil Rest Area"
              rows={3}
              disabled={loading}
            />
          </div>

          {/* RTSP URL */}
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
              placeholder="rtsp://admin:hik12345@36.91.27.35:554/Streaming/channels/901"
              disabled={loading}
            />
            {errors.rtsp_url && (
              <span className="text-sm text-destructive">{errors.rtsp_url}</span>
            )}
            <span className="text-xs text-muted-foreground">
              IP Address and Port will be extracted automatically from RTSP URL
            </span>
          </div>

          {/* Location Grid */}
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
                disabled={loading}
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
                disabled={loading}
              />
              {errors.longitude && (
                <span className="text-sm text-destructive">{errors.longitude}</span>
              )}
            </div>
          </div>

          {/* Building & Zone */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="building">
                Building <span className="text-destructive">*</span>
              </Label>
              <Input
                id="building"
                value={formData.building}
                onChange={(e) =>
                  setFormData({ ...formData, building: e.target.value })
                }
                placeholder="Rest Area 4"
                disabled={loading}
              />
              {errors.building && (
                <span className="text-sm text-destructive">{errors.building}</span>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="zone">
                Zone <span className="text-destructive">*</span>
              </Label>
              <Input
                id="zone"
                value={formData.zone}
                onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                placeholder="Rest Area"
                disabled={loading}
              />
              {errors.zone && (
                <span className="text-sm text-destructive">{errors.zone}</span>
              )}
            </div>
          </div>

          {/* Model & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="model">Camera Model</Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                placeholder="PTZ Camera"
                disabled={loading}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="status">
                Status <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value as CameraStatus })
                }
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="READY">Online (Ready)</SelectItem>
                  <SelectItem value="OFFLINE">Offline</SelectItem>
                  <SelectItem value="ERROR">Error</SelectItem>
                  <SelectItem value="UNKNOWN">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Info Box */}
          <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm">
            <p className="font-medium mb-2">Automatic Settings:</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• <strong>Manufacturer:</strong> Hikvision</li>
              <li>• <strong>Resolution:</strong> 1920x1080</li>
              <li>• <strong>FPS:</strong> 25</li>
              <li>• <strong>Tags:</strong> rest-area, indoor, ptz, metro-e, pln</li>
              <li>• <strong>IP & Port:</strong> Extracted from RTSP URL</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2">
          {camera && onDelete && (
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={loading}
            >
              Delete
            </Button>
          )}
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Camera'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};