import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { issuesApi } from "../api/issues";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { PageSkeleton } from "../components/PageSkeleton";
import { FileText, ExternalLink, Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { IssueWorkProduct, IssueWorkProductType } from "@paperclipai/shared";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const TYPE_LABEL: Record<IssueWorkProductType, string> = {
  document: "DOC",
  artifact: "FILE",
  pull_request: "PR",
  branch: "BR",
  preview_url: "HTML",
  runtime_service: "SVC",
  commit: "GIT",
};

const TYPE_LABEL_LONG: Record<IssueWorkProductType, string> = {
  document: "Document",
  artifact: "File",
  pull_request: "Pull Request",
  branch: "Branch",
  preview_url: "Preview",
  runtime_service: "Service",
  commit: "Commit",
};

const TYPE_BADGE_STYLE: Record<IssueWorkProductType, string> = {
  document: "bg-amber-500/90 text-white",
  artifact: "bg-emerald-500/90 text-white",
  pull_request: "bg-violet-500/90 text-white",
  branch: "bg-neutral-500/90 text-white",
  preview_url: "bg-blue-500/90 text-white",
  runtime_service: "bg-cyan-500/90 text-white",
  commit: "bg-neutral-500/90 text-white",
};

const STATUS_STYLE: Record<string, string> = {
  active: "bg-green-500/15 text-green-600 dark:text-green-400",
  ready_for_review: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  approved: "bg-green-500/15 text-green-600 dark:text-green-400",
  draft: "bg-neutral-500/15 text-muted-foreground",
  merged: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  closed: "bg-neutral-500/15 text-muted-foreground",
  failed: "bg-red-500/15 text-red-600 dark:text-red-400",
  archived: "bg-neutral-500/15 text-muted-foreground",
  changes_requested: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
};

const FILTER_TYPES: { label: string; value: string }[] = [
  { label: "All", value: "all" },
  { label: "Documents", value: "document" },
  { label: "Files", value: "artifact" },
  { label: "Pull Requests", value: "pull_request" },
  { label: "Previews", value: "preview_url" },
];

function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function Deliverables() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [filter, setFilter] = useState("all");
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    setBreadcrumbs([{ label: "Deliverables" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.deliverables(selectedCompanyId!),
    queryFn: () => issuesApi.listWorkProductsForCompany(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    retry: 1,
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    if (filter === "all") return data;
    return data.filter((item) => item.type === filter);
  }, [data, filter]);

  if (!selectedCompanyId) {
    return <EmptyState icon={FileText} message="Select a company to view deliverables." />;
  }

  if (isLoading && !error) {
    return <PageSkeleton variant="list" />;
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Deliverables"
        actions={
          <DropdownMenu open={filterOpen} onOpenChange={setFilterOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-[11.5px] h-7">
                {filter === "all" ? "Filter" : FILTER_TYPES.find((f) => f.value === filter)?.label ?? "Filter"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {FILTER_TYPES.map(({ label, value }) => (
                <DropdownMenuItem
                  key={value}
                  onClick={() => {
                    setFilter(value);
                    setFilterOpen(false);
                  }}
                  className={filter === value ? "font-semibold" : ""}
                >
                  {label}
                  {value !== "all" && data && (
                    <span className="ml-auto text-muted-foreground text-[10px]">
                      {data.filter((i) => i.type === value).length}
                    </span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <div className="flex-1 overflow-y-auto p-5 space-y-4">

        {filtered.length === 0 || error ? (
          <EmptyState
            icon={FileText}
            message={
              filter === "all"
                ? "No deliverables yet. Your agents will add files and docs here as they work."
                : `No ${filter.replace(/_/g, " ")}s yet.`
            }
          />
        ) : (
          <div className="rounded-xl border border-border/50 bg-card/80 overflow-hidden">
            {filtered.map((item, index) => {
              const typeKey = item.type as IssueWorkProductType;
              const badgeLabel = TYPE_LABEL[typeKey] ?? item.type.toUpperCase().slice(0, 4);
              const badgeStyle = TYPE_BADGE_STYLE[typeKey] ?? "bg-neutral-500/90 text-white";
              const typeLong = TYPE_LABEL_LONG[typeKey] ?? item.type;
              const hasUrl = !!item.url;
              const isPreviewable = typeKey === "preview_url" || typeKey === "document";

              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 p-3 hover:bg-accent/30 transition-colors ${
                    index < filtered.length - 1 ? "border-b border-border/40" : ""
                  }`}
                >
                  {/* Type badge */}
                  <div
                    className={`w-[34px] h-[34px] rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${badgeStyle}`}
                  >
                    {badgeLabel}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold truncate">{item.title}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {typeLong}
                      {item.summary ? ` \u00b7 ${item.summary}` : ""}
                      {" \u00b7 "}
                      {formatDate(item.createdAt)}
                    </div>
                  </div>

                  {/* Action button */}
                  {hasUrl && (
                    <a
                      href={item.url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button variant="ghost" size="sm" className="text-[11px] h-7 gap-1.5 shrink-0">
                        {isPreviewable ? (
                          <>
                            <Eye className="h-3 w-3" />
                            Preview
                          </>
                        ) : (
                          <>
                            <Download className="h-3 w-3" />
                            Download
                          </>
                        )}
                      </Button>
                    </a>
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
