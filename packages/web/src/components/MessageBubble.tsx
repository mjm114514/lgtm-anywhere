import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type {
  ChatMessage,
  ContentBlock,
  SubagentState,
} from "../hooks/useSessionSocket";
import "./MessageBubble.css";

interface MessageBubbleProps {
  message: ChatMessage;
  cwd?: string;
}

export function MessageBubble({ message, cwd }: MessageBubbleProps) {
  if (message.role === "user") {
    return (
      <div className="message-bubble message-bubble--user">
        <div className="message-bubble-content">{message.content}</div>
        {message.images && message.images.length > 0 && (
          <div className="message-bubble-images">
            {message.images.map((img, i) => (
              <img
                key={i}
                src={`data:${img.media_type};base64,${img.data}`}
                alt={`Attachment ${i + 1}`}
                className="message-bubble-image"
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Assistant message: render as timeline of blocks
  // Group: pair each tool_use with its subsequent tool_result
  const items = buildTimelineItems(message.blocks);

  return (
    <div className="message-bubble message-bubble--assistant">
      {items.map((item, i) => (
        <TimelineItem
          key={i}
          item={item}
          isStreaming={i === items.length - 1 && !!message.isStreaming}
          cwd={cwd}
        />
      ))}
      {items.length === 0 && message.isStreaming && (
        <div className="timeline-item">
          <div className="timeline-dot" />
          <div className="timeline-content">
            <span className="timeline-streaming">Thinking...</span>
          </div>
        </div>
      )}
    </div>
  );
}

type TimelineEntry =
  | { type: "text"; text: string }
  | {
      type: "tool";
      name: string;
      toolUseId: string;
      input?: unknown;
      result?: string;
    }
  | {
      type: "subagent";
      toolUseId: string;
      task: SubagentState;
      result?: string;
    };

function buildTimelineItems(blocks: ContentBlock[]): TimelineEntry[] {
  const items: TimelineEntry[] = [];
  const resultMap = new Map<string, string>();

  // Collect tool_use IDs that are rendered as subagent blocks
  const subagentToolUseIds = new Set<string>();
  for (const b of blocks) {
    if (b.type === "subagent") {
      subagentToolUseIds.add(b.toolUseId);
    }
  }

  // First pass: collect all tool_results by toolUseId
  for (const b of blocks) {
    if (b.type === "tool_result") {
      resultMap.set(b.toolUseId, b.content);
    }
  }

  // Second pass: build timeline
  for (const b of blocks) {
    if (b.type === "text") {
      if (b.text.trim()) {
        items.push({ type: "text", text: b.text });
      }
    } else if (b.type === "tool_use") {
      // Skip Agent tool_use if already rendered as subagent block
      if (b.name === "Agent" && subagentToolUseIds.has(b.toolUseId)) continue;
      items.push({
        type: "tool",
        name: b.name,
        toolUseId: b.toolUseId,
        input: b.input,
        result: resultMap.get(b.toolUseId),
      });
    } else if (b.type === "subagent") {
      items.push({
        type: "subagent",
        toolUseId: b.toolUseId,
        task: b.task,
        result: b.task.result ?? resultMap.get(b.toolUseId),
      });
    }
    // tool_result blocks are consumed via resultMap, not rendered standalone
  }

  return items;
}

function TimelineItem({
  item,
  isStreaming,
  cwd,
}: {
  item: TimelineEntry;
  isStreaming: boolean;
  cwd?: string;
}) {
  if (item.type === "text") {
    return (
      <div className="timeline-item">
        <div className="timeline-dot" />
        <div className="timeline-content timeline-text">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {children}
                </a>
              ),
            }}
          >
            {item.text}
          </ReactMarkdown>
          {isStreaming && <span className="timeline-streaming-cursor" />}
        </div>
      </div>
    );
  }

  if (item.type === "subagent") {
    return <SubagentBlock task={item.task} result={item.result} cwd={cwd} />;
  }

  return <ToolBlock item={item} isInProgress={isStreaming} cwd={cwd} />;
}

function ToolBlock({
  item,
  isInProgress,
  cwd,
}: {
  item: TimelineEntry & { type: "tool" };
  isInProgress: boolean;
  cwd?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const inputSummary = formatToolInput(item.name, item.input, cwd);
  const inProgress = isInProgress && !item.result;

  return (
    <div className="timeline-item">
      <div
        className={`timeline-dot ${inProgress ? "timeline-dot--tool-running" : "timeline-dot--tool"}`}
      />
      <div className="timeline-content">
        <div className="tool-header" onClick={() => setExpanded(!expanded)}>
          <span className="tool-name">{item.name}</span>
          {inputSummary && (
            <span className="tool-input-summary">{inputSummary}</span>
          )}
          <span
            className={`tool-chevron ${expanded ? "tool-chevron--open" : ""}`}
          >
            &#9656;
          </span>
        </div>
        {expanded && (
          <div className="tool-detail">
            {item.input !== undefined && (
              <div className="tool-input">
                <pre>{JSON.stringify(item.input, null, 2)}</pre>
              </div>
            )}
          </div>
        )}
        {item.name === "Edit" ? (
          <EditDiffResult input={item.input} result={item.result} cwd={cwd} />
        ) : (
          item.result && <ToolResult content={item.result} />
        )}
      </div>
    </div>
  );
}

// ── Subagent block ──

/** Format seconds into m:ss or h:mm:ss */
function formatDuration(totalSec: number): string {
  const s = Math.floor(totalSec);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m < 60) return `${m}:${sec.toString().padStart(2, "0")}`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h}:${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

function SubagentBlock({
  task,
  result,
  cwd,
}: {
  task: SubagentState;
  result?: string;
  cwd?: string;
}) {
  const [toolsExpanded, setToolsExpanded] = useState(false);

  const isRunning = task.status === "running";
  const isFailed = task.status === "failed" || task.status === "stopped";

  // ── Real-time ticking timer ──
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setTick(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  // When done, use final SDK duration; while running, compute from wall clock
  const durationStr = formatDuration(
    !isRunning && task.usage
      ? task.usage.duration_ms / 1000
      : (tick - task.startedAt) / 1000,
  );

  const toolCount = task.innerBlocks.filter(
    (b) => b.type === "tool_use",
  ).length;

  const tokenCount = task.usage ? task.usage.total_tokens : null;

  // ── Last N tool calls for the preview box ──
  const toolBlocks = task.innerBlocks.filter(
    (b) => b.type === "tool_use",
  ) as Array<ContentBlock & { type: "tool_use" }>;
  const lastTools = toolBlocks.slice(-5);

  const dotClass = isFailed
    ? "timeline-dot--subagent-failed"
    : isRunning
      ? "timeline-dot--subagent-running"
      : "timeline-dot--subagent-done";

  return (
    <div className="timeline-item">
      <div className={`timeline-dot timeline-dot--subagent ${dotClass}`} />
      <div className="timeline-content">
        <div className="subagent-header">
          <span className="subagent-label">Agent</span>
          <span className="subagent-description">{task.description}</span>
          {isRunning && task.lastToolName && (
            <span className="subagent-activity">{task.lastToolName}</span>
          )}
        </div>

        {/* Stats line */}
        {(toolCount > 0 || durationStr || tokenCount) && (
          <div className="subagent-stats">
            {toolCount > 0 && (
              <span>
                {toolCount} tool call{toolCount !== 1 ? "s" : ""}
              </span>
            )}
            <span>{durationStr}</span>
            {tokenCount && <span>{tokenCount.toLocaleString()} tokens</span>}
          </div>
        )}

        {/* Tool calls preview box — shows last 5 by default, all when expanded */}
        {toolBlocks.length > 0 && (
          <div
            className={`subagent-tools-preview ${toolsExpanded ? "subagent-tools-preview--open" : ""}`}
            onClick={() => setToolsExpanded(!toolsExpanded)}
          >
            <ul className="subagent-tools-preview-list">
              {(toolsExpanded ? toolBlocks : lastTools).map((tool, i) => (
                <li key={i} className="subagent-tools-preview-item">
                  <span className="subagent-tools-preview-name">
                    {tool.name}
                  </span>
                  <span className="subagent-tools-preview-input">
                    {formatToolInput(tool.name, tool.input, cwd)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Result — expandable like ToolResult */}
        {result && <ToolResult content={result} />}
      </div>
    </div>
  );
}

function ToolResult({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  const truncated = content.length > 200;
  const display = expanded ? content : content.slice(0, 200);

  return (
    <div
      className={`tool-result ${truncated ? "tool-result--clickable" : ""}`}
      onClick={() => truncated && setExpanded(!expanded)}
    >
      <pre>
        {display}
        {truncated && !expanded && "..."}
      </pre>
    </div>
  );
}

/** Render a unified diff view for Edit tool results. */
function EditDiffResult({
  input,
  result,
  cwd,
}: {
  input: unknown;
  result?: string;
  cwd?: string;
}) {
  const [expanded, setExpanded] = useState(true);
  const obj = (input && typeof input === "object" ? input : {}) as Record<
    string,
    unknown
  >;
  const oldStr = (typeof obj.old_string === "string" ? obj.old_string : "") as string;
  const newStr = (typeof obj.new_string === "string" ? obj.new_string : "") as string;
  const filePath =
    typeof obj.file_path === "string" ? stripCwd(obj.file_path, cwd) : "";

  // Build unified diff lines
  const oldLines = oldStr.split("\n");
  const newLines = newStr.split("\n");
  const diffLines = computeUnifiedDiff(oldLines, newLines);

  return (
    <div className="edit-diff">
      <div
        className="edit-diff-header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="edit-diff-file">{filePath}</span>
        <span className="edit-diff-stats">
          <span className="edit-diff-additions">
            +{newLines.length}
          </span>
          <span className="edit-diff-deletions">
            -{oldLines.length}
          </span>
        </span>
        <span
          className={`tool-chevron ${expanded ? "tool-chevron--open" : ""}`}
        >
          &#9656;
        </span>
      </div>
      {expanded && (
        <div className="edit-diff-body">
          {diffLines.map((line, i) => (
            <div
              key={i}
              className={`edit-diff-line ${
                line.type === "add"
                  ? "edit-diff-line--add"
                  : line.type === "del"
                    ? "edit-diff-line--del"
                    : "edit-diff-line--ctx"
              }`}
            >
              <span className="edit-diff-line-prefix">
                {line.type === "add" ? "+" : line.type === "del" ? "-" : " "}
              </span>
              <span className="edit-diff-line-content">{line.text}</span>
            </div>
          ))}
        </div>
      )}
      {result && (
        <div className="edit-diff-status">
          {result.toLowerCase().includes("error") ? "Failed" : "Applied"}
        </div>
      )}
    </div>
  );
}

type DiffLine = { type: "add" | "del" | "ctx"; text: string };

/** Simple LCS-based unified diff. */
function computeUnifiedDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  // Build LCS table
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        oldLines[i - 1] === newLines[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack to produce diff
  const result: DiffLine[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.push({ type: "ctx", text: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: "add", text: newLines[j - 1] });
      j--;
    } else {
      result.push({ type: "del", text: oldLines[i - 1] });
      i--;
    }
  }
  return result.reverse();
}

/** Strip cwd prefix from a file path for shorter display. */
function stripCwd(filePath: string, cwd?: string): string {
  if (!cwd) return filePath;
  const prefix = cwd.endsWith("/") ? cwd : cwd + "/";
  if (filePath.startsWith(prefix)) {
    return filePath.slice(prefix.length);
  }
  return filePath;
}

/** Format a short summary of tool input for the header line. */
function formatToolInput(_name: string, input: unknown, cwd?: string): string {
  if (!input || typeof input !== "object") return "";
  const obj = input as Record<string, unknown>;

  // Common patterns for Claude tool calls
  if (typeof obj.command === "string") return truncate(obj.command, 60);
  if (typeof obj.file_path === "string")
    return truncate(stripCwd(obj.file_path, cwd), 60);
  if (typeof obj.path === "string")
    return truncate(stripCwd(obj.path, cwd), 60);
  if (typeof obj.pattern === "string") return truncate(obj.pattern, 60);
  if (typeof obj.query === "string") return truncate(obj.query, 60);
  if (typeof obj.url === "string") return truncate(obj.url, 60);
  if (typeof obj.prompt === "string") return truncate(obj.prompt, 60);

  // For tools with a "name" sub-param (like Read with file_path)
  const firstStringVal = Object.values(obj).find(
    (v) => typeof v === "string",
  ) as string | undefined;
  if (firstStringVal) return truncate(firstStringVal, 60);

  return "";
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "..." : s;
}
