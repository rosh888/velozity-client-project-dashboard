import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "../auth/AuthContext";
import { getAccessToken } from "../api/client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? "http://localhost:4000";

interface SocketContextValue {
  socket: Socket | null;
}

const SocketContext = createContext<SocketContextValue>({ socket: null });

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user) {
      socketRef.current?.close();
      socketRef.current = null;
      setSocket(null);
      return;
    }

    const token = getAccessToken();
    if (!token) return;

    const instance = io(SOCKET_URL, { auth: { token } });
    socketRef.current = instance;
    setSocket(instance);

    return () => {
      instance.close();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return <SocketContext.Provider value={{ socket }}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext).socket;
}
