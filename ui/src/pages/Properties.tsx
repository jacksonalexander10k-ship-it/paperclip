import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useLocation } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { propertiesApi, type PropertyFilters, type Property } from "../api/properties";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { Tabs } from "@/components/ui/tabs";
import { PageTabBar } from "../components/PageTabBar";
import { Button } from "@/components/ui/button";
import { cn } from "../lib/utils";
import { Building2, Plus, SlidersHorizontal } from "lucide-react";

const PROPERTY_GRADIENTS = [
  "linear-gradient(135deg, #064e3b, #047857)",
  "linear-gradient(135deg, #3730a3, #4f46e5)",
  "linear-gradient(135deg, #0c4a6e, #0369a1)",
  "linear-gradient(135deg, #78350f, #b45309)",
  "linear-gradient(135deg, #134e4a, #0f766e)",
  "linear-gradient(135deg, #7f1d1d, #b91c1c)",
  "linear-gradient(135deg, #1e3a5f, #1d4ed8)",
  "linear-gradient(135deg, #500724, #9d174d)",
] as const;

const SALE_STAGES = ["available", "viewing_scheduled", "offer_received", "under_negotiation", "sold"] as const;
const RENTAL_STAGES = ["available", "viewing_scheduled", "application_received", "under_contract", "rented"] as const;

const STAGE_LABELS: Record<string, string> = {
  available: "Available",
  viewing_scheduled: "Viewing Scheduled",
  offer_received: "Offer Received",
  under_negotiation: "Under Negotiation",
  sold: "Sold",
  application_received: "Application Received",
  under_contract: "Under Contract",
  rented: "Rented",
};

function getPillClasses(stage: string): string {
  switch (stage) {
    case "available":
      return "bg-green-500/10 text-green-700 dark:bg-green-400/12 dark:text-green-400";
    case "viewing_scheduled":
      return "bg-violet-500/10 text-violet-700 dark:bg-violet-400/12 dark:text-violet-400";
    case "offer_received":
    case "application_received":
      return "bg-amber-500/10 text-amber-700 dark:bg-amber-400/12 dark:text-amber-400";
    case "under_negotiation":
    case "under_contract":
      return "bg-orange-500/10 text-orange-700 dark:bg-orange-400/12 dark:text-orange-400";
    case "sold":
    case "rented":
      return "bg-muted-foreground/10 text-muted-foreground";
    default:
      return "bg-muted-foreground/10 text-muted-foreground";
  }
}

function getDotClasses(stage: string): string {
  switch (stage) {
    case "available":
      return "bg-green-600 dark:bg-green-400";
    case "viewing_scheduled":
      return "bg-violet-600 dark:bg-violet-400";
    case "offer_received":
    case "application_received":
      return "bg-amber-600 dark:bg-amber-400";
    case "under_negotiation":
    case "under_contract":
      return "bg-orange-600 dark:bg-orange-400";
    case "sold":
    case "rented":
      return "bg-muted-foreground/50";
    default:
      return "bg-muted-foreground/50";
  }
}

function getTextClasses(stage: string): string {
  switch (stage) {
    case "available":
      return "text-green-700 dark:text-green-400";
    case "viewing_scheduled":
      return "text-violet-700 dark:text-violet-400";
    case "offer_received":
    case "application_received":
      return "text-amber-700 dark:text-amber-400";
    case "under_negotiation":
    case "under_contract":
      return "text-orange-700 dark:text-orange-400";
    case "sold":
    case "rented":
      return "text-muted-foreground";
    default:
      return "text-muted-foreground";
  }
}

function formatPrice(value: number, listingType: "sale" | "rental"): string {
  const fmt = (n: number) => {
    if (n >= 1_000_000) {
      const m = n / 1_000_000;
      return `AED ${m % 1 === 0 ? m.toFixed(0) : m.toFixed(2)}M`;
    }
    return `AED ${n.toLocaleString("en-US")}`;
  };
  return listingType === "rental" ? `${fmt(value)}/yr` : fmt(value);
}

function getDaysListed(createdAt: string): number {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - created) / (1000 * 60 * 60 * 24)));
}

