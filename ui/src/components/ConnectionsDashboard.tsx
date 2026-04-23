/**
 * ConnectionsDashboard — company-wide overseer view of every credential.
 *
 * Replaces the hardcoded stub in CompanySettings.tsx. Read-only for now:
 * shows every credential in the company with its status, expiry, owner,
 * and "also used by" list. Filter tabs for All / Active / Expiring /
 * Orphaned. Clicking a row jumps to the owner agent's profile.
 *
 * The primary UI for CONNECTING things still lives on the agent page.
 * This dashboard is for monitoring + managing existing connections
 * across the whole team in one place.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@/lib/router";
import {
  MessageCircle,
  Mail,
  Instagram,
  Calendar,
  Megaphone,
  Check,
  AlertCircle,
  Clock,
  Users,
  Loader2,
} from "lucide-react";
import { cn } from "../lib/utils";
import { timeAgo } from "../lib/timeAgo";
import {
  agentCredentialsApi,
  type AvailableCompanyCredential,
} from "../api/agent-credentials";

type FilterTab = "all" | "active" | "expiring" | "orphaned";

interface ServiceMeta {
  label: string;
  icon: typeof MessageCircle;
  color: string;
  bgColor: string;
}

const SERVICE_META: Record<string, ServiceMeta> = {
  whatsapp: { label: "WhatsApp", icon: MessageCircle, color: "text-green-600", bgColor: "bg-green-500/10" },
  whatsapp_baileys: { label: "WhatsApp", icon: MessageCircle, color: "text-green-600", bgColor: "bg-green-500/10" },
  gmail: { label: "Gmail", icon: Mail, color: "text-red-500", bgColor: "bg-red-500/10" },
  instagram: { label: "Instagram", icon: Instagram, color: "text-pink-500", bgColor: "bg-pink-500/10" },
  facebook: { label: "Facebook Ads", icon: Megaphone, color: "text-blue-600", bgColor: "bg-blue-500/10" },
  google_calendar: { label: "Google Calendar", icon: Calendar, color: "text-blue-500", bgColor: "bg-blue-500/10" },
};

const FALLBACK_META: ServiceMeta = {
  label: "Unknown service",
  icon: AlertCircle,
  color: "text-muted-foreground",
  bgColor: "bg-muted/30",
};

function getServiceMeta(service: string): ServiceMeta {
  return SERVICE_META[service] ?? FALLBACK_META;
}

function classifyExpiry(expiresAt: string | null): "active" | "expiring" | "expired" | "never" {
  if (!expiresAt) return "never";
  const now = Date.now();
  const expiry = new Date(expiresAt).getTime();
  if (expiry < now) return "expired";
  // Expiring = within 7 days
  if (expiry < now + 7 * 24 * 60 * 60 * 1000) return "expiring";
  return "active";
}

export function ConnectionsDashboard({ companyId }: { companyId: string }) {
  const [filter, setFilter] = useState<FilterTab>("all");

  const { data: all, isLoading } = useQuery({
    queryKey: ["company-creds-available", companyId, undefined],
    queryFn: () => agentCredentialsApi.listCompanyAvailable(companyId),
  });

  const { data: orphaned } = useQuery({
    queryKey: ["company-creds-orphaned", companyId],
    queryFn: () => agentCredentialsApi.listCompanyOrphaned(companyId),
  });

  const filtered = useMemo(() => {
    const creds = all ?? [];
    switch (filter) {
      case "active":
        return creds.filter((c) => {
          const cls = classifyExpiry(c.expiresAt);
          return cls === "active" || cls === "never";
        });
      case "expiring":
        return creds.filter((c) => {
          const cls = classifyExpiry(c.expiresAt);
          return cls === "expiring" || cls === "expired";
        });
      case "orphaned":
        return orphaned ?? [];
      case "all":
      default:
        return creds;
    }
  }, [all, orphaned, filter]);

  const counts = useMemo(() => {
    const creds = all ?? [];
    return {
      all: creds.length,
      active: creds.filter((c) => {
        const cls = classifyExpiry(c.expiresAt);
        return cls === "active" || cls === "never";
      }).length,
      expiring: creds.filter((c) => {
        const cls = classifyExpiry(c.expiresAt);
        return cls === "expiring" || cls === "expired";
      }).length,
      orphaned: (orphaned ?? []).length,
    };
  }, [all, orphaned]);

  return (
    <div className="rounded-xl border border-border/50 bg-card/80 overflow-hidden">
      <div className="px-3.5 py-3 border-b border-border/40 bg-muted/20 flex items-center justify-between">
        <span className="text-[12px] font-bold">Connections</span>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {counts.all} total
        </span>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-0.5 px-3.5 pt-2.5 pb-2 border-b border-border/40">
        <FilterButton label="All" count={counts.all} active={filter === "all"} onClick={() => setFilter("all")} />
        <FilterButton label="Active" count={counts.active} active={filter === "active"} onClick={() => setFilter("active")} />
        <FilterButton label="Expiring" count={counts.expiring} active={filter === "expiring"} onClick={() => setFilter("expiring")} tone="warning" />
        <FilterButton label="Orphaned" count={counts.orphaned} active={filter === "orphaned"} onClick={() => setFilter("orphaned")} tone="muted" />
      </div>

      {/* Body */}
      <div>
        {isLoading ? (
          <div className="px-4 py-8 text-center text-[12px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin inline mr-2" />
            Loading connections...
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-[12px] text-muted-foreground">
            {filter === "all" ? (
              <>
                No connections yet. Open an agent's page to connect WhatsApp, Gmail, or other services.
              </>
            ) : filter === "expiring" ? (
              <>Nothing expiring soon. Everything's healthy.</>
            ) : filter === "orphaned" ? (
              <>No orphaned connections. Credentials are cleaned up automatically when their last agent leaves.</>
            ) : (
              <>No active connections.</>
            )}
          </div>
        ) : (
          filtered.map((cred, idx) => (
            <CredentialRow
              key={cred.id}
              cred={cred}
              isLast={idx === filtered.length - 1}
            />
          ))
        )}
      </div>
    </div>
  );
}

