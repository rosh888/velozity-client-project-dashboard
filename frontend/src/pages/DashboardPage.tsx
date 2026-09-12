import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useSocket } from "../socket/SocketContext";
import { ActivityFeed } from "../components/ActivityFeed";
import { timeAgo } from "../utils/timeAgo";
import type { Priority, Project, Task, TaskStatus } from "../types";

interface AdminDashboard {
  role: "ADMIN";
  totalProjects: number;
  totalTasks: number;
  tasksByStatus: Partial<Record<TaskStatus, number>>;
  overdueCount: number;
  onlineUsers: number;
}

interface PmDashboard {
  role: "PROJECT_MANAGER";
  projects: Project[];
  tasksByPriority: Partial<Record<Priority, number>>;
  upcomingDueDates: Task[];
}

interface DevDashboard {
  role: "DEVELOPER";
  tasks: Task[];
}

type DashboardData = AdminDashboard | PmDashboard | DevDashboard;

export function DashboardPage() {
  const { user } = useAuth();
  const socket = useSocket();
  const [data, setData] = useState<DashboardData | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<number | null>(null);

  function load() {
    api.get("/dashboard").then((res) => setData(res.data.data));
  }

  useEffect(load, []);

  useEffect(() => {
    if (!socket) return;
    function onPresence(p: { count: number }) {
      setOnlineUsers(p.count);
    }
    socket.on("presence:update", onPresence);
    return () => {
      socket.off("presence:update", onPresence);
    };
  }, [socket]);

  if (!data) return <p className="muted">Loading dashboard…</p>;

  return (
    <div>
      <div className="page-header">
        <h2>Welcome back, {user?.name}</h2>
      </div>

      {data.role === "ADMIN" && (
        <>
          <div className="stat-grid">
            <Stat label="Total projects" value={data.totalProjects} />
            <Stat label="Total tasks" value={data.totalTasks} />
            <Stat label="Overdue tasks" value={data.overdueCount} />
            <Stat label="Users online now" value={onlineUsers ?? data.onlineUsers} />
          </div>
          <div className="card">
            <strong>Tasks by status</strong>
            <div style={{ marginTop: 8 }}>
              {Object.entries(data.tasksByStatus).map(([status, count]) => (
                <span key={status} className={`badge badge-${status}`} style={{ marginRight: 8 }}>
                  {status.replace("_", " ")}: {count}
                </span>
              ))}
            </div>
          </div>
          <div className="card">
            <strong>Global activity feed</strong>
            <ActivityFeed />
          </div>
        </>
      )}

      {data.role === "PROJECT_MANAGER" && (
        <>
          <div className="card">
            <strong>Your projects</strong>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Client</th>
                  <th>Tasks</th>
                </tr>
              </thead>
              <tbody>
                {data.projects.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link to={`/projects/${p.id}`}>{p.name}</Link>
                    </td>
                    <td>{p.client?.name}</td>
                    <td>{p._count?.tasks ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card">
            <strong>Tasks by priority</strong>
            <div style={{ marginTop: 8 }}>
              {Object.entries(data.tasksByPriority).map(([priority, count]) => (
                <span key={priority} className={`badge badge-${priority}`} style={{ marginRight: 8 }}>
                  {priority}: {count}
                </span>
              ))}
            </div>
          </div>
          <div className="card">
            <strong>Due this week</strong>
            {data.upcomingDueDates.length === 0 && <p className="muted">Nothing due this week.</p>}
            <table>
              <tbody>
                {data.upcomingDueDates.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Link to={`/tasks/${t.id}`}>{t.title}</Link>
                    </td>
                    <td>{t.assignee?.name ?? "Unassigned"}</td>
                    <td>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card">
            <strong>Activity on your projects</strong>
            <ActivityFeed />
          </div>
        </>
      )}

      {data.role === "DEVELOPER" && (
        <>
          <div className="card">
            <strong>Your assigned tasks</strong>
            {data.tasks.length === 0 && <p className="muted">No tasks assigned yet.</p>}
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Project</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                {data.tasks.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Link to={`/tasks/${t.id}`}>{t.title}</Link>
                    </td>
                    <td>{t.project?.name}</td>
                    <td>
                      <span className={`badge badge-${t.priority}`}>{t.priority}</span>
                    </td>
                    <td>
                      <span className={`badge badge-${t.status}`}>{t.status.replace("_", " ")}</span>
                    </td>
                    <td>{t.dueDate ? timeAgo(t.dueDate) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card">
            <strong>Activity on your tasks</strong>
            <ActivityFeed />
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat-card">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}
