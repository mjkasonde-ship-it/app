import { useEffect, useRef } from "react";

/**
 * Custom hook for real-time wallet notifications via WebSocket.
 * Automatically reconnects on disconnect with exponential backoff.
 *
 * @param {string} companyId - Company ID to subscribe to
 * @param {function} onEvent - Callback invoked with { type, data, timestamp }
 */
export function useWalletNotifications(companyId, onEvent) {
  const wsRef = useRef(null);
  const retryRef = useRef(0);
  const maxRetries = 8;
  const timerRef = useRef(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    function scheduleReconnect() {
      if (retryRef.current >= maxRetries) return;
      const delay = Math.min(1000 * 2 ** retryRef.current, 30000);
      retryRef.current += 1;
      timerRef.current = setTimeout(doConnect, delay);
    }

    function doConnect() {
      if (!companyId) return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/api/ws/notifications/${companyId}`;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => { retryRef.current = 0; };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            onEventRef.current(msg);
          } catch { /* ignore */ }
        };

        ws.onclose = () => { wsRef.current = null; scheduleReconnect(); };
        ws.onerror = () => { ws.close(); };
      } catch {
        scheduleReconnect();
      }
    }

    doConnect();

    return () => {
      clearTimeout(timerRef.current);
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    };
  }, [companyId]);

  // Heartbeat ping every 30s to keep connection alive
  useEffect(() => {
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send("ping");
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);
}
