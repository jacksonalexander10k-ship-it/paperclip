import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  autoReplyRulesApi,
  type AutoReplyRule,
  type CreateAutoReplyRuleInput,
} from "../api/auto-reply-rules";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  MessageCircle,
  Mail,
  Clock,
  Zap,
} from "lucide-react";

const LEAD_SOURCES = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "property_finder", label: "Property Finder" },
  { value: "bayut", label: "Bayut" },
  { value: "dubizzle", label: "Dubizzle" },
  { value: "facebook_ad", label: "Facebook Ad" },
  { value: "landing_page", label: "Landing Page" },
  { value: "instagram", label: "Instagram" },
];

const REPLY_CHANNELS = [
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "email", label: "Email", icon: Mail },
];

function formatSource(source: string): string {
  const found = LEAD_SOURCES.find((s) => s.value === source);
  return found?.label ?? source;
}

function formatChannel(channel: string): string {
  const found = REPLY_CHANNELS.find((c) => c.value === channel);
  return found?.label ?? channel;
}

interface RuleFormState {
  leadSource: string;
  replyChannel: string;
  fixedMessage: string;
  emailSubject: string;
  delaySecs: number;
}

const DEFAULT_FORM: RuleFormState = {
  leadSource: "whatsapp",
  replyChannel: "whatsapp",
  fixedMessage: "",
  emailSubject: "",
  delaySecs: 60,
};

