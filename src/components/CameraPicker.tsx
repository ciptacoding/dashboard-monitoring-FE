import { useState, useMemo, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Camera } from '@/types/camera';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CameraPickerProps {
  open: boolean;
  cameras: Camera[];
  selectedIds: string[];
  onClose: () => void;
  onSave: (ids: string[]) => void;
}

export const CameraPicker = ({
  open,
  cameras,
  selectedIds,
  onClose,
  onSave,
}: CameraPickerProps) => {
  const [search, setSearch] = useState('');
  const [tempSelected, setTempSelected] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'READY' | 'OFFLINE' | 'UNKNOWN'>('ALL');

  // Reset state when sheet opens
  useEffect(() => {
    if (open && cameras.length > 0) {
      console.log('=== CAMERA PICKER DEBUG ===');
      console.log('Total cameras:', cameras.length);
      console.log('First camera:', cameras[0]);
      console.log('Camera keys:', Object.keys(cameras[0]));
      
      // Check each field
      const cam = cameras[0];
      console.log('name:', typeof cam.name, cam.name);
      console.log('building:', typeof cam.building, cam.building);
      console.log('zone:', typeof cam.zone, cam.zone);
      console.log('status:', typeof cam.status, cam.status);
      console.log('tags:', Array.isArray(cam.tags), cam.tags);
      console.log('created_at:', typeof cam.created_at, cam.created_at);
      console.log('updated_at:', typeof cam.updated_at, cam.updated_at);
  
      setTempSelected(new Set(selectedIds));
      setSearch('');
      setStatusFilter('ALL');
    }
  }, [open, selectedIds]);

  const filteredCameras = useMemo(() => {
    return cameras.filter((cam) => {
      const matchesSearch =
        cam.name.toLowerCase().includes(search.toLowerCase()) ||
        (cam.building && cam.building.toLowerCase().includes(search.toLowerCase())) ||
        (cam.zone && cam.zone.toLowerCase().includes(search.toLowerCase())) ||
        (cam.tags && cam.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase())));

      const matchesStatus =
        statusFilter === 'ALL' || cam.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [cameras, search, statusFilter]);

  const handleToggle = (id: string) => {
    const newSelected = new Set(tempSelected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setTempSelected(newSelected);
  };

  const handleSave = () => {
    onSave(Array.from(tempSelected));
    onClose();
  };

  const handleSelectAll = () => {
    setTempSelected(new Set(filteredCameras.map((c) => c.id)));
  };

  const handleClearAll = () => {
    setTempSelected(new Set());
  };

  // Count cameras by status
  const statusCounts = useMemo(() => {
    return {
      all: cameras.length,
      ready: cameras.filter(c => c.status === 'READY').length,
      offline: cameras.filter(c => c.status === 'OFFLINE').length,
    };
  }, [cameras]);

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[500px] sm:max-w-[500px]">
        <SheetHeader>
          <SheetTitle>Select Cameras</SheetTitle>
          <SheetDescription>
            Choose which cameras to display in the grid
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cameras..."
              className="pl-9"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 hover:bg-accent rounded p-1"
                type="button"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <Badge
              variant={statusFilter === 'ALL' ? 'default' : 'outline'}
              className="cursor-pointer hover:bg-primary/90"
              onClick={() => setStatusFilter('ALL')}
            >
              All ({statusCounts.all})
            </Badge>
            <Badge
              variant={statusFilter === 'READY' ? 'default' : 'outline'}
              className="cursor-pointer hover:bg-primary/90"
              onClick={() => setStatusFilter('READY')}
            >
              Ready ({statusCounts.ready})
            </Badge>
            <Badge
              variant={statusFilter === 'OFFLINE' ? 'default' : 'outline'}
              className="cursor-pointer hover:bg-primary/90"
              onClick={() => setStatusFilter('OFFLINE')}
            >
              Offline ({statusCounts.offline})
            </Badge>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={handleClearAll}>
              Clear All
            </Button>
            <div className="flex-1" />
            <span className="text-sm text-muted-foreground">
              {tempSelected.size} selected
            </span>
          </div>

          {/* Camera List */}
          <ScrollArea className="h-[calc(100vh-380px)]">
            <div className="space-y-2 pr-4">
              {filteredCameras.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    {cameras.length === 0 
                      ? 'No cameras available. Add a camera first.' 
                      : 'No cameras match your search or filter.'}
                  </p>
                </div>
              ) : (
                filteredCameras.map((camera) => (
                  <div
                    key={camera.id}
                    className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => handleToggle(camera.id)}
                  >
                    <Checkbox
                      checked={tempSelected.has(camera.id)}
                      onCheckedChange={() => handleToggle(camera.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className={`status-dot ${camera.status.toLowerCase()}`} />
                        <h4 className="font-medium text-sm truncate">{camera.name}</h4>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {camera.building && <span>{camera.building}</span>}
                        {camera.building && camera.zone && <span> • </span>}
                        {camera.zone && <span>{camera.zone}</span>}
                        {!camera.building && !camera.zone && <span>No location</span>}
                      </div>
                      {camera.tags && Array.isArray(camera.tags) && camera.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {camera.tags.slice(0, 3).map((tag, index) => (
                            <Badge key={`${camera.id}-tag-${index}`} variant="secondary" className="text-xs">
                              {String(tag)}
                            </Badge>
                          ))}
                          {camera.tags.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{camera.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="flex gap-2 pt-4 border-t border-border">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSave} className="flex-1">
              Apply Selection ({tempSelected.size})
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};