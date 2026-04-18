import { ChangeEvent, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { companiesApi } from "../api/companies";
import { accessApi } from "../api/access";
import { assetsApi } from "../api/assets";
import { agentLearningsApi, type AgentLearning } from "../api/agent-learnings";
import { agentsApi } from "../api/agents";
import { isGhostDepartmentManager } from "../lib/team-grouping";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Check, Download, Upload, MessageCircle, Mail, Calendar, Camera, Bell, Brain, Trash2, ArrowRight } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { AutoReplyRules } from "../components/AutoReplyRules";
import { ConnectionsDashboard } from "../components/ConnectionsDashboard";
import {
  ToggleField,
  HintIcon
} from "../components/agent-config-primitives";
import { usePushNotifications } from "../hooks/usePushNotifications";

type AgentSnippetInput = {
  onboardingTextUrl: string;
  connectionCandidates?: string[] | null;
  testResolutionUrl?: string | null;
};

export function CompanySettings() {
  const {
    companies,
    selectedCompany,
    selectedCompanyId,
    setSelectedCompanyId
  } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  // General settings local state
  const [companyName, setCompanyName] = useState("");
  const [description, setDescription] = useState("");
  const [brandColor, setBrandColor] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);

  // Sync local state from selected company.
  // NOTE: description is user-editable free text ONLY. We never seed it from
  // a computed roster/state summary — the live roster is rendered as a
  // read-only "Team summary" field below. If the DB contains a legacy
  // auto-populated dump (old onboarding wrote one), we detect and clear it
  // so the owner sees a genuinely blank textarea.
  useEffect(() => {
    if (!selectedCompany) return;
    setCompanyName(selectedCompany.name);
    const rawDesc = selectedCompany.description ?? "";
    // Legacy seeded-dump detection — these patterns only ever came from the
    // old onboarding flow that dumped agency state into description.
    const isLegacyDump =
      /^Agency:\s/m.test(rawDesc) && /Hired agents/i.test(rawDesc);
    setDescription(isLegacyDump ? "" : rawDesc);
    setBrandColor(selectedCompany.brandColor ?? "");
    setLogoUrl(selectedCompany.logoUrl ?? "");
  }, [selectedCompany]);

  // Live roster — used for the read-only "Team summary" field.
  const { data: companyAgents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const teamSummary = (() => {
    // Ghost department-manager agents (Sales Manager, Marketing Manager, …)
    // are org-chart scaffolding, not real hires. Exclude them before counting
    // or listing so the summary matches the sidebar + /agents view.
    const agents = (companyAgents ?? []).filter((a) => !isGhostDepartmentManager(a));
    if (agents.length === 0) return "CEO only — no agents hired yet.";
    const ceo = agents.find((a) => String(a.role ?? "").toLowerCase() === "ceo");
    const nonCeo = agents.filter((a) => String(a.role ?? "").toLowerCase() !== "ceo");
    if (nonCeo.length === 0) return "CEO only — no agents hired yet.";
    const roster = nonCeo
      .map((a) => `${a.name}${a.role ? ` (${a.role})` : ""}`)
      .join(", ");
    return `${ceo ? "CEO + " : ""}${nonCeo.length} agent${nonCeo.length === 1 ? "" : "s"} — ${roster}`;
  })();

  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSnippet, setInviteSnippet] = useState<string | null>(null);
  const [snippetCopied, setSnippetCopied] = useState(false);
  const [snippetCopyDelightId, setSnippetCopyDelightId] = useState(0);

  const generalDirty =
    !!selectedCompany &&
    (companyName !== selectedCompany.name ||
      description !== (selectedCompany.description ?? "") ||
      brandColor !== (selectedCompany.brandColor ?? ""));

  const generalMutation = useMutation({
    mutationFn: (data: {
      name: string;
      description: string | null;
      brandColor: string | null;
    }) => companiesApi.update(selectedCompanyId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
    }
  });

  const settingsMutation = useMutation({
    mutationFn: (requireApproval: boolean) =>
      companiesApi.update(selectedCompanyId!, {
        requireBoardApprovalForNewAgents: requireApproval
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
    }
  });

  const inviteMutation = useMutation({
    mutationFn: () =>
      accessApi.createOpenClawInvitePrompt(selectedCompanyId!),
    onSuccess: async (invite) => {
      setInviteError(null);
      const base = window.location.origin.replace(/\/+$/, "");
      const onboardingTextLink =
        invite.onboardingTextUrl ??
        invite.onboardingTextPath ??
        `/api/invites/${invite.token}/onboarding.txt`;
      const absoluteUrl = onboardingTextLink.startsWith("http")
        ? onboardingTextLink
        : `${base}${onboardingTextLink}`;
      setSnippetCopied(false);
      setSnippetCopyDelightId(0);
      let snippet: string;
      try {
        const manifest = await accessApi.getInviteOnboarding(invite.token);
        snippet = buildAgentSnippet({
          onboardingTextUrl: absoluteUrl,
          connectionCandidates:
            manifest.onboarding.connectivity?.connectionCandidates ?? null,
          testResolutionUrl:
            manifest.onboarding.connectivity?.testResolutionEndpoint?.url ??
            null
        });
      } catch {
        snippet = buildAgentSnippet({
          onboardingTextUrl: absoluteUrl,
          connectionCandidates: null,
          testResolutionUrl: null
        });
      }
      setInviteSnippet(snippet);
      try {
        await navigator.clipboard.writeText(snippet);
        setSnippetCopied(true);
        setSnippetCopyDelightId((prev) => prev + 1);
        setTimeout(() => setSnippetCopied(false), 2000);
      } catch {
        /* clipboard may not be available */
      }
      queryClient.invalidateQueries({
        queryKey: queryKeys.sidebarBadges(selectedCompanyId!)
      });
    },
    onError: (err) => {
      setInviteError(
        err instanceof Error ? err.message : "Failed to create invite"
      );
    }
  });

  const syncLogoState = (nextLogoUrl: string | null) => {
    setLogoUrl(nextLogoUrl ?? "");
    void queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
  };

  const logoUploadMutation = useMutation({
    mutationFn: (file: File) =>
      assetsApi
        .uploadCompanyLogo(selectedCompanyId!, file)
        .then((asset) => companiesApi.update(selectedCompanyId!, { logoAssetId: asset.assetId })),
    onSuccess: (company) => {
      syncLogoState(company.logoUrl);
      setLogoUploadError(null);
    }
  });

  const clearLogoMutation = useMutation({
    mutationFn: () => companiesApi.update(selectedCompanyId!, { logoAssetId: null }),
    onSuccess: (company) => {
      setLogoUploadError(null);
      syncLogoState(company.logoUrl);
    }
  });

  function handleLogoFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.currentTarget.value = "";
    if (!file) return;
    setLogoUploadError(null);
    logoUploadMutation.mutate(file);
  }

  function handleClearLogo() {
    clearLogoMutation.mutate();
  }

  useEffect(() => {
    setInviteError(null);
    setInviteSnippet(null);
    setSnippetCopied(false);
    setSnippetCopyDelightId(0);
  }, [selectedCompanyId]);

  const archiveMutation = useMutation({
    mutationFn: ({
      companyId,
      nextCompanyId
    }: {
      companyId: string;
      nextCompanyId: string | null;
    }) => companiesApi.archive(companyId).then(() => ({ nextCompanyId })),
    onSuccess: async ({ nextCompanyId }) => {
      if (nextCompanyId) {
        setSelectedCompanyId(nextCompanyId);
      }
      await queryClient.invalidateQueries({
        queryKey: queryKeys.companies.all
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.companies.stats
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: ({
      companyId,
      nextCompanyId
    }: {
      companyId: string;
      nextCompanyId: string | null;
    }) => companiesApi.remove(companyId).then(() => ({ nextCompanyId })),
    onSuccess: async ({ nextCompanyId }) => {
      if (nextCompanyId) {
        setSelectedCompanyId(nextCompanyId);
      }
      await queryClient.invalidateQueries({
        queryKey: queryKeys.companies.all
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.companies.stats
      });
      pushToast({ title: "Agency deleted" });
    }
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Settings" }]);
  }, [setBreadcrumbs]);

  const { permission, subscribed, subscribe, unsubscribe } = usePushNotifications();

  if (!selectedCompany) {
    return (
      <div className="text-sm text-muted-foreground p-5">
        No company selected. Select a company from the switcher above.
      </div>
    );
  }

  function handleSaveGeneral() {
    if (!generalDirty) return;
    generalMutation.mutate({
      name: companyName.trim(),
      description: description.trim() || null,
      brandColor: brandColor || null
    });
  }

  // Integration items for the Integrations section
  const integrations = [
    {
      icon: MessageCircle,
      iconBg: "bg-green-500/15",
      iconColor: "text-green-500",
      name: "WhatsApp",
      status: "Not connected",
      connected: false,
    },
    {
      icon: Mail,
      iconBg: "bg-blue-500/15",
      iconColor: "text-blue-500",
      name: "Gmail",
      status: "Not connected",
      connected: false,
    },
    {
      icon: Camera,
      iconBg: "bg-pink-500/15",
      iconColor: "text-pink-500",
      name: "Instagram",
      status: "Not connected",
      connected: false,
    },
    {
      icon: Calendar,
      iconBg: "bg-amber-500/15",
      iconColor: "text-amber-500",
      name: "Google Calendar",
      status: "Not connected",
      connected: false,
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Settings" />

      <div className="flex-1 overflow-y-auto p-5 space-y-4 max-w-2xl">
        {/* Agency section */}
        <div className="rounded-xl border border-border/50 bg-card/80 overflow-hidden">
          <div className="px-3.5 py-3 border-b border-border/40 bg-muted/20">
            <span className="text-[12px] font-bold">Agency</span>
          </div>
          <div className="p-4 space-y-4">
            {/* Agency name */}
            <div className="space-y-1.5">
              <label className="text-[11.5px] text-muted-foreground">Agency name</label>
              <input
                className="w-full bg-background border border-border rounded-lg p-2 text-[13px] outline-none focus:border-primary/50 transition-colors"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>

            {/* Brand colour */}
            <div className="space-y-1.5">
              <label className="text-[11.5px] text-muted-foreground">Brand colour</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={brandColor || "#6366f1"}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="h-8 w-8 cursor-pointer rounded-lg border border-border bg-transparent p-0 shrink-0"
                />
                <input
                  type="text"
                  value={brandColor}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || /^#[0-9a-fA-F]{0,6}$/.test(v)) {
                      setBrandColor(v);
                    }
                  }}
                  placeholder="Default"
                  className="flex-1 bg-background border border-border rounded-lg p-2 text-[13px] font-mono outline-none focus:border-primary/50 transition-colors"
                />
                {brandColor && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setBrandColor("")}
                    className="text-[11px] text-muted-foreground h-7"
                  >
                    Clear
                  </Button>
                )}
              </div>
              <p className="text-[10.5px] text-muted-foreground/80">
                Leave blank to use the default sage palette.
              </p>
            </div>

            {/* Description — user-editable free text ONLY. Never seeded from
                computed agency state. */}
            <div className="space-y-1.5">
              <label className="text-[11.5px] text-muted-foreground">Description</label>
              <textarea
                className="w-full bg-background border border-border rounded-lg p-2 text-[13px] outline-none focus:border-primary/50 transition-colors whitespace-pre-wrap min-h-[80px] resize-y"
                value={description}
                placeholder="Optional — a short description of your agency"
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={500}
              />
              <div className="text-right text-[10.5px] text-muted-foreground/80">
                {description.length} / 500
              </div>
            </div>

            {/* Team summary — read-only, auto-generated from the live roster. */}
            <div className="space-y-1.5">
              <label className="text-[11.5px] text-muted-foreground">Team summary</label>
              <div
                aria-readonly="true"
                className="w-full bg-muted/30 border border-border/60 rounded-lg p-2 text-[12.5px] text-muted-foreground whitespace-pre-wrap"
              >
                {teamSummary}
              </div>
            </div>

            {/* Logo upload */}
            <div className="space-y-1.5">
              <label className="text-[11.5px] text-muted-foreground">Logo</label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                onChange={handleLogoFileChange}
                className="w-full bg-background border border-border rounded-lg p-2 text-[13px] outline-none file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:py-1 file:text-xs"
              />
              {logoUrl && (
                <div className="flex items-center gap-2 mt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleClearLogo}
                    disabled={clearLogoMutation.isPending}
                    className="text-[11px] h-7"
                  >
                    {clearLogoMutation.isPending ? "Removing..." : "Remove logo"}
                  </Button>
                </div>
              )}
              {(logoUploadMutation.isError || logoUploadError) && (
                <span className="text-[11px] text-destructive">
                  {logoUploadError ??
                    (logoUploadMutation.error instanceof Error
                      ? logoUploadMutation.error.message
                      : "Logo upload failed")}
                </span>
              )}
              {clearLogoMutation.isError && (
                <span className="text-[11px] text-destructive">
                  {clearLogoMutation.error.message}
                </span>
              )}
              {logoUploadMutation.isPending && (
                <span className="text-[11px] text-muted-foreground">Uploading logo...</span>
              )}
            </div>

            {/* Save button — always visible, disabled when form is clean */}
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                onClick={handleSaveGeneral}
                disabled={!generalDirty || generalMutation.isPending || !companyName.trim()}
                className="text-[11.5px] h-7"
              >
                {generalMutation.isPending ? "Saving..." : "Save changes"}
              </Button>
              {generalMutation.isSuccess && !generalDirty && (
                <span className="text-[11px] text-muted-foreground">Saved</span>
              )}
              {generalMutation.isError && (
                <span className="text-[11px] text-destructive">
                  {generalMutation.error instanceof Error
                    ? generalMutation.error.message
                    : "Failed to save"}
                </span>
              )}
            </div>

            {/* Hiring toggle */}
            <div className="pt-2 border-t border-border/40">
              <ToggleField
                label="Require your approval before hiring new agents"
                hint="New agent hires stay pending until you approve them."
                checked={!!selectedCompany.requireBoardApprovalForNewAgents}
                onChange={(v) => settingsMutation.mutate(v)}
              />
            </div>
          </div>
        </div>

        {/* Connections dashboard — company-wide overview of every agent's
            connected accounts. The primary UI for connecting things lives
            on the agent page; this is the overseer's view. */}
        {selectedCompanyId && <ConnectionsDashboard companyId={selectedCompanyId} />}

        {/* Invites section — hidden from non-technical users */}
        <div className="hidden rounded-xl border border-border/50 bg-card/80 overflow-hidden">
          <div className="px-3.5 py-3 border-b border-border/40 bg-muted/20">
            <span className="text-[12px] font-bold">Agent Invites</span>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[11.5px] text-muted-foreground">
                Generate an External Agent invite snippet.
              </span>
              <HintIcon text="Creates a short-lived External Agent invite and renders a copy-ready prompt." />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={() => inviteMutation.mutate()}
                disabled={inviteMutation.isPending}
                className="text-[11.5px] h-7"
              >
                {inviteMutation.isPending
                  ? "Generating..."
                  : "Generate External Agent Invite Prompt"}
              </Button>
            </div>
            {inviteError && (
              <p className="text-[11.5px] text-destructive">{inviteError}</p>
            )}
            {inviteSnippet && (
              <div className="rounded-lg border border-border/50 bg-background p-2 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] text-muted-foreground">
                    External Agent Invite Prompt
                  </div>
                  {snippetCopied && (
                    <span
                      key={snippetCopyDelightId}
                      className="flex items-center gap-1 text-[11px] text-green-600 animate-pulse"
                    >
                      <Check className="h-3 w-3" />
                      Copied
                    </span>
                  )}
                </div>
                <textarea
                  className="h-[28rem] w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[11px] outline-none"
                  value={inviteSnippet}
                  readOnly
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-[11px] h-7"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(inviteSnippet);
                        setSnippetCopied(true);
                        setSnippetCopyDelightId((prev) => prev + 1);
                        setTimeout(() => setSnippetCopied(false), 2000);
                      } catch {
                        /* clipboard may not be available */
                      }
                    }}
                  >
                    {snippetCopied ? "Copied snippet" : "Copy snippet"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Import / Export — hidden from non-technical users */}
        <div className="hidden rounded-xl border border-border/50 bg-card/80 overflow-hidden">
          <div className="px-3.5 py-3 border-b border-border/40 bg-muted/20">
            <span className="text-[12px] font-bold">Company Packages</span>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-[11.5px] text-muted-foreground">
              Import and export have moved to dedicated pages accessible from the{" "}
              <a href="/org" className="underline hover:text-foreground">Org Chart</a> header.
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" asChild className="text-[11px] h-7">
                <a href="/company/export">
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Export
                </a>
              </Button>
              <Button size="sm" variant="outline" asChild className="text-[11px] h-7">
                <a href="/company/import">
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Import
                </a>
              </Button>
            </div>
          </div>
        </div>

        {/* Push Notifications section */}
        <div className="rounded-xl border border-border/50 bg-card/80 overflow-hidden">
          <div className="px-3.5 py-3 border-b border-border/40 bg-muted/20">
            <span className="text-[12px] font-bold">Push Notifications</span>
          </div>
          <div className="flex items-center gap-3 p-3.5">
            <div className="w-[28px] h-[28px] rounded-lg flex items-center justify-center shrink-0 bg-violet-500/15">
              <Bell className="h-3.5 w-3.5 text-violet-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold">Browser notifications</div>
              <div className="text-[11px] text-muted-foreground">
                {permission === "denied"
                  ? "Blocked — enable in browser settings"
                  : subscribed
                  ? "Enabled — you'll be notified of approvals and CEO updates"
                  : "Get notified of approvals, agent errors, and CEO messages"}
              </div>
            </div>
            {permission === "denied" ? (
              <span className="text-[11px] text-muted-foreground shrink-0">Blocked</span>
            ) : subscribed ? (
              <button
                onClick={async () => {
                  try {
                    await unsubscribe();
                    pushToast({ title: "Browser notifications disabled", tone: "info" });
                  } catch (err) {
                    pushToast({ title: "Couldn't disable notifications", tone: "error" });
                  }
                }}
                className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors shrink-0"
              >
                Disable
              </button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="text-[11px] h-7 shrink-0"
                onClick={async () => {
                  try {
                    await subscribe();
                    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                      pushToast({ title: "Browser notifications enabled", tone: "success" });
                    } else if (typeof Notification !== "undefined" && Notification.permission === "denied") {
                      pushToast({
                        title: "Notifications blocked by browser",
                        body: "Enable them in your browser settings and try again.",
                        tone: "error",
                      });
                    }
                  } catch (err) {
                    pushToast({
                      title: "Couldn't enable notifications",
                      body: "Check your browser's notification permission.",
                      tone: "error",
                    });
                  }
                }}
              >
                Enable
              </Button>
            )}
          </div>
        </div>

        {/* Agent Learnings / Instincts section */}
        <CompanyLearningsSection companyId={selectedCompanyId!} />

        {/* Auto-Reply Rules */}
        <AutoReplyRules companyId={selectedCompanyId!} />

        {/* Export agency data */}
        <div className="rounded-xl border border-border/50 bg-card/80 overflow-hidden">
          <div className="px-3.5 py-3 border-b border-border/40 bg-muted/20">
            <span className="text-[12px] font-bold">Data Export</span>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-[11.5px] text-muted-foreground">
              Export your agency data as a portable company package (agents, skills, configuration).
            </p>
            <Button
              size="sm"
              variant="outline"
              className="text-[11px] h-7"
              onClick={() => {
                companiesApi
                  .exportBundle(selectedCompanyId!, {})
                  .then((result) => {
                    const blob = new Blob([JSON.stringify(result, null, 2)], {
                      type: "application/json",
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${selectedCompany.name.replace(/\s+/g, "-").toLowerCase()}-export.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    pushToast({ title: "Agency data exported successfully" });
                  })
                  .catch((err) => {
                    pushToast({
                      title: err instanceof Error ? err.message : "Export failed",
                      tone: "error",
                    });
                  });
              }}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export Agency Data
            </Button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 overflow-hidden">
          <div className="px-3.5 py-3 border-b border-destructive/20 bg-destructive/5">
            <span className="text-[12px] font-bold text-destructive">Danger Zone</span>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-[11.5px] text-muted-foreground">
              Archive this company to hide it from the sidebar. This persists in
              the database.
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="destructive"
                className="text-[11px] h-7"
                disabled={
                  archiveMutation.isPending ||
                  selectedCompany.status === "archived"
                }
                onClick={() => {
                  if (!selectedCompanyId) return;
                  const confirmed = window.confirm(
                    `Archive company "${selectedCompany.name}"? It will be hidden from the sidebar.`
                  );
                  if (!confirmed) return;
                  const nextCompanyId =
                    companies.find(
                      (company) =>
                        company.id !== selectedCompanyId &&
                        company.status !== "archived"
                    )?.id ?? null;
                  archiveMutation.mutate({
                    companyId: selectedCompanyId,
                    nextCompanyId
                  });
                }}
              >
                {archiveMutation.isPending
                  ? "Archiving..."
                  : selectedCompany.status === "archived"
                  ? "Already archived"
                  : "Archive company"}
              </Button>
              {archiveMutation.isError && (
                <span className="text-[11px] text-destructive">
                  {archiveMutation.error instanceof Error
                    ? archiveMutation.error.message
                    : "Failed to archive company"}
                </span>
              )}
            </div>

            {/* Delete Agency */}
            <div className="pt-3 border-t border-destructive/20 space-y-2">
              <p className="text-[11.5px] text-muted-foreground">
                Permanently delete this agency and all its data. This action cannot be undone.
              </p>
              <Button
                size="sm"
                variant="destructive"
                className="text-[11px] h-7"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (!selectedCompanyId) return;
                  const confirmed = window.confirm(
                    `Permanently delete "${selectedCompany.name}"? This cannot be undone.`
                  );
                  if (!confirmed) return;
                  const secondConfirm = window.confirm(
                    `Are you absolutely sure? All agents, tasks, learnings, and history will be permanently deleted.`
                  );
                  if (!secondConfirm) return;
                  const nextCompanyId =
                    companies.find(
                      (company) =>
                        company.id !== selectedCompanyId &&
                        company.status !== "archived"
                    )?.id ?? null;
                  deleteMutation.mutate({
                    companyId: selectedCompanyId,
                    nextCompanyId
                  });
                }}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                {deleteMutation.isPending ? "Deleting..." : "Delete agency permanently"}
              </Button>
              {deleteMutation.isError && (
                <span className="text-[11px] text-destructive">
                  {deleteMutation.error instanceof Error
                    ? deleteMutation.error.message
                    : "Failed to delete company"}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CompanyLearningsSection({ companyId }: { companyId: string }) {
  const queryClient = useQueryClient();

  const { data: learnings, isLoading } = useQuery({
    queryKey: queryKeys.agentLearnings.list(companyId),
    queryFn: () => agentLearningsApi.list(companyId),
  });

  const { data: stats } = useQuery({
    queryKey: queryKeys.agentLearnings.stats(companyId),
    queryFn: () => agentLearningsApi.stats(companyId),
  });

  const removeMutation = useMutation({
    mutationFn: (learningId: string) =>
      agentLearningsApi.remove(companyId, learningId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agentLearnings.list(companyId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agentLearnings.stats(companyId) });
    },
  });

  const activeLearnings = (learnings ?? []).filter((l) => l.active);

  const typeColors: Record<string, string> = {
    correction: "bg-blue-500/10 text-blue-600",
    rejection: "bg-red-500/10 text-red-600",
    compacted: "bg-amber-500/10 text-amber-600",
    observation: "bg-green-500/10 text-green-600",
    outcome: "bg-purple-500/10 text-purple-600",
  };

  return (
    <div className="rounded-xl border border-border/50 bg-card/80 overflow-hidden">
      <div className="px-3.5 py-3 border-b border-border/40 bg-muted/20">
        <div className="flex items-center gap-2">
          <Brain className="h-3.5 w-3.5 text-primary" />
          <span className="text-[12px] font-bold">Agency Learnings</span>
          {stats && stats.active > 0 && (
            <span className="text-[10px] text-muted-foreground">
              ({stats.active} active)
            </span>
          )}
        </div>
      </div>
      <div className="p-4 space-y-3">
        {isLoading && (
          <div className="h-16 bg-muted/30 rounded-lg animate-pulse" />
        )}

        {!isLoading && activeLearnings.length === 0 && (
          <p className="text-[11.5px] text-muted-foreground">
            No learnings yet. Agents will start learning when you edit or reject their approval cards.
          </p>
        )}

        {stats && stats.active > 0 && (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-border/40 bg-background p-2.5">
              <div className="text-lg font-bold">{stats.corrections}</div>
              <div className="text-[10px] text-muted-foreground">Corrections</div>
            </div>
            <div className="rounded-lg border border-border/40 bg-background p-2.5">
              <div className="text-lg font-bold">{stats.rejections}</div>
              <div className="text-[10px] text-muted-foreground">Rejections</div>
            </div>
            <div className="rounded-lg border border-border/40 bg-background p-2.5">
              <div className="text-lg font-bold">{stats.totalApplied}</div>
              <div className="text-[10px] text-muted-foreground">Times Applied</div>
            </div>
          </div>
        )}

        {activeLearnings.slice(0, 10).map((learning) => (
          <div
            key={learning.id}
            className="rounded-lg border border-border/40 bg-background px-3 py-2.5 space-y-1.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                    typeColors[learning.type] ?? "bg-muted text-muted-foreground"
                  }`}
                >
                  {learning.type}
                </span>
                {learning.actionType && (
                  <span className="text-[10px] text-muted-foreground">
                    {learning.actionType}
                  </span>
                )}
                {learning.appliedCount > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    Applied {learning.appliedCount}x
                  </span>
                )}
              </div>
              <button
                className="text-muted-foreground hover:text-destructive transition-colors p-0.5"
                onClick={() => removeMutation.mutate(learning.id)}
                title="Delete this learning"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>

            {learning.type === "correction" && (
              <div className="space-y-0.5">
                <p className="text-[11px] text-muted-foreground line-through truncate">
                  {learning.original}
                </p>
                <div className="flex items-center gap-1.5">
                  <ArrowRight className="h-3 w-3 text-green-500 shrink-0" />
                  <p className="text-[11px] text-foreground truncate">
                    {learning.corrected}
                  </p>
                </div>
              </div>
            )}

            {learning.type === "rejection" && (
              <p className="text-[11px] text-muted-foreground line-through truncate">
                {learning.original}
              </p>
            )}

            {(learning.type === "compacted" || learning.type === "observation" || learning.type === "outcome") && (
              <p className="text-[11px] text-foreground truncate">
                {learning.corrected || learning.original}
              </p>
            )}

            {learning.context && (
              <p className="text-[10px] text-muted-foreground truncate">{learning.context}</p>
            )}
          </div>
        ))}

        {activeLearnings.length > 10 && (
          <p className="text-[10.5px] text-muted-foreground text-center">
            +{activeLearnings.length - 10} more learnings (view per-agent in agent detail)
          </p>
        )}
      </div>
    </div>
  );
}

function buildAgentSnippet(input: AgentSnippetInput) {
  const candidateUrls = buildCandidateOnboardingUrls(input);
  const resolutionTestUrl = buildResolutionTestUrl(input);

  const candidateList =
    candidateUrls.length > 0
      ? candidateUrls.map((u) => `- ${u}`).join("\n")
      : "- (No candidate URLs available yet.)";

  const connectivityBlock =
    candidateUrls.length === 0
      ? `No candidate URLs are available. Ask your user to configure a reachable hostname in Aygency, then retry.
Suggested steps:
- choose a hostname that resolves to the Aygency host from your runtime
- run: pnpm paperclipai allowed-hostname <host>
- restart Aygency
- verify with: curl -fsS http://<host>:3100/api/health
- regenerate this invite snippet`
      : `If none are reachable, ask your user to add a reachable hostname in Aygency, restart, and retry.
Suggested command:
- pnpm paperclipai allowed-hostname <host>
Then verify with: curl -fsS <base-url>/api/health`;

  const resolutionLine = resolutionTestUrl
    ? `\nYou MUST test Aygency-to-gateway reachability, call: ${resolutionTestUrl}?url=<urlencoded-gateway-url> (using the hostname that worked above). Do not assume your 172.x is necessarily reachable from Aygency. Test it. `
    : "";

  return `You're invited to join an Aygency organization.

The URLs you should try are:
${candidateList}

Connectivity guidance:
If you are running on a different machine than Aygency, Aygency must be reachable at one of the hostnames used above.
Verify the hostname works from your runtime with: GET <base-url>/api/health

${connectivityBlock}

For your "agentName", just use your own agent name (External Agent or whatever your name is) and send it directly.
You also need to send a gateway URL that Aygency can access. Check your config and include that URL.${resolutionLine}

---

This onboarding flow is for the External Agent Gateway.
When you submit the join request, use:
- \`adapterType: "openclaw_gateway"\`
- \`agentDefaultsPayload.url\` as your \`ws://\` or \`wss://\` gateway URL
- \`agentDefaultsPayload.headers["x-openclaw-token"]\` with your gateway token
- (legacy accepted) \`agentDefaultsPayload.headers["x-openclaw-auth"]\`
- Keep device auth enabled (recommended). If \`devicePrivateKeyPem\` is omitted, Aygency will generate and persist one during join so pairing approvals remain stable.
- Only use \`disableDeviceAuth=true\` for special environments where pairing cannot be completed.

Do NOT use \`/v1/responses\` or \`/hooks/*\` in this join flow.

Before you do anything, please respond to your user that you understand the instructions and you're going to work on them. Then do the step above in another session called "aygency-onboarding" and then tell your user when you're done. Update your user in intermediate steps along the way so they know what's going on.

Then after you've connected to Aygency (exchanged keys etc.) you MUST review and follow the onboarding instructions in onboarding.txt they give you.

`;
}

function buildCandidateOnboardingUrls(input: AgentSnippetInput): string[] {
  const candidates = (input.connectionCandidates ?? [])
    .map((candidate) => candidate.trim())
    .filter(Boolean);
  const urls = new Set<string>();
  let onboardingUrl: URL | null = null;

  try {
    onboardingUrl = new URL(input.onboardingTextUrl);
    urls.add(onboardingUrl.toString());
  } catch {
    const trimmed = input.onboardingTextUrl.trim();
    if (trimmed) {
      urls.add(trimmed);
    }
  }

  if (!onboardingUrl) {
    for (const candidate of candidates) {
      urls.add(candidate);
    }
    return Array.from(urls);
  }

  const onboardingPath = `${onboardingUrl.pathname}${onboardingUrl.search}`;
  for (const candidate of candidates) {
    try {
      const base = new URL(candidate);
      urls.add(`${base.origin}${onboardingPath}`);
    } catch {
      urls.add(candidate);
    }
  }

  return Array.from(urls);
}

function buildResolutionTestUrl(input: AgentSnippetInput): string | null {
  const explicit = input.testResolutionUrl?.trim();
  if (explicit) return explicit;

  try {
    const onboardingUrl = new URL(input.onboardingTextUrl);
    const testPath = onboardingUrl.pathname.replace(
      /\/onboarding\.txt$/,
      "/test-resolution"
    );
    return `${onboardingUrl.origin}${testPath}`;
  } catch {
    return null;
  }
}
