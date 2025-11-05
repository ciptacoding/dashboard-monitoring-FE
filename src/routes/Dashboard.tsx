import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Search, Video, User, LayoutGrid, Map, Columns2 } from 'lucide-react';
import { useAuth } from '@/state/useAuth';
import { useCameras } from '@/state/useCameras';
import { useLayoutPrefs } from '@/state/useLayoutPrefs';
import { useWs } from '@/state/useWs';
import { WsClient, WSEvent, CameraStatusEvent, StreamUpdateEvent } from '@/lib/wsClient';
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
    refreshCameraStream,
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
      const allCameras: Camera[] = [];
      const pageSize = 50; // atau 25, 10, tergantung API limit
      let currentPage = 1;
      let hasMore = true;

      // Loop untuk mengambil semua kamera sampai total 50
      while (hasMore && allCameras.length < 50) {
        const response = await api.cameras.getAll({
          page: currentPage,
          page_size: pageSize
        });
        
        if (!mounted) return;

        allCameras.push(...response.data);
        
        // Cek apakah masih ada data berikutnya
        hasMore = response.data.length === pageSize && allCameras.length < 50;
        currentPage++;
      }

      // Ambil maksimal 50 kamera
      const cameras = allCameras.slice(0, 50);
      setCameras(cameras);
      setSelectedCameraIds(cameras.slice(0, 4).map(c => c.id));
      
    } catch (e) {
      console.error('Failed to load cameras from API:', e);
    }
  })();

  return () => { mounted = false; };
}, [setCameras, setSelectedCameraIds]);

  // WebSocket connection with enhanced event handling
  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws';
    console.log('Connecting to WebSocket:', wsUrl);
    
    const ws = new WsClient(wsUrl);
    
    const unsubscribe = ws.on((event: WSEvent) => {
      console.log('📨 Received WebSocket event:', event.type);
      
      switch (event.type) {
        case 'connected':
          console.log('✅ WebSocket connected:', event.data);
          toast.success('Connected', {
            description: 'Real-time monitoring active',
          });
          break;

        case 'camera_status': {
          const statusData = event.data as CameraStatusEvent;
          console.log('📹 Camera status update:', statusData);
          
          updateCameraStatus(statusData.id, statusData.status, statusData.last_seen);
          
          // Show notification if camera goes offline
          if (statusData.status === 'OFFLINE') {
            const camera = cameras.find((c) => c.id === statusData.id);
            if (camera) {
              showCameraOfflineNotification(camera.name, camera.id);
              
              toast.error('Camera Offline', {
                description: `${camera.name} is offline`,
              });
            }
          }
          
          // Show notification if camera comes back online
          if (statusData.status === 'ONLINE') {
            const camera = cameras.find((c) => c.id === statusData.id);
            if (camera) {
              toast.success('Camera Online', {
                description: `${camera.name} is back online`,
              });
            }
          }
          break;
        }

        case 'stream_update': {
          const streamData = event.data as StreamUpdateEvent;
          console.log('🎥 Stream update:', streamData);
          
          const camera = cameras.find((c) => c.id === streamData.id);
          if (!camera) break;

          switch (streamData.status) {
            case 'frozen':
              toast.warning('Stream Frozen', {
                description: `${streamData.name}: ${streamData.message}`,
                duration: 5000,
              });
              
              // Auto-refresh frozen stream
              console.log('🔄 Auto-refreshing frozen stream:', streamData.name);
              refreshCameraStream(streamData.id);
              break;

            case 'offline':
              toast.error('Camera Offline', {
                description: `${streamData.name}: ${streamData.message}`,
                duration: 5000,
              });
              break;

            case 'online':
              toast.success('Camera Online', {
                description: `${streamData.name}: ${streamData.message}`,
              });
              break;

            case 'restarted':
              toast.success('Stream Restarted', {
                description: `${streamData.name}: ${streamData.message}`,
              });
              
              // Force refresh the camera in UI
              setTimeout(() => {
                // Trigger a re-render by updating the camera
                updateCamera(streamData.id, { 
                  status: 'ONLINE',
                  last_seen: new Date().toISOString(),
                });
              }, 1000);
              break;

            case 'restart_failed':
              toast.error('Restart Failed', {
                description: `${streamData.name}: ${streamData.message}`,
                duration: 8000,
              });
              break;
          }
          break;
        }

        case 'pong':
          // Heartbeat response - no action needed
          break;

        case 'error':
          console.error('WebSocket error event:', event.data);
          toast.error('Connection Error', {
            description: 'WebSocket connection issue',
          });
          break;
      }
    });

    ws.connect((connected) => {
      console.log('WebSocket connection status:', connected);
      setConnected(connected);
      
      if (!connected) {
        toast.error('Disconnected', {
          description: 'Real-time monitoring inactive. Reconnecting...',
        });
      }
    });

    return () => {
      unsubscribe();
      ws.disconnect();
    };
  }, [setConnected, updateCameraStatus, cameras, updateCamera, refreshCameraStream]);

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
      {/* Top bar */}
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