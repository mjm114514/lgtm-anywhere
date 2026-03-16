import { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { ChatArea } from "./components/ChatArea";
import { LoginPage } from "./components/LoginPage";
import { useAuth } from "./hooks/useAuth";
import { useHubMode, HubModeProvider } from "./hooks/useHubMode";
import { useMobile } from "./hooks/useMobile";
import "./App.css";

export interface SelectedProject {
  cwd: string;
  name: string;
}

function AppContent() {
  const { auth, verify } = useAuth();
  const { isHub } = useHubMode();
  const isMobile = useMobile();

  const [selectedProject, setSelectedProject] =
    useState<SelectedProject | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const [selectedSessionSummary, setSelectedSessionSummary] = useState("");
  const [showNewSession, setShowNewSession] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(isMobile);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

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
    if (!isHub) {
      setSelectedNodeId(null);
    }
  };

  const handleSelectNodeProject = (
    nodeId: string,
    project: SelectedProject,
  ) => {
    setSelectedNodeId(nodeId);
    setSelectedProject(project);
    setSelectedSessionId(null);
    setSelectedSessionSummary("");
    setShowNewSession(false);
  };

  const handleSelectSession = (sessionId: string, summary: string) => {
    setSelectedSessionId(sessionId);
    setSelectedSessionSummary(summary);
    setShowNewSession(false);
    if (isMobile) {
      setSidebarCollapsed(true);
    }
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
      <Sidebar
        selectedProject={selectedProject}
        selectedSessionId={selectedSessionId}
        selectedNodeId={selectedNodeId}
        onSelectProject={handleSelectProject}
        onSelectNodeProject={handleSelectNodeProject}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        isMobile={isMobile}
      />
      <ChatArea
        selectedProject={selectedProject}
        selectedSessionId={selectedSessionId}
        sessionSummary={selectedSessionSummary}
        showNewSession={showNewSession}
        onSessionCreated={handleSessionCreated}
        nodeId={selectedNodeId}
        isMobile={isMobile}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed((c) => !c)}
      />
    </div>
  );
}

export default function App() {
  return (
    <HubModeProvider>
      <AppContent />
    </HubModeProvider>
  );
}
