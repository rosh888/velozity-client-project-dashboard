import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api, apiErrorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { ActivityFeed } from "../components/ActivityFeed";
import type { Priority, Project, User } from "../types";

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [developers, setDevelopers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");

  const canManage = user?.role === "ADMIN" || user?.role === "PROJECT_MANAGER";

  function load() {
    if (!id) return;
    api
      .get(`/projects/${id}`)
      .then((res) => setProject(res.data.data))
      .catch(() => setNotFound(true));
  }

  useEffect(load, [id]);

  useEffect(() => {
    if (canManage) {
      api.get("/users", { params: { role: "DEVELOPER" } }).then((res) => setDevelopers(res.data.data));
    }
  }, [canManage]);

  async function handleCreateTask(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/tasks", {
        title,
        description: description || undefined,
        projectId: id,
        assigneeId: assigneeId || undefined,
        priority,
        dueDate: dueDate || undefined,
      });
      setTitle("");
      setDescription("");
      setAssigneeId("");
      setPriority("MEDIUM");
      setDueDate("");
      setShowForm(false);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  if (notFound) return <p>You don't have access to this project.</p>;
  if (!project) return <p className="muted">Loading…</p>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>{project.name}</h2>
          <p className="muted">
            {project.client?.name} · Owned by {project.owner?.name}
          </p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "New task"}
          </button>
        )}
      </div>

      {showForm && (
        <form className="card" onSubmit={handleCreateTask} style={{ marginBottom: 16 }}>
          <div className="form-row">
            <label>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required style={{ width: "100%" }} />
          </div>
          <div className="form-row">
            <label>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ width: "100%" }} rows={2} />
          </div>
          <div className="filters-bar">
            <div>
              <label>Assignee</label>
              <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                <option value="">Unassigned</option>
                {developers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
            <div>
              <label>Due date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          {error && <div className="error-text">{error}</div>}
          <button className="btn btn-primary" type="submit">
            Create task
          </button>
        </form>
      )}

      <div className="card">
        <strong>Tasks</strong>
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Assignee</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Due</th>
            </tr>
          </thead>
          <tbody>
            {project.tasks?.map((t) => (
              <tr key={t.id}>
                <td>
                  <Link to={`/tasks/${t.id}`}>{t.title}</Link>
                </td>
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
            {project.tasks?.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  No tasks yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <strong>Project activity</strong>
        <ActivityFeed projectId={project.id} />
      </div>
    </div>
  );
}
