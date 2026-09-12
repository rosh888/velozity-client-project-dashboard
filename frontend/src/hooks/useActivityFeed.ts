import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { useSocket } from "../socket/SocketContext";
import type { ActivityEvent } from "../types";

// loads the latest activity then stays live over the socket. on reconnect
// it asks the server for everything newer than the last event it already
// has (straight from Postgres, no client cache) so a dropped connection
// never silently loses events
export function useActivityFeed(options?: { projectId?: string; taskId?: string }) {
  const socket = useSocket();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const lastSeenRef = useRef<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api.get("/activity", { params: { limit: 20 } }).then((res) => {
      const data: ActivityEvent[] = res.data.data;
      setEvents(data);
      lastSeenRef.current = data[0]?.createdAt ?? null;
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!socket) return;

    function matchesScope(event: ActivityEvent) {
      if (options?.projectId && event.projectId !== options.projectId) return false;
      if (options?.taskId && event.taskId !== options.taskId) return false;
      return true;
    }

    function onNew(event: ActivityEvent) {
      lastSeenRef.current = event.createdAt;
      if (!matchesScope(event)) return;
      setEvents((prev) => [event, ...prev].slice(0, 100));
    }

    async function catchUp() {
      if (!lastSeenRef.current) return;
      const res = await api.get("/activity", { params: { after: lastSeenRef.current, limit: 20 } });
      const missed: ActivityEvent[] = res.data.data;
      if (missed.length === 0) return;
      lastSeenRef.current = missed[missed.length - 1].createdAt;
      setEvents((prev) => {
        const existingIds = new Set(prev.map((e) => e.id));
        const toAdd = missed.filter((e) => !existingIds.has(e.id)).reverse();
        return [...toAdd, ...prev].slice(0, 100);
      });
    }

    socket.on("activity:new", onNew);
    socket.on("connect", catchUp);
    return () => {
      socket.off("activity:new", onNew);
      socket.off("connect", catchUp);
    };
  }, [socket, options?.projectId, options?.taskId]);

  useEffect(() => {
    if (!socket || !options?.projectId) return;
    socket.emit("project:join", { projectId: options.projectId });
  }, [socket, options?.projectId]);

  useEffect(() => {
    if (!socket || !options?.taskId) return;
    socket.emit("task:join", { taskId: options.taskId });
  }, [socket, options?.taskId]);

  const visibleEvents = options?.projectId || options?.taskId
    ? events.filter(
        (e) =>
          (!options.projectId || e.projectId === options.projectId) &&
          (!options.taskId || e.taskId === options.taskId)
      )
    : events;

  return { events: visibleEvents, loading };
}
