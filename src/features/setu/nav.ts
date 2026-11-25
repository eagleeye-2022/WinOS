import type { ElementType } from "react";
import { Bot, CalendarHeart, Contact, Link2, TrendingUp } from "lucide-react";
import { ROUTES } from "@/constants/routes";

export interface SetuNavItem {
  label: string;
  href: string;
  icon: ElementType;
  section?: string;
  children?: { label: string; href: string; icon: ElementType }[];
  /** Group starts expanded (the user can still collapse it; that choice is remembered). */
  defaultOpen?: boolean;
}

/**
 * Setu's features ("Setu Features" in the sidebar), in flow order: 121 Meetings produce
 * referrals → prospects on the Sales Pipeline; the WhatsApp Bot captures both from the field.
 * The same five are the tabs under the Setu header (components/bni/setu-shell.tsx).
 */
export const SETU_NAV: readonly SetuNavItem[] = [
  { label: "121 Meetings", href: ROUTES.setu121, icon: CalendarHeart },
  { label: "Sales Pipeline", href: ROUTES.setuPipeline, icon: TrendingUp },
  { label: "WhatsApp Bot", href: ROUTES.setuWhatsappBot, icon: Bot },
  { label: "Contacts", href: ROUTES.setuContacts, icon: Contact },
  { label: "Referrals", href: ROUTES.setuReferrals, icon: Link2 },
];
