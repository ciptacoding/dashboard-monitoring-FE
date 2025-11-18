import { useMemo } from 'react';
import { Camera } from '@/types/camera';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CameraStatusSummaryProps {
  cameras: Camera[];
}

const getStatusLabel = (status: Camera['status']): string => {
  switch (status) {
    case 'READY':
      return 'Ready';
    case 'ONLINE':
      return 'Online';
    case 'OFFLINE':
      return 'Offline';
    case 'ERROR':
      return 'Error';
    case 'FROZEN':
      return 'Frozen';
    case 'UNKNOWN':
      return 'Unknown';
    default:
      return status;
  }
};

const getStatusDescription = (status: Camera['status']): string => {
  switch (status) {
    case 'READY':
      return 'Kamera siap dan streaming aktif';
    case 'ONLINE':
      return 'Kamera online dan berfungsi normal';
    case 'OFFLINE':
      return 'Kamera offline atau tidak terhubung';
    case 'ERROR':
      return 'Kamera mengalami error';
    case 'UNKNOWN':
      return 'Status kamera tidak diketahui';
    default:
      return 'Status tidak valid';
  }
};

export const CameraStatusSummary = ({ cameras }: CameraStatusSummaryProps) => {
  const statusCounts = useMemo(() => {
    const counts = {
      READY: 0,
      ONLINE: 0,
      OFFLINE: 0,
      ERROR: 0,
      FROZEN: 0,
      UNKNOWN: 0,
    };

    cameras.forEach((camera) => {
      if (camera.status in counts) {
        counts[camera.status as keyof typeof counts]++;
      }
    });

    return counts;
  }, [cameras]);

  const totalCameras = cameras.length;
  const activeCameras = statusCounts.READY + statusCounts.ONLINE;
  const inactiveCameras = statusCounts.OFFLINE + statusCounts.ERROR + statusCounts.FROZEN + statusCounts.UNKNOWN;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-4 text-sm">
        {/* Total Cameras */}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Total:</span>
          <Badge variant="outline" className="font-semibold">
            {totalCameras}
          </Badge>
        </div>

        {/* Status Breakdown */}
        <div className="flex items-center gap-3">
          {/* READY Status */}
          {statusCounts.READY > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 cursor-help">
                  <div className="status-dot ready" />
                  <span className="text-muted-foreground">
                    {statusCounts.READY} {getStatusLabel('READY')}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">{getStatusLabel('READY')}</p>
                <p className="text-xs text-muted-foreground">{getStatusDescription('READY')}</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* ONLINE Status */}
          {statusCounts.ONLINE > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 cursor-help">
                  <div className="status-dot online" />
                  <span className="text-muted-foreground">
                    {statusCounts.ONLINE} {getStatusLabel('ONLINE')}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">{getStatusLabel('ONLINE')}</p>
                <p className="text-xs text-muted-foreground">{getStatusDescription('ONLINE')}</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* OFFLINE Status */}
          {statusCounts.OFFLINE > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 cursor-help">
                  <div className="status-dot offline" />
                  <span className="text-muted-foreground">
                    {statusCounts.OFFLINE} {getStatusLabel('OFFLINE')}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">{getStatusLabel('OFFLINE')}</p>
                <p className="text-xs text-muted-foreground">{getStatusDescription('OFFLINE')}</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* ERROR Status */}
          {statusCounts.ERROR > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 cursor-help">
                  <div className="status-dot error" />
                  <span className="text-muted-foreground">
                    {statusCounts.ERROR} {getStatusLabel('ERROR')}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">{getStatusLabel('ERROR')}</p>
                <p className="text-xs text-muted-foreground">{getStatusDescription('ERROR')}</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* FROZEN Status */}
          {statusCounts.FROZEN > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 cursor-help">
                  <div className="status-dot frozen" />
                  <span className="text-muted-foreground">
                    {statusCounts.FROZEN} {getStatusLabel('FROZEN')}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">{getStatusLabel('FROZEN')}</p>
                <p className="text-xs text-muted-foreground">{getStatusDescription('FROZEN')}</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* UNKNOWN Status */}
          {statusCounts.UNKNOWN > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 cursor-help">
                  <div className="status-dot unknown" />
                  <span className="text-muted-foreground">
                    {statusCounts.UNKNOWN} {getStatusLabel('UNKNOWN')}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">{getStatusLabel('UNKNOWN')}</p>
                <p className="text-xs text-muted-foreground">{getStatusDescription('UNKNOWN')}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Summary Badge */}
        <div className="flex items-center gap-2 pl-3 border-l border-border">
          <Badge
            variant={activeCameras === totalCameras ? 'default' : 'secondary'}
            className="font-semibold"
          >
            {activeCameras}/{totalCameras} Active
          </Badge>
        </div>
      </div>
    </TooltipProvider>
  );
};

