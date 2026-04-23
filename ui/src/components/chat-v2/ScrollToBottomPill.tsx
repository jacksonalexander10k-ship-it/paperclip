import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { GLASS } from "./glass";

interface Props {
  show: boolean;
  onClick: () => void;
}

export function ScrollToBottomPill({ show, onClick }: Props) {
  if (!show) return null;
  return (
    <button
      onClick={onClick}
      className={cn(
        "sticky bottom-20 md:bottom-4 left-1/2 z-10 mx-auto flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full",
        GLASS.interactive,
      )}
      aria-label="Scroll to bottom"
    >
      <ArrowDown className="h-4 w-4 text-foreground/70" />
    </button>
  );
}
