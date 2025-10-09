import { toast } from 'sonner';

let permissionGranted = false;

export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    permissionGranted = true;
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    permissionGranted = permission === 'granted';
    return permissionGranted;
  }

  return false;
};

export const showCameraOfflineNotification = (cameraName: string, cameraId: string) => {
  if (permissionGranted && 'Notification' in window) {
    const notification = new Notification('Camera Offline', {
      body: `${cameraName} (ID ${cameraId}) is offline`,
      icon: '/favicon.ico',
      tag: `camera-${cameraId}`,
      requireInteraction: false,
    });

    notification.onclick = () => {
      window.focus();
      // Focus on the camera marker
      window.dispatchEvent(
        new CustomEvent('focusCamera', { detail: { cameraId } })
      );
      notification.close();
    };
  } else {
    // Fallback to in-app toast
    toast.error('Camera Offline', {
      description: `${cameraName} (ID ${cameraId}) is offline`,
    });
  }
};

export const showCameraNotFoundNotification = (cameraId: string) => {
  if (permissionGranted && 'Notification' in window) {
    new Notification('Camera Stream Not Found', {
      body: `Stream for camera ${cameraId} not found`,
      icon: '/favicon.ico',
      tag: `camera-not-found-${cameraId}`,
    });
  } else {
    toast.error('Camera Stream Not Found', {
      description: `Stream for camera ${cameraId} not found`,
    });
  }
};

// Register service worker for Web Push
export const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', registration);
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }
  return null;
};
