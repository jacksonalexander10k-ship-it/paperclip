import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Send, Plus, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { whatsappTemplatesApi, renderTemplate, type WhatsappTemplate } from "../api/whatsapp-templates";
import { cn } from "../lib/utils";

export interface OutreachLead {
  id: string;
  name: string;
  phone: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  companyId: string;
  agentName: string;
  companyName: string;
  selectedLeads: OutreachLead[];
  onConfirm: (params: {
    templateId?: string;
    customMessage?: string;
    delaySecs: number;
  }) => void;
  onManageTemplates: () => void;
  submitting: boolean;
}

export function StartOutreachDialog({
  open,
  onClose,
  companyId,
  agentName,
  companyName,
  selectedLeads,
  onConfirm,
  onManageTemplates,
  submitting,
}: Props) {
  const [mode, setMode] = useState<"template" | "custom">("template");
  const [templateId, setTemplateId] = useState<string>("");
  const [customMessage, setCustomMessage] = useState<string>("");
  const [delaySecs, setDelaySecs] = useState<number>(5);
  const [previewLeadIdx, setPreviewLeadIdx] = useState<number>(0);

  const { data: templates } = useQuery({
    queryKey: ["whatsapp-templates", companyId],
    queryFn: () => whatsappTemplatesApi.list(companyId),
    enabled: open && !!companyId,
  });

  // Pick default template when templates load
  useEffect(() => {
    if (open && templates && templates.length > 0 && !templateId) {
      const def = templates.find((t) => t.isDefault) ?? templates[0];
      setTemplateId(def.id);
    }
  }, [open, templates, templateId]);

  // Reset preview index when selection changes
  useEffect(() => {
    if (open) setPreviewLeadIdx(0);
  }, [open, selectedLeads.length]);

  if (!open) return null;

  const previewLead = selectedLeads[previewLeadIdx] ?? selectedLeads[0];
  const selectedTemplate = templates?.find((t) => t.id === templateId);

  const sourceText = mode === "custom" ? customMessage : (selectedTemplate?.content ?? "");
  const previewMessage = previewLead
    ? renderTemplate(sourceText, {
        lead_name: previewLead.name,
        client_name: previewLead.name,
        agent_name: agentName,
        company_name: companyName,
        phone: previewLead.phone ?? "",
      })
    : sourceText;

  const noPhoneCount = selectedLeads.filter((l) => !l.phone).length;
  const validCount = selectedLeads.length - noPhoneCount;

  const canSend =
    !submitting &&
    validCount > 0 &&
    sourceText.trim().length > 0 &&
    (mode === "custom" || !!templateId);

  function submit() {
    onConfirm({
      templateId: mode === "template" ? templateId : undefined,
      customMessage: mode === "custom" ? customMessage : undefined,
      delaySecs,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div>
            <h2 className="text-[14px] font-bold">Start outreach</h2>
            <p className="text-[11.5px] text-muted-foreground mt-0.5">
              {validCount} {validCount === 1 ? "lead" : "leads"} ready
              {noPhoneCount > 0 && (
                <span className="text-amber-600 dark:text-amber-500"> · {noPhoneCount} skipped (no phone)</span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Mode tabs */}
          <div className="flex items-center gap-1 border-b border-border">
            <button
              onClick={() => setMode("template")}
              className={cn(
                "px-3 py-1.5 text-[12px] font-medium border-b-2 transition-colors -mb-[1px]",
                mode === "template"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              Use template
            </button>
            <button
              onClick={() => setMode("custom")}
              className={cn(
                "px-3 py-1.5 text-[12px] font-medium border-b-2 transition-colors -mb-[1px]",
                mode === "custom"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              Custom message
            </button>
            <div className="flex-1" />
            <button
              onClick={onManageTemplates}
              className="px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Manage templates
            </button>
          </div>

          {/* Template picker */}
          {mode === "template" && (
            <div className="space-y-2">
              <label className="text-[12px] font-medium text-muted-foreground block">
                Template
              </label>
              {templates && templates.length === 0 ? (
                <div className="text-[12px] text-muted-foreground p-3 border border-dashed border-border rounded-md">
                  No templates yet.{" "}
                  <button onClick={onManageTemplates} className="text-primary underline">
                    Create one
                  </button>
                  {" "}or switch to "Custom message".
                </div>
              ) : (
                <select
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-md border border-border bg-background text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {(templates ?? []).map((t: WhatsappTemplate) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.isDefault ? " · default" : ""}
                      {t.category ? ` · ${t.category}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Custom message */}
          {mode === "custom" && (
            <div className="space-y-2">
              <label className="text-[12px] font-medium text-muted-foreground block">
                Message{" "}
                <span className="text-muted-foreground/60">
                  · vars: {`{{lead_name}}, {{agent_name}}, {{company_name}}, {{phone}}`}
                </span>
              </label>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={5}
                placeholder="Hi {{lead_name}}, this is {{agent_name}} from {{company_name}}..."
                className="w-full px-2.5 py-2 rounded-md border border-border bg-background text-[13px] focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>
          )}

          {/* Delay */}
          <div className="space-y-2">
            <label className="text-[12px] font-medium text-muted-foreground flex items-center gap-1.5">
              <Clock className="w-3 h-3" /> Send delay
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={300}
                step={5}
                value={delaySecs}
                onChange={(e) => setDelaySecs(Number(e.target.value))}
                className="flex-1 accent-primary"
              />
              <span className="text-[12px] tabular-nums w-16 text-right">
                {delaySecs === 0 ? "Instant" : `${delaySecs}s`}
              </span>
            </div>
            <p className="text-[10.5px] text-muted-foreground/70">
              Demo-friendly: 5s. Production: 60s+ to feel less bot-like.
            </p>
          </div>

          {/* Live preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-medium text-muted-foreground">
                Preview {previewLead && `· ${previewLead.name}`}
              </label>
              {selectedLeads.length > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPreviewLeadIdx((i) => Math.max(0, i - 1))}
                    disabled={previewLeadIdx === 0}
                    className="text-[11px] px-1.5 py-0.5 rounded border border-border disabled:opacity-30"
                  >
                    ←
                  </button>
                  <span className="text-[10.5px] text-muted-foreground tabular-nums">
                    {previewLeadIdx + 1}/{selectedLeads.length}
                  </span>
                  <button
                    onClick={() => setPreviewLeadIdx((i) => Math.min(selectedLeads.length - 1, i + 1))}
                    disabled={previewLeadIdx === selectedLeads.length - 1}
                    className="text-[11px] px-1.5 py-0.5 rounded border border-border disabled:opacity-30"
                  >
                    →
                  </button>
                </div>
              )}
            </div>
            <div className="rounded-lg p-3 text-[13px] leading-relaxed whitespace-pre-wrap" style={{ background: "oklch(0.95 0.02 162)", color: "oklch(0.25 0.05 162)" }}>
              {previewMessage || (
                <span className="text-muted-foreground/60 italic">
                  {mode === "custom" ? "Type a message above..." : "Pick a template above..."}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/20">
          <div className="text-[11px] text-muted-foreground">
            From: {agentName} · Sends via WhatsApp
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-[12px] h-8" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="text-[12px] h-8 gap-1.5"
              disabled={!canSend}
              onClick={submit}
            >
              <Send className="w-3 h-3" />
              {submitting ? "Sending..." : `Send to ${validCount}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
