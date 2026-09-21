import { User, MessageSquare, Folder, LayoutGrid, type LucideIcon } from "lucide-react";

export const MODULE_STYLE: Record<string, { icon: LucideIcon; bg: string }> = {
  USER_MANAGEMENT: { icon: User, bg: "bg-blue-500" },
  STANDUP: { icon: MessageSquare, bg: "bg-emerald-500" },
  PROJECTS: { icon: Folder, bg: "bg-purple-500" },
};

export function moduleStyle(key: string) {
  return MODULE_STYLE[key] ?? { icon: LayoutGrid, bg: "bg-muted-foreground" };
}
