import type { ElementType } from "react";
import { CalendarCheck2, CircleCheckBig, Contact, Handshake, LayoutDashboard, ListFilter, ListTodo, Phone } from "lucide-react";
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

/** Setu's sidebar ("Core Modules" in the design). Activities is a group: Tasks / Calls / Meetings. */
export const SETU_NAV: readonly SetuNavItem[] = [
  { label: "Dashboard", href: ROUTES.setuDashboard, icon: LayoutDashboard },
  { label: "Leads", href: ROUTES.setuLeads, icon: ListFilter },
  { label: "Contacts", href: ROUTES.setuContacts, icon: Contact },
  { label: "Deals", href: ROUTES.setuDeals, icon: Handshake },
  {
    label: "Activities",
    href: ROUTES.setuActivities,
    icon: ListTodo,
    defaultOpen: true,
    children: [
      { label: "Tasks", href: ROUTES.setuTasks, icon: CircleCheckBig },
      { label: "Calls", href: ROUTES.setuCalls, icon: Phone },
      { label: "Meetings", href: ROUTES.setuMeetings, icon: CalendarCheck2 },
    ],
  },
  // Forecast is hidden until its page is built (/setu/forecast is still a "Coming soon" placeholder):
  // { label: "Forecast", href: ROUTES.setuForecast, icon: TrendingUp },
];
