import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, apiErrorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useSocket } from "../socket/SocketContext";
import { timeAgo } from "../utils/timeAgo";
import type { ActivityEvent, Task, TaskStatus } from "../types";

const STATUS_OPTIONS: TaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const socket = useSocket();
  const [task, setTask] = useState<Task | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveEvents, setLiveEvents] = useState<ActivityEvent[]>([]);

  function load() {
    if (!id) return;
    api
      .get(`/tasks/${id}`)
      .then((res) => setTask(res.data.data))
      .catch(() => setNotFound(true));
  }

  useEffect(load, [id]);

  useEffect(() => {
    if (!socket || !id) return;
    socket.emit("task:join", { taskId: id });

    function onNew(event: ActivityEvent) {
      if (event.taskId !== id) return;
      setLiveEvents((prev) => [event, ...prev]);
    }
    socket.on("activity:new", onNew);
    return () => {
      socket.off("activity:new", onNew);
    };
  }, [socket, id]);

  async function updateStatus(status: TaskStatus) {
    if (!id) return;
    setError(null);
    try {
      await api.patch(`/tasks/${id}/status`, { status });
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  if (notFound) return <p>You don't have access to this task.</p>;
  if (!task) return <p className="muted">Loading…</p>;

  const canChangeStatus =
    user?.role === "ADMIN" ||
    (user?.role === "PROJECT_MANAGER" && task.project?.ownerId === user.id) ||
    (user?.role === "DEVELOPER" && task.assigneeId === user.id);

  const knownActivityIds = new Set(liveEvents.map((e) => e.id));
  const history = (task.activityLogs ?? []).filter((a) => !knownActivityIds.has(a.id));

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>{task.title}</h2>
          <p className="muted">{task.project?.name}</p>
        </div>
        <div>
          <span className={`badge badge-${task.priority}`} style={{ marginRight: 6 }}>
            {task.priority}
          </span>
          <span className={`badge badge-${task.status}`}>{task.status.replace("_", " ")}</span>
        </div>
      </div>

      <div className="card">
        <p>{task.description || <span className="muted">No description.</span>}</p>
        <p className="muted">
          Assignee: {task.assignee?.name ?? "Unassigned"} · Due:{" "}
          {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "-"}
        </p>

        {canChangeStatus && (
          <div className="filters-bar" style={{ marginTop: 12 }}>
            <label style={{ marginRight: 4 }}>Update status:</label>
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                className="btn btn-sm"
                disabled={task.status === s}
                onClick={() => updateStatus(s)}
              >
                {s.replace("_", " ")}
              </button>
            ))}
          </div>
        )}
        {error && <div className="error-text">{error}</div>}
      </div>

      <div className="card">
        <strong>Activity</strong>
        {liveEvents.map((e) => (
          <div key={e.id} className="activity-item">
            <div>{e.message}</div>
            <div className="time">{timeAgo(e.createdAt)}</div>
          </div>
        ))}
        {history.map((a) => (
          <div key={a.id} className="activity-item">
            <div>{a.message}</div>
            <div className="time">{timeAgo(a.createdAt)}</div>
          </div>
        ))}
        {liveEvents.length === 0 && history.length === 0 && <p className="muted">No activity yet.</p>}
      </div>
    </div>
  );
}
