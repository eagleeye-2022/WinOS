import { cn } from "@/lib/utils";

/** Top of each of the icon's three checklist rows, in viewBox units. */
const ROW_OFFSETS = [0, 8, 16];

/**
 * The SOP icon: a checklist of three ticked boxes with text lines. The ticks show the state —
 * green when an SOP is aligned, red when not. Boxes and lines follow the theme (black on light,
 * white on dark). Same props as a lucide icon (size / strokeWidth / className), so it also drops
 * into nav items (`icon: SopIcon` — checked by default).
 */
export function SopIcon({
  checked = true,
  size = 18,
  className,
}: {
  checked?: boolean;
  size?: number;
  /** Accepted for lucide compatibility; the icon keeps its own stroke widths. */
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      {ROW_OFFSETS.map((y) => (
        <g key={y} transform={`translate(0 ${y})`}>
          {/* Box, open at the top right where the tick passes through, and its text lines. */}
          <path d="M5.5 2H1.5v5.5H7V5.5M10.5 2.5h7M10.5 6h12" className="stroke-foreground" strokeWidth={1.2} />
          <path
            d="M3 4l1.7 1.9L8.5 1"
            className={checked ? "stroke-green-600 dark:stroke-green-500" : "stroke-red-600 dark:stroke-red-500"}
            strokeWidth={1.7}
          />
        </g>
      ))}
    </svg>
  );
}
