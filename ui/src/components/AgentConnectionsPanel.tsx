/**
 * AgentConnectionsPanel — editable per-agent connections section.
 *
 * Replaces the read-only ConnectedAppsGrid on the agent dashboard. For
 * each service (WhatsApp, Gmail, Instagram, Facebook Ads, Calendar),
 * shows one of three states:
 *
 *   1. Not connected (no credentials exist in the company for this service)
 *      → [Connect {service}]
 *
 *   2. Not connected but others exist in the company
 *      → [Connect new] [Join existing ▾]
 *
 *   3. Connected
 *      → Shows account label, last synced time, "also used by" list,
 *        [Disconnect] and (for joinable services) [Switch account ▾]
 *
 * WhatsApp is the one service that can NEVER be joined — Baileys holds
 * one active session per phone number. Enforced at the service layer
 * and hidden in the UI by removing the "Join existing" option.
 *
 * Connection flows per service:
 *   - WhatsApp: opens the existing <WhatsAppConnect> QR-scan modal
 *   - Gmail: opens the existing Gmail OAuth popup flow
 *   - Instagram / Facebook Ads: OAuth popup flow (Meta)
 *   - Google Calendar: coming soon — shows a muted "Coming soon" hint
 */

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@/lib/router";
import {
  MessageCircle,
  Mail,
  Instagram,
  Calendar,
  Megaphone,
  Check,
  Loader2,
  Plus,
  Users,
  ChevronDown,
  Unlink,
  AlertCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "../lib/utils";
import { timeAgo } from "../lib/timeAgo";
import {
  agentCredentialsApi,
  type AgentCredentialWithSharing,
  type AvailableCompanyCredential,
} from "../api/agent-credentials";
import { WhatsAppConnect } from "./WhatsAppConnect";

interface ServiceDefinition {
  /** The canonical service key used in the credentials table. */
  key: string;
  /** Alternate service keys that should be deduplicated into this one. */
  aliases?: string[];
  label: string;
  icon: typeof MessageCircle;
  color: string;
  bgColor: string;
  /** Can multiple agents share one credential? WhatsApp = false. */
  joinable: boolean;
  /** Is the connect flow wired up in this sprint? */
  connectable: boolean;
  /** Short tooltip if not yet connectable. */
  pendingReason?: string;
}

const SERVICES: ServiceDefinition[] = [
  {
    key: "whatsapp",
    aliases: ["whatsapp_baileys"],
    label: "WhatsApp",
    icon: MessageCircle,
    color: "text-green-600",
    bgColor: "bg-green-500/10",
    joinable: false,
    connectable: true,
  },
  {
    key: "gmail",
    label: "Gmail",
    icon: Mail,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    joinable: true,
    connectable: true,
  },
  {
    key: "instagram",
    label: "Instagram",
    icon: Instagram,
    color: "text-pink-500",
    bgColor: "bg-pink-500/10",
    joinable: true,
    connectable: true,
  },
  {
    key: "facebook",
    label: "Facebook Ads",
    icon: Megaphone,
    color: "text-blue-600",
    bgColor: "bg-blue-500/10",
    joinable: true,
    connectable: true,
  },
  {
    key: "google_calendar",
    label: "Google Calendar",
    icon: Calendar,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    joinable: true,
    connectable: false,
    pendingReason: "Coming soon",
  },
];

function serviceMatches(credentialService: string, def: ServiceDefinition): boolean {
  if (credentialService === def.key) return true;
  return def.aliases?.includes(credentialService) ?? false;
}

export function AgentConnectionsPanel({
  agentId,
  agentName,
  companyId,
}: {
  agentId: string;
  agentName: string;
  companyId: string;
}) {
  const queryClient = useQueryClient();
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [pendingJoinService, setPendingJoinService] = useState<string | null>(null);

  // This agent's current credential links (with sharing info)
  const { data: agentCreds, isLoading } = useQuery({
    queryKey: ["agent-creds-sharing", agentId],
    queryFn: () => agentCredentialsApi.listWithSharing(agentId),
  });

  const connectedByService = useMemo(() => {
    const map = new Map<string, AgentCredentialWithSharing>();
    for (const cred of agentCreds ?? []) {
      // Store against the canonical service key, accounting for aliases
      const def = SERVICES.find((s) => serviceMatches(cred.service, s));
      if (def) {
        // Prefer owner over joined if both somehow exist
        const existing = map.get(def.key);
        if (!existing || (existing.role === "joined" && cred.role === "owner")) {
          map.set(def.key, cred);
        }
      }
    }
    return map;
  }, [agentCreds]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["agent-creds-sharing", agentId] });
    queryClient.invalidateQueries({ queryKey: ["agent-credentials", agentId] });
  };

  const unlinkMutation = useMutation({
    mutationFn: ({ credentialId }: { credentialId: string }) =>
      agentCredentialsApi.unlinkCredential(agentId, credentialId),
    onSuccess: invalidate,
  });

  const joinMutation = useMutation({
    mutationFn: ({ credentialId }: { credentialId: string }) =>
      agentCredentialsApi.joinCredential(agentId, credentialId),
    onSuccess: () => {
      setPendingJoinService(null);
      invalidate();
    },
  });

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border/60 px-4 py-6 text-center text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin inline mr-2" />
        Loading connections...
      </div>
    );
  }

  const connectedCount = Array.from(connectedByService.values()).length;

  return (
    <>
      <div className="rounded-xl border border-border/60 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border/50">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-foreground">Connected Accounts</span>
          </div>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {connectedCount}/{SERVICES.length} connected
          </span>
        </div>

        {/* Service rows */}
        <div>
          {SERVICES.map((service) => {
            const cred = connectedByService.get(service.key);
            const isConnected = !!cred;
            return (
              <ServiceRow
                key={service.key}
                service={service}
                cred={cred}
                agentId={agentId}
                agentName={agentName}
                companyId={companyId}
                isConnected={isConnected}
                onConnectWhatsApp={() => setWhatsappOpen(true)}
                onAfterOAuth={invalidate}
                onDisconnect={(credentialId) => unlinkMutation.mutate({ credentialId })}
                disconnectPending={unlinkMutation.isPending}
                onJoin={(credentialId) => joinMutation.mutate({ credentialId })}
                joinPending={joinMutation.isPending && pendingJoinService === service.key}
                onJoinOpen={() => setPendingJoinService(service.key)}
              />
            );
          })}
        </div>
      </div>

      {/* WhatsApp QR modal */}
      <Dialog open={whatsappOpen} onOpenChange={setWhatsappOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect WhatsApp to {agentName}</DialogTitle>
            <DialogDescription>
              Scan the QR code with WhatsApp on your phone. Each agent needs their own phone number.
            </DialogDescription>
          </DialogHeader>
          <WhatsAppConnect agentId={agentId} agentName={agentName} />
        </DialogContent>
      </Dialog>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────
// ServiceRow — one row per service
// ──────────────────────────────────────────────────────────────────

function ServiceRow({
  service,
  cred,
  agentId,
  companyId,
  isConnected,
  onConnectWhatsApp,
  onAfterOAuth,
  onDisconnect,
  disconnectPending,
  onJoin,
  joinPending,
  onJoinOpen,
}: {
  service: ServiceDefinition;
  cred: AgentCredentialWithSharing | undefined;
  agentId: string;
  agentName: string;
  companyId: string;
  isConnected: boolean;
  onConnectWhatsApp: () => void;
  onAfterOAuth: () => void;
  onDisconnect: (credentialId: string) => void;
  disconnectPending: boolean;
  onJoin: (credentialId: string) => void;
  joinPending: boolean;
  onJoinOpen: () => void;
}) {
  const Icon = service.icon;

  // Available credentials in the company to join (only fetched when dropdown opens)
  const [joinOpen, setJoinOpen] = useState(false);
  const { data: available } = useQuery({
    queryKey: ["company-creds-available", companyId, service.key],
    queryFn: () => agentCredentialsApi.listCompanyAvailable(companyId, service.key),
    enabled: joinOpen && service.joinable,
  });

  // Filter out credentials this agent is already linked to
  const joinable = useMemo(() => {
    if (!available) return [] as AvailableCompanyCredential[];
    return available.filter((c) => !c.linkedAgentIds.includes(agentId));
  }, [available, agentId]);

  const openJoin = () => {
    setJoinOpen(true);
    onJoinOpen();
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-b-0">
      {/* Icon */}
      <div className={cn("flex items-center justify-center h-8 w-8 rounded-lg shrink-0", service.bgColor)}>
        <Icon className={cn("h-4 w-4", service.color)} />
      </div>

      {/* Label + status */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium truncate">{service.label}</span>
          {isConnected && <Check className="h-3 w-3 text-green-500 shrink-0" />}
        </div>
        {isConnected && cred ? (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="truncate">
              {cred.accountLabel ?? cred.gmailAddress ?? cred.whatsappPhoneNumberId ?? "Connected"}
            </span>
            {cred.connectedAt && (
              <>
                <span>·</span>
                <span>{timeAgo(cred.connectedAt)}</span>
              </>
            )}
            {cred.alsoUsedBy.length > 0 && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <Users className="h-2.5 w-2.5" />
                  Also used by{" "}
                  {cred.alsoUsedBy.slice(0, 2).map((a, i) => (
                    <span key={a.agentId}>
                      <Link
                        to={`/agents/${a.agentId}`}
                        className="text-foreground hover:underline"
                      >
                        {a.agentName}
                      </Link>
                      {i < Math.min(cred.alsoUsedBy.length, 2) - 1 && ", "}
                    </span>
                  ))}
                  {cred.alsoUsedBy.length > 2 && <span> +{cred.alsoUsedBy.length - 2}</span>}
                </span>
              </>
            )}
          </div>
        ) : (
          <div className="text-[11px] text-muted-foreground">
            {service.connectable ? "Not connected" : (service.pendingReason ?? "Coming soon")}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {isConnected && cred ? (
          // Connected state — disconnect
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] text-muted-foreground hover:text-destructive"
            onClick={() => onDisconnect(cred.credentialId)}
            disabled={disconnectPending}
          >
            {disconnectPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Unlink className="h-3 w-3" />
            )}
            <span className="ml-1">Disconnect</span>
          </Button>
        ) : service.connectable ? (
          // Not connected, but connectable — show Connect + (if joinable) Join
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-[11px]"
              onClick={() => {
                if (service.key === "whatsapp") {
                  onConnectWhatsApp();
                } else if (service.key === "gmail") {
                  // Gmail OAuth — redirect to the backend oauth-url endpoint
                  agentCredentialsApi
                    .getGmailOAuthUrl(agentId)
                    .then((res) => {
                      window.open(res.url, "_blank", "width=600,height=700");
                    })
                    .catch((err) => {
                      console.error("Failed to get Gmail OAuth URL", err);
                    });
                } else if (service.key === "instagram" || service.key === "facebook") {
                  // Open popup synchronously (browsers block popups from async handlers)
                  const popup = window.open("about:blank", "meta-oauth", "width=600,height=750");
                  const onMessage = (ev: MessageEvent) => {
                    if (ev.data?.type === "meta-oauth-complete") {
                      window.removeEventListener("message", onMessage);
                      popup?.close();
                      onAfterOAuth();
                    }
                  };
                  window.addEventListener("message", onMessage);
                  agentCredentialsApi
                    .getMetaOAuthUrl(agentId)
                    .then((res) => {
                      if (popup) popup.location.href = res.url;
                    })
                    .catch((err) => {
                      popup?.close();
                      window.removeEventListener("message", onMessage);
                      console.error("Failed to get Meta OAuth URL", err);
                      alert(err?.message ?? "Meta OAuth is not configured.");
                    });
                }
              }}
            >
              <Plus className="h-3 w-3 mr-1" />
              Connect
            </Button>
            {service.joinable && (
              <Popover open={joinOpen} onOpenChange={setJoinOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    onClick={openJoin}
                  >
                    Join existing
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-1" align="end">
                  {joinable === undefined ? (
                    <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin inline mr-1" />
                      Loading...
                    </div>
                  ) : joinable.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                      No {service.label} accounts connected yet. Use "Connect" to add one.
                    </div>
                  ) : (
                    <div className="py-1">
                      {joinable.map((available) => (
                        <button
                          key={available.id}
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-accent/50 rounded text-xs flex flex-col gap-0.5"
                          onClick={() => {
                            onJoin(available.id);
                            setJoinOpen(false);
                          }}
                          disabled={joinPending}
                        >
                          <span className="font-medium truncate">
                            {available.accountLabel ?? available.gmailAddress ?? available.providerAccountId ?? "Account"}
                          </span>
                          {available.linkedAgentNames.length > 0 && (
                            <span className="text-[10px] text-muted-foreground truncate">
                              Used by {available.linkedAgentNames.slice(0, 3).join(", ")}
                              {available.linkedAgentNames.length > 3 && ` +${available.linkedAgentNames.length - 3}`}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            )}
          </>
        ) : (
          // Not yet connectable — show a muted hint
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Soon
          </span>
        )}
      </div>
    </div>
  );
}
