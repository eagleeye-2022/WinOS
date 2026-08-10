"use client";

import React, { useState } from "react";
import {
  ClipboardList,
  Plus,
  Zap,
  Clock,
  Share2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  Check,
} from "lucide-react";
import { PickTemplateModal } from "../modals/pick-template-modal";

export function ChecklistWorkspaceView() {
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [createdChecklists, setCreatedChecklists] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"TEMPLATES" | "ACTIVE">("TEMPLATES");

  const handleAddTemplates = (titles: string[]) => {
    setCreatedChecklists((prev) => [...new Set([...prev, ...titles])]);
    setActiveTab("ACTIVE");
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-y-auto p-6 space-y-6">
      {createdChecklists.length === 0 || activeTab === "TEMPLATES" ? (
        /* Empty State Hero Card (Matching Image 1 & 2) */
        <div className="rounded-2xl border bg-gradient-to-b from-info/5 via-background to-background p-10 text-center flex flex-col items-center justify-center space-y-5 shadow-xs">
          {/* Clipboard Illustration Icon */}
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-card shadow-md border border-info/20">
            <ClipboardList size={36} className="text-amber-500" />
            <span className="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xs shadow-2xs">
              ✓
            </span>
            <span className="absolute -bottom-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 font-bold text-[10px]">
              ≡
            </span>
          </div>

          <div className="max-w-md space-y-2">
            <h2 className="text-xl font-extrabold tracking-tight text-foreground">
              No checklists created yet.
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              A checklist will help you log the to-dos for your task or issue instantaneously. Start from a proven template or build one from scratch.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsTemplateModalOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
            >
              <ClipboardList size={15} /> Pick from Template
            </button>

            <button
              type="button"
              onClick={() => {
                setCreatedChecklists(["Custom SOP Checklist"]);
                setActiveTab("ACTIVE");
              }}
              className="flex items-center gap-2 rounded-lg border border-info bg-background px-5 py-2.5 text-xs font-bold text-info hover:bg-info/10 transition-colors"
            >
              <Plus size={15} /> New Checklist
            </button>
          </div>
        </div>
      ) : (
        /* Active Checklists Content */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Active SOP Checklists</h3>
            <button
              type="button"
              onClick={() => setIsTemplateModalOpen(true)}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground shadow-2xs hover:bg-primary/90"
            >
              + Add Template
            </button>
          </div>

          <div className="space-y-3">
            {createdChecklists.map((title) => (
              <div key={title} className="rounded-lg border bg-card p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ChevronDown size={16} className="text-muted-foreground" />
                    <h4 className="font-bold text-xs text-foreground">{title}</h4>
                    <span className="rounded bg-info/10 text-info px-2 py-0.5 text-[10px] font-bold">
                      ACTIVE
                    </span>
                  </div>
                  <MoreVertical size={14} className="text-muted-foreground cursor-pointer" />
                </div>

                <div className="space-y-2 pl-6 text-xs">
                  {["Standard quality verification", "Spelling and formatting checks", "Final approval signoff"].map((item) => (
                    <label key={item} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-input text-primary h-4 w-4" />
                      <span className="text-foreground">{item}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3 Bottom Feature Cards (Matching Image 1) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        {/* Card 1: Boost Accuracy */}
        <div className="rounded-xl border bg-card p-5 space-y-2 shadow-2xs">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10 text-success font-bold">
            <Zap size={18} />
          </div>
          <h4 className="text-xs font-bold text-foreground">Boost Accuracy</h4>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Checklists reduce human error in repetitive SOP tasks by 40%.
          </p>
        </div>

        {/* Card 2: Full Traceability */}
        <div className="rounded-xl border bg-card p-5 space-y-2 shadow-2xs">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/10 text-warning font-bold">
            <Clock size={18} />
          </div>
          <h4 className="text-xs font-bold text-foreground">Full Traceability</h4>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Every tick is logged in the status timeline for audit readiness.
          </p>
        </div>

        {/* Card 3: Collaborative Flow */}
        <div className="rounded-xl border bg-card p-5 space-y-2 shadow-2xs">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold">
            <Share2 size={18} />
          </div>
          <h4 className="text-xs font-bold text-foreground">Collaborative Flow</h4>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Share task lists across teams to ensure synchronized progress.
          </p>
        </div>
      </div>

      {/* Pick Template Modal */}
      <PickTemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        onAddTemplates={handleAddTemplates}
      />
    </div>
  );
}
