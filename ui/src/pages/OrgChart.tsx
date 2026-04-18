import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useNavigate } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { agentsApi, type OrgNode, type DepartmentKey } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { agentUrl } from "../lib/utils";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import {
  Network,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Crown,
  TrendingUp,
  Megaphone,
  Settings,
  BarChart3,
  Users,
  Layers,
} from "lucide-react";
import { AGENT_ROLE_LABELS, type Agent } from "@paperclipai/shared";
import { isGhostDepartmentManager, agentInitials } from "../lib/team-grouping";

// ── Layout constants ────────────────────────────────────────────────────
const CARD_W = 220;
const CARD_H = 80;
const CEO_W = 260;
const CEO_H = 100;
const GAP_X = 50;
const GAP_Y = 100;
const PADDING = 80;
const GROUP_PAD = 24; // padding inside department group boxes

// ── Department color system ─────────────────────────────────────────────
const DEPARTMENT_COLORS: Record<DepartmentKey, {
  bg: string; bgDark: string; border: string; borderDark: string;
  accent: string; accentDark: string; glow: string;
}> = {
  sales:        { bg: "#f0fdf4", bgDark: "rgba(22,163,74,0.06)", border: "#86efac", borderDark: "rgba(22,163,74,0.2)", accent: "#16a34a", accentDark: "#4ade80", glow: "162" },
  marketing:    { bg: "#f5f3ff", bgDark: "rgba(124,58,237,0.06)", border: "#c4b5fd", borderDark: "rgba(124,58,237,0.2)", accent: "#7c3aed", accentDark: "#a78bfa", glow: "280" },
  operations:   { bg: "#fffbeb", bgDark: "rgba(217,119,6,0.06)",  border: "#fcd34d", borderDark: "rgba(217,119,6,0.2)",  accent: "#d97706", accentDark: "#fbbf24", glow: "45" },
  intelligence: { bg: "#ecfeff", bgDark: "rgba(8,145,178,0.06)",  border: "#67e8f9", borderDark: "rgba(8,145,178,0.2)",  accent: "#0891b2", accentDark: "#22d3ee", glow: "195" },
};

const DEPT_ICONS: Record<string, typeof TrendingUp> = {
  "trending-up": TrendingUp,
  megaphone: Megaphone,
  settings: Settings,
  "bar-chart": BarChart3,
};

// Map department manager names to department keys
function detectDepartmentKey(name: string): DepartmentKey {
  const n = name.toLowerCase();
  if (n.includes("sales")) return "sales";
  if (n.includes("marketing")) return "marketing";
  if (n.includes("intel")) return "intelligence";
  return "operations";
}

function isDeptManager(node: OrgNode): boolean {
  return !!(node.metadata as Record<string, unknown>)?.isDepartmentManager;
}

// ── Node accent colors for workers ──────────────────────────────────────
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

// ── Status helpers ──────────────────────────────────────────────────────
const statusConfig: Record<string, { color: string; label: string }> = {
  running: { color: "#10b981", label: "Running" },
  active: { color: "#10b981", label: "Active" },
  paused: { color: "#f59e0b", label: "Paused" },
  idle: { color: "#94a3b8", label: "Idle" },
  error: { color: "#ef4444", label: "Error" },
  terminated: { color: "#94a3b8", label: "Off" },
};

// ── Tree layout types ───────────────────────────────────────────────────
interface LayoutNode {
  id: string;
  name: string;
  role: string;
  title?: string;
  status: string;
  icon?: string;
  metadata?: Record<string, unknown> | null;
  lastHeartbeatAt?: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  colorIndex: number;
  depth: number;
  children: LayoutNode[];
}

// ── Layout algorithm ────────────────────────────────────────────────────
function nodeW(node: OrgNode): number {
  return node.role === "ceo" ? CEO_W : CARD_W;
}

function nodeH(node: OrgNode): number {
  return node.role === "ceo" ? CEO_H : CARD_H;
}

function subtreeWidth(node: OrgNode): number {
  const w = nodeW(node);
  if (node.reports.length === 0) return w;
  const childrenW = node.reports.reduce((sum, c) => sum + subtreeWidth(c), 0);
  const gaps = (node.reports.length - 1) * GAP_X;
  return Math.max(w, childrenW + gaps);
}

