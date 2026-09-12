import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { Task } from "../types";

export function TasksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);

  const status = searchParams.get("status") ?? "";
  const priority = searchParams.get("priority") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  useEffect(() => {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    if (priority) params.priority = priority;
    if (from) params.from = from;
    if (to) params.to = to;
    api.get("/tasks", { params }).then((res) => {
      setTasks(res.data.data);
      setTotal(res.data.meta.total);
    });
  }, [status, priority, from, to]);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  }

  return (
    <div>
      <div className="page-header">
        <h2>Tasks</h2>
      </div>

      <div className="filters-bar card">
        <div>
          <label>Status</label>
          <select value={status} onChange={(e) => updateParam("status", e.target.value)}>
            <option value="">All</option>
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="DONE">Done</option>
            <option value="OVERDUE">Overdue</option>
          </select>
        </div>
        <div>
          <label>Priority</label>
          <select value={priority} onChange={(e) => updateParam("priority", e.target.value)}>
            <option value="">All</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>
        <div>
          <label>Due from</label>
          <input type="date" value={from} onChange={(e) => updateParam("from", e.target.value)} />
        </div>
        <div>
          <label>Due to</label>
          <input type="date" value={to} onChange={(e) => updateParam("to", e.target.value)} />
        </div>
        <button className="btn btn-sm" onClick={() => setSearchParams({})}>
          Clear filters
        </button>
      </div>

      <div className="card">
        <p className="muted">{total} task(s)</p>
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Project</th>
              <th>Assignee</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Due</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id}>
                <td>
                  <Link to={`/tasks/${t.id}`}>{t.title}</Link>
                </td>
                <td>{t.project?.name}</td>
                <td>{t.assignee?.name ?? "Unassigned"}</td>
                <td>
                  <span className={`badge badge-${t.priority}`}>{t.priority}</span>
                </td>
                <td>
                  <span className={`badge badge-${t.status}`}>{t.status.replace("_", " ")}</span>
                </td>
                <td>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "-"}</td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  No tasks match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
