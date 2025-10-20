import { AlertCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface ErrorAlertProps {
  error: {
    message: string;
    code?: string;
  };
  onDismiss?: () => void;
}

export const ErrorAlert = ({ error, onDismiss }: ErrorAlertProps) => {
  const getErrorIcon = () => {
    switch (error.code) {
      case 'INVALID_CREDENTIALS':
        return <XCircle className="h-4 w-4" />;
      case 'USER_INACTIVE':
        return <AlertTriangle className="h-4 w-4" />;
      case 'NETWORK_ERROR':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getErrorTitle = () => {
    switch (error.code) {
      case 'INVALID_CREDENTIALS':
        return 'Login Gagal';
      case 'USER_INACTIVE':
        return 'Akun Tidak Aktif';
      case 'NETWORK_ERROR':
        return 'Koneksi Bermasalah';
      case 'TOKEN_EXPIRED':
        return 'Sesi Berakhir';
      default:
        return 'Terjadi Kesalahan';
    }
  };

  return (
    <Alert 
      variant="destructive" 
      className={cn(
        "animate-in fade-in-50 slide-in-from-top-2",
        "relative"
      )}
    >
      {getErrorIcon()}
      <AlertTitle>{getErrorTitle()}</AlertTitle>
      <AlertDescription>
        <div className="flex items-start justify-between gap-2">
          <p className="flex-1">{error.message}</p>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-destructive-foreground/80 hover:text-destructive-foreground transition-colors"
              aria-label="Dismiss error"
            >
              <XCircle className="h-4 w-4" />
            </button>
          )}
        </div>
        {error.code && (
          <div className="text-xs mt-2 opacity-70 font-mono">
            Code: {error.code}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
};