function FilterButton({
  label,
  count,
  active,
  onClick,
  tone,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  tone?: "warning" | "muted";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      )}
    >
      {label}
      {count > 0 && (
        <span
          className={cn(
            "ml-1.5 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-bold tabular-nums",
            active
              ? "bg-primary/20"
              : tone === "warning"
                ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                : tone === "muted"
                  ? "bg-muted-foreground/15"
                  : "bg-muted-foreground/10",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function CredentialRow({ cred, isLast }: { cred: AvailableCompanyCredential; isLast: boolean }) {
  const meta = getServiceMeta(cred.service);
  const Icon = meta.icon;
  const expiryClass = classifyExpiry(cred.expiresAt);
  const ownerAgentId = cred.connectedByAgentId ?? cred.linkedAgentIds[0];

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3",
        !isLast && "border-b border-border/40",
      )}
    >
      {/* Icon */}
      <div className={cn("flex items-center justify-center h-8 w-8 rounded-lg shrink-0", meta.bgColor)}>
        <Icon className={cn("h-4 w-4", meta.color)} />
      </div>

      {/* Service + account label */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium truncate">{meta.label}</span>
          {/* Expiry indicator */}
          {expiryClass === "active" || expiryClass === "never" ? (
            <Check className="h-3 w-3 text-green-500 shrink-0" />
          ) : expiryClass === "expiring" ? (
            <Clock className="h-3 w-3 text-amber-500 shrink-0" />
          ) : (
            <AlertCircle className="h-3 w-3 text-red-500 shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
          <span className="truncate">
            {cred.accountLabel ?? cred.gmailAddress ?? cred.whatsappPhoneNumberId ?? cred.providerAccountId ?? "Unlabeled"}
          </span>
          {cred.connectedAt && (
            <>
              <span>·</span>
              <span>connected {timeAgo(cred.connectedAt)}</span>
            </>
          )}
        </div>
      </div>

      {/* Usage (how many agents) */}
      <div className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground shrink-0 min-w-[100px]">
        {cred.linkedAgentIds.length > 0 ? (
          <>
            <Users className="h-3 w-3" />
            <span className="truncate">
              {cred.linkedAgentNames.slice(0, 2).join(", ")}
              {cred.linkedAgentNames.length > 2 && ` +${cred.linkedAgentNames.length - 2}`}
            </span>
          </>
        ) : (
          <span className="italic text-muted-foreground/60">Orphaned</span>
        )}
      </div>

      {/* Quick link to owner */}
      {ownerAgentId && (
        <Link
          to={`/agents/${ownerAgentId}/dashboard`}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors no-underline shrink-0"
        >
          View →
        </Link>
      )}
    </div>
  );
}
