"use client";

import { Fragment, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PROFILE_CONFIG } from "@/features/users/permission-config";
import type { ProfileType, PermissionScope } from "@/features/users/permission-config";
import type {
  PermissionModuleView,
  PermissionActionView,
  PermissionRuleView,
} from "@/features/users/actions/permission-actions";
import { updatePermissionRuleAction } from "@/features/users/actions/permission-actions";

const SCOPE_LABEL: Record<PermissionScope, string> = {
  NONE: "None",
  OWNED: "Owned",
  ALL: "All",
  BOTH: "Both",
};

interface PermissionMatrixProps {
  profileType: ProfileType;
  modules: PermissionModuleView[];
}

export function PermissionMatrix({ profileType, modules }: PermissionMatrixProps) {
  const config = PROFILE_CONFIG[profileType];
  const columnCount = config.roles.length + 2; // label + roles + static column

  return (
    <div className="grid grid-cols-[180px_1fr] gap-4">
      <div className="sticky top-6 self-start rounded-lg border bg-card p-3 space-y-1 h-fit">
        <p className="px-2 pb-1 text-xs font-bold uppercase text-muted-foreground">Default Modules</p>
        {modules.map((mod) => (
          <a
            key={mod.id}
            href={`#module-${profileType}-${mod.key}`}
            className="block rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-accent/50 transition-colors"
          >
            {mod.name}
          </a>
        ))}
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[220px]">Action Permissions</TableHead>
              {config.roles.map((col) => (
                <TableHead key={col.role}>
                  {col.label} {col.sub && <span className="text-muted-foreground font-normal">{col.sub}</span>}
                </TableHead>
              ))}
              <TableHead className="text-muted-foreground">{config.staticColumnLabel}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {modules.map((mod) => (
              <Fragment key={mod.id}>
                <TableRow id={`module-${profileType}-${mod.key}`} className="bg-muted/40 hover:bg-muted/40">
                  <TableCell colSpan={columnCount} className="font-bold text-foreground py-2">
                    {mod.name}
                  </TableCell>
                </TableRow>
                {mod.actions.map((action) => (
                  <ActionRow key={action.id} profileType={profileType} action={action} />
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ActionRow({ profileType, action }: { profileType: ProfileType; action: PermissionActionView }) {
  const config = PROFILE_CONFIG[profileType];
  return (
    <TableRow>
      <TableCell className="text-muted-foreground">{action.label}</TableCell>
      {config.roles.map((col) => (
        <TableCell key={col.role}>
          <PermissionCell action={action} rule={action.rulesByRole[col.role]} />
        </TableCell>
      ))}
      <TableCell>
        <StaticColumnCell action={action} />
      </TableCell>
    </TableRow>
  );
}

function StaticColumnCell({ action }: { action: PermissionActionView }) {
  if (action.controlType === "BOOLEAN") {
    return <Check size={16} className="text-muted-foreground/60" />;
  }
  return <span className="text-xs font-medium text-muted-foreground/60">All</span>;
}

function PermissionCell({
  action,
  rule,
}: {
  action: PermissionActionView;
  rule: PermissionRuleView;
}) {
  const [optimistic, setOptimistic] = useState(rule);
  const [, startTransition] = useTransition();

  function persist(patch: Partial<PermissionRuleView>) {
    const next = { ...optimistic, ...patch };
    setOptimistic(next);
    startTransition(async () => {
      await updatePermissionRuleAction({
        actionId: action.id,
        role: rule.role,
        enabled: next.enabled,
        scope: next.scope,
        scopeAssignee: next.scopeAssignee,
        scopeOwner: next.scopeOwner,
      });
    });
  }

  if (action.controlType === "BOOLEAN") {
    return (
      <Checkbox
        checked={optimistic.enabled}
        onCheckedChange={(checked) => persist({ enabled: checked === true })}
      />
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={optimistic.scope}
        onValueChange={(value) => persist({ scope: value as PermissionScope })}
      >
        <SelectTrigger className="h-8 w-[110px]">
          <SelectValue placeholder="Select">{SCOPE_LABEL[optimistic.scope]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All</SelectItem>
          <SelectItem value="OWNED">Owned</SelectItem>
          <SelectItem value="BOTH">Both</SelectItem>
        </SelectContent>
      </Select>

      {optimistic.scope === "BOTH" && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Assignee"
            onClick={() => persist({ scopeAssignee: !optimistic.scopeAssignee })}
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white transition-opacity",
              optimistic.scopeAssignee ? "bg-success opacity-100" : "bg-success/40 opacity-50"
            )}
          >
            A
          </button>
          <button
            type="button"
            title="Owner"
            onClick={() => persist({ scopeOwner: !optimistic.scopeOwner })}
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white transition-opacity",
              optimistic.scopeOwner ? "bg-warning opacity-100" : "bg-warning/40 opacity-50"
            )}
          >
            O
          </button>
        </div>
      )}
    </div>
  );
}
