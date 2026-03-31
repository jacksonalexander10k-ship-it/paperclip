import {
  Inbox,
  LayoutDashboard,
  DollarSign,
  Search,
  Repeat,
  Settings,
  MessageSquare,
  ShieldCheck,
  FileText,
  Users,
  Activity,
  BookOpen,
  CheckSquare,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { SidebarSection } from "./SidebarSection";
import { SidebarNavItem } from "./SidebarNavItem";
import { SidebarAgents } from "./SidebarAgents";
import { useDialog } from "../context/DialogContext";
import { useCompany } from "../context/CompanyContext";
import { heartbeatsApi } from "../api/heartbeats";
import { approvalsApi } from "../api/approvals";
import { authApi } from "../api/auth";
import { queryKeys } from "../lib/queryKeys";
import { useInboxBadge } from "../hooks/useInboxBadge";
import { Button } from "@/components/ui/button";
import { PluginSlotOutlet } from "@/plugins/slots";

export function Sidebar() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const inboxBadge = useInboxBadge(selectedCompanyId);

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
    <aside className="w-[205px] h-full min-h-0 border-r border-sidebar-border/60 bg-sidebar/95 backdrop-blur-xl flex flex-col">
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
          <SidebarNavItem to="/ceo-chat" label="CEO Chat" icon={MessageSquare} />
          <SidebarNavItem to="/dashboard" label="Dashboard" icon={LayoutDashboard} liveCount={liveRunCount} />
          <SidebarNavItem
            to="/inbox"
            label="Inbox"
            icon={Inbox}
            badge={inboxBadge.inbox}
            badgeTone={inboxBadge.failedRuns > 0 ? "danger" : "default"}
            alert={inboxBadge.failedRuns > 0}
          />
          <PluginSlotOutlet
            slotTypes={["sidebar"]}
            context={pluginContext}
            className="flex flex-col gap-0.5"
            itemClassName="text-[12.5px] font-medium"
            missingBehavior="placeholder"
          />
        </div>

        {/* WORK */}
        <SidebarSection label="Work">
          <SidebarNavItem to="/issues" label="Tasks" icon={CheckSquare} />
          <SidebarNavItem
            to="/approvals/pending"
            label="Approvals"
            icon={ShieldCheck}
            badge={pendingApprovals}
          />
          <SidebarNavItem to="/routines" label="Automations" icon={Repeat} />
          <SidebarNavItem to="/deliverables" label="Deliverables" icon={FileText} />
        </SidebarSection>

        {/* TEAM */}
        <SidebarSection label="Team">
          <SidebarNavItem to="/agents" label="All Agents" icon={Users} />
        </SidebarSection>

        {/* Individual agents */}
        <SidebarAgents />

        {/* AGENCY */}
        <SidebarSection label="Agency">
          <SidebarNavItem to="/costs" label="Budget" icon={DollarSign} />
          <button
            onClick={toggleActivityPanel}
            className="flex items-center gap-2.5 px-2 py-1.5 text-[12.5px] font-medium rounded-lg text-muted-foreground/60 hover:bg-accent/50 hover:text-foreground transition-all duration-150 w-full text-left"
          >
            <Activity className="w-[13px] h-[13px] shrink-0" />
            <span className="truncate">Live Activity</span>
          </button>
          <SidebarNavItem to="/company/settings" label="Settings" icon={Settings} />
        </SidebarSection>

        <PluginSlotOutlet
          slotTypes={["sidebarPanel"]}
          context={pluginContext}
          className="flex flex-col gap-3"
          itemClassName="rounded-xl border border-border p-3"
          missingBehavior="placeholder"
        />
      </nav>

      {/* Footer — docs + user avatar */}
      <div className="border-t border-sidebar-border/50 px-2 py-2 flex items-center gap-1">
        <a
          href="https://docs.paperclip.ing/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-2 py-1.5 text-[12.5px] font-medium text-muted-foreground/40 hover:bg-accent/50 hover:text-foreground transition-all duration-150 flex-1 rounded-lg"
        >
          <BookOpen className="w-[13px] h-[13px] shrink-0" />
          <span className="truncate">Docs</span>
        </a>
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
