"use client";
import { useEffect, type RefObject } from "react";

/**
 * Plays the personal watermarked HLS stream: native HLS on Safari/iOS, hls.js (loaded on demand) elsewhere.
 * With `url = null` it does nothing and the <video src> (plain mp4) is used.
 */
export function useHls(ref: RefObject<HTMLVideoElement | null>, url: string | null) {
  useEffect(() => {
    const video = ref.current;
    if (!video || !url) return;
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      return () => {
        video.removeAttribute("src");
        video.load();
      };
    }
    let destroyed = false;
    let hls: { destroy(): void } | null = null;
    import("hls.js").then(({ default: Hls }) => {
      if (destroyed || !Hls.isSupported()) return;
      const h = new Hls({ maxBufferLength: 20, enableWorker: false });
      h.loadSource(url);
      h.attachMedia(video);
      h.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) h.startLoad();
        else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) h.recoverMediaError();
      });
      hls = h;
    });
    return () => {
      destroyed = true;
      hls?.destroy();
    };
  }, [ref, url]);
}
