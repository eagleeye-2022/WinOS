"use client";

import React, { useState } from "react";
import {
  X,
  ChevronDown,
  Mail,
  MoreHorizontal,
  Maximize2,
  Search,
  Loader2,
} from "lucide-react";
import { ProjectUser, UserType } from "../../types";

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInviteUser: (user: ProjectUser) => void;
  defaultUserType?: UserType;
}

const AVAILABLE_PROJECTS = [
  { id: "EEDP-5", name: "JTG: Joytree Global" },
  { id: "EEDP-6", name: "JRE Global" },
  { id: "EEDP-8", name: "FNTC : Fantacy Bakery" },
  { id: "EEDP-10", name: "Sales Department" },
  { id: "EEDP-15", name: "ATCA" },
];

export function InviteMemberModal({
  isOpen,
  onClose,
  onInviteUser,
  defaultUserType = "PORTAL",
}: InviteMemberModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [userRole, setUserRole] = useState(
    defaultUserType === "CLIENT" ? "Client" : ""
  );
  const [associatedProjectsOpen, setAssociatedProjectsOpen] = useState(true);
  const [projectTab, setProjectTab] = useState<"ALL" | "WORKING">("ALL");
  const [projectSearch, setProjectSearch] = useState("");
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleToggleProject = (projectId: string) => {
    if (selectedProjects.includes(projectId)) {
      setSelectedProjects(selectedProjects.filter((id) => id !== projectId));
    } else {
      setSelectedProjects([...selectedProjects, projectId]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    setIsSubmitting(true);

    const initials = name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    const isClient = defaultUserType === "CLIENT" || userRole === "Client";

    const newUser: ProjectUser = {
      id: `usr-${Date.now()}`,
      name,
      email,
      userType: isClient ? "CLIENT" : "PORTAL",
      role: isClient ? "Client" : userRole || "TEAM MEMBER",
      portalProfile: isClient ? undefined : "Employee",
      projects: selectedProjects.length > 0
        ? AVAILABLE_PROJECTS.filter((p) => selectedProjects.includes(p.id))
            .map((p) => p.name)
            .join(", ")
        : "None",
      statusText: "Active 1m ago",
      initials: initials || "U",
      avatarColor: "bg-primary text-primary-foreground",
    };

    onInviteUser(newUser);
    onClose();
    setIsSubmitting(false);
  };

  const filteredProjects = AVAILABLE_PROJECTS.filter(
    (p) =>
      p.id.toLowerCase().includes(projectSearch.toLowerCase()) ||
      p.name.toLowerCase().includes(projectSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-overlay backdrop-blur-xs transition-opacity duration-200">
      <div className="relative flex h-full w-full max-w-2xl flex-col bg-background shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-bold text-foreground">
            {defaultUserType === "CLIENT" ? "Invite Client" : "Invite New Member"}
          </h2>
          <div className="flex items-center gap-2 text-muted-foreground">
            <button
              type="button"
              className="p-1 hover:bg-accent rounded hover:text-foreground"
              title="More Options"
            >
              <MoreHorizontal size={16} />
            </button>
            <button
              type="button"
              className="p-1 hover:bg-accent rounded hover:text-foreground"
              title="Maximize"
            >
              <Maximize2 size={14} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 hover:bg-accent rounded hover:text-foreground"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-sm"
        >
          {/* Name Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name here...."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Email Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              Email ID <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="hello@example.com"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary pr-9"
              />
              <Mail
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
            </div>
          </div>

          {/* User Role */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              User Role
            </label>
            <div className="relative">
              <select
                value={userRole}
                onChange={(e) => setUserRole(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
              >
                <option value="">Select Role</option>
                {defaultUserType === "CLIENT" ? (
                  <option value="Client">Client</option>
                ) : (
                  <>
                    <option value="TEAM MEMBER">TEAM MEMBER</option>
                    <option value="REPORTING MANAGER 1">REPORTING MANAGER 1</option>
                    <option value="ADMINISTRATOR">ADMINISTRATOR</option>
                  </>
                )}
              </select>
              <ChevronDown
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
            </div>
          </div>

          {/* Collapsible Associated Projects */}
          <div className="rounded-md border border-border bg-card">
            <button
              type="button"
              onClick={() =>
                setAssociatedProjectsOpen(!associatedProjectsOpen)
              }
              className="flex w-full items-center justify-between px-4 py-3 text-xs font-bold text-foreground hover:bg-accent/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <ChevronDown
                  size={16}
                  className={`text-muted-foreground transition-transform duration-200 ${
                    associatedProjectsOpen ? "" : "-rotate-90"
                  }`}
                />
                <span>Associated Projects</span>
              </div>
            </button>

            {associatedProjectsOpen && (
              <div className="border-t p-4 space-y-3">
                {/* Tabs */}
                <div className="flex gap-4 border-b pb-2 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setProjectTab("ALL")}
                    className={`pb-1 transition-colors ${
                      projectTab === "ALL"
                        ? "text-primary border-b-2 border-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    All Projects
                  </button>
                  <button
                    type="button"
                    onClick={() => setProjectTab("WORKING")}
                    className={`pb-1 transition-colors ${
                      projectTab === "WORKING"
                        ? "text-primary border-b-2 border-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Working Projects
                  </button>
                </div>

                {/* Search Box */}
                <div className="relative">
                  <input
                    type="text"
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    placeholder="Type to search..."
                    className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <Search
                    size={14}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                  />
                </div>

                {/* Projects Checkbox List */}
                <div className="max-h-48 overflow-y-auto space-y-2 border rounded-md p-3 bg-background">
                  {filteredProjects.map((project) => (
                    <label
                      key={project.id}
                      className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer hover:bg-accent/40 p-1 rounded transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedProjects.includes(project.id)}
                        onChange={() => handleToggleProject(project.id)}
                        className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                      />
                      <span className="font-mono text-muted-foreground text-[11px]">
                        {project.id}
                      </span>
                      <span className="font-medium">{project.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 rounded-md bg-primary px-6 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs disabled:opacity-50"
              >
                {isSubmitting && <Loader2 size={13} className="animate-spin" />}
                Invite
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-input bg-background px-6 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
              >
                Cancel
              </button>
            </div>
            <span className="text-xs text-muted-foreground font-medium">
              User Licences <span className="font-bold text-foreground">(1/20)</span>
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
