import { useMemo } from "react";
import { NavLink, useLocation } from "@/lib/router";
import {
  House,
  MessageSquare,
  CircleDot,
  Users,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { cn } from "../lib/utils";
import { sidebarBadgesApi } from "../api/sidebarBadges";
import { queryKeys } from "../lib/queryKeys";

interface MobileBottomNavProps {
  visible: boolean;
}

interface MobileNavLinkItem {
  type: "link";
  to: string;
  label: string;
  icon: typeof House;
  badge?: number;
}

type MobileNavItem = MobileNavLinkItem;

export function MobileBottomNav({ visible }: MobileBottomNavProps) {
  const location = useLocation();
  const { selectedCompanyId } = useCompany();

  const { data: sidebarBadges } = useQuery({
    queryKey: queryKeys.sidebarBadges(selectedCompanyId!),
    queryFn: () => sidebarBadgesApi.get(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 15_000,
  });

  const items = useMemo<MobileNavItem[]>(
    () => [
      { type: "link", to: "/dashboard", label: "Home", icon: House },
      { type: "link", to: "/ceo-chat", label: "CEO", icon: MessageSquare, badge: sidebarBadges?.ceoChatUnread },
      { type: "link", to: "/approvals/pending", label: "Inbox", icon: CircleDot, badge: sidebarBadges?.approvals },
      { type: "link", to: "/agents/all", label: "Team", icon: Users },
    ],
    [sidebarBadges?.ceoChatUnread, sidebarBadges?.approvals],
  );

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-30 border-t border-border/60 bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 transition-transform duration-200 ease-out md:hidden pb-[env(safe-area-inset-bottom)]",
        visible ? "translate-y-0" : "translate-y-full",
      )}
      aria-label="Mobile navigation"
    >
      <div className="grid h-16 grid-cols-4 px-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.label}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-md text-[10px] font-medium transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className="relative">
                    <Icon className={cn("h-[18px] w-[18px]", isActive && "stroke-[2.3]")} />
                    {item.badge != null && item.badge > 0 && (
                      <span className="absolute -right-2 -top-2 rounded-full bg-primary px-1.5 py-0.5 text-[10px] leading-none text-primary-foreground">
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    )}
                  </span>
                  <span className="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
