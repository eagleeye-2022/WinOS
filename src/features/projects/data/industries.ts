/**
 * A project can have several industries. They're kept in the existing `Project.industry` text
 * column as a comma-separated list ("Healthcare, Skin Care") — no schema change, and an older
 * single value reads as a one-item list.
 */
export const INDUSTRY_SEPARATOR = ", ";

/** "Healthcare, Skin Care" → ["Healthcare", "Skin Care"] (trimmed, empties and duplicates dropped). */
export function parseIndustries(value: string | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of (value || "").split(",")) {
    const name = part.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/** ["Healthcare", "Skin Care"] → "Healthcare, Skin Care" (commas inside a typed name are dropped). */
export function joinIndustries(names: string[]): string {
  return parseIndustries(names.map((n) => n.replace(/,/g, " ")).join(",")).join(INDUSTRY_SEPARATOR);
}

/** Suggested values for the All Projects "Industry" column. Anything else can be typed in. */
export const PROJECT_INDUSTRIES: string[] = [
  "Agriculture",
  "Automotive",
  "Aviation",
  "Banking & Finance",
  "Beauty & Cosmetics",
  "Construction",
  "Consulting",
  "E-commerce",
  "Education",
  "Energy & Utilities",
  "Entertainment & Media",
  "Fashion & Apparel",
  "Fitness & Wellness",
  "Food & Beverage",
  "Government & Public Sector",
  "Healthcare",
  "Hospitality",
  "Insurance",
  "Legal",
  "Logistics & Supply Chain",
  "Manufacturing",
  "Marketing & Advertising",
  "Non-profit",
  "Pharmaceuticals",
  "Real Estate",
  "Retail",
  "SaaS",
  "Skin Care",
  "Sports",
  "Technology",
  "Telecommunications",
  "Travel & Tourism",
];
