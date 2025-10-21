import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Search, Video, User, LayoutGrid, Map, Columns2 } from 'lucide-react';
import { useAuth } from '@/state/useAuth';
import { useCameras } from '@/state/useCameras';
import { useLayoutPrefs } from '@/state/useLayoutPrefs';
import { useWs } from '@/state/useWs';
import { WsClient } from '@/lib/wsClient';
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
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { api } from '@/lib/api';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const {
    cameras,
    selectedCameraIds,
    setCameras,
    addCamera,
    updateCamera,
    deleteCamera,
    setSelectedCameraIds,
    updateCameraStatus,
  } = useCameras();
  const { loadPreferences, splitRatio, setSplitRatio } = useLayoutPrefs();
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

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await api.cameras.getAll();
        if (!mounted) return;
        setCameras(response.data);
        setSelectedCameraIds(response.data.slice(0, 4).map(c => c.id));
      } catch (e) {
        console.error('Failed to load cameras from API:', e);
      }
    })();
    return () => { mounted = false; };
  }, [setCameras, setSelectedCameraIds]);

  // WebSocket connection
  useEffect(() => {
    const ws = new WsClient((import.meta as any).env.VITE_WS_URL);
    const off = ws.on((event) => {
      if (event.type === 'camera_status') {
        updateCameraStatus(event.id, event.status, event.lastSeen);
        if (event.status === 'OFFLINE') {
          const camera = cameras.find((c) => c.id === event.id);
          if (camera) showCameraOfflineNotification(camera.name, camera.id);
        }
      } else if (event.type === 'camera_not_found') {
        showCameraNotFoundNotification(event.id);
      } else if (event.type === 'motion_detected') {
        const camera = cameras.find((c) => c.id === event.id);
        if (camera) toast.info('Motion Detected', { description: `Motion detected at ${camera.name}` });
      }
    });

    ws.connect((connected) => setConnected(connected));
    return () => { off(); ws.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setConnected, updateCameraStatus, cameras]);

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

  const handleLogout = async () => {
    try {
      toast.loading('Logging out...');
      await logout();
      toast.dismiss();
      toast.success('Logged out successfully');
      navigate('/login');
    } catch (error) {
      toast.dismiss();
      toast.error('Logout failed, but cleared local session');
      navigate('/login');
    }
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
      {/* Top bar - PENTING: tambahkan z-index tinggi dan relative */}
      <header className="relative z-50 h-16 border-b border-border bg-card/50 backdrop-blur flex items-center justify-between px-6">
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

          {/* User Dropdown Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <User className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled className="cursor-default">
                <User className="h-4 w-4 mr-2" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{user?.username || 'User'}</span>
                  <span className="text-xs text-muted-foreground">{user?.email || 'user@example.com'}</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem disabled className="cursor-default">
                <span className="text-xs text-muted-foreground">Role: {user?.role || 'N/A'}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden relative z-10">
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
      <footer className="relative z-40 h-12 border-t border-border bg-card/50 backdrop-blur flex items-center justify-between px-6">
        <WsIndicator />
        
        {/* Layout mode buttons */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={splitRatio === 100 ? 'default' : 'ghost'}
            onClick={() => setSplitRatio(100)}
          >
            <LayoutGrid className="h-4 w-4 mr-2" />
            Grid Only
          </Button>
          <Button
            size="sm"
            variant={splitRatio === 50 ? 'default' : 'ghost'}
            onClick={() => setSplitRatio(50)}
          >
            <Columns2 className="h-4 w-4 mr-2" />
            50:50
          </Button>
          <Button
            size="sm"
            variant={splitRatio === 0 ? 'default' : 'ghost'}
            onClick={() => setSplitRatio(0)}
          >
            <Map className="h-4 w-4 mr-2" />
            Map Only
          </Button>
        </div>
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