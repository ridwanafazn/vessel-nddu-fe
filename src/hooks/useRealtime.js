import { useEffect, useRef, useState } from "react";
import {
  getRealtimeStatus,
  subscribeRealtime,
  subscribeRealtimeStatus,
} from "../api/ws";

export function useRealtime(type, handler, enabled = true) {
  const savedHandler = useRef(handler);

  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled || !type) return undefined;

    return subscribeRealtime(type, (message) => {
      savedHandler.current?.(message);
    });
  }, [type, enabled]);
}

export function useRealtimeStatus() {
  const [status, setStatus] = useState(getRealtimeStatus());

  useEffect(() => {
    return subscribeRealtimeStatus(setStatus);
  }, []);

  return status;
}
