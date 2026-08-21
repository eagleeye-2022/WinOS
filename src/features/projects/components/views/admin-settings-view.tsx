"use client";

import React, { useState, useEffect } from "react";
import { Settings, Users, Layers, Clock, Shield, Plus, Edit3, Trash2, Check, Globe, Loader2 } from "lucide-react";
import { getUsersAction } from "../../actions/project-actions";
import { ProjectUser } from "../../types";
import { DEFAULT_PROJECT_TEMPLATES } from "../../data/sop-templates";
import { ProjectTemplatesModal } from "../modals/project-templates-modal";

export function AdminSettingsView() {
  const [activeTab, setActiveTab] = useState<"DEPARTMENTS" | "TEMPLATES" | "HOURS">("DEPARTMENTS");
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);

  const [users, setUsers] = useState<ProjectUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  useEffect(() => {
    async function loadUsers() {
      setIsLoadingUsers(true);
      try {
        const fetchedUsers = await getUsersAction();
        setUsers(fetchedUsers);
      } catch (err) {
        console.error("Failed to load users for settings:", err);
      } finally {
        setIsLoadingUsers(false);
      }
    }
    loadUsers();
  }, []);

  const departmentAliases = [
    { name: "SEO & Performance Marketing", alias: "seo@", deptKey: "Development" },
    { name: "UI/UX & Graphic Design", alias: "design@", deptKey: "Design" },
    { name: "Full-Stack Development", alias: "dev@", deptKey: "Development" },
    { name: "Digital Products / Management", alias: "digitalproducts@", deptKey: "Management" },
    { name: "Quality Assurance & QA", alias: "qa@", deptKey: "QA" },
  ];

  const departments = departmentAliases.map((dept) => {
    const matchingUsers = users.filter((u) => u.department === dept.deptKey || u.departmentAlias === dept.alias);
    const leadUser = matchingUsers.find((u) => u.role === "MANAGER" || u.role === "ADMIN") || matchingUsers[0];
    return {
      name: dept.name,
      alias: dept.alias,
      usersCount: matchingUsers.length,
      manager: leadUser?.name || "Unassigned Lead",
    };
  });


  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-y-auto p-6 space-y-6">
      {/* Title Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <Settings size={24} className="text-primary" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">Admin & Portal Workspace Settings</h1>
            <p className="text-xs text-muted-foreground">
              Manage operational departments, user roles, SOP template library, and organization working hours.
            </p>
          </div>
        </div>
      </div>

      {/* Settings Navigation Sub-Tabs */}
      <div className="flex gap-4 border-b pb-0 font-semibold text-xs">
        <button
          type="button"
          onClick={() => setActiveTab("DEPARTMENTS")}
          className={`pb-3 transition-colors ${
            activeTab === "DEPARTMENTS"
              ? "text-primary border-b-2 border-primary font-bold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Departments & User Roles
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("TEMPLATES")}
          className={`pb-3 transition-colors ${
            activeTab === "TEMPLATES"
              ? "text-primary border-b-2 border-primary font-bold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          SOP Project Templates (CRUD)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("HOURS")}
          className={`pb-3 transition-colors ${
            activeTab === "HOURS"
              ? "text-primary border-b-2 border-primary font-bold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Business Hours & Timezone
        </button>
      </div>

      {/* Tab 1: Departments & User Roles */}
      {activeTab === "DEPARTMENTS" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
              Operational Department Aliases
            </h2>
            <button
              type="button"
              onClick={() => alert("Department creation dialog opened.")}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus size={14} /> Add New Department
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {departments.map((dept) => (
              <div key={dept.alias} className="rounded-lg border bg-card p-4 space-y-2">
                <div className="flex items-center justify-between border-b pb-2">
                  <div>
                    <h3 className="font-bold text-sm text-foreground">{dept.name}</h3>
                    <code className="text-xs text-primary font-mono">{dept.alias}</code>
                  </div>
                  <span className="rounded bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold">
                    {dept.usersCount} Assigned Users
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  <span>Manager: <strong className="text-foreground">{dept.manager}</strong></span>
                  <div className="flex items-center gap-2">
                    <button type="button" className="text-muted-foreground hover:text-foreground">
                      <Edit3 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: SOP Templates Manager */}
      {activeTab === "TEMPLATES" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
                First-Class SOP Project Templates ({DEFAULT_PROJECT_TEMPLATES.length})
              </h2>
              <p className="text-xs text-muted-foreground">
                Manage, customize, or create custom project templates.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsTemplatesModalOpen(true)}
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Layers size={14} /> Open Template Library Browser
            </button>
          </div>

          <div className="space-y-3">
            {DEFAULT_PROJECT_TEMPLATES.map((tmpl) => (
              <div key={tmpl.id} className="rounded-lg border bg-card p-4 space-y-2">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-foreground">{tmpl.name}</h3>
                    {tmpl.isDefault && (
                      <span className="rounded bg-primary/20 text-primary px-2 py-0.5 text-[10px] font-bold">
                        Default Active SOP
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground font-semibold">
                    Category: {tmpl.category}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{tmpl.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Business Hours & Timezone */}
      {activeTab === "HOURS" && (
        <div className="rounded-lg border bg-card p-5 space-y-4 max-w-xl">
          <h2 className="text-sm font-bold text-foreground border-b pb-3 flex items-center gap-2">
            <Globe size={16} className="text-primary" /> Organization Working Hours & Timezone
          </h2>

          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-muted-foreground">Organization Timezone</label>
              <input
                type="text"
                disabled
                value="Asia/Kolkata (IST - UTC+05:30)"
                className="w-full rounded border bg-muted px-3 py-2 text-foreground font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-muted-foreground">Standard Workday Hours</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] text-muted-foreground">Start Time</span>
                  <input
                    type="text"
                    defaultValue="09:30 AM"
                    className="w-full rounded border bg-background px-3 py-1.5 text-foreground"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground">End Time</span>
                  <input
                    type="text"
                    defaultValue="06:30 PM"
                    className="w-full rounded border bg-background px-3 py-1.5 text-foreground"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => alert("Working hours saved.")}
                className="rounded bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Browser Modal */}
      <ProjectTemplatesModal
        isOpen={isTemplatesModalOpen}
        onClose={() => setIsTemplatesModalOpen(false)}
      />
    </div>
  );
}
