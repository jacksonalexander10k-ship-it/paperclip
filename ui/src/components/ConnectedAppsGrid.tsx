import { useQuery } from "@tanstack/react-query";
import { agentCredentialsApi } from "../api/agent-credentials";
import { cn } from "../lib/utils";
import { timeAgo } from "../lib/timeAgo";
import {
  MessageCircle, Mail, Instagram, Calendar,
  Megaphone, Check, X, Link2,
} from "lucide-react";

interface ServiceConfig {
  key: string;
  label: string;
  icon: typeof MessageCircle;
  color: string;
  bgColor: string;
}

const SERVICES: ServiceConfig[] = [
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "text-green-600", bgColor: "bg-green-500/10" },
  { key: "whatsapp_baileys", label: "WhatsApp", icon: MessageCircle, color: "text-green-600", bgColor: "bg-green-500/10" },
  { key: "gmail", label: "Gmail", icon: Mail, color: "text-red-500", bgColor: "bg-red-500/10" },
  { key: "instagram", label: "Instagram", icon: Instagram, color: "text-pink-500", bgColor: "bg-pink-500/10" },
  { key: "google_calendar", label: "Calendar", icon: Calendar, color: "text-blue-500", bgColor: "bg-blue-500/10" },
  { key: "facebook", label: "Facebook Ads", icon: Megaphone, color: "text-blue-600", bgColor: "bg-blue-500/10" },
];

// Deduplicate WhatsApp variants — show only one slot
function deduplicateServices(connectedKeys: Set<string>): ServiceConfig[] {
  const seen = new Set<string>();
  return SERVICES.filter((s) => {
    // Combine whatsapp + whatsapp_baileys into one "WhatsApp" slot
    const displayKey = s.key === "whatsapp_baileys" ? "whatsapp" : s.key;
    if (seen.has(displayKey)) return false;
    seen.add(displayKey);
    return true;
  }).map((s) => {
    // If whatsapp_baileys is connected, show the whatsapp slot as connected
    if (s.key === "whatsapp" && !connectedKeys.has("whatsapp") && connectedKeys.has("whatsapp_baileys")) {
      return { ...s, key: "whatsapp_baileys" };
    }
    return s;
  });
}

export function ConnectedAppsGrid({
  agentId,
  className,
}: {
  agentId: string;
  className?: string;
}) {
  const { data: credentials, isLoading } = useQuery({
    queryKey: ["agent-credentials", agentId],
    queryFn: () => agentCredentialsApi.list(agentId),
  });

  const connectedMap = new Map<string, { connectedAt: string | null }>();
  for (const cred of credentials ?? []) {
    connectedMap.set(cred.service, { connectedAt: cred.connectedAt });
  }

  const connectedKeys = new Set(connectedMap.keys());
  const services = deduplicateServices(connectedKeys);
  const connectedCount = services.filter((s) => connectedMap.has(s.key)).length;

  if (isLoading) return null;

  return (
    <div className={cn("rounded-xl border border-border/60 overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-muted/30">
        <div className="flex items-center gap-2">
          <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[12px] font-semibold text-foreground">Connected Apps</span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {connectedCount}/{services.length} connected
        </span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-border/30">
        {services.map((service) => {
          const Icon = service.icon;
          const cred = connectedMap.get(service.key);
          const isConnected = !!cred;

          return (
            <div
              key={service.key}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 bg-background",
                isConnected ? "opacity-100" : "opacity-50",
              )}
            >
              <div className={cn("flex items-center justify-center h-7 w-7 rounded-lg shrink-0", service.bgColor)}>
                <Icon className={cn("h-3.5 w-3.5", service.color)} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-medium truncate">{service.label}</span>
                  {isConnected ? (
                    <Check className="h-3 w-3 text-green-500 shrink-0" />
                  ) : (
                    <X className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                  )}
                </div>
                {isConnected && cred?.connectedAt && (
                  <span className="text-[9px] text-muted-foreground">
                    {timeAgo(cred.connectedAt)}
                  </span>
                )}
                {!isConnected && (
                  <span className="text-[9px] text-muted-foreground/50">Not connected</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
