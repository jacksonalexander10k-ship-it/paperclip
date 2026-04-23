import { useState } from "react";
import { ChevronDown, ChevronRight, Upload, Sparkles, Brain, ScrollText } from "lucide-react";
import { cn } from "../../lib/utils";
import { AgentLearningsTab } from "../AgentLearningsTab";
import { AgentSkillsPanel } from "./AgentSkillsPanel";
import { AgentKnowledgePanel } from "./AgentKnowledgePanel";
import { AgentProfileSection } from "./AgentProfileSection";
import { AgentInstructionsInline } from "./AgentInstructionsInline";

interface AgentTrainingTabProps {
  agentId: string;
  companyId: string;
  agentRole: string;
}

/**
 * Training tab — merges Profile, Knowledge, Skills, and Memory into a single
 * scrollable page with collapsible sections. Replaces the separate Instructions
 * + Learnings + Skills tabs.
 *
 * Follows Claude-Code-style skill UX: grouped, filterable, togglable, with
 * a preview of the underlying instructions.
 */
export function AgentTrainingTab({ agentId, companyId, agentRole }: AgentTrainingTabProps) {
  // Profiles removed — every agent is smart by default, shaped by custom instructions.
  void agentRole;

  return (
    <div className="max-w-3xl mx-auto w-full space-y-4">
      {/* Custom instructions — the primary way to shape agent behaviour */}
      <Section
        id="instructions"
        icon={<Sparkles className="h-4 w-4" />}
        title="Custom instructions"
        description="Tell this agent how to behave. Each line is a rule you can toggle on or off."
        defaultOpen
      >
        <AgentInstructionsInline agentId={agentId} companyId={companyId} />
      </Section>

      {/* Knowledge base */}
      <Section
        id="knowledge"
        icon={<ScrollText className="h-4 w-4" />}
        title="Knowledge"
        description="Files this agent can reference — brochures, price lists, area guides."
      >
        <AgentKnowledgePanel agentId={agentId} companyId={companyId} />
      </Section>

      {/* Skills — Claude-Code-style grouped list */}
      <Section
        id="skills"
        icon={<Sparkles className="h-4 w-4" />}
        title="Skills"
        description="Things this agent knows how to do. Toggle on/off anytime."
        defaultOpen
      >
        <AgentSkillsPanel agentId={agentId} companyId={companyId} agentRole={agentRole} />
      </Section>

      {/* What they've learned (memory) */}
      <Section
        id="memory"
        icon={<Brain className="h-4 w-4" />}
        title="What this agent has learned"
        description="Rules picked up from your edits on their drafts."
      >
        <AgentLearningsTab agentId={agentId} companyId={companyId} />
      </Section>
    </div>
  );
}

// ── Collapsible section wrapper ─────────────────────────────────────────────

function Section({
  id,
  icon,
  title,
  description,
  children,
  defaultOpen = false,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div id={id} className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/30 transition-colors"
      >
        <div className="shrink-0 text-muted-foreground">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
        <div className="shrink-0 text-muted-foreground">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold">{title}</div>
          <div className="text-[11.5px] text-muted-foreground mt-0.5">{description}</div>
        </div>
      </button>
      {open && <div className={cn("border-t border-border/40 p-4")}>{children}</div>}
    </div>
  );
}
