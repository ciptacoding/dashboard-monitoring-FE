import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Search, Video, User } from 'lucide-react';
import { useAuth } from '@/state/useAuth';
import { useCameras } from '@/state/useCameras';
import { useLayoutPrefs } from '@/state/useLayoutPrefs';
import { useWs } from '@/state/useWs';
import { createMockWsClient } from '@/lib/wsClient';
import {
  requestNotificationPermission,
  registerServiceWorker,
  showCameraOfflineNotification,
  showCameraNotFoundNotification,
} from '@/lib/notifications';
import { Camera } from '@/types/camera';
import { CameraGrid } from '@/components/CameraGrid';
import { BasicLeafletMap } from '@/components/BasicLeafletMap';
import { SplitPane } from '@/components/SplitPane';
import { WsIndicator } from '@/components/WsIndicator';
import { CameraCrudDialog } from '@/components/CameraCrudDialog';
import { CameraPicker } from '@/components/CameraPicker';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const {
    cameras,
    selectedCameraIds,
    addCamera,
    updateCamera,
    deleteCamera,
    setSelectedCameraIds,
    updateCameraStatus,
  } = useCameras();
  const { loadPreferences } = useLayoutPrefs();
  const { setConnected } = useWs();

  const [search, setSearch] = useState('');
  const [crudDialogOpen, setCrudDialogOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingCamera, setEditingCamera] = useState<Camera | undefined>();
  const [focusedCameraId, setFocusedCameraId] = useState<string | undefined>();

  // Initialize
  useEffect(() => {
    loadPreferences();
    registerServiceWorker();
    requestNotificationPermission();
  }, [loadPreferences]);

  // WebSocket connection
  useEffect(() => {
    const mockWs = createMockWsClient(
      (connected) => setConnected(connected),
      (event) => {
        if (event.type === 'camera_status') {
          updateCameraStatus(event.id, event.status, event.lastSeen);
          
          if (event.status === 'OFFLINE') {
            const camera = cameras.find((c) => c.id === event.id);
            if (camera) {
              showCameraOfflineNotification(camera.name, camera.id);
            }
          }
        } else if (event.type === 'camera_not_found') {
          showCameraNotFoundNotification(event.id);
        } else if (event.type === 'motion_detected') {
          const camera = cameras.find((c) => c.id === event.id);
          if (camera) {
            toast.info('Motion Detected', {
              description: `Motion detected at ${camera.name}`,
            });
          }
        }
      }
    );

    return () => {
      mockWs.disconnect();
    };
  }, [cameras, setConnected, updateCameraStatus]);

  // Focus camera from notification
  useEffect(() => {
    const handleFocusCamera = (event: CustomEvent) => {
      setFocusedCameraId(event.detail.cameraId);
    };

    window.addEventListener('focusCamera', handleFocusCamera as EventListener);
    return () => {
      window.removeEventListener('focusCamera', handleFocusCamera as EventListener);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleAddCamera = () => {
    setEditingCamera(undefined);
    setCrudDialogOpen(true);
  };

  const handleEditCamera = (camera: Camera) => {
    setEditingCamera(camera);
    setCrudDialogOpen(true);
  };

  const handleSaveCamera = (camera: Omit<Camera, 'id'> | Camera) => {
    if ('id' in camera) {
      updateCamera(camera.id, camera);
    } else {
      addCamera({ ...camera, id: Date.now().toString() } as Camera);
    }
  };

  const handleDeleteCamera = (id: string) => {
    deleteCamera(id);
  };

  const handleFocusCameraOnMap = (camera: Camera) => {
    setFocusedCameraId(camera.id);
  };

  const filteredCameras = search
    ? cameras.filter(
        (cam) =>
          cam.name.toLowerCase().includes(search.toLowerCase()) ||
          cam.building?.toLowerCase().includes(search.toLowerCase()) ||
          cam.zone?.toLowerCase().includes(search.toLowerCase())
      )
    : cameras;

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
      <header className="h-16 border-b border-border bg-card/50 backdrop-blur flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Video className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold">CCTV Dashboard</h1>
            <p className="text-xs text-muted-foreground">
              Monitoring System
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cameras..."
              className="pl-9"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <User className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled>
                {user?.email || 'Admin'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        <SplitPane
          leftPane={
            <CameraGrid
              cameras={filteredCameras}
              selectedCameraIds={selectedCameraIds}
              onAddCamera={handleAddCamera}
              onSelectCameras={() => setPickerOpen(true)}
              onEditCamera={handleEditCamera}
              onDeleteCamera={(cam) => handleDeleteCamera(cam.id)}
              onFocusCameraOnMap={handleFocusCameraOnMap}
            />
          }
          rightPane={
            <BasicLeafletMap
              cameras={filteredCameras}
              focusedCameraId={focusedCameraId}
              onEditCamera={handleEditCamera}
              onShowInGrid={(cam) => {
                if (!selectedCameraIds.includes(cam.id)) {
                  setSelectedCameraIds([...selectedCameraIds, cam.id]);
                }
                toast.success(`${cam.name} added to grid`);
              }}
            />
          }
        />
      </main>

      {/* Status bar */}
      <footer className="h-12 border-t border-border bg-card/50 backdrop-blur flex items-center px-6">
        <WsIndicator />
      </footer>

      {/* Dialogs */}
      <CameraCrudDialog
        open={crudDialogOpen}
        camera={editingCamera}
        onClose={() => {
          setCrudDialogOpen(false);
          setEditingCamera(undefined);
        }}
        onSave={handleSaveCamera}
        onDelete={handleDeleteCamera}
      />

      <CameraPicker
        open={pickerOpen}
        cameras={cameras}
        selectedIds={selectedCameraIds}
        onClose={() => setPickerOpen(false)}
        onSave={setSelectedCameraIds}
      />
    </div>
  );
}
