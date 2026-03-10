import { useState, useEffect, useCallback, useRef } from "react";
import type { TerminalInfo } from "@lgtm-anywhere/shared";
import { createTerminal, fetchTerminals, deleteTerminal } from "../api";
import { useTerminal } from "../hooks/useTerminal";
import "./TerminalPanel.css";

interface TerminalTab {
  id: string;
  title: string;
}

interface TerminalPanelProps {
  cwd: string | null;
}

/**
 * Single terminal tab body — each gets its own useTerminal + container div.
 * We keep all tabs mounted (hidden via CSS) so they don't lose state.
 */
function TerminalTabBody({
  terminalId,
  isActive,
}: {
  terminalId: string;
  isActive: boolean;
}) {
  const { containerRef, isConnected, exitCode, fit, focus } =
    useTerminal(terminalId);

  // Re-fit whenever the container is resized (drag handle, window resize, tab switch)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !isActive) return;

    // Initial fit + focus after CSS display change takes effect
    const t = setTimeout(() => {
      fit();
      focus();
    }, 50);

    const observer = new ResizeObserver(() => {
      fit();
    });
    observer.observe(el);

    return () => {
      clearTimeout(t);
      observer.disconnect();
    };
  }, [isActive, fit, focus, containerRef]);

  return (
    <div
      className={`terminal-tab-body ${isActive ? "terminal-tab-body--active" : ""}`}
    >
      <div ref={containerRef} className="terminal-xterm-container" />
      {exitCode !== null && (
        <div className="terminal-exit-badge">
          Process exited with code {exitCode}
        </div>
      )}
      {!isConnected && exitCode === null && (
        <div className="terminal-connecting-badge">Connecting...</div>
      )}
    </div>
  );
}

export function TerminalPanel({ cwd }: TerminalPanelProps) {
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(true);
  const [panelHeight, setPanelHeight] = useState(250);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  // Render-phase reset when cwd changes (avoids setState in effect)
  const [prevCwd, setPrevCwd] = useState(cwd);
  if (prevCwd !== cwd) {
    setPrevCwd(cwd);
    setTabs([]);
    setActiveTabId(null);
  }

  // Fetch existing terminals when cwd changes
  useEffect(() => {
    if (!cwd) return;

    let cancelled = false;
    fetchTerminals(cwd)
      .then((terminals: TerminalInfo[]) => {
        if (cancelled) return;
        const newTabs = terminals.map((t, i) => ({
          id: t.id,
          title: `Terminal ${i + 1}`,
        }));
        setTabs(newTabs);
        setActiveTabId(newTabs.length > 0 ? newTabs[0].id : null);
      })
      .catch(() => {
        // ignore — no existing terminals
      });

    return () => {
      cancelled = true;
    };
  }, [cwd]);

  const handleNewTab = useCallback(async () => {
    if (!cwd) return;
    try {
      const res = await createTerminal(cwd);
      const newTab: TerminalTab = {
        id: res.id,
        title: `Terminal ${tabs.length + 1}`,
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.id);
      setCollapsed(false);
    } catch (err) {
      console.error("[TerminalPanel] Failed to create terminal:", err);
    }
  }, [cwd, tabs.length]);

  const handleCloseTab = useCallback(
    async (tabId: string) => {
      try {
        await deleteTerminal(tabId);
      } catch {
        // ignore — might already be dead
      }
      setTabs((prev) => {
        const next = prev.filter((t) => t.id !== tabId);
        if (next.length === 0) {
          // Last tab closed — collapse the panel
          setCollapsed(true);
          setActiveTabId(null);
        } else if (activeTabId === tabId) {
          setActiveTabId(next[next.length - 1].id);
        }
        return next;
      });
    },
    [activeTabId],
  );

  // Open panel: expand + ensure at least one tab exists
  const openPanel = useCallback(async () => {
    setCollapsed(false);
    if (tabs.length === 0 && cwd) {
      try {
        const res = await createTerminal(cwd);
        const newTab: TerminalTab = { id: res.id, title: "Terminal 1" };
        setTabs([newTab]);
        setActiveTabId(newTab.id);
      } catch (err) {
        console.error("[TerminalPanel] Failed to create terminal:", err);
      }
    }
  }, [tabs.length, cwd]);

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      if (prev) {
        // Opening — will trigger openPanel via effect below
        return false;
      }
      return true;
    });
  }, []);

  // When expanding with no tabs, auto-create one
  const [prevCollapsed, setPrevCollapsed] = useState(collapsed);
  if (prevCollapsed !== collapsed) {
    setPrevCollapsed(collapsed);
    if (!collapsed && tabs.length === 0 && cwd) {
      // Schedule tab creation (can't call async in render)
      queueMicrotask(() => openPanel());
    }
  }

  // Cmd+J (macOS) / Ctrl+J (Windows/Linux) to toggle panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "j" &&
        (e.metaKey || e.ctrlKey) &&
        !e.shiftKey &&
        !e.altKey
      ) {
        e.preventDefault();
        setCollapsed((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Drag resize handlers
  const handleDragStart = useCallback(
    (e: React.PointerEvent) => {
      isDragging.current = true;
      startY.current = e.clientY;
      startHeight.current = panelHeight;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [panelHeight],
  );

  const handleDragMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const delta = startY.current - e.clientY;
    const maxHeight = window.innerHeight * 0.6;
    const newHeight = Math.max(
      120,
      Math.min(startHeight.current + delta, maxHeight),
    );
    setPanelHeight(newHeight);
  }, []);

  const handleDragEnd = useCallback(() => {
    isDragging.current = false;
  }, []);

  if (!cwd) return null;

  const shortcutHint = navigator.platform.includes("Mac")
    ? "\u2318J"
    : "Ctrl+J";

  return (
    <div
      className={`terminal-panel ${collapsed ? "terminal-panel--collapsed" : ""}`}
      style={collapsed ? undefined : { height: panelHeight }}
    >
      {/* Toggle tab — always visible, protrudes above the panel */}
      <div className="terminal-toggle-wrapper">
        <button className="terminal-toggle-tab" onClick={toggleCollapse}>
          <span className="terminal-toggle-label">&gt;_</span>
          <span className="terminal-toggle-shortcut">{shortcutHint}</span>
          {tabs.length > 0 && (
            <span className="terminal-toggle-badge">{tabs.length}</span>
          )}
        </button>
      </div>

      {!collapsed && (
        <>
          <div
            className="terminal-panel-handle"
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
          />
          <div className="terminal-panel-tabs">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                className={`terminal-panel-tab ${tab.id === activeTabId ? "terminal-panel-tab--active" : ""}`}
                onClick={() => setActiveTabId(tab.id)}
              >
                <span className="terminal-panel-tab-label">{tab.title}</span>
                <button
                  className="terminal-panel-tab-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCloseTab(tab.id);
                  }}
                >
                  x
                </button>
              </div>
            ))}
            <button className="terminal-panel-new-btn" onClick={handleNewTab}>
              +
            </button>
            <div className="terminal-panel-tabs-spacer" />
          </div>
          <div className="terminal-panel-body">
            {tabs.map((tab) => (
              <TerminalTabBody
                key={tab.id}
                terminalId={tab.id}
                isActive={tab.id === activeTabId}
              />
            ))}
            {tabs.length === 0 && (
              <div className="terminal-panel-empty">
                No terminals open. Click + to create one.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
