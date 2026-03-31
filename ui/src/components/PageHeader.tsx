import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  badge?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, badge, actions }: PageHeaderProps) {
  return (
    <div className="h-[50px] shrink-0 flex items-center px-[18px] border-b border-border gap-[10px]">
      <h1 className="text-[14px] font-bold tracking-[-0.02em] text-foreground flex-1 truncate">
        {title}
      </h1>
      {badge}
      {actions && <div className="flex items-center gap-[6px] shrink-0">{actions}</div>}
    </div>
  );
}
