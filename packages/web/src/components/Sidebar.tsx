import { ProjectList } from "./ProjectList";
import { SessionList } from "./SessionList";
import { NodeList } from "./NodeList";
import { HubSessionList } from "./HubSessionList";
import { useHubMode } from "../hooks/useHubMode";
import type { SelectedProject } from "../App";
import "./Sidebar.css";

interface SidebarProps {
  selectedProject: SelectedProject | null;
  selectedSessionId: string | null;
  selectedNodeId: string | null;
  onSelectProject: (project: SelectedProject) => void;
  onSelectNodeProject: (nodeId: string, project: SelectedProject) => void;
  onSelectSession: (sessionId: string, summary: string) => void;
  onNewSession: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  isMobile: boolean;
}

export function Sidebar({
  selectedProject,
  selectedSessionId,
  selectedNodeId,
  onSelectProject,
  onSelectNodeProject,
  onSelectSession,
  onNewSession,
  collapsed,
  onToggleCollapse,
  isMobile,
}: SidebarProps) {
  const { isHub } = useHubMode();

  return (
    <>
      {isMobile && !collapsed && (
        <div className="sidebar-overlay" onClick={onToggleCollapse} />
      )}
      <aside
        className={`sidebar${collapsed ? " sidebar-collapsed" : ""}${isMobile ? " sidebar-mobile" : ""}`}
      >
        <div className="sidebar-header">
          {!collapsed && (
            <h1 className="sidebar-title">
              {isHub ? "LGTM Hub" : "LGTM Anywhere"}
            </h1>
          )}
          <button
            className="sidebar-toggle"
            onClick={onToggleCollapse}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? "›" : "‹"}
          </button>
        </div>
        {!collapsed && (
          <>
            <div className="sidebar-upper">
              {isHub ? (
                <NodeList
                  selectedNodeId={selectedNodeId}
                  selectedCwd={selectedProject?.cwd ?? null}
                  onSelectProject={onSelectNodeProject}
                />
              ) : (
                <ProjectList
                  selectedCwd={selectedProject?.cwd ?? null}
                  onSelect={onSelectProject}
                />
              )}
            </div>
            <div className="sidebar-lower">
              {selectedProject ? (
                isHub && selectedNodeId ? (
                  <HubSessionList
                    nodeId={selectedNodeId}
                    cwd={selectedProject.cwd}
                    projectName={selectedProject.name}
                    selectedSessionId={selectedSessionId}
                    onSelect={onSelectSession}
                    onNewSession={onNewSession}
                  />
                ) : !isHub ? (
                  <SessionList
                    cwd={selectedProject.cwd}
                    projectName={selectedProject.name}
                    selectedSessionId={selectedSessionId}
                    onSelect={onSelectSession}
                    onNewSession={onNewSession}
                  />
                ) : (
                  <div className="sidebar-placeholder">
                    Select a project to view sessions
                  </div>
                )
              ) : (
                <div className="sidebar-placeholder">
                  {isHub
                    ? "Select a node and project to view sessions"
                    : "Select a project to view sessions"}
                </div>
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}
