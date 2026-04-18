import {
  LayoutDashboard,
  DollarSign,
  Search,
  Repeat,
  Settings,
  MessageSquare,
  ShieldCheck,
  FileText,
  Users,
  UserSearch,
  Activity,
  BookOpen,
  CheckSquare,
  Building2,
  FolderOpen,
  Sun,
  Moon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { SidebarSection } from "./SidebarSection";
import { SidebarNavItem } from "./SidebarNavItem";
import { SidebarAgents } from "./SidebarAgents";
import { useDialog } from "../context/DialogContext";
import { useTheme } from "../context/ThemeContext";
import { useCompany } from "../context/CompanyContext";
import { heartbeatsApi } from "../api/heartbeats";
import { approvalsApi } from "../api/approvals";
import { authApi } from "../api/auth";
import { sidebarBadgesApi } from "../api/sidebarBadges";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { PluginSlotOutlet } from "@/plugins/slots";

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:bg-accent/50 hover:text-foreground transition-all duration-150 shrink-0"
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <Sun className="w-[13px] h-[13px]" aria-hidden="true" /> : <Moon className="w-[13px] h-[13px]" aria-hidden="true" />}
    </button>
  );
}

export function Sidebar() {
  const { selectedCompanyId, selectedCompany } = useCompany();

  const { data: sidebarBadges } = useQuery({
    queryKey: queryKeys.sidebarBadges(selectedCompanyId!),
    queryFn: () => sidebarBadgesApi.get(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 15_000,
  });

  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.liveRuns(selectedCompanyId!),
    queryFn: () => heartbeatsApi.liveRunsForCompany(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 10_000,
  });
  const liveRunCount = liveRuns?.length ?? 0;

  const { data: approvals } = useQuery({
    queryKey: queryKeys.approvals.list(selectedCompanyId!),
    queryFn: () => approvalsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 15_000,
  });

  const { data: session } = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
  });

  const pendingApprovals = (approvals ?? []).filter(
    (a) => a.status === "pending" || a.status === "revision_requested",
  ).length;

  const userInitials = (() => {
    const name = session?.user?.name ?? session?.user?.email ?? "";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase() || "AJ";
  })();

  function openSearch() {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
  }

  function toggleActivityPanel() {
    document.dispatchEvent(new Event("toggle-activity-panel"));
  }

  const pluginContext = {
    companyId: selectedCompanyId,
    companyPrefix: selectedCompany?.issuePrefix ?? null,
  };

  return (
    <aside className="w-[240px] h-full min-h-0 border-r border-sidebar-border/60 bg-sidebar/95 backdrop-blur-xl flex flex-col">
      {/* Header — logo + company name + search */}
      <div className="flex items-center gap-2 px-3 h-[50px] shrink-0 border-b border-sidebar-border/50">
        {selectedCompany?.brandColor ? (
          <div
            className="w-6 h-6 rounded-md shrink-0 flex items-center justify-center"
            style={{ backgroundColor: selectedCompany.brandColor }}
          >
            <span className="text-white text-[8px] font-bold">AW</span>
          </div>
        ) : (
          <div className="w-6 h-6 rounded-md shrink-0 bg-primary flex items-center justify-center">
            <span className="text-white text-[8px] font-bold">AW</span>
          </div>
        )}
        <span className="flex-1 text-[13px] font-bold text-sidebar-foreground truncate">
          {selectedCompany?.name ?? "Aygency World"}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-sidebar-foreground/30 hover:text-sidebar-foreground shrink-0 h-6 w-6"
          onClick={openSearch}
        >
          <Search className="h-3 w-3" />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 min-h-0 overflow-y-auto scrollbar-auto-hide flex flex-col gap-4 px-2 py-2.5">
        {/* Primary nav — no section header */}
        <div className="flex flex-col gap-0.5">
          <SidebarNavItem to="/ceo-chat" label="CEO Chat" icon={MessageSquare} badge={sidebarBadges?.ceoChatUnread} />
          <div data-tour="sidebar-dashboard">
            <SidebarNavItem to="/dashboard" label="Dashboard" icon={LayoutDashboard} liveCount={liveRunCount} />
          </div>
          <div data-tour="sidebar-approvals">
            <SidebarNavItem
              to="/approvals/pending"
              label="Inbox"
              icon={ShieldCheck}
              badge={pendingApprovals}
            />
          </div>
        </div>

        {/* PIPELINE */}
        <SidebarSection label="Pipeline">
          <div data-tour="sidebar-leads">
            <SidebarNavItem to="/leads" label="Leads" icon={UserSearch} />
          </div>
          <SidebarNavItem to="/properties" label="Properties" icon={Building2} />
        </SidebarSection>

        {/* TEAM */}
        <SidebarSection label="Team">
          <SidebarNavItem to="/agents" label="Team" icon={Users} />
        </SidebarSection>

        {/* Individual agents */}
        <div data-tour="sidebar-agents">
          <SidebarAgents />
        </div>

        {/* WORKSPACE */}
        <SidebarSection label="Workspace">
          <SidebarNavItem to="/knowledge-base" label="Knowledge Base" icon={FolderOpen} />
          <div data-tour="sidebar-settings">
            <SidebarNavItem to="/company/settings" label="Settings" icon={Settings} />
          </div>
        </SidebarSection>

        <PluginSlotOutlet
          slotTypes={["sidebarPanel"]}
          context={pluginContext}
          className="flex flex-col gap-3"
          itemClassName="rounded-xl border border-border p-3"
          missingBehavior="placeholder"
        />
      </nav>

      {/* Footer — theme toggle + user avatar */}
      <div className="border-t border-sidebar-border/50 px-2 py-2 flex items-center gap-1">
        <ThemeToggle />
        <div className="flex-1" />
        <div
          className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0"
          title={session?.user?.name ?? session?.user?.email ?? ""}
        >
          {userInitials}
        </div>
      </div>
    </aside>
  );
}
