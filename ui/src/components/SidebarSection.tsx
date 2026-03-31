import type { ReactNode } from "react";

interface SidebarSectionProps {
  label: string;
  children: ReactNode;
}

export function SidebarSection({ label, children }: SidebarSectionProps) {
  return (
    <div>
      <div className="px-2 pb-1 pt-2 text-[9.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground/25">
        {label}
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}
