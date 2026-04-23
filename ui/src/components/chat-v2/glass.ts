// Shared light-glass style constants for chat-v2 surface.
// Isolated here so we can tweak the whole chat glass look from one place.
// If we want to revert to the old look, edit or remove these classes.

export const GLASS = {
  /** Static glass card — message bubbles */
  card: "bg-white/60 backdrop-blur-xl border border-white/50 shadow-[0_2px_16px_rgba(0,0,0,0.04)]",
  /** Interactive glass — buttons, chips */
  interactive:
    "bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_2px_12px_rgba(0,0,0,0.05)] hover:bg-white/85 transition-colors",
  /** Prominent glass tile — the input */
  tile: "bg-white/55 backdrop-blur-2xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.06)]",
  /** Specular 1px highlight to lay across the top of a glass tile */
  specular:
    "pointer-events-none absolute top-0 left-0 right-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.85)_50%,transparent)]",
};
