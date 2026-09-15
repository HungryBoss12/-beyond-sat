export function BeyondAiMark({
  className,
  size = "lg",
}: {
  className?: string;
  size?: "sm" | "lg";
}) {
  const box = size === "lg" ? "h-14 w-14 rounded-2xl" : "h-10 w-10 rounded-xl";
  return (
    <span
      className={`beyond-ai-mark group grid shrink-0 place-items-center bg-brand-800 text-white ring-1 ring-brand-400/40 ${box} ${className ?? ""}`}
      aria-hidden
    >
      <svg
        viewBox="0 0 48 48"
        className={size === "lg" ? "beyond-ai-mark-svg h-9 w-9" : "beyond-ai-mark-svg h-7 w-7"}
        fill="none"
      >
        <circle
          className="beyond-ai-orbit"
          cx="24"
          cy="24"
          r="15.2"
          stroke="currentColor"
          strokeWidth="1.7"
          opacity="0.35"
        />
        <path
          className="beyond-ai-core"
          d="M24 11.2 27.6 20.4 37.2 24 27.6 27.6 24 36.8 20.4 27.6 10.8 24 20.4 20.4Z"
          fill="currentColor"
        />
        <circle className="beyond-ai-spark beyond-ai-spark-a" cx="36.4" cy="13.2" r="1.7" fill="currentColor" />
        <circle className="beyond-ai-spark beyond-ai-spark-b" cx="12.2" cy="34.6" r="1.35" fill="currentColor" />
      </svg>
    </span>
  );
}
