import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useSocket } from "../socket/SocketContext";
import type { AppNotification } from "../types";

interface NotificationsContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const socket = useSocket();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    api.get("/notifications").then((res) => {
      setNotifications(res.data.data);
      setUnreadCount(res.data.meta.unreadCount);
    });
  }, [user]);

  useEffect(() => {
    if (!socket) return;

    function onNew(payload: AppNotification & { unreadCount: number }) {
      setNotifications((prev) => [payload, ...prev].slice(0, 50));
      setUnreadCount(payload.unreadCount);
    }
    function onCount(payload: { unreadCount: number }) {
      setUnreadCount(payload.unreadCount);
    }

    socket.on("notification:new", onNew);
    socket.on("notification:count", onCount);
    return () => {
      socket.off("notification:new", onNew);
      socket.off("notification:count", onCount);
    };
  }, [socket]);

  async function markRead(id: string) {
    await api.patch(`/notifications/${id}/read`);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function markAllRead() {
    await api.patch("/notifications/read-all");
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, markRead, markAllRead }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}
