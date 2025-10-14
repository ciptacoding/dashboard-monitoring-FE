// src/lib/hlsPlayer.ts
import Hls from 'hls.js';

export class HlsPlayer {
  private hls: Hls | null = null;
  private video: HTMLVideoElement;

  constructor(video: HTMLVideoElement) {
    this.video = video;
    // autoplay policy
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.preload = 'auto';
  }

  load(url: string) {
    this.destroy(); // pastikan bersih sebelum load ulang

    if (Hls.isSupported()) {
      this.hls = new Hls({
        // ==== penting untuk stabil ====
        lowLatencyMode: false,             // ← pakai HLS standar (bukan LL-HLS)
        enableWorker: true,
        liveSyncDurationCount: 3,          // target ~3 segmen dari live edge
        liveMaxLatencyDurationCount: 5,    // toleransi keterlambatan
        maxLiveSyncPlaybackRate: 1.0,      // jangan speed-up mengejar live
        capLevelToPlayerSize: true,        // auto turunkan level sesuai ukuran video
        maxBufferLength: 30,               // detik buffer maksimal
        backBufferLength: 60,              // detik buffer belakang
        maxBufferHole: 0.5,                // toleransi gap kecil
        fragLoadingTimeOut: 20000,
        manifestLoadingTimeOut: 20000,
        // ==============================
      });

      this.hls.attachMedia(this.video);
      this.hls.loadSource(url);

      this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
        // coba play; biarkan gagal diam2 kalau policy blok
        this.video.play().catch(() => {});
      });

      // Recovery & logging
      this.hls.on(Hls.Events.ERROR, (_evt, data) => {
        // Non-fatal stall → "nudging" tipis ke depan
        if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR) {
          try {
            this.video.currentTime = this.video.currentTime + 0.01;
          } catch {}
        }

        if (!data.fatal) return;

        console.warn('HLS fatal error:', data.type, data.details);

        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            // jaringan putus → coba lanjutkan loading
            this.hls?.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            // demux/MediaSource error → recover
            this.hls?.recoverMediaError();
            break;
          default:
            // tidak bisa recover → reload sumber
            this.reload(url);
            break;
        }
      });

      // (opsional) saat level berubah, catat — bantu debug kualitas/adaptasi
      this.hls.on(Hls.Events.LEVEL_SWITCHED, (_e, d) => {
        // console.debug('level switched to', d.level);
      });
    } else if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari (HLS native)
      this.video.src = url;
      this.video.play().catch(() => {});
    } else {
      console.error('HLS is not supported in this browser');
    }
  }

  // paksa reload bersih (mis. saat fatal error)
  private reload(url: string) {
    this.destroy();
    // kecilkan jeda supaya tidak tight loop saat masalah jaringan
    setTimeout(() => this.load(url), 1000);
  }

  play() {
    return this.video.play();
  }

  pause() {
    this.video.pause();
    // kalau mau hemat resource, hentikan fetch segmen juga:
    this.hls?.stopLoad();
  }

  resume() {
    // lanjutkan fetch segmen
    this.hls?.startLoad();
    this.video.play().catch(() => {});
  }

  destroy() {
    if (this.hls) {
      try {
        this.hls.destroy();
      } catch {}
      this.hls = null;
    }
    // Lepas src untuk bebaskan MSE
    try { this.video.removeAttribute('src'); this.video.load(); } catch {}
  }
}
