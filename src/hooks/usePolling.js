import { useEffect, useRef } from "react";

/**
 * Polling aman: recursive setTimeout (bukan setInterval) supaya request
 * tidak menumpuk ketika server lambat / cold start.
 *
 * - Berhenti otomatis saat komponen unmount atau `enabled=false`.
 * - Pause saat tab tidak aktif (document.hidden).
 * - Error ditelan di sini; pemanggil bertanggung jawab set state error sendiri.
 */
export function usePolling(callback, { enabled = true, interval = 1000, immediate = true } = {}) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return undefined;

    let cancelled = false;
    let timer = null;

    const schedule = (delay) => {
      if (cancelled) return;
      timer = setTimeout(run, Math.max(250, Number(delay) || 1000));
    };

    const run = async () => {
      if (cancelled) return;

      if (typeof document !== "undefined" && document.hidden) {
        schedule(interval);
        return;
      }

      try {
        await savedCallback.current();
      } catch {
        /* caller handles errors */
      }

      schedule(interval);
    };

    if (immediate) {
      run();
    } else {
      schedule(interval);
    }

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, interval, immediate]);
}
