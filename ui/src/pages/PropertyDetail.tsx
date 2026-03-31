import { useEffect } from "react";
import { useParams, Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { propertiesApi } from "../api/properties";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { PageHeader } from "../components/PageHeader";
import { PageSkeleton } from "../components/PageSkeleton";
import { cn } from "../lib/utils";
import {
  Bed,
  Bath,
  Maximize,
  Layers,
  Eye,
  Car,
  Phone,
  Mail,
  User,
  ArrowLeft,
  Link as LinkIcon,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

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

const STAGE_COLORS: Record<string, string> = {
  available: "text-green-700 dark:text-green-400 bg-green-500/10 dark:bg-green-400/12",
  viewing_scheduled: "text-violet-700 dark:text-violet-400 bg-violet-500/10 dark:bg-violet-400/12",
  offer_received: "text-amber-700 dark:text-amber-400 bg-amber-500/10 dark:bg-amber-400/12",
  application_received: "text-amber-700 dark:text-amber-400 bg-amber-500/10 dark:bg-amber-400/12",
  under_negotiation: "text-orange-700 dark:text-orange-400 bg-orange-500/10 dark:bg-orange-400/12",
  under_contract: "text-orange-700 dark:text-orange-400 bg-orange-500/10 dark:bg-orange-400/12",
  sold: "text-muted-foreground bg-muted",
  rented: "text-muted-foreground bg-muted",
};

const INTEREST_LABELS: Record<string, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const INTEREST_COLORS: Record<string, string> = {
  high: "text-green-700 dark:text-green-400 bg-green-500/10 dark:bg-green-400/12",
  medium: "text-amber-700 dark:text-amber-400 bg-amber-500/10 dark:bg-amber-400/12",
  low: "text-muted-foreground bg-muted",
};

function formatPrice(value: number | null, listingType?: string | null): string {
  if (!value) return "—";
  const n = value;
  let str: string;
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    str = `AED ${m % 1 === 0 ? m.toFixed(0) : m.toFixed(2)}M`;
  } else {
    str = `AED ${n.toLocaleString("en-US")}`;
  }
  if (listingType === "rental") return `${str}/yr`;
  return str;
}

function labelCase(str: string): string {
  return str.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function PropertyDetail() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  const { data: property, isLoading } = useQuery({
    queryKey: queryKeys.properties.detail(selectedCompanyId!, propertyId!),
    queryFn: () => propertiesApi.get(selectedCompanyId!, propertyId!),
    enabled: !!selectedCompanyId && !!propertyId,
  });

  const { data: leads } = useQuery({
    queryKey: queryKeys.properties.leads(selectedCompanyId!, propertyId!),
    queryFn: () => propertiesApi.listLeads(selectedCompanyId!, propertyId!),
    enabled: !!selectedCompanyId && !!propertyId,
  });

  useEffect(() => {
    setBreadcrumbs([
      { label: "Properties", href: "/properties" },
      { label: property?.buildingName ?? "Property" },
    ]);
    return () => setBreadcrumbs([]);
  }, [property?.buildingName, setBreadcrumbs]);

  if (isLoading) return <PageSkeleton />;
  if (!property) return null;

  const stage = property.pipelineStatus ?? "available";
  const stageLabel = STAGE_LABELS[stage] ?? labelCase(stage);
  const stageColor = STAGE_COLORS[stage] ?? "text-muted-foreground bg-muted";

  const price = property.listingType === "rental" ? property.rentalPrice : property.saleValue;
  const gradient = PROPERTY_GRADIENTS[Math.abs(propertyId!.charCodeAt(0)) % PROPERTY_GRADIENTS.length];

  const locationParts = [
    property.unit && `Unit ${property.unit}`,
    property.buildingName,
    property.streetAddress,
    property.area,
  ].filter(Boolean);

  const specs = [
    property.bedrooms != null && { icon: Bed, label: property.bedrooms === 0 ? "Studio" : `${property.bedrooms} Bed${property.bedrooms !== 1 ? "s" : ""}` },
    property.bathrooms != null && { icon: Bath, label: `${property.bathrooms} Bath${property.bathrooms !== 1 ? "s" : ""}` },
    property.sqft != null && { icon: Maximize, label: `${property.sqft.toLocaleString("en-US")} sqft` },
    property.floor != null && { icon: Layers, label: `Floor ${property.floor}` },
    property.viewType && { icon: Eye, label: labelCase(property.viewType) },
    property.parkingSpaces != null && { icon: Car, label: `${property.parkingSpaces} Parking` },
  ].filter(Boolean) as { icon: React.ComponentType<{ className?: string }>; label: string }[];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title={property.buildingName ?? "Property"}
        actions={
          <Link to="/properties">
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Button>
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">

          {/* Photo gallery / placeholder */}
          <div className="rounded-xl overflow-hidden h-52">
            {property.photos && property.photos.length > 0 ? (
              <div className="flex gap-2 h-full overflow-x-auto">
                {property.photos.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`Photo ${i + 1}`}
                    className="h-full w-auto shrink-0 object-cover rounded-xl"
                  />
                ))}
              </div>
            ) : (
              <div
                className="h-full w-full flex items-center justify-center"
                style={{ background: gradient }}
              >
                <Building2 className="h-16 w-16 text-white/30" />
              </div>
            )}
          </div>

          {/* Price + status */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground">
                {formatPrice(price, property.listingType)}
              </p>
              {property.propertyType && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {labelCase(property.propertyType)}
                  {property.listingType ? ` · For ${labelCase(property.listingType)}` : ""}
                </p>
              )}
            </div>
            <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium shrink-0", stageColor)}>
              {stageLabel}
            </span>
          </div>

          {/* Location */}
          {locationParts.length > 0 && (
            <p className="text-sm text-muted-foreground -mt-2">
              {locationParts.join(" · ")}
            </p>
          )}

          {/* Specs grid */}
          {specs.length > 0 && (
            <div className="rounded-xl border border-border/50 bg-card/80 p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Property Details
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {specs.map(({ icon: Icon, label }, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Owner section */}
          <div className="rounded-xl border border-border/50 bg-card/80 p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Owner / Landlord
            </p>
            {property.landlordName ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium text-foreground">{property.landlordName}</span>
                </div>
                {property.landlordPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <a
                      href={`tel:${property.landlordPhone}`}
                      className="text-sm text-primary hover:underline"
                    >
                      {property.landlordPhone}
                    </a>
                  </div>
                )}
                {property.landlordEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <a
                      href={`mailto:${property.landlordEmail}`}
                      className="text-sm text-primary hover:underline"
                    >
                      {property.landlordEmail}
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No owner linked</p>
            )}
          </div>

          {/* Interested leads */}
          <div className="rounded-xl border border-border/50 bg-card/80 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Interested Leads {leads && leads.length > 0 && `(${leads.length})`}
              </p>
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground">
                <LinkIcon className="h-3 w-3" />
                Link Lead
              </Button>
            </div>
            {leads && leads.length > 0 ? (
              <div className="space-y-2">
                {leads.map((lead) => {
                  const interestColor = lead.interestLevel
                    ? (INTEREST_COLORS[lead.interestLevel] ?? "text-muted-foreground bg-muted")
                    : undefined;
                  const interestLabel = lead.interestLevel
                    ? (INTEREST_LABELS[lead.interestLevel] ?? labelCase(lead.interestLevel))
                    : null;
                  return (
                    <div
                      key={lead.id}
                      className="flex items-center justify-between gap-3 py-2 border-b border-border/30 last:border-0"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium text-foreground truncate">
                          {lead.name ?? "Unknown"}
                        </span>
                        {lead.phone && (
                          <span className="text-xs text-muted-foreground hidden sm:inline truncate">
                            {lead.phone}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {lead.score != null && (
                          <span className="text-xs font-medium text-muted-foreground">
                            {lead.score}/10
                          </span>
                        )}
                        {interestLabel && (
                          <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", interestColor)}>
                            {interestLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No leads linked yet</p>
            )}
          </div>

          {/* Notes */}
          {property.notes && (
            <div className="rounded-xl border border-border/50 bg-card/80 p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Notes
              </p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{property.notes}</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
