import { Wifi, WifiOff } from 'lucide-react';
import { useWs } from '@/state/useWs';
import { useCameras } from '@/state/useCameras';

export const WsIndicator = () => {
  const { connected } = useWs();
  const { cameras } = useCameras();

  const onlineCount = cameras.filter((c) => c.status === 'READY').length;
  const offlineCount = cameras.filter((c) => c.status === 'OFFLINE').length;

  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-2">
        {connected ? (
          <>
            <Wifi className="h-4 w-4 text-status-online" />
            <span className="text-muted-foreground">Connected</span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4 text-status-offline" />
            <span className="text-muted-foreground">Disconnected</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="status-dot online" />
          <span className="text-muted-foreground">{onlineCount} Online</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="status-dot offline" />
          <span className="text-muted-foreground">{offlineCount} Offline</span>
        </div>
      </div>
    </div>
  );
};