function PropertyCard({ property, index, listingType }: { property: Property; index: number; listingType: "sale" | "rental" }) {
  const gradient = PROPERTY_GRADIENTS[index % PROPERTY_GRADIENTS.length];
  const stage = property.pipelineStatus ?? "available";
  const isTerminal = stage === "sold" || stage === "rented";
  const price = listingType === "sale" ? property.saleValue : property.rentalPrice;
  const daysListed = getDaysListed(property.createdAt);

  const locationParts = [property.buildingName, property.area].filter(Boolean);
  const specParts: string[] = [];
  if (property.bedrooms != null) specParts.push(`${property.bedrooms} Bed${property.bedrooms !== 1 ? "s" : ""}`);
  if (property.bathrooms != null) specParts.push(`${property.bathrooms} Bath${property.bathrooms !== 1 ? "s" : ""}`);
  if (property.sqft != null) specParts.push(`${property.sqft.toLocaleString("en-US")} sqft`);

  return (
    <Link
      to={`/properties/${property.id}`}
      className={cn(
        "block rounded-xl border border-border/50 bg-card/80 overflow-hidden no-underline text-inherit",
        "hover:border-primary/25 hover:-translate-y-px hover:shadow-md transition-all",
        isTerminal && "opacity-50"
      )}
    >
      {/* Photo area */}
      <div className="relative h-[140px] overflow-hidden">
        {property.photos && property.photos.length > 0 ? (
          <img
            src={property.photos[0]}
            alt={property.buildingName ?? "Property"}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: gradient }}
          >
            <span className="text-3xl">🏢</span>
          </div>
        )}

        {/* Status badge — top left */}
        <div
          className={cn(
            "absolute top-2 left-2 flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium backdrop-blur-sm bg-background/80",
            getTextClasses(stage)
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", getDotClasses(stage))} />
          {STAGE_LABELS[stage] ?? stage}
        </div>

        {/* Photo count — top right */}
        {property.photos && property.photos.length > 1 && (
          <div className="absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-medium bg-background/80 backdrop-blur-sm text-muted-foreground">
            {property.photos.length} photos
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-3.5">
        {/* Price */}
        {price != null ? (
          <p className="text-[16px] font-extrabold leading-tight truncate">
            {formatPrice(price, listingType)}
          </p>
        ) : (
          <p className="text-[16px] font-extrabold leading-tight text-muted-foreground/50">Price TBC</p>
        )}

        {/* Location */}
        {locationParts.length > 0 && (
          <p className="text-[12px] text-muted-foreground mt-0.5 truncate">
            {locationParts.join(" · ")}
          </p>
        )}

        {/* Specs row */}
        {specParts.length > 0 && (
          <p className="text-[11.5px] text-muted-foreground mt-2 pt-2 border-t border-border/50 truncate">
            {specParts.join(" · ")}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-2 pt-1">
          {property.leadCount > 0 ? (
            <span className="text-[11px] font-medium text-primary">
              {property.leadCount} lead{property.leadCount !== 1 ? "s" : ""}
            </span>
          ) : (
            <span />
          )}
          <span className="text-[10px] text-muted-foreground">
            {daysListed === 0 ? "Listed today" : `${daysListed}d listed`}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function Properties() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();
  const location = useLocation();

  const pathTab = location.pathname.split("/").pop();
  const tab: "sale" | "rental" = pathTab === "rental" ? "rental" : "sale";

  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  useEffect(() => {
    setStatusFilter(null);
  }, [tab]);

  useEffect(() => {
    setBreadcrumbs([{ label: "Properties" }]);
  }, [setBreadcrumbs]);

  const filters = useMemo<PropertyFilters>(() => ({
    listingType: tab,
    ...(statusFilter ? { pipelineStatus: statusFilter } : {}),
  }), [tab, statusFilter]);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.properties.list(selectedCompanyId!, filters as Record<string, unknown>),
    queryFn: () => propertiesApi.list(selectedCompanyId!, filters),
    enabled: !!selectedCompanyId,
  });

  const stages = tab === "sale" ? SALE_STAGES : RENTAL_STAGES;
  const summary = data?.summary ?? {};
  const items = data?.items ?? [];

  if (!selectedCompanyId) {
    return <EmptyState icon={Building2} message="Select a company to view properties." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Properties"
        actions={
          <>
            <Button variant="ghost" size="sm">
              <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
              Filter
            </Button>
            <Button size="sm" onClick={() => navigate("/properties/new")}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Property
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-4 space-y-4">
          {/* Tabs */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs value={tab} onValueChange={(v) => navigate(`/properties/${v}`)}>
              <PageTabBar
                items={[
                  { value: "sale", label: "Sales" },
                  { value: "rental", label: "Rentals" },
                ]}
                value={tab}
                onValueChange={(v) => navigate(`/properties/${v}`)}
              />
            </Tabs>
          </div>

          {/* Pipeline status pills */}
          <div className="flex flex-wrap gap-1.5">
            {stages.map((stage) => {
              const count = summary[stage] ?? 0;
              const isActive = statusFilter === stage;
              return (
                <button
                  key={stage}
                  onClick={() => setStatusFilter(isActive ? null : stage)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-all border",
                    isActive
                      ? cn(getPillClasses(stage), "border-current/30 ring-1 ring-current/20")
                      : cn(getPillClasses(stage), "border-transparent opacity-70 hover:opacity-100")
                  )}
                >
                  {STAGE_LABELS[stage]}
                  {count > 0 && (
                    <span className="font-bold tabular-nums">{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Empty state */}
          {items.length === 0 && (
            <EmptyState
              icon={Building2}
              message={
                statusFilter
                  ? `No properties with status "${STAGE_LABELS[statusFilter] ?? statusFilter}".`
                  : `No ${tab === "sale" ? "sale" : "rental"} properties yet. Add your first property to get started.`
              }
              action="Add Property"
              onAction={() => navigate("/properties/new")}
            />
          )}

          {/* Card grid */}
          {items.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {items.map((property, index) => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  index={index}
                  listingType={tab}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
