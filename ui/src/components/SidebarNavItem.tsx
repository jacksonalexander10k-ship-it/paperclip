import { NavLink } from "@/lib/router";
import { cn } from "../lib/utils";
import { useSidebar } from "../context/SidebarContext";
import type { LucideIcon } from "lucide-react";

interface SidebarNavItemProps {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  className?: string;
  badge?: number;
  badgeTone?: "default" | "danger";
  alert?: boolean;
  liveCount?: number;
}

export function SidebarNavItem({
  to,
  label,
  icon: Icon,
  end,
  className,
  badge,
  badgeTone = "default",
  alert = false,
  liveCount,
}: SidebarNavItemProps) {
  const { isMobile, setSidebarOpen } = useSidebar();

  return (
    <NavLink
      to={to}
      end={end}
      onClick={() => { if (isMobile) setSidebarOpen(false); }}
      className={({ isActive }) =>
        cn(
          "relative flex items-center gap-2.5 px-2 py-1.5 text-[12.5px] font-medium rounded-lg transition-all duration-150",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground/60 hover:bg-accent/50 hover:text-foreground",
          className,
        )
      }
    >
      <span className="relative shrink-0">
        <Icon className="w-[13px] h-[13px]" />
        {alert && (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 shadow-[0_0_0_2px_hsl(var(--background))]" />
        )}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {liveCount != null && liveCount > 0 && (
        <span className="ml-auto flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
          </span>
          <span className="text-[10px] font-medium text-primary">{liveCount}</span>
        </span>
      )}
      {badge != null && badge > 0 && (
        <span
          className={cn(
            "ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none tabular-nums",
            badgeTone === "danger"
              ? "bg-red-500/20 text-red-400"
              : "bg-primary/15 text-primary",
          )}
        >
          {badge}
        </span>
      )}
    </NavLink>
  );
}
