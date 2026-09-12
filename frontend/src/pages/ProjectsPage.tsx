import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, apiErrorMessage } from "../api/client";
import type { Client, Project } from "../types";

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function loadProjects() {
    api.get("/projects").then((res) => setProjects(res.data.data));
  }

  useEffect(() => {
    loadProjects();
    api.get("/clients").then((res) => setClients(res.data.data));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/projects", { name, description: description || undefined, clientId });
      setName("");
      setDescription("");
      setClientId("");
      setShowForm(false);
      loadProjects();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Projects</h2>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "New project"}
        </button>
      </div>

      {showForm && (
        <form className="card" onSubmit={handleCreate} style={{ marginBottom: 16 }}>
          <div className="form-row">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required style={{ width: "100%" }} />
          </div>
          <div className="form-row">
            <label>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: "100%" }}
              rows={2}
            />
          </div>
          <div className="form-row">
            <label>Client</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
              <option value="">Select a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {error && <div className="error-text">{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            Create project
          </button>
        </form>
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Client</th>
              <th>Owner</th>
              <th>Tasks</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link to={`/projects/${p.id}`}>{p.name}</Link>
                </td>
                <td>{p.client?.name}</td>
                <td>{p.owner?.name}</td>
                <td>{p._count?.tasks ?? 0}</td>
              </tr>
            ))}
            {projects.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  No projects yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
