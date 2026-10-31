import { useCallback, useEffect, useRef, useState } from "react";
import { healthApi } from "../api/endpoints";

/**
 * Memantau kesehatan backend.
 * status: "checking" | "online" | "offline"
 *
 * Request pertama bisa sampai 60 detik (Render free cold start),
 * karena itu timeout axios 90 detik dan banner menampilkan status "checking".
 */
export function useBackendHealth({ pollMs = 60000 } = {}) {
  const [status, setStatus] = useState("checking");
  const [error, setError] = useState("");
  const mountedRef = useRef(true);

  const check = useCallback(async () => {
    setStatus((previous) => (previous === "online" ? "online" : "checking"));
    try {
      await healthApi.get();
      if (!mountedRef.current) return;
      setStatus("online");
      setError("");
    } catch (err) {
      if (!mountedRef.current) return;
      setStatus("offline");
      setError(err?.message || "Server tidak dapat dihubungi");
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    check();

    const timer = setInterval(check, pollMs);

    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
  }, [check, pollMs]);

  return { status, error, retry: check };
}
