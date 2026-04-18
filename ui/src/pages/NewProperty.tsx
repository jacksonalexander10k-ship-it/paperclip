import { useEffect, useState } from "react";
import { Link, useNavigate } from "@/lib/router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { propertiesApi } from "../api/properties";
import { PageHeader } from "../components/PageHeader";
import { Button } from "@/components/ui/button";
import { cn } from "../lib/utils";

type ListingType = "sale" | "rental";

export function NewProperty() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [listingType, setListingType] = useState<ListingType>("sale");
  const [buildingName, setBuildingName] = useState("");
  const [unit, setUnit] = useState("");
  const [area, setArea] = useState("");
  const [propertyType, setPropertyType] = useState("apartment");
  const [bedrooms, setBedrooms] = useState<string>("");
  const [bathrooms, setBathrooms] = useState<string>("");
  const [sqft, setSqft] = useState<string>("");
  const [price, setPrice] = useState<string>("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setBreadcrumbs([{ label: "Properties", href: "/properties/sales" }, { label: "Add property" }]);
  }, [setBreadcrumbs]);

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => propertiesApi.create(selectedCompanyId!, data),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      pushToast({ title: "Property added", tone: "success" });
      navigate(created?.id ? `/properties/${created.id}` : "/properties/sales");
    },
    onError: (err) => {
      pushToast({
        title: "Couldn't add property",
        body: err instanceof Error ? err.message : "Please try again.",
        tone: "error",
      });
    },
  });

  const canSubmit = buildingName.trim().length > 0 && price.trim().length > 0 && !createMutation.isPending;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const priceNum = Number(price.replace(/[^0-9.]/g, ""));
    const payload: Record<string, unknown> = {
      listingType,
      buildingName: buildingName.trim(),
      unit: unit.trim() || null,
      area: area.trim() || null,
      propertyType,
      bedrooms: bedrooms === "" ? null : Number(bedrooms),
      bathrooms: bathrooms === "" ? null : Number(bathrooms),
      sqft: sqft === "" ? null : Number(sqft),
      notes: notes.trim() || null,
      pipelineStatus: "available",
    };
    if (listingType === "sale") {
      payload.saleValue = Number.isFinite(priceNum) ? priceNum : null;
    } else {
      payload.rentalPrice = Number.isFinite(priceNum) ? priceNum : null;
    }
    createMutation.mutate(payload);
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Add property"
        actions={
          <Link
            to="/properties/sales"
            className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to properties
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <form onSubmit={onSubmit} className="mx-auto max-w-2xl p-5 space-y-5">
          <Section title="Listing">
            <Segmented
              value={listingType}
              options={[
                { value: "sale", label: "For sale" },
                { value: "rental", label: "For rent" },
              ]}
              onChange={(v) => setListingType(v as ListingType)}
            />
          </Section>

          <Section title="Location">
            <Field label="Building / project" required>
              <Input value={buildingName} onChange={setBuildingName} placeholder="e.g. Binghatti Hills" autoFocus />
            </Field>
            <Field label="Unit">
              <Input value={unit} onChange={setUnit} placeholder="e.g. 1402" />
            </Field>
            <Field label="Area">
              <Input value={area} onChange={setArea} placeholder="e.g. JVC" />
            </Field>
          </Section>

          <Section title="Details">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <Select
                  value={propertyType}
                  onChange={setPropertyType}
                  options={[
                    { value: "apartment", label: "Apartment" },
                    { value: "villa", label: "Villa" },
                    { value: "townhouse", label: "Townhouse" },
                    { value: "penthouse", label: "Penthouse" },
                    { value: "studio", label: "Studio" },
                    { value: "office", label: "Office" },
                    { value: "retail", label: "Retail" },
                  ]}
                />
              </Field>
              <Field label="Bedrooms">
                <Input value={bedrooms} onChange={setBedrooms} placeholder="e.g. 2" inputMode="numeric" />
              </Field>
              <Field label="Bathrooms">
                <Input value={bathrooms} onChange={setBathrooms} placeholder="e.g. 2" inputMode="numeric" />
              </Field>
              <Field label="Sq ft">
                <Input value={sqft} onChange={setSqft} placeholder="e.g. 1100" inputMode="numeric" />
              </Field>
            </div>
          </Section>

          <Section title={listingType === "sale" ? "Sale price (AED)" : "Rent per year (AED)"}>
            <Field label={listingType === "sale" ? "Asking price" : "Annual rent"} required>
              <Input value={price} onChange={setPrice} placeholder="e.g. 1200000" inputMode="numeric" />
            </Field>
          </Section>

          <Section title="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional — anything agents should know about this listing"
              rows={4}
              className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-[13px] placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary"
            />
          </Section>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Link
              to="/properties/sales"
              className="inline-flex h-9 items-center rounded-lg px-3 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </Link>
            <Button type="submit" disabled={!canSubmit}>
              {createMutation.isPending ? "Adding…" : "Add property"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/80 p-4">
      <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-3">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-[11px] text-muted-foreground mb-1">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </div>
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  autoFocus,
  inputMode,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      inputMode={inputMode}
      className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-[13px] placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary"
    />
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-[13px] focus:outline-none focus:border-primary"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border/60 p-0.5 bg-muted/30">
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "px-3 py-1.5 text-[12.5px] rounded-md transition-colors",
            value === o.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default NewProperty;
