// Single Socket.IO connection — native port of
// frontend/components/socket-provider.jsx.
// Connects directly to EXPO_PUBLIC_API_URL (no Next rewrites on native).
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { refreshAccessToken } from "./api";
import { getToken, setRefreshHandler } from "./auth";
import { API_URL } from "./config";

const SocketContext = createContext({
  socket: null,
  isConnected: false,
  reconnectNonce: 0,
});

export function useSocket() {
  return useContext(SocketContext);
}

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const socketRef = useRef(null);
  const connectedOnce = useRef(false);

  useEffect(() => {
    setRefreshHandler(refreshAccessToken);
    let cancelled = false;
    let s = null;

    const build = async () => {
      let token = getToken();
      if (!token) {
        try {
          token = await refreshAccessToken();
        } catch {
          token = null;
        }
      }
      if (!token || cancelled) return;

      s = io(API_URL, {
        path: "/socket.io",
        auth: { token },
        transports: ["websocket", "polling"],
        reconnectionDelay: 800,
        reconnectionDelayMax: 4000,
      });
      socketRef.current = s;

      s.on("connect_error", async (err) => {
        if (err?.message && /token/i.test(err.message)) {
          try {
            const fresh = await refreshAccessToken();
            if (cancelled) return;
            s.auth = { token: fresh };
            s.connect();
          } catch {}
        }
      });
      s.on("connect", () => {
        if (cancelled) return;
        setSocket(s);
        setIsConnected(true);
        if (connectedOnce.current) setReconnectNonce((n) => n + 1);
        else connectedOnce.current = true;
      });
      s.on("disconnect", () => {
        if (cancelled) return;
        setIsConnected(false);
      });
    };

    build();
    return () => {
      cancelled = true;
      if (s) s.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected, reconnectNonce }}>
      {children}
    </SocketContext.Provider>
  );
}
