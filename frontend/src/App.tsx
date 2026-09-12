import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { SocketProvider } from "./socket/SocketContext";
import { NotificationsProvider } from "./notifications/NotificationsContext";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { TasksPage } from "./pages/TasksPage";
import { TaskDetailPage } from "./pages/TaskDetailPage";
import { UsersPage } from "./pages/UsersPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <NotificationsProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<Layout />}>
                  <Route path="/" element={<DashboardPage />} />
                  <Route element={<ProtectedRoute roles={["ADMIN", "PROJECT_MANAGER"]} />}>
                    <Route path="/projects" element={<ProjectsPage />} />
                    <Route path="/projects/:id" element={<ProjectDetailPage />} />
                  </Route>
                  <Route path="/tasks" element={<TasksPage />} />
                  <Route path="/tasks/:id" element={<TaskDetailPage />} />
                  <Route element={<ProtectedRoute roles={["ADMIN"]} />}>
                    <Route path="/users" element={<UsersPage />} />
                  </Route>
                </Route>
              </Route>
            </Routes>
          </NotificationsProvider>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
