"use client";

import { UserAvatar } from "@/components/shared/user-avatar";
import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  User,
  Mail,
  Phone,
  Briefcase,
  Building,
  Calendar,
  LogOut,
  Edit,
  Loader2,
} from "lucide-react";
import { getMyProfileData } from "../queries/attendance-queries";
import { logoutAction } from "@/features/auth/actions/logout";
import { ROUTES } from "@/constants/routes";
import { PulseCard, StatusPill } from "@/components/pulse/pulse-ui";

type Profile = Awaited<ReturnType<typeof getMyProfileData>>;

/** Shown for a field that hasn't been filled in — never a made-up value. */
const NOT_SET = "Not set";

function initialsOf(name?: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0]?.slice(0, 2) ?? "?").toUpperCase();
}

function Field({ label, icon, value }: { label: string; icon?: React.ReactNode; value?: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className={value ? "mt-1 truncate text-[13px] font-semibold text-foreground" : "mt-1 text-[13px] italic text-muted-foreground"}>
        {value || NOT_SET}
      </dd>
    </div>
  );
}

export function MyProfileView() {
  const [userProfile, setUserProfile] = useState<Profile>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      setIsLoading(true);
      try {
        setUserProfile(await getMyProfileData());
      } catch (err) {
        console.error("Failed to load user profile:", err);
      } finally {
        setIsLoading(false);
      }
    });
  }, []);

  const joined = userProfile?.dateOfJoining
    ? new Date(userProfile.dateOfJoining).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div className="mx-auto flex w-full max-w-5xl select-none flex-col gap-4">

      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border/70 bg-card py-20 text-muted-foreground">
          <Loader2 className="h-7 w-7 animate-spin text-blue-600 dark:text-blue-400" />
          <span className="text-xs font-semibold">Loading profile...</span>
        </div>
      ) : !userProfile ? (
        <div className="rounded-lg border border-border/70 bg-card py-20 text-center text-xs text-muted-foreground">
          Couldn&apos;t load your profile. Refresh to try again.
        </div>
      ) : (
        <>
          {/* Profile header: cover strip, overlapping photo, name, pills, edit */}
          <section className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="h-24 bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 dark:from-blue-800 dark:via-sky-800 dark:to-cyan-800" />
            <div className="flex flex-col gap-4 px-6 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-end gap-4">
                <UserAvatar
                  name={userProfile.name}
                  image={userProfile.image}
                  className="-mt-10 h-20 w-20 shrink-0 rounded-xl border-4 border-card bg-blue-50 text-xl font-bold text-blue-700 shadow-md dark:bg-blue-500/15 dark:text-blue-300"
                >
                  {initialsOf(userProfile.name || userProfile.email)}
                </UserAvatar>
                <div className="min-w-0 space-y-1 pb-0.5">
                  <h2 className="truncate text-lg font-semibold text-foreground">{userProfile.name || userProfile.email}</h2>
                  <p className={userProfile.title ? "text-xs text-muted-foreground" : "text-xs italic text-muted-foreground"}>
                    {userProfile.title || "No designation set"}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <StatusPill tone={userProfile.isActive ? "green" : "gray"}>
                      <span className={userProfile.isActive ? "h-1.5 w-1.5 rounded-full bg-emerald-500" : "h-1.5 w-1.5 rounded-full bg-muted-foreground/50"} />
                      {userProfile.isActive ? "Active" : "Inactive"}
                    </StatusPill>
                    <StatusPill tone="gray" className="font-mono">
                      Team Member ID: {userProfile.employeeId || NOT_SET}
                    </StatusPill>
                  </div>
                </div>
              </div>

              {/* The real edit form (User Management's member form, which lets people edit themselves). */}
              <Link
                href={ROUTES.settingsUsersEdit(userProfile.id)}
                className="inline-flex h-8 items-center gap-1.5 self-start rounded-md border border-border/80 px-3 text-xs font-semibold text-foreground transition-colors hover:bg-accent sm:self-auto"
              >
                <Edit className="h-3.5 w-3.5" />
                Edit Profile
              </Link>
            </div>
          </section>

          {/* Details */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <PulseCard icon={<User className="h-4 w-4" />} title="Personal & Employment Information">
              <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <Field label="Official Email" icon={<Mail className="h-3.5 w-3.5" />} value={userProfile.email} />
                <Field label="Work Phone" icon={<Phone className="h-3.5 w-3.5" />} value={userProfile.workMobile} />
                <Field label="Department" icon={<Building className="h-3.5 w-3.5" />} value={userProfile.department} />
                <Field label="Employment Type" icon={<Briefcase className="h-3.5 w-3.5" />} value={userProfile.employmentType} />
                <Field label="Date of Joining" icon={<Calendar className="h-3.5 w-3.5" />} value={joined} />
              </dl>
            </PulseCard>

            <PulseCard icon={<Briefcase className="h-4 w-4" />} iconTone="violet" title="Reporting Structure & Security" bodyClassName="flex flex-col justify-between gap-4 px-5 pb-5 pt-4">
              <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <Field label="Primary Reporting Manager" value={userProfile.reportingTo?.name} />
                <Field label="Work Location" value={userProfile.location} />
                <Field label="Profile Role" value={userProfile.profileRole} />
              </dl>

              {/* Sign out */}
              <div className="border-t border-border/70 pt-4">
                <button
                  onClick={() => logoutAction()}
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-rose-200 bg-rose-50/50 px-4 py-2 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-100/70 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-950/60"
                >
                  <LogOut className="h-4 w-4" />
                  Log Out of WinOS
                </button>
              </div>
            </PulseCard>
          </div>
        </>
      )}
    </div>
  );
}
