import { useState, useMemo } from 'react';
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
  const [tempSelected, setTempSelected] = useState<Set<string>>(
    new Set(selectedIds)
  );
  const [statusFilter, setStatusFilter] = useState<Camera['status'] | 'ALL'>('ALL');

  const filteredCameras = useMemo(() => {
    return cameras.filter((cam) => {
      const matchesSearch =
        cam.name.toLowerCase().includes(search.toLowerCase()) ||
        cam.building?.toLowerCase().includes(search.toLowerCase()) ||
        cam.zone?.toLowerCase().includes(search.toLowerCase()) ||
        cam.tags?.some((tag) => tag.toLowerCase().includes(search.toLowerCase()));

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
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <Badge
              variant={statusFilter === 'ALL' ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setStatusFilter('ALL')}
            >
              All
            </Badge>
            <Badge
              variant={statusFilter === 'READY' ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setStatusFilter('READY')}
            >
              Ready
            </Badge>
            <Badge
              variant={statusFilter === 'OFFLINE' ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setStatusFilter('OFFLINE')}
            >
              Offline
            </Badge>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={handleClearAll}>
              Clear All
            </Button>
            <div className="flex-1" />
            <span className="text-sm text-muted-foreground self-center">
              {tempSelected.size} selected
            </span>
          </div>

          {/* Camera List */}
          <ScrollArea className="h-[calc(100vh-340px)]">
            <div className="space-y-2">
              {filteredCameras.map((camera) => (
                <div
                  key={camera.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 cursor-pointer"
                  onClick={() => handleToggle(camera.id)}
                >
                  <Checkbox
                    checked={tempSelected.has(camera.id)}
                    onCheckedChange={() => handleToggle(camera.id)}
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
                    </div>
                    {camera.tags && camera.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {camera.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {filteredCameras.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No cameras found
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="flex gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSave} className="flex-1">
              Apply Selection
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
