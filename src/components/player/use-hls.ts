"use client";
import { useEffect, useRef, type RefObject } from "react";

/**
 * Plays the personal watermarked HLS stream: native HLS on Safari/iOS, hls.js (loaded on demand) elsewhere.
 * With `url = null` it does nothing and the <video src> (plain mp4) is used.
 */
export function useHls(ref: RefObject<HTMLVideoElement | null>, url: string | null, stopped = false) {
  const inst = useRef<{ stopLoad(): void; startLoad(): void } | null>(null);
  // Login wall: stop fetching new segments while the picture is frozen; resume after sign-in.
  useEffect(() => {
    if (stopped) inst.current?.stopLoad();
    else inst.current?.startLoad();
  }, [stopped]);
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
      inst.current = h;
    });
    return () => {
      destroyed = true;
      inst.current = null;
      hls?.destroy();
    };
  }, [ref, url]);
}
