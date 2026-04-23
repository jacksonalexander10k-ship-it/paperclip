/**
 * 2×18 blinking cursor appended inline to streaming text.
 */
export function StreamingCursor() {
  return (
    <span
      className="ml-0.5 inline-block h-[18px] w-[2px] bg-primary align-middle"
      style={{ animation: "blink 530ms step-end infinite" }}
    />
  );
}
