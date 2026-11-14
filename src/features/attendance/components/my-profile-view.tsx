"use client";

import { UserAvatar } from "@/components/shared/user-avatar";
import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
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

interface MyProfileViewProps {
  onBack?: () => void;
}

type Profile = Awaited<ReturnType<typeof getMyProfileData>>;

/** Shown for a field that hasn't been filled in — never a made-up value. */
const NOT_SET = "Not set";

function initialsOf(name?: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0]?.slice(0, 2) ?? "?").toUpperCase();
}

function Field({ label, icon, value }: { label: string; icon?: React.ReactNode; value?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground flex items-center gap-2 shrink-0">
        {icon} {label}
      </span>
      <span
        className={
          value
            ? "font-semibold text-foreground text-right truncate"
            : "italic text-muted-foreground text-right"
        }
      >
        {value || NOT_SET}
      </span>
    </div>
  );
}

export function MyProfileView({ onBack }: MyProfileViewProps) {
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
    <div className="flex flex-col gap-6 w-full select-none max-w-5xl mx-auto">
      {/* Back Link */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>My Profile</span>
      </button>

      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-xs font-semibold">Loading profile...</span>
        </div>
      ) : !userProfile ? (
        <div className="py-20 text-center text-xs text-muted-foreground">Couldn&apos;t load your profile. Refresh to try again.</div>
      ) : (
        <>
          {/* Profile Header Card */}
          <div className="p-6 rounded-2xl bg-card border border-border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <UserAvatar
                name={userProfile.name}
                image={userProfile.image}
                className="w-16 h-16 bg-primary/15 text-primary text-xl font-bold border-2 border-white dark:border-zinc-800 shadow-md"
              >
                {initialsOf(userProfile.name || userProfile.email)}
              </UserAvatar>
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-foreground">
                  {userProfile.name || userProfile.email}
                </h2>
                <div className={userProfile.title ? "text-xs text-muted-foreground" : "text-xs italic text-muted-foreground"}>
                  {userProfile.title || "No designation set"}
                </div>
                <div className="flex items-center gap-3 pt-1 text-xs">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:border-emerald-900 dark:text-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {userProfile.isActive ? "Active" : "Inactive"}
                  </span>
                  <span className="text-muted-foreground font-mono">Team Member ID: {userProfile.employeeId || NOT_SET}</span>
                </div>
              </div>
            </div>

            {/* The real edit form (User Management's member form, which lets people edit themselves). */}
            <Link
              href={ROUTES.settingsUsersEdit(userProfile.id)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-input text-xs font-bold text-foreground hover:bg-accent shadow-xs transition-colors"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>Edit Profile</span>
            </Link>
          </div>

          {/* Details 2-Column Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Primary Details */}
            <div className="p-6 rounded-2xl bg-card border border-border shadow-xs space-y-4">
              <div className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
                <User className="w-4 h-4 text-primary" />
                <span>Personal & Employment Information</span>
              </div>

              <div className="space-y-3.5 text-xs">
                <Field label="Official Email" icon={<Mail className="w-3.5 h-3.5" />} value={userProfile.email} />
                <Field label="Work Phone" icon={<Phone className="w-3.5 h-3.5" />} value={userProfile.workMobile} />
                <Field label="Department" icon={<Building className="w-3.5 h-3.5" />} value={userProfile.department} />
                <Field
                  label="Employment Type"
                  icon={<Briefcase className="w-3.5 h-3.5" />}
                  value={userProfile.employmentType}
                />
                <Field label="Date of Joining" icon={<Calendar className="w-3.5 h-3.5" />} value={joined} />
              </div>
            </div>

            {/* Reporting & Security */}
            <div className="p-6 rounded-2xl bg-card border border-border shadow-xs space-y-4 flex flex-col justify-between">
              <div>
                <div className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
                  <Briefcase className="w-4 h-4 text-primary" />
                  <span>Reporting Structure & Security</span>
                </div>

                <div className="space-y-3.5 text-xs mt-4">
                  <Field label="Primary Reporting Manager" value={userProfile.reportingTo?.name} />
                  <Field label="Work Location" value={userProfile.location} />
                  <Field label="Profile Role" value={userProfile.profileRole} />
                </div>
              </div>

              {/* Sign Out Button */}
              <div className="pt-4 border-t border-border">
                <button
                  onClick={() => logoutAction()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-100/70 dark:hover:bg-rose-950/60 transition-colors shadow-2xs"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out of WinOS</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
