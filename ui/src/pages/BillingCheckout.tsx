import { useEffect, useState } from "react";
import { useCompany } from "../context/CompanyContext";
import { Loader2 } from "lucide-react";

const API_BASE = "/api";

export default function BillingCheckout() {
  const { selectedCompanyId } = useCompany();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedCompanyId) return;

    async function startCheckout() {
      try {
        const res = await fetch(`${API_BASE}/companies/${selectedCompanyId}/billing/checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ tierId: "starter" }),
        });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          // Stripe not configured — skip billing in dev, go to onboarding
          setError(data.error ?? null);
          setTimeout(() => {
            window.location.href = "/dashboard?onboarding=1";
          }, 2000);
        }
      } catch {
        // Skip billing on error, go to onboarding
        window.location.href = "/dashboard?onboarding=1";
      }
    }

    startCheckout();
  }, [selectedCompanyId]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">Billing setup skipped</p>
          <p className="text-xs text-muted-foreground">{error}</p>
          <p className="text-xs text-muted-foreground mt-2">Redirecting to setup...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3 text-primary" />
        <p className="text-sm text-foreground">Setting up your subscription...</p>
        <p className="text-xs text-muted-foreground mt-1">7-day free trial, cancel anytime</p>
      </div>
    </div>
  );
}
