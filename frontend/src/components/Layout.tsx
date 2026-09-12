import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { NotificationBell } from "./NotificationBell";

export function Layout() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>Velozity Dashboard</h1>
        <nav>
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          {(user.role === "ADMIN" || user.role === "PROJECT_MANAGER") && (
            <NavLink to="/projects">Projects</NavLink>
          )}
          <NavLink to="/tasks">Tasks</NavLink>
          {user.role === "ADMIN" && <NavLink to="/users">Users</NavLink>}
        </nav>
      </aside>
      <div className="main">
        <div className="topbar">
          <span className="muted">
            {user.name} · {user.role.replace("_", " ")}
          </span>
          <NotificationBell />
          <button className="btn btn-sm" onClick={() => logout()}>
            Log out
          </button>
        </div>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
