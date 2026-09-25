"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import type { UserModuleAccessView } from "@/features/users/actions/permission-actions";
import { setUserModuleAccessAction } from "@/features/users/actions/permission-actions";
import { moduleStyle } from "@/features/users/module-access-style";

const AVATAR_COLORS = [
  "bg-indigo-500",
  "bg-emerald-500",
  "bg-purple-500",
  "bg-amber-500",
  "bg-pink-500",
  "bg-sky-500",
  "bg-rose-500",
];

function initialsOf(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U"
  );
}

interface UserModuleAccessTableProps {
  data: UserModuleAccessView;
}

export function UserModuleAccessTable({ data }: UserModuleAccessTableProps) {
  const [access, setAccess] = useState(
    () => new Map(data.users.map((u) => [u.userId, { ...u.access }]))
  );
  const [, startTransition] = useTransition();

  function toggle(userId: string, moduleId: string, moduleKey: string, checked: boolean) {
    setAccess((prev) => {
      const next = new Map(prev);
      next.set(userId, { ...next.get(userId), [moduleKey]: checked });
      return next;
    });
    startTransition(async () => {
      await setUserModuleAccessAction(userId, moduleId, checked);
    });
  }

  return (
    <div className="space-y-4">
      {/* Modules legend */}
      {/* <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3">
        <span className="text-sm font-semibold text-foreground mr-1">Modules</span>
        {data.modules.map((mod) => {
          const style = moduleStyle(mod.key);
          const Icon = style.icon;
          return (
            <span
              key={mod.id}
              className="flex items-center gap-2 rounded-full bg-muted/60 pl-1.5 pr-3 py-1 text-sm font-medium text-foreground"
            >
              <span className={cn("flex h-6 w-6 items-center justify-center rounded-md text-white", style.bg)}>
                <Icon size={13} />
              </span>
              {mod.name}
            </span>
          );
        })}
      </div> */}

      {/* Access table */}
      <div className="rounded-xl border bg-card overflow-x-auto">
        <div
          className="grid items-center border-b bg-muted/40 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          style={{ gridTemplateColumns: `260px repeat(${data.modules.length}, 1fr)` }}
        >
          <span>User</span>
          {data.modules.map((mod) => {
            // const style = moduleStyle(mod.key);
            // const Icon = style.icon;
            return (
              <span key={mod.id} className="flex items-center gap-2 justify-self-center normal-case text-foreground">
                {/* <span className={cn("flex h-5 w-5 items-center justify-center rounded text-white", style.bg)}>
                  <Icon size={11} />
                </span> */}
                {mod.name}
              </span>
            );
          })}
        </div>

        <div className="divide-y">
          {data.users.map((u, idx) => (
            <div
              key={u.userId}
              className={cn(
                "grid items-center px-4 py-3",
                !u.isActive && "opacity-50"
              )}
              style={{ gridTemplateColumns: `260px repeat(${data.modules.length}, 1fr)` }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white",
                    AVATAR_COLORS[idx % AVATAR_COLORS.length]
                  )}
                >
                  {initialsOf(u.name)[0]}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{u.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                </div>
              </div>
              {data.modules.map((mod) => (
                <div key={mod.id} className="justify-self-center">
                  <Switch
                    checked={access.get(u.userId)?.[mod.key] ?? true}
                    onCheckedChange={(checked) => toggle(u.userId, mod.id, mod.key, checked)}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