export function AutoReplyRules({ companyId }: { companyId: string }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RuleFormState>(DEFAULT_FORM);

  const { data: rules, isLoading } = useQuery({
    queryKey: queryKeys.autoReplyRules.list(companyId),
    queryFn: () => autoReplyRulesApi.list(companyId),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.autoReplyRules.list(companyId),
    });

  const createMutation = useMutation({
    mutationFn: (data: CreateAutoReplyRuleInput) =>
      autoReplyRulesApi.create(companyId, data),
    onSuccess: () => {
      invalidate();
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      ruleId,
      data,
    }: {
      ruleId: string;
      data: Partial<CreateAutoReplyRuleInput>;
    }) => autoReplyRulesApi.update(companyId, ruleId, data),
    onSuccess: () => {
      invalidate();
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (ruleId: string) =>
      autoReplyRulesApi.remove(companyId, ruleId),
    onSuccess: invalidate,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ ruleId, enabled }: { ruleId: string; enabled: string }) =>
      autoReplyRulesApi.update(companyId, ruleId, { enabled }),
    onSuccess: invalidate,
  });

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(DEFAULT_FORM);
  }

  function startEdit(rule: AutoReplyRule) {
    setEditingId(rule.id);
    setShowForm(true);
    setForm({
      leadSource: rule.leadSource,
      replyChannel: rule.replyChannel,
      fixedMessage: rule.fixedMessage ?? "",
      emailSubject: rule.emailSubject ?? "",
      delaySecs: rule.delaySecs,
    });
  }

  function handleSubmit() {
    const payload: CreateAutoReplyRuleInput = {
      leadSource: form.leadSource,
      replyChannel: form.replyChannel,
      fixedMessage: form.fixedMessage || null,
      emailSubject: form.emailSubject || null,
      delaySecs: form.delaySecs,
    };

    if (editingId) {
      updateMutation.mutate({ ruleId: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="rounded-xl border border-border/50 bg-card/80 overflow-hidden">
      <div className="px-3.5 py-3 border-b border-border/40 bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[12px] font-bold">Auto-Reply Rules</span>
            {rules && rules.length > 0 && (
              <span className="text-[10px] text-muted-foreground">
                ({rules.filter((r) => r.enabled === "true").length} active)
              </span>
            )}
          </div>
          {!showForm && (
            <Button
              variant="ghost"
              size="sm"
              className="text-[11px] h-7"
              onClick={() => {
                setForm(DEFAULT_FORM);
                setEditingId(null);
                setShowForm(true);
              }}
            >
              <Plus className="mr-1 h-3 w-3" />
              Add Rule
            </Button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Inline form */}
        {showForm && (
          <div className="rounded-lg border border-border/50 bg-background p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold">
                {editingId ? "Edit Rule" : "New Rule"}
              </span>
              <button
                onClick={resetForm}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Lead source */}
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">
                Lead Source
              </label>
              <select
                value={form.leadSource}
                onChange={(e) =>
                  setForm((f) => ({ ...f, leadSource: e.target.value }))
                }
                className="w-full bg-background border border-border rounded-lg p-2 text-[13px] outline-none focus:border-primary/50 transition-colors"
              >
                {LEAD_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Reply channel */}
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">
                Reply Channel
              </label>
              <select
                value={form.replyChannel}
                onChange={(e) =>
                  setForm((f) => ({ ...f, replyChannel: e.target.value }))
                }
                className="w-full bg-background border border-border rounded-lg p-2 text-[13px] outline-none focus:border-primary/50 transition-colors"
              >
                {REPLY_CHANNELS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Email subject (only for email channel) */}
            {form.replyChannel === "email" && (
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">
                  Email Subject
                </label>
                <input
                  type="text"
                  value={form.emailSubject}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, emailSubject: e.target.value }))
                  }
                  placeholder="e.g. Thanks for your enquiry"
                  className="w-full bg-background border border-border rounded-lg p-2 text-[13px] outline-none focus:border-primary/50 transition-colors"
                />
              </div>
            )}

            {/* Message */}
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">
                Message
              </label>
              <textarea
                value={form.fixedMessage}
                onChange={(e) =>
                  setForm((f) => ({ ...f, fixedMessage: e.target.value }))
                }
                placeholder="Hi {{name}}, thanks for reaching out! We'll get back to you shortly."
                rows={3}
                className="w-full bg-background border border-border rounded-lg p-2 text-[13px] outline-none focus:border-primary/50 transition-colors resize-none"
              />
            </div>

            {/* Delay */}
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">
                Delay (seconds)
              </label>
              <input
                type="number"
                min={0}
                max={3600}
                value={form.delaySecs}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    delaySecs: Math.max(0, parseInt(e.target.value, 10) || 0),
                  }))
                }
                className="w-full bg-background border border-border rounded-lg p-2 text-[13px] outline-none focus:border-primary/50 transition-colors"
              />
              <p className="text-[10px] text-muted-foreground">
                How long to wait before sending. 0 = immediate.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                className="text-[11.5px] h-7"
                onClick={handleSubmit}
                disabled={isSaving || !form.fixedMessage.trim()}
              >
                {isSaving
                  ? "Saving..."
                  : editingId
                  ? "Update Rule"
                  : "Create Rule"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-[11.5px] h-7"
                onClick={resetForm}
              >
                Cancel
              </Button>
              {(createMutation.isError || updateMutation.isError) && (
                <span className="text-[11px] text-destructive">
                  Failed to save rule
                </span>
              )}
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-2">
            <div className="h-14 bg-muted/30 rounded-lg animate-pulse" />
            <div className="h-14 bg-muted/30 rounded-lg animate-pulse" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && (!rules || rules.length === 0) && !showForm && (
          <p className="text-[11.5px] text-muted-foreground leading-[1.5]">
            No auto-reply rules configured. Add a rule to automatically respond
            to incoming leads from specific sources.
          </p>
        )}

        {/* Rules list */}
        {rules && rules.length > 0 && (
          <div className="space-y-2">
            {rules.map((rule) => {
              const ChannelIcon =
                rule.replyChannel === "email" ? Mail : MessageCircle;
              const isEnabled = rule.enabled === "true";

              return (
                <div
                  key={rule.id}
                  className={`rounded-lg border bg-background px-3 py-2.5 space-y-1.5 ${
                    isEnabled
                      ? "border-border/40"
                      : "border-border/20 opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                        {formatSource(rule.leadSource)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        via
                      </span>
                      <span className="flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded bg-muted">
                        <ChannelIcon className="h-3 w-3" />
                        {formatChannel(rule.replyChannel)}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {rule.delaySecs}s
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Toggle enabled */}
                      <button
                        onClick={() =>
                          toggleMutation.mutate({
                            ruleId: rule.id,
                            enabled: isEnabled ? "false" : "true",
                          })
                        }
                        className={`relative w-8 h-[18px] rounded-full transition-colors ${
                          isEnabled ? "bg-primary" : "bg-muted-foreground/30"
                        }`}
                        title={isEnabled ? "Disable rule" : "Enable rule"}
                      >
                        <span
                          className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white transition-transform ${
                            isEnabled ? "left-[16px]" : "left-[2px]"
                          }`}
                        />
                      </button>
                      <button
                        onClick={() => startEdit(rule)}
                        className="text-muted-foreground hover:text-foreground transition-colors p-1"
                        title="Edit rule"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => {
                          if (
                            window.confirm(
                              "Delete this auto-reply rule?"
                            )
                          ) {
                            deleteMutation.mutate(rule.id);
                          }
                        }}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1"
                        title="Delete rule"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* Message preview */}
                  {rule.fixedMessage && (
                    <p className="text-[11px] text-muted-foreground truncate">
                      {rule.fixedMessage}
                    </p>
                  )}

                  {/* Email subject */}
                  {rule.replyChannel === "email" && rule.emailSubject && (
                    <p className="text-[10px] text-muted-foreground/70 truncate">
                      Subject: {rule.emailSubject}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
