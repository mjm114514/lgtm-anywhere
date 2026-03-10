import { ProjectList } from "./ProjectList";
import { SessionList } from "./SessionList";
import type { SelectedProject } from "../App";
import "./Sidebar.css";

interface SidebarProps {
  selectedProject: SelectedProject | null;
  selectedSessionId: string | null;
  onSelectProject: (project: SelectedProject) => void;
  onSelectSession: (sessionId: string, summary: string) => void;
  onNewSession: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({
  selectedProject,
  selectedSessionId,
  onSelectProject,
  onSelectSession,
  onNewSession,
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  return (
    <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
      <div className="sidebar-header">
        {!collapsed && <h1 className="sidebar-title">LGTM Anywhere</h1>}
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
            <ProjectList
              selectedCwd={selectedProject?.cwd ?? null}
              onSelect={onSelectProject}
            />
          </div>
          <div className="sidebar-lower">
            {selectedProject ? (
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
            )}
          </div>
        </>
      )}
    </aside>
  );
}
