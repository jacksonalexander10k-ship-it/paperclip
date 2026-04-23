/**
 * Three bouncing dots — shown inside an assistant bubble while waiting
 * for the first token to arrive.
 */
export function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5 py-1">
      <span className="h-2 w-2 rounded-full bg-primary/80 animate-bounce [animation-duration:800ms]" />
      <span className="h-2 w-2 rounded-full bg-primary/80 animate-bounce [animation-duration:800ms] [animation-delay:150ms]" />
      <span className="h-2 w-2 rounded-full bg-primary/80 animate-bounce [animation-duration:800ms] [animation-delay:300ms]" />
    </div>
  );
}