function layoutTree(node: OrgNode, x: number, y: number, colorIndex: number, depth: number): LayoutNode {
  const totalW = subtreeWidth(node);
  const w = nodeW(node);
  const h = nodeH(node);
  const layoutChildren: LayoutNode[] = [];

  if (node.reports.length > 0) {
    const childrenW = node.reports.reduce((sum, c) => sum + subtreeWidth(c), 0);
    const gaps = (node.reports.length - 1) * GAP_X;
    let cx = x + (totalW - childrenW - gaps) / 2;

    for (let i = 0; i < node.reports.length; i++) {
      const child = node.reports[i];
      const cw = subtreeWidth(child);
      layoutChildren.push(layoutTree(child, cx, y + h + GAP_Y, (colorIndex + i + 1) % NODE_COLORS.length, depth + 1));
      cx += cw + GAP_X;
    }
  }

  return {
    id: node.id,
    name: node.name,
    role: node.role,
    title: node.title,
    status: node.status,
    icon: node.icon,
    metadata: node.metadata,
    lastHeartbeatAt: node.lastHeartbeatAt,
    x: x + (totalW - w) / 2,
    y,
    w,
    h,
    colorIndex,
    depth,
    children: layoutChildren,
  };
}

function layoutForest(roots: OrgNode[]): LayoutNode[] {
  let x = PADDING;
  const result: LayoutNode[] = [];
  for (let i = 0; i < roots.length; i++) {
    const root = roots[i];
    const w = subtreeWidth(root);
    result.push(layoutTree(root, x, PADDING, i % NODE_COLORS.length, 0));
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

// ── Department group bounding boxes ─────────────────────────────────────
interface DeptGroup {
  deptKey: DepartmentKey;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  managerNode: LayoutNode;
}

function computeDeptGroups(allNodes: LayoutNode[]): DeptGroup[] {
  const groups: DeptGroup[] = [];
  for (const node of allNodes) {
    if (!isDeptManager(node as unknown as OrgNode)) continue;
    // Collect all descendants including the manager
    const descendants: LayoutNode[] = [];
    function collect(n: LayoutNode) {
      descendants.push(n);
      n.children.forEach(collect);
    }
    collect(node);

    if (descendants.length === 0) continue;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const d of descendants) {
      minX = Math.min(minX, d.x);
      minY = Math.min(minY, d.y);
      maxX = Math.max(maxX, d.x + d.w);
      maxY = Math.max(maxY, d.y + d.h);
    }

    const deptKey = detectDepartmentKey(node.name);
    groups.push({
      deptKey,
      label: node.title ?? node.name,
      x: minX - GROUP_PAD,
      y: minY - GROUP_PAD - 20, // extra space for label
      width: (maxX - minX) + GROUP_PAD * 2,
      height: (maxY - minY) + GROUP_PAD * 2 + 20,
      managerNode: node,
    });
  }
  return groups;
}

// ── Time ago helper ─────────────────────────────────────────────────────
function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ── Main component ──────────────────────────────────────────────────────
export function OrgChart() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
    setBreadcrumbs([{ label: "Team" }]);
  }, [setBreadcrumbs]);

  const layout = useMemo(() => layoutForest(orgTree ?? []), [orgTree]);
  const allNodes = useMemo(() => flattenLayout(layout), [layout]);
  const edges = useMemo(() => collectEdges(layout), [layout]);
  const deptGroups = useMemo(() => computeDeptGroups(allNodes), [allNodes]);

  // Collision keys for avatar initials — every name on the tree contributes.
  // When two agents share initials, agentInitials differentiates using role.
  const treeInitialsCollisionKeys = useMemo(() => {
    const set = new Set<string>();
    for (const n of allNodes) set.add(agentInitials(n.name));
    return set;
  }, [allNodes]);

  // Check if org is flat — use both layout-based detection AND agents list as fallback
  const hasDepartments = useMemo(() => {
    if (deptGroups.length > 0) return true;
    // Fallback: check agents list for isDepartmentManager metadata
    for (const a of agents ?? []) {
      if ((a.metadata as Record<string, unknown>)?.isDepartmentManager && a.status !== "terminated") return true;
    }
    return false;
  }, [deptGroups, agents]);

  const isFlat = !hasDepartments && allNodes.length > 2;

  // Setup departments mutation
  const setupDepts = useMutation({
    mutationFn: () => agentsApi.setupDepartments(selectedCompanyId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.org(selectedCompanyId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(selectedCompanyId!) });
    },
  });

  // Department stats for summary bar
  const deptStats = useMemo(() => {
    const stats: Array<{ key: DepartmentKey; label: string; count: number }> = [];
    for (const g of deptGroups) {
      const workerCount = g.managerNode.children.length;
      const shortLabel = g.deptKey.charAt(0).toUpperCase() + g.deptKey.slice(1);
      stats.push({ key: g.deptKey, label: shortLabel, count: workerCount });
    }
    return stats;
  }, [deptGroups]);

  const statusCounts = useMemo(() => {
    let active = 0, idle = 0, paused = 0;
    for (const n of allNodes) {
      if (isDeptManager(n as unknown as OrgNode)) continue;
      if (n.status === "running" || n.status === "active") active++;
      else if (n.status === "paused") paused++;
      else idle++;
    }
    return { active, idle, paused };
  }, [allNodes]);

  const bounds = useMemo(() => {
    if (allNodes.length === 0) return { width: 800, height: 600 };
    let maxX = 0, maxY = 0;
    for (const n of allNodes) {
      maxX = Math.max(maxX, n.x + n.w);
      maxY = Math.max(maxY, n.y + n.h);
    }
    // Account for group boxes
    for (const g of deptGroups) {
      maxX = Math.max(maxX, g.x + g.width);
      maxY = Math.max(maxY, g.y + g.height);
    }
    return { width: maxX + PADDING, height: maxY + PADDING };
  }, [allNodes, deptGroups]);

  // ── Pan & zoom ──────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
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

  // ── Renders ─────────────────────────────────────────────────────────

  if (!selectedCompanyId) {
    return <EmptyState icon={Network} message="Select a company to view the org chart." />;
  }
  if (isLoading) return <PageSkeleton variant="org-chart" />;
  if (orgTree && orgTree.length === 0) {
    return <EmptyState icon={Network} message="No organizational hierarchy defined." />;
  }

  return (
    <div className="flex flex-col h-full -m-6 -mt-2">
      {/* Canvas — full bleed, no border */}
      <div
        ref={containerRef}
        className="w-full flex-1 min-h-0 overflow-hidden relative"
        style={{
          cursor: dragging ? "grabbing" : "grab",
          // Dot grid background — subtle dots at intersections
          background: `
            radial-gradient(circle, oklch(0.72 0.01 265 / 0.12) 1px, transparent 1px),
            radial-gradient(ellipse 80% 60% at 50% 40%, oklch(0.72 0.18 162 / 0.02) 0%, transparent 70%),
            var(--background)
          `,
          backgroundSize: "24px 24px, 100% 100%, 100% 100%",
          backgroundPosition: `${pan.x % 24}px ${pan.y % 24}px, 0 0, 0 0`,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Top-left: department chips + status */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
          {deptStats.length > 0 && deptStats.map((d) => {
            const colors = DEPARTMENT_COLORS[d.key];
            return (
              <span
                key={d.key}
                className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground bg-card/80 backdrop-blur-sm border border-border rounded-full px-2.5 py-1"
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors.accent }} />
                {d.label}
                <span className="text-muted-foreground/50">{d.count}</span>
              </span>
            );
          })}

          {isFlat && (
            <button
              onClick={() => setupDepts.mutate()}
              disabled={setupDepts.isPending}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary bg-card/80 backdrop-blur-sm border border-border rounded-full px-2.5 py-1 hover:bg-card transition-colors"
            >
              <Layers className="h-3 w-3" />
              {setupDepts.isPending ? "Setting up..." : "Set up departments"}
            </button>
          )}
        </div>

        {/* Top-right: status counts */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2 text-[11px] text-muted-foreground">
          {statusCounts.active > 0 && (
            <span className="flex items-center gap-1 bg-card/80 backdrop-blur-sm border border-border rounded-full px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {statusCounts.active} active
            </span>
          )}
          {statusCounts.idle > 0 && (
            <span className="flex items-center gap-1 bg-card/80 backdrop-blur-sm border border-border rounded-full px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              {statusCounts.idle} idle
            </span>
          )}
          {statusCounts.paused > 0 && (
            <span className="flex items-center gap-1 bg-card/80 backdrop-blur-sm border border-border rounded-full px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              {statusCounts.paused} paused
            </span>
          )}
        </div>

        {/* Bottom: zoom controls */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-0.5 bg-card/80 backdrop-blur-sm border border-border rounded-full shadow-xs px-1 py-0.5">
          <button
            className="w-7 h-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            onClick={() => zoomTo(0.8)}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="text-[10px] font-mono text-muted-foreground w-9 text-center select-none">
            {Math.round(zoom * 100)}%
          </span>
          <button
            className="w-7 h-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            onClick={() => zoomTo(1.2)}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <div className="w-px h-3.5 bg-border mx-0.5" />
          <button
            className="w-7 h-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            onClick={fitToScreen}
            aria-label="Fit to screen"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* SVG layer — group boxes + edges */}
        <svg className="absolute inset-0 pointer-events-none" style={{ width: "100%", height: "100%" }}>
          <defs>
            {/* Per-department edge gradients */}
            {(Object.entries(DEPARTMENT_COLORS) as [DepartmentKey, typeof DEPARTMENT_COLORS.sales][]).map(([key, colors]) => (
              <linearGradient key={key} id={`edge-grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.accent} stopOpacity="0.35" />
                <stop offset="100%" stopColor={colors.accent} stopOpacity="0.08" />
              </linearGradient>
            ))}
            <linearGradient id="edge-grad-default" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.08" />
            </linearGradient>
          </defs>

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Department group backgrounds */}
            {deptGroups.map((g) => {
              const colors = DEPARTMENT_COLORS[g.deptKey];
              return (
                <g key={g.deptKey} className="org-group-enter">
                  {/* Group background */}
                  <rect
                    x={g.x}
                    y={g.y}
                    width={g.width}
                    height={g.height}
                    rx={12}
                    ry={12}
                    fill={colors.accent}
                    fillOpacity={0.04}
                    stroke={colors.accent}
                    strokeOpacity={0.12}
                    strokeWidth={1}
                    strokeDasharray="6 4"
                  />
                  {/* Department label */}
                  <text
                    x={g.x + 12}
                    y={g.y + 14}
                    fill={colors.accent}
                    fillOpacity={0.5}
                    fontSize={9}
                    fontWeight={600}
                    letterSpacing="0.08em"
                  >
                    {g.deptKey.toUpperCase()}
                  </text>
                </g>
              );
            })}

            {/* Edge lines */}
            {edges.map(({ parent, child }) => {
              // Hide edges involving a ghost department-manager card — we
              // skipped rendering those cards above, so dangling lines would
              // point at empty space otherwise.
              const parentAgent = agentMap.get(parent.id);
              const childAgent = agentMap.get(child.id);
              if (parentAgent && isGhostDepartmentManager(parentAgent)) return null;
              if (childAgent && isGhostDepartmentManager(childAgent)) return null;
              const x1 = parent.x + parent.w / 2;
              const y1 = parent.y + parent.h;
              const x2 = child.x + child.w / 2;
              const y2 = child.y;
              const midY = y1 + (y2 - y1) * 0.5;

              // Determine edge color — use department color if child is in a department
              let gradientId = "edge-grad-default";
              if (isDeptManager(child as unknown as OrgNode)) {
                gradientId = `edge-grad-${detectDepartmentKey(child.name)}`;
              } else if (isDeptManager(parent as unknown as OrgNode)) {
                gradientId = `edge-grad-${detectDepartmentKey(parent.name)}`;
              }

              const isHovered = hoveredNodeId === parent.id || hoveredNodeId === child.id;
              const path = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;

              return (
                <g key={`${parent.id}-${child.id}`}>
                  {/* Shadow */}
                  <path
                    d={path}
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    strokeOpacity={0.05}
                    filter="blur(3px)"
                  />
                  {/* Animated main line */}
                  <path
                    d={path}
                    fill="none"
                    stroke={`url(#${gradientId})`}
                    strokeWidth={isHovered ? 2.5 : 1.5}
                    className="org-edge-animated"
                    style={{
                      transition: "stroke-width 0.2s ease",
                    }}
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
          {allNodes.map((node, i) => {
            const agent = agentMap.get(node.id);
            // Skip rendering ghost department-manager cards — the department
            // bounding box (rendered above from deptGroups) still appears, but
            // the cosmetic "Sales Manager" card is hidden from the org chart.
            if (agent && isGhostDepartmentManager(agent)) return null;
            const isCeo = node.role === "ceo";
            const isManager = isDeptManager(node as unknown as OrgNode);
            const deptKey = isManager ? detectDepartmentKey(node.name) : null;
            const deptColors = deptKey ? DEPARTMENT_COLORS[deptKey] : null;
            const colors = NODE_COLORS[node.colorIndex % NODE_COLORS.length];
            const sConfig = statusConfig[node.status] ?? statusConfig.idle;
            const initials = agentInitials(node.name, node.role, treeInitialsCollisionKeys);
            const isLive = node.status === "running" || node.status === "active";
            const isHovered = hoveredNodeId === node.id;

            // Stagger animation delay based on depth
            const animDelay = isCeo ? 0 : isManager ? 200 + i * 60 : 400 + i * 40;

            // ── CEO card ──────────────────────────────────────────
            if (isCeo) {
              return (
                <div
                  key={node.id}
                  data-org-card
                  className="absolute rounded-2xl cursor-pointer select-none org-node-enter org-ceo-card"
                  style={{
                    left: node.x,
                    top: node.y,
                    width: CEO_W,
                    minHeight: CEO_H,
                    animationDelay: `${animDelay}ms`,
                    background: "var(--card)",
                    border: "2px solid var(--primary)",
                    boxShadow: isHovered
                      ? "0 8px 32px rgba(0,0,0,0.12), 0 0 0 4px oklch(0.72 0.18 162 / 0.12)"
                      : undefined,
                    transition: "transform 0.2s ease, box-shadow 0.2s ease",
                    transform: isHovered ? "translateY(-3px)" : undefined,
                  }}
                  onClick={() => navigate(agent ? agentUrl(agent) : `/agents/${node.id}`)}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                >
                  {/* Crown badge */}
                  <div
                    className="absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full flex items-center justify-center"
                    style={{
                      background: "var(--primary)",
                      boxShadow: "0 2px 8px oklch(0.72 0.18 162 / 0.3)",
                    }}
                  >
                    <Crown className="h-3 w-3 text-white" />
                  </div>

                  <div className="flex items-center px-5 py-4 gap-4">
                    {/* Avatar with status ring */}
                    <div className="relative shrink-0">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-[14px] font-bold"
                        style={{
                          background: "linear-gradient(135deg, var(--primary), oklch(0.55 0.22 162))",
                          color: "white",
                        }}
                      >
                        {initials}
                      </div>
                      {/* Status ring */}
                      <span
                        className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2"
                        style={{
                          backgroundColor: sConfig.color,
                          borderColor: "var(--card)",
                        }}
                      />
                      {isLive && (
                        <span
                          className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full"
                          style={{
                            backgroundColor: sConfig.color,
                            animation: "org-status-pulse 1.5s ease-out infinite",
                          }}
                        />
                      )}
                    </div>

                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-[15px] font-semibold text-foreground leading-tight truncate">
                        {node.name}
                      </span>
                      <span className="text-[12px] font-medium text-primary mt-0.5 truncate">
                        {agent?.title ?? "Chief Executive Officer"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            }

            // ── Department Manager card ───────────────────────────
            if (isManager && deptColors) {
              const DeptIcon = DEPT_ICONS[node.icon ?? ""] ?? Users;
              const childCount = node.children.length;
              return (
                <div
                  key={node.id}
                  data-org-card
                  className="absolute rounded-xl cursor-pointer select-none org-node-enter"
                  style={{
                    left: node.x,
                    top: node.y,
                    width: CARD_W,
                    minHeight: CARD_H,
                    animationDelay: `${animDelay}ms`,
                    background: "var(--card)",
                    borderLeft: `4px solid ${deptColors.accent}`,
                    borderTop: "1px solid var(--border)",
                    borderRight: "1px solid var(--border)",
                    borderBottom: "1px solid var(--border)",
                    boxShadow: isHovered
                      ? `0 6px 24px rgba(0,0,0,0.08), 0 0 0 2px ${deptColors.accent}30`
                      : "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.02)",
                    transition: "transform 0.2s ease, box-shadow 0.2s ease",
                    transform: isHovered ? "translateY(-2px)" : undefined,
                  }}
                  onClick={() => navigate(agent ? agentUrl(agent) : `/agents/${node.id}`)}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                >
                  <div className="flex items-center px-3.5 py-3 gap-3">
                    {/* Department icon */}
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: deptColors.bg,
                        color: deptColors.accent,
                      }}
                    >
                      <DeptIcon className="h-4 w-4" />
                    </div>

                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-[12px] font-semibold text-foreground leading-tight truncate">
                        {node.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">
                        {childCount} agent{childCount !== 1 ? "s" : ""}
                      </span>
                    </div>

                    {/* Paused indicator */}
                    {node.status === "paused" && (
                      <span className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-wide">
                        relay
                      </span>
                    )}
                  </div>
                </div>
              );
            }

            // ── Worker Agent card ─────────────────────────────────
            // Determine worker's department color from parent
            let workerDeptColors: typeof DEPARTMENT_COLORS.sales | null = null;
            for (const g of deptGroups) {
              const isChild = g.managerNode.children.some(c => c.id === node.id);
              if (isChild) {
                workerDeptColors = DEPARTMENT_COLORS[g.deptKey];
                break;
              }
            }

            return (
              <div
                key={node.id}
                data-org-card
                className="absolute rounded-xl cursor-pointer select-none org-node-enter"
                style={{
                  left: node.x,
                  top: node.y,
                  width: CARD_W,
                  minHeight: CARD_H,
                  animationDelay: `${animDelay}ms`,
                  backgroundColor: colors.bg,
                  borderLeft: workerDeptColors ? `3px solid ${workerDeptColors.accent}` : `1px solid ${colors.border}`,
                  borderTop: `1px solid ${colors.border}`,
                  borderRight: `1px solid ${colors.border}`,
                  borderBottom: `1px solid ${colors.border}`,
                  boxShadow: isHovered
                    ? `0 6px 24px rgba(0,0,0,0.1), 0 0 0 2px ${(workerDeptColors?.accent ?? colors.accent)}30`
                    : "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.02)",
                  transition: "transform 0.2s ease, box-shadow 0.2s ease",
                  transform: isHovered ? "translateY(-3px)" : undefined,
                }}
                onClick={() => navigate(agent ? agentUrl(agent) : `/agents/${node.id}`)}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
              >
                <div className="flex items-center px-4 py-3 gap-3">
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
                    {/* Status dot with pulse for active */}
                    <span
                      className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2"
                      style={{
                        backgroundColor: sConfig.color,
                        borderColor: colors.bg,
                      }}
                    />
                    {isLive && (
                      <span
                        className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full"
                        style={{
                          backgroundColor: sConfig.color,
                          animation: "org-status-pulse 1.5s ease-out infinite",
                        }}
                      />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[13px] font-semibold text-foreground leading-tight truncate">
                      {node.name}
                    </span>
                    <span
                      className="text-[11px] font-medium mt-0.5 truncate"
                      style={{ color: workerDeptColors?.accent ?? colors.accent }}
                    >
                      {agent?.title ?? roleLabel(node.role)}
                    </span>
                    {node.lastHeartbeatAt && (
                      <span className="text-[9px] text-muted-foreground/50 font-mono leading-tight mt-0.5">
                        {timeAgo(node.lastHeartbeatAt)}
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
