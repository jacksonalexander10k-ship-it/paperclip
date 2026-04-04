import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Link, useNavigate } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { agentsApi, type OrgNode } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { agentUrl } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { Download, Network, Upload, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { AGENT_ROLE_LABELS, type Agent } from "@paperclipai/shared";

// Layout constants — wider, more breathing room like n8n
const CARD_W = 220;
const CARD_H = 80;
const GAP_X = 50;
const GAP_Y = 100;
const PADDING = 80;

// Node accent colors — soft pastels for light mode
const NODE_COLORS = [
  { bg: "#f0fdf4", border: "#bbf7d0", accent: "#16a34a", iconBg: "#dcfce7" },
  { bg: "#eef2ff", border: "#c7d2fe", accent: "#4f46e5", iconBg: "#e0e7ff" },
  { bg: "#f0f9ff", border: "#bae6fd", accent: "#0284c7", iconBg: "#e0f2fe" },
  { bg: "#fffbeb", border: "#fde68a", accent: "#d97706", iconBg: "#fef3c7" },
  { bg: "#faf5ff", border: "#e9d5ff", accent: "#9333ea", iconBg: "#f3e8ff" },
  { bg: "#fef2f2", border: "#fecaca", accent: "#dc2626", iconBg: "#fee2e2" },
  { bg: "#ecfeff", border: "#a5f3fc", accent: "#0891b2", iconBg: "#cffafe" },
  { bg: "#fdf4ff", border: "#f5d0fe", accent: "#c026d3", iconBg: "#fae8ff" },
] as const;

// ── Tree layout types ───────────────────────────────────────────────────

interface LayoutNode {
  id: string;
  name: string;
  role: string;
  status: string;
  x: number;
  y: number;
  colorIndex: number;
  children: LayoutNode[];
}

// ── Layout algorithm ────────────────────────────────────────────────────

function subtreeWidth(node: OrgNode): number {
  if (node.reports.length === 0) return CARD_W;
  const childrenW = node.reports.reduce((sum, c) => sum + subtreeWidth(c), 0);
  const gaps = (node.reports.length - 1) * GAP_X;
  return Math.max(CARD_W, childrenW + gaps);
}

function layoutTree(node: OrgNode, x: number, y: number, colorIndex: number): LayoutNode {
  const totalW = subtreeWidth(node);
  const layoutChildren: LayoutNode[] = [];

  if (node.reports.length > 0) {
    const childrenW = node.reports.reduce((sum, c) => sum + subtreeWidth(c), 0);
    const gaps = (node.reports.length - 1) * GAP_X;
    let cx = x + (totalW - childrenW - gaps) / 2;

    for (let i = 0; i < node.reports.length; i++) {
      const child = node.reports[i];
      const cw = subtreeWidth(child);
      layoutChildren.push(layoutTree(child, cx, y + CARD_H + GAP_Y, (colorIndex + i + 1) % NODE_COLORS.length));
      cx += cw + GAP_X;
    }
  }

  return {
    id: node.id,
    name: node.name,
    role: node.role,
    status: node.status,
    x: x + (totalW - CARD_W) / 2,
    y,
    colorIndex,
    children: layoutChildren,
  };
}

function layoutForest(roots: OrgNode[]): LayoutNode[] {
  let x = PADDING;
  const result: LayoutNode[] = [];
  for (let i = 0; i < roots.length; i++) {
    const root = roots[i];
    const w = subtreeWidth(root);
    result.push(layoutTree(root, x, PADDING, i % NODE_COLORS.length));
    x += w + GAP_X;
  }
  return result;
}

function flattenLayout(nodes: LayoutNode[]): LayoutNode[] {
  const result: LayoutNode[] = [];
  function walk(n: LayoutNode) {
    result.push(n);
    n.children.forEach(walk);
  }
  nodes.forEach(walk);
  return result;
}

function collectEdges(nodes: LayoutNode[]): Array<{ parent: LayoutNode; child: LayoutNode }> {
  const edges: Array<{ parent: LayoutNode; child: LayoutNode }> = [];
  function walk(n: LayoutNode) {
    for (const c of n.children) {
      edges.push({ parent: n, child: c });
      walk(c);
    }
  }
  nodes.forEach(walk);
  return edges;
}

// ── Status helpers ──────────────────────────────────────────────────────

const statusConfig: Record<string, { color: string; label: string }> = {
  running: { color: "#10b981", label: "Running" },
  active: { color: "#10b981", label: "Active" },
  paused: { color: "#f59e0b", label: "Paused" },
  idle: { color: "#94a3b8", label: "Idle" },
  error: { color: "#ef4444", label: "Error" },
  terminated: { color: "#94a3b8", label: "Off" },
};

const adapterLabels: Record<string, string> = {
  claude_local: "AI Agent",
  codex_local: "AI Agent",
  gemini_local: "AI Agent",
  opencode_local: "AI Agent",
  cursor: "AI Agent",
  hermes_local: "AI Agent",
  openclaw_gateway: "AI Agent",
  process: "AI Agent",
  http: "AI Agent",
};

// ── Main component ──────────────────────────────────────────────────────

export function OrgChart() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();

  const { data: orgTree, isLoading } = useQuery({
    queryKey: queryKeys.org(selectedCompanyId!),
    queryFn: () => agentsApi.org(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const agentMap = useMemo(() => {
    const m = new Map<string, Agent>();
    for (const a of agents ?? []) m.set(a.id, a);
    return m;
  }, [agents]);

  useEffect(() => {
    setBreadcrumbs([{ label: "Your Team" }]);
  }, [setBreadcrumbs]);

  const layout = useMemo(() => layoutForest(orgTree ?? []), [orgTree]);
  const allNodes = useMemo(() => flattenLayout(layout), [layout]);
  const edges = useMemo(() => collectEdges(layout), [layout]);

  const bounds = useMemo(() => {
    if (allNodes.length === 0) return { width: 800, height: 600 };
    let maxX = 0, maxY = 0;
    for (const n of allNodes) {
      maxX = Math.max(maxX, n.x + CARD_W);
      maxY = Math.max(maxY, n.y + CARD_H);
    }
    return { width: maxX + PADDING, height: maxY + PADDING };
  }, [allNodes]);

  // Pan & zoom
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const hasInitialized = useRef(false);
  useEffect(() => {
    if (hasInitialized.current || allNodes.length === 0 || !containerRef.current) return;
    hasInitialized.current = true;
    fitToScreen();
  }, [allNodes, bounds]);

  const fitToScreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const cW = container.clientWidth;
    const cH = container.clientHeight;
    const scaleX = (cW - 60) / bounds.width;
    const scaleY = (cH - 60) / bounds.height;
    const fitZoom = Math.min(scaleX, scaleY, 1);
    const chartW = bounds.width * fitZoom;
    const chartH = bounds.height * fitZoom;
    setZoom(fitZoom);
    setPan({ x: (cW - chartW) / 2, y: (cH - chartH) / 2 });
  }, [bounds]);

  const zoomTo = useCallback((factor: number) => {
    const container = containerRef.current;
    if (!container) return;
    const newZoom = Math.min(Math.max(zoom * factor, 0.2), 2);
    const cx = container.clientWidth / 2;
    const cy = container.clientHeight / 2;
    const scale = newZoom / zoom;
    setPan({ x: cx - scale * (cx - pan.x), y: cy - scale * (cy - pan.y) });
    setZoom(newZoom);
  }, [zoom, pan]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-org-card]")) return;
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy });
  }, [dragging]);

  const handleMouseUp = useCallback(() => setDragging(false), []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    const newZoom = Math.min(Math.max(zoom * factor, 0.2), 2);
    const scale = newZoom / zoom;
    setPan({ x: mouseX - scale * (mouseX - pan.x), y: mouseY - scale * (mouseY - pan.y) });
    setZoom(newZoom);
  }, [zoom, pan]);

  if (!selectedCompanyId) {
    return <EmptyState icon={Network} message="Select a company to view the org chart." />;
  }
  if (isLoading) return <PageSkeleton variant="org-chart" />;
  if (orgTree && orgTree.length === 0) {
    return <EmptyState icon={Network} message="No organizational hierarchy defined." />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="mb-3 flex items-center justify-end shrink-0">
        <div className="text-xs text-muted-foreground">
          {allNodes.length} team member{allNodes.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="w-full flex-1 min-h-0 overflow-hidden relative rounded-xl border border-border"
        style={{
          cursor: dragging ? "grabbing" : "grab",
          background: "linear-gradient(var(--background) 1px, transparent 1px), linear-gradient(90deg, var(--background) 1px, transparent 1px), var(--muted)",
          backgroundSize: "20px 20px, 20px 20px",
          backgroundPosition: `${pan.x % 20}px ${pan.y % 20}px`,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Zoom controls — pill shape */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-0.5 bg-card border border-border rounded-full shadow-sm px-1 py-0.5">
          <button
            className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            onClick={() => zoomTo(0.8)}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="text-[10px] font-mono text-muted-foreground w-10 text-center select-none">
            {Math.round(zoom * 100)}%
          </span>
          <button
            className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            onClick={() => zoomTo(1.2)}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <div className="w-px h-4 bg-border mx-0.5" />
          <button
            className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            onClick={fitToScreen}
            aria-label="Fit to screen"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* SVG connector lines */}
        <svg className="absolute inset-0 pointer-events-none" style={{ width: "100%", height: "100%" }}>
          <defs>
            <linearGradient id="edge-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {edges.map(({ parent, child }) => {
              const x1 = parent.x + CARD_W / 2;
              const y1 = parent.y + CARD_H;
              const x2 = child.x + CARD_W / 2;
              const y2 = child.y;
              const midY = y1 + (y2 - y1) * 0.5;

              return (
                <g key={`${parent.id}-${child.id}`}>
                  {/* Shadow line */}
                  <path
                    d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    strokeOpacity={0.08}
                    filter="blur(2px)"
                  />
                  {/* Main line */}
                  <path
                    d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth={1.5}
                    strokeOpacity={0.2}
                  />
                  {/* Connection dots */}
                  <circle cx={x1} cy={y1} r={3} fill="var(--primary)" fillOpacity={0.15} />
                  <circle cx={x2} cy={y2} r={3} fill="var(--primary)" fillOpacity={0.15} />
                </g>
              );
            })}
          </g>
        </svg>

        {/* Node cards */}
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
          {allNodes.map((node) => {
            const agent = agentMap.get(node.id);
            const colors = NODE_COLORS[node.colorIndex % NODE_COLORS.length];
            const sConfig = statusConfig[node.status] ?? statusConfig.idle;
            const initials = node.name.slice(0, 2).toUpperCase();
            const isLive = node.status === "running" || node.status === "active";

            return (
              <div
                key={node.id}
                data-org-card
                className="absolute rounded-xl transition-all duration-200 cursor-pointer select-none hover:-translate-y-0.5"
                style={{
                  left: node.x,
                  top: node.y,
                  width: CARD_W,
                  minHeight: CARD_H,
                  backgroundColor: colors.bg,
                  border: `1px solid ${colors.border}`,
                  boxShadow: `0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.02)`,
                }}
                onClick={() => navigate(agent ? agentUrl(agent) : `/agents/${node.id}`)}
              >
                <div className="flex items-center px-4 py-3.5 gap-3">
                  {/* Avatar circle */}
                  <div className="relative shrink-0">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold"
                      style={{
                        backgroundColor: colors.iconBg,
                        color: colors.accent,
                      }}
                    >
                      {initials}
                    </div>
                    {/* Status dot */}
                    <span
                      className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2"
                      style={{
                        backgroundColor: sConfig.color,
                        borderColor: colors.bg,
                      }}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[13px] font-semibold text-foreground leading-tight truncate">
                      {node.name}
                    </span>
                    <span className="text-[11px] font-medium mt-0.5 truncate" style={{ color: colors.accent }}>
                      {agent?.title ?? roleLabel(node.role)}
                    </span>
                    {agent && (
                      <span className="text-[10px] text-muted-foreground/50 font-mono leading-tight mt-1">
                        {adapterLabels[agent.adapterType] ?? agent.adapterType}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const roleLabels: Record<string, string> = AGENT_ROLE_LABELS;

function roleLabel(role: string): string {
  return roleLabels[role] ?? role;
}
