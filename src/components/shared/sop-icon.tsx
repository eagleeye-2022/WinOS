import { cn } from "@/lib/utils";

/**
 * The SOP icon: a ticked list in green when an SOP is aligned, the same list struck through in red
 * when not. Same props as a lucide icon (size / strokeWidth / className), so it also drops into
 * nav items (`icon: SopIcon` — checked by default).
 */
export function SopIcon({
  checked = true,
  size = 18,
  strokeWidth = 2,
  className,
}: {
  checked?: boolean;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(
        "shrink-0",
        checked ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500",
        className
      )}
      aria-hidden="true"
    >
      {checked ? (
        <>
          <path d="M13 12h8" />
          <path d="M13 19h8" />
          <path d="M13 5h8" />
          <path d="m3 17 2 2 4-4" />
          <rect x="3" y="4" width="6" height="6" rx="1" />
        </>
      ) : (
        <>
          <path d="M13 19h6" />
          <path d="M13 5h8" />
          <path d="M17.657 12H21" />
          <path d="m2 2 20 20" />
          <path d="m3 17 2 2 4-4" />
          <path d="M9 9a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1" />
        </>
      )}
    </svg>
  );
}
