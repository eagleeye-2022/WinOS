"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Briefcase,
  Building,
  Calendar,
  KeyRound,
  Bell,
  LogOut,
  ChevronRight,
  Edit,
  Loader2,
} from "lucide-react";
import { getMyProfileData } from "../queries/attendance-queries";
import { logoutAction } from "@/features/auth/actions/logout";

interface MyProfileViewProps {
  onBack?: () => void;
}

export function MyProfileView({ onBack }: MyProfileViewProps) {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      setIsLoading(true);
      try {
        const user = await getMyProfileData();
        setUserProfile(user);
      } catch (err) {
        console.error("Failed to load user profile:", err);
      } finally {
        setIsLoading(false);
      }
    });
  }, []);

  return (
    <div className="flex flex-col gap-6 w-full select-none max-w-5xl mx-auto">
      {/* Back Link */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>My Profile</span>
      </button>

      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="text-xs font-semibold">Loading profile...</span>
        </div>
      ) : (
        <>
          {/* Profile Header Card */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <img
                src={
                  userProfile?.image ||
                  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=140&auto=format&fit=crop&q=80"
                }
                alt={userProfile?.name || "User"}
                className="w-16 h-16 rounded-full object-cover border-2 border-white dark:border-slate-800 shadow-md shrink-0"
              />
              <div className="space-y-1">
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                  {userProfile?.name || "Employee"}
                </h2>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {userProfile?.title || "Senior Software Engineer"}
                </div>
                <div className="flex items-center gap-3 pt-1 text-xs">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:border-emerald-900 dark:text-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {userProfile?.isActive ? "Active" : "Inactive"}
                  </span>
                  <span className="text-slate-400 font-mono">
                    Employee ID: {userProfile?.employeeId || `WIN-${userProfile?.id?.slice(-4)?.toUpperCase() || "1023"}`}
                  </span>
                </div>
              </div>
            </div>

            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 shadow-xs transition-colors">
              <Edit className="w-3.5 h-3.5" />
              <span>Edit Profile</span>
            </button>
          </div>

          {/* Details 2-Column Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Primary Details */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4">
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <User className="w-4 h-4 text-blue-600" />
                <span>Personal & Employment Information</span>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5" /> Official Email
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {userProfile?.email || "employee@eagleeyedigital.io"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5" /> Work Phone
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {userProfile?.workMobile || "+91 98765 43210"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-2">
                    <Building className="w-3.5 h-3.5" /> Department
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {userProfile?.department || "Engineering & Product"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-2">
                    <Briefcase className="w-3.5 h-3.5" /> Employment Type
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {userProfile?.employmentType || "Full-time (Permanent)"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" /> Date of Joining
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {userProfile?.dateOfJoining
                      ? new Date(userProfile.dateOfJoining).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "12 Jan 2024"}
                  </span>
                </div>
              </div>
            </div>

            {/* Reporting & Security */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4 flex flex-col justify-between">
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <Briefcase className="w-4 h-4 text-blue-600" />
                  <span>Reporting Structure & Security</span>
                </div>

                <div className="space-y-3.5 text-xs mt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Primary Reporting Manager</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {userProfile?.reportingTo?.name || "Mohit (Manager)"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Work Location</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {userProfile?.location || "Gurgaon HQ - Cyber City"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Profile Role</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {userProfile?.profileRole || "EMPLOYEE"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sign Out Button */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => logoutAction()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-100/70 transition-colors shadow-2xs"
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
