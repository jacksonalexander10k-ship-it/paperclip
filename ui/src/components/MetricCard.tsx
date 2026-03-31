import type { ReactNode } from "react";
import { Link } from "@/lib/router";

interface MetricCardProps {
  icon?: unknown;
  value: string | number;
  label: string;
  description?: ReactNode;
  to?: string;
  onClick?: () => void;
  valueColor?: "default" | "green" | "amber";
}

export function MetricCard({ value, label, description, to, onClick, valueColor = "default" }: MetricCardProps) {
  const isClickable = !!(to || onClick);

  const valueClass =
    valueColor === "green"
      ? "text-primary"
      : valueColor === "amber"
        ? "text-amber-400"
        : "text-foreground";

  const inner = (
    <div
      className="bg-card border border-border rounded-[12px] p-[16px_18px] transition-[border-color] duration-150 hover:border-[rgba(255,255,255,0.12)]"
      style={{ cursor: isClickable ? "pointer" : undefined }}
    >
      {/* .ml */}
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-2">
        {label}
      </p>
      {/* .mv */}
      <p className={`font-['JetBrains_Mono',monospace] text-[38px] font-extrabold leading-none tracking-[-0.04em] ${valueClass}`}>
        {value}
      </p>
      {/* .ms */}
      {description && (
        <div className="text-[11px] text-muted-foreground mt-1">{description}</div>
      )}
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="no-underline text-inherit" onClick={onClick}>
        {inner}
      </Link>
    );
  }

  if (onClick) {
    return <div onClick={onClick}>{inner}</div>;
  }

  return inner;
}
