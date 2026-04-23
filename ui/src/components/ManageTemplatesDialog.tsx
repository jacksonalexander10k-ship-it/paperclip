import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Plus, Trash2, Star, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { whatsappTemplatesApi, type WhatsappTemplate } from "../api/whatsapp-templates";
import { cn } from "../lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  companyId: string;
}

const CATEGORIES = [
  { id: "first_touch", label: "First touch" },
  { id: "follow_up", label: "Follow up" },
  { id: "reactivation", label: "Reactivation" },
  { id: "viewing", label: "Viewing" },
  { id: "general", label: "General" },
];

export function ManageTemplatesDialog({ open, onClose, companyId }: Props) {
  const queryClient = useQueryClient();
  const { data: templates } = useQuery({
    queryKey: ["whatsapp-templates", companyId],
    queryFn: () => whatsappTemplatesApi.list(companyId),
    enabled: open && !!companyId,
  });

  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<{ name: string; category: string; content: string; isDefault: boolean }>({
    name: "",
    category: "first_touch",
    content: "",
    isDefault: false,
  });

  useEffect(() => {
    if (open && templates && templates.length > 0 && editingId === null) {
      const def = templates.find((t) => t.isDefault) ?? templates[0];
      setEditingId(def.id);
    }
  }, [open, templates, editingId]);

  useEffect(() => {
    if (editingId === "new") {
      setDraft({ name: "", category: "first_touch", content: "", isDefault: false });
      return;
    }
    if (editingId && templates) {
      const t = templates.find((x) => x.id === editingId);
      if (t) {
        setDraft({
          name: t.name,
          category: t.category ?? "first_touch",
          content: t.content ?? "",
          isDefault: Boolean(t.isDefault),
        });
      }
    }
  }, [editingId, templates]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["whatsapp-templates", companyId] });

  const create = useMutation({
    mutationFn: () =>
      whatsappTemplatesApi.create(companyId, {
        name: draft.name.trim(),
        category: draft.category,
        content: draft.content,
        isDefault: draft.isDefault,
      }),
    onSuccess: (tpl) => {
      invalidate();
      setEditingId(tpl.id);
    },
  });

  const update = useMutation({
    mutationFn: () =>
      whatsappTemplatesApi.update(companyId, editingId as string, {
        name: draft.name.trim(),
        category: draft.category,
        content: draft.content,
        isDefault: draft.isDefault,
      }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => whatsappTemplatesApi.remove(companyId, id),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    },
  });

  if (!open) return null;

  function save() {
    if (!draft.name.trim() || !draft.content.trim()) return;
    if (editingId === "new") create.mutate();
    else if (editingId) update.mutate();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <h2 className="text-[14px] font-bold">Outreach templates</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Sidebar */}
          <div className="w-56 border-r border-border flex flex-col">
            <div className="p-2.5 border-b border-border">
              <Button
                size="sm"
                variant="outline"
                className="w-full justify-start text-[12px] h-8 gap-1.5"
                onClick={() => setEditingId("new")}
              >
                <Plus className="w-3 h-3" /> New template
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {(templates ?? []).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setEditingId(t.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 border-b border-border/50 hover:bg-accent/40 transition-colors",
                    editingId === t.id && "bg-accent/60",
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    {t.isDefault && <Star className="w-3 h-3 fill-current text-amber-500" />}
                    <span className="font-medium text-[12.5px] truncate">{t.name}</span>
                  </div>
                  <div className="text-[10.5px] text-muted-foreground mt-0.5">
                    {t.usageCount ?? 0} uses
                  </div>
                </button>
              ))}
              {templates && templates.length === 0 && editingId !== "new" && (
                <div className="px-3 py-4 text-[12px] text-muted-foreground">
                  No templates yet.
                </div>
              )}
            </div>
          </div>

          {/* Editor */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {editingId === null ? (
              <div className="flex-1 flex items-center justify-center text-[12.5px] text-muted-foreground">
                Pick a template or create a new one.
              </div>
            ) : (
              <>
                <div className="p-4 space-y-3 overflow-y-auto flex-1">
                  <div>
                    <label className="text-[12px] font-medium text-muted-foreground block mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={draft.name}
                      onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                      placeholder="e.g. Off-plan first touch"
                      className="w-full h-8 px-2.5 rounded-md border border-border bg-background text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>

                  <div>
                    <label className="inline-flex items-center gap-2 text-[12.5px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draft.isDefault}
                        onChange={(e) => setDraft((d) => ({ ...d, isDefault: e.target.checked }))}
                        className="h-4 w-4 rounded border-border accent-primary"
                      />
                      Use this as the default template
                    </label>
                  </div>

                  <div>
                    <label className="text-[12px] font-medium text-muted-foreground block mb-1">
                      Message *{" "}
                      <span className="text-muted-foreground/60">
                        · vars: {`{{lead_name}}, {{agent_name}}, {{company_name}}, {{phone}}`}
                      </span>
                    </label>
                    <textarea
                      value={draft.content}
                      onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
                      rows={8}
                      placeholder="Hi {{lead_name}}, this is {{agent_name}}..."
                      className="w-full px-2.5 py-2 rounded-md border border-border bg-background text-[13px] focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                    />
                  </div>

                  {editingId !== "new" && (
                    <div className="pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-[11px] h-7 gap-1.5 text-destructive border-destructive/30"
                        onClick={() => {
                          if (confirm(`Delete "${draft.name}"?`)) remove.mutate(editingId as string);
                        }}
                      >
                        <Trash2 className="w-3 h-3" /> Delete template
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border bg-muted/20">
                  <Button variant="ghost" size="sm" className="text-[12px] h-8" onClick={onClose}>
                    Close
                  </Button>
                  <Button
                    size="sm"
                    className="text-[12px] h-8 gap-1.5"
                    disabled={!draft.name.trim() || !draft.content.trim() || create.isPending || update.isPending}
                    onClick={save}
                  >
                    <Save className="w-3 h-3" />
                    {editingId === "new" ? "Create" : "Save"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
