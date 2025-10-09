import Hls from 'hls.js';

export class HlsPlayer {
  private hls: Hls | null = null;
  private video: HTMLVideoElement;

  constructor(video: HTMLVideoElement) {
    this.video = video;
  }

  load(url: string) {
    if (Hls.isSupported()) {
      this.hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
      });

      this.hls.loadSource(url);
      this.hls.attachMedia(this.video);

      this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
        this.video.play().catch((error) => {
          console.warn('Autoplay prevented:', error);
        });
      });

      this.hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          console.error('HLS fatal error:', data);
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('Network error, trying to recover...');
              this.hls?.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('Media error, trying to recover...');
              this.hls?.recoverMediaError();
              break;
            default:
              console.log('Unrecoverable error');
              this.destroy();
              break;
          }
        }
      });
    } else if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      this.video.src = url;
      this.video.play().catch((error) => {
        console.warn('Autoplay prevented:', error);
      });
    } else {
      console.error('HLS is not supported');
    }
  }

  play() {
    return this.video.play();
  }

  pause() {
    this.video.pause();
  }

  destroy() {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    this.video.src = '';
  }
}
