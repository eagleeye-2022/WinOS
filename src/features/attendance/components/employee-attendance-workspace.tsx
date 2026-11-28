"use client";

// A manager's view of ONE team member's attendance — same header as their Leave page (avatar +
// switch person), their week / month log, and regularizing on their behalf.

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarCheck, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { PULSE_PAGE_BG } from "@/components/pulse/pulse-ui";
import { usePulseCrumbs } from "@/components/pulse/pulse-breadcrumbs";
import { EmployeeSwitcherHeader } from "@/components/pulse/employee-switcher-header";
import { toast } from "@/components/shared/toast";
import { getLeaveApplicantOptionsAction } from "@/features/leave/queries/leave-queries";
import { getTeamMemberProfileAction } from "../queries/attendance-queries";
import type { EmployeeProfile } from "../types";
import { addDaysToKey, istDateKey } from "../utils";
import { EmployeeAttendanceView } from "./employee-attendance-view";
import { RegularizeAttendanceFormPage } from "./regularize-attendance-form-page";

/**
 * `embedded`: shown as a tab inside the member's profile — no page frame, no breadcrumb, and no
 * member switcher (the profile header already says who this is).
 */
export function EmployeeAttendanceWorkspace({ userId, embedded = false }: { userId: string; embedded?: boolean }) {
  const router = useRouter();
  const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<{ id: string; name: string }[]>([]);
  const [regularizing, setRegularizing] = useState(false);
  /** Bumped after a regularization so the log reloads. */
  const [version, setVersion] = useState(0);

  useEffect(() => {
    getTeamMemberProfileAction(userId)
      .then((p) => (p ? setEmployee(p) : setError("Team member not found.")))
      .catch(() => setError("Couldn't load this team member."));
    getLeaveApplicantOptionsAction().then(setOptions).catch(() => setOptions([]));
  }, [userId]);

  const name = employee?.name ?? "Team Member";
  usePulseCrumbs(
    useMemo(
      () =>
        embedded
          ? null
          : [
              { label: name, onClick: () => setRegularizing(false) },
              ...(regularizing ? [{ label: "Regularize on Behalf" }] : [{ label: "Attendance Log" }]),
            ],
      [name, regularizing, embedded]
    )
  );

  useEffect(() => {
    if (!embedded) document.title = `${name} · Attendance | WinOS`;
  }, [name, embedded]);

  if (error) {
    return (
      <div className={cn("h-full p-6", PULSE_PAGE_BG)}>
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </div>
      </div>
    );
  }
  if (!employee) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const todayKey = istDateKey();

  const regularizeButton = (
    <Button
      type="button"
      onClick={() => setRegularizing(true)}
      className="h-8 gap-1.5 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700"
    >
      <UserPlus className="h-3.5 w-3.5" />
      Regularize on Behalf
    </Button>
  );

  return (
    <div
      className={cn(
        "flex select-none flex-col space-y-4",
        // Embedded: the host page already scrolls and has its own background and padding.
        !embedded && "h-full overflow-y-auto px-4 py-4 sm:px-6 sm:py-6",
        !embedded && PULSE_PAGE_BG
      )}
    >
      {regularizing ? (
        <RegularizeAttendanceFormPage
          onBack={() => setRegularizing(false)}
          onSubmitSuccess={() => {
            toast.success(`Attendance regularized for ${employee.name}.`);
            setRegularizing(false);
            setVersion((v) => v + 1);
          }}
          initialDate={addDaysToKey(todayKey, -1)}
          maxDate={todayKey}
          onBehalfOf={employee}
        />
      ) : (
        <>
          {embedded ? (
            <div className="flex justify-end">{regularizeButton}</div>
          ) : (
          <EmployeeSwitcherHeader
            employee={{
              id: employee.id,
              name: employee.name,
              image: employee.avatarUrl,
              title: employee.designation,
              department: employee.department,
              employeeCode: employee.employeeId,
            }}
            options={options}
            onSwitch={(id) => router.push(ROUTES.pulseTeamMemberAttendance(id))}
            actions={
              <>
                <Button asChild variant="outline" className="h-8 gap-1.5 rounded-md px-3 text-xs font-semibold">
                  <Link href={ROUTES.pulseTeamMemberLeave(employee.id)}>
                    <CalendarCheck className="h-3.5 w-3.5" />
                    Leave
                  </Link>
                </Button>
                {regularizeButton}
              </>
            }
          />
          )}
          <EmployeeAttendanceView
            key={version}
            employee={employee}
            hideProfile
            onApplyRegularizationOnBehalf={() => setRegularizing(true)}
          />
        </>
      )}
    </div>
  );
}
