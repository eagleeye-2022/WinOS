import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Title case for titles (tasks, iNotes cards, events): capitalises the first letter of each word
 * and leaves the rest exactly as typed, so "TTG", "7Dots" and "iNote" keep their spelling:
 * "ttg project iNote" → "Ttg Project iNote", "TTG project iNote" → "TTG Project iNote".
 * A word that already has a capital after its first letter ("iNote", "eBay") is left untouched.
 * Words after "/" or "-" are capitalised too ("ecommerce/product" → "Ecommerce/Product").
 * Use toTitleCase for people's names instead.
 */
export function toTitleText(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\s/-]+/g, (word) =>
      /[A-Z]/.test(word.slice(1)) ? word : word.charAt(0).toUpperCase() + word.slice(1)
    );
}

export function toTitleCase(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .split(/[\s._-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
