"use client";

// Header for a manager's per-employee Pulse page (Leave / Attendance): avatar, the person's name
// as a dropdown to jump to another team member, and their role. Back lives in the Pulse trail bar.

import { UserAvatar } from "@/components/shared/user-avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface SwitcherEmployee {
  id: string;
  name: string;
  image?: string;
  title?: string;
  department?: string;
  employeeCode?: string;
}

export function EmployeeSwitcherHeader({
  employee,
  options,
  onSwitch,
  actions,
  className,
}: {
  employee: SwitcherEmployee;
  /** Team members the viewer may open (the current one is added if missing). */
  options: { id: string; name: string }[];
  onSwitch: (userId: string) => void;
  /** Right-hand buttons (e.g. a link to the same person's Attendance / Leave). */
  actions?: React.ReactNode;
  className?: string;
}) {
  const list = options.some((o) => o.id === employee.id) ? options : [{ id: employee.id, name: employee.name }, ...options];
  // Just the job title (department / employee code are left out on purpose).
  const subtitle = employee.title || "";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-border/70 bg-card px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <UserAvatar
          userId={employee.id}
          name={employee.name}
          image={employee.image}
          className="h-11 w-11 shrink-0 rounded-lg bg-blue-50 text-sm font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
        >
          {employee.name.slice(0, 2).toUpperCase()}
        </UserAvatar>
        <div className="min-w-0">
          <Select value={employee.id} onValueChange={(id) => id !== employee.id && onSwitch(id)}>
            <SelectTrigger
              aria-label="Switch team member"
              className="h-7 w-auto max-w-[min(18rem,70vw)] gap-2 border-none bg-transparent p-0 text-[15px] font-semibold text-foreground shadow-none focus:ring-0 dark:bg-transparent"
            >
              <SelectValue>{employee.name}</SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-72 w-72">
              {list.map((o) => (
                <SelectItem key={o.id} value={o.id} className="py-1.5 text-xs">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <UserAvatar
                      userId={o.id}
                      name={o.name}
                      className="h-6 w-6 bg-blue-50 text-[10px] font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                    >
                      {o.name.slice(0, 2).toUpperCase()}
                    </UserAvatar>
                    <span className="truncate">{o.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
