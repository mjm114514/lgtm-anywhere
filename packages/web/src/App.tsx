import { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { ChatArea } from "./components/ChatArea";
import { LoginPage } from "./components/LoginPage";
import { useAuth } from "./hooks/useAuth";
import "./App.css";

export interface SelectedProject {
  cwd: string;
  name: string;
}

export default function App() {
  const { auth, verify, logout } = useAuth();

  const [selectedProject, setSelectedProject] =
    useState<SelectedProject | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const [selectedSessionSummary, setSelectedSessionSummary] = useState("");
  const [showNewSession, setShowNewSession] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Auth gate
  if (auth.state === "loading") {
    return (
      <div className="auth-loading">
        <p>Loading...</p>
      </div>
    );
  }

  if (auth.state === "unauthenticated" || auth.state === "error") {
    return <LoginPage auth={auth} onVerify={verify} />;
  }

  // auth.state === "authenticated" || auth.state === "disabled"

  const handleSelectProject = (project: SelectedProject) => {
    setSelectedProject(project);
    setSelectedSessionId(null);
    setSelectedSessionSummary("");
    setShowNewSession(false);
  };

  const handleSelectSession = (sessionId: string, summary: string) => {
    setSelectedSessionId(sessionId);
    setSelectedSessionSummary(summary);
    setShowNewSession(false);
  };

  const handleNewSession = () => {
    setSelectedSessionId(null);
    setShowNewSession(true);
  };

  const handleSessionCreated = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setShowNewSession(false);
  };

  return (
    <div className="app">
      {auth.state === "authenticated" && (
        <div className="auth-header">
          <button onClick={logout} className="auth-logout-btn">
            Logout
          </button>
        </div>
      )}
      <Sidebar
        selectedProject={selectedProject}
        selectedSessionId={selectedSessionId}
        onSelectProject={handleSelectProject}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
      />
      <ChatArea
        selectedProject={selectedProject}
        selectedSessionId={selectedSessionId}
        sessionSummary={selectedSessionSummary}
        showNewSession={showNewSession}
        onSessionCreated={handleSessionCreated}
      />
    </div>
  );
}
