import { cn } from "@/lib/utils";

/**
 * The SOP icon, in two states:
 * - checked (an SOP is aligned): solid green box with a white tick;
 * - unchecked (no SOP yet): light red box with a red cross.
 * Same props as a lucide icon (size / strokeWidth / className), so it also drops into nav items
 * (`icon: SopIcon` — checked by default).
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
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      {checked ? (
        <>
          <rect x="2" y="2" width="20" height="20" rx="4" className="fill-green-600 stroke-green-600" strokeWidth={2} />
          <path
            d="M7 12.5l3.2 3.2L17 8.8"
            stroke="#FFFFFF"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <>
          <rect
            x="3"
            y="3"
            width="18"
            height="18"
            rx="4"
            className="fill-red-50 stroke-red-600 dark:fill-red-500/15 dark:stroke-red-500"
            strokeWidth={2}
          />
          <path
            d="M8.5 8.5l7 7M15.5 8.5l-7 7"
            className="stroke-red-600 dark:stroke-red-500"
            strokeWidth={2.4}
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}
