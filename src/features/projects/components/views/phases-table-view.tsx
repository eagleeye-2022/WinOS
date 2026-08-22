"use client";

import React, { useState, useEffect } from "react";
import {
  ChevronDown,
  Filter,
  Download,
  RotateCw,
  Plus,
  ArrowUpDown,
  Info,
  User,
  X,
  Loader2,
} from "lucide-react";
import { getProjectByIdAction, getProjectsAction } from "../../actions/project-actions";

interface PhaseRow {
  id: string;
  name: string;
  progressPercent: number;
  status: string;
  ownerName: string;
  startDate: string;
  endDate: string;
  overdueDaysText: string;
}

interface PhasesTableViewProps {
  projectId?: string;
  onOpenAddModal?: () => void;
}

export function PhasesTableView({ projectId, onOpenAddModal }: PhasesTableViewProps) {
  const [phases, setPhases] = useState<PhaseRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPhaseFilter, setSelectedPhaseFilter] = useState("All Phases");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showAddPhaseForm, setShowAddPhaseForm] = useState(false);
  const [newPhaseName, setNewPhaseName] = useState("");

  useEffect(() => {
    async function loadPhases() {
      setIsLoading(true);
      try {
        if (projectId) {
          const proj = await getProjectByIdAction(projectId);
          if (proj && proj.phases) {
            const mappedPhases: PhaseRow[] = (proj.phases || []).map((ph) => ({
              id: ph.id,
              name: ph.name,
              progressPercent: ph.isCompleted ? 100 : 0,
              status: ph.isCompleted ? "Completed" : "Active",
              ownerName: proj.owner.name,
              startDate: proj.startDate || "--",
              endDate: proj.deadline || "--",
              overdueDaysText: "",
            }));
            setPhases(mappedPhases);
          }
        } else {
          const projects = await getProjectsAction();
          if (projects.length > 0) {
            const firstProj = projects[0];
            const mappedPhases: PhaseRow[] = (firstProj.phases || []).map((ph) => ({
              id: ph.id,
              name: ph.name,
              progressPercent: ph.isCompleted ? 100 : 0,
              status: ph.isCompleted ? "Completed" : "Active",
              ownerName: firstProj.owner.name,
              startDate: firstProj.startDate || "--",
              endDate: firstProj.deadline || "--",
              overdueDaysText: "",
            }));
            setPhases(mappedPhases);
          }
        }
      } catch (err) {
        console.error("Failed to load project phases:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadPhases();
  }, [projectId]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleSelectAll = () => {
    if (selectedIds.length === phases.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(phases.map((p) => p.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleAddPhaseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhaseName.trim()) return;

    setIsSubmitting(true);

    const newPh: PhaseRow = {
      id: `ph-${Date.now()}`,
      name: newPhaseName.trim(),
      progressPercent: 0,
      status: "Active",
      ownerName: "Mohit Nagpure",
      startDate: new Date().toLocaleDateString("en-GB"),
      endDate: "30/12/2026",
      overdueDaysText: "",
    };

    setPhases([...phases, newPh]);
    setNewPhaseName("");
    setShowAddPhaseForm(false);
    setIsSubmitting(false);
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden">
      {/* Top Action Toolbar (Matching Image 2) */}
      <div className="flex items-center justify-between border-b px-6 py-2.5 bg-muted/20">
        <div className="flex items-center gap-3 text-xs">
          <div className="relative">
            <select
              value={selectedPhaseFilter}
              onChange={(e) => setSelectedPhaseFilter(e.target.value)}
              className="rounded border border-input bg-background px-3 py-1.5 font-medium text-info outline-none cursor-pointer appearance-none pr-8"
            >
              <option value="All Phases">All Phases</option>
              <option value="Active Phases">Active Phases</option>
              <option value="Completed Phases">Completed Phases</option>
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-info pointer-events-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
            title="Filter"
          >
            <Filter size={15} />
          </button>

          <button
            type="button"
            className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
            title="Download CSV"
          >
            <Download size={15} />
          </button>

          <button
            type="button"
            className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
            title="Refresh"
          >
            <RotateCw size={15} />
          </button>

          {/* <div className="h-4 w-px bg-border mx-0.5" />

          <button
            type="button"
            onClick={() => setShowAddPhaseForm(true)}
            className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
          >
            <Plus size={16} /> Add Task
          </button> */}
        </div>
      </div>

      {/* Inline Add Phase Form */}
      {showAddPhaseForm && (
        <form
          onSubmit={handleAddPhaseSubmit}
          className="flex items-center gap-3 border-b p-3 bg-info/10 text-xs"
        >
          <input
            type="text"
            required
            value={newPhaseName}
            onChange={(e) => setNewPhaseName(e.target.value)}
            placeholder="Enter new phase name..."
            className="flex-1 rounded border px-3 py-1.5 bg-background text-xs outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-1.5 rounded bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 size={12} className="animate-spin" />}
            Save Phase
          </button>
          <button
            type="button"
            onClick={() => setShowAddPhaseForm(false)}
            className="rounded border px-3 py-1.5 text-xs hover:bg-accent"
          >
            Cancel
          </button>
        </form>
      )}

      {/* Main Phases Data Table (Matching Image 2) */}
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b bg-muted/40 text-muted-foreground font-semibold">
              <th className="py-3 px-4 border-r w-12 text-center">
                <input
                  type="checkbox"
                  checked={selectedIds.length === phases.length}
                  onChange={toggleSelectAll}
                  className="rounded border-input text-primary h-4 w-4"
                />
              </th>
              <th className="py-3 px-4 border-r whitespace-nowrap min-w-[280px]">
                Phase Name
              </th>
              <th className="py-3 px-4 border-r whitespace-nowrap w-24 text-center">
                <span className="inline-flex items-center gap-1">
                  % <Info size={12} />
                </span>
              </th>
              <th className="py-3 px-4 border-r whitespace-nowrap w-32">
                📋 Status
              </th>
              <th className="py-3 px-4 border-r whitespace-nowrap min-w-[160px]">
                👤 Owner
              </th>
              <th className="py-3 px-4 border-r whitespace-nowrap">
                <span className="inline-flex items-center gap-1">
                  📅 Start Date <ArrowUpDown size={12} />
                </span>
              </th>
              <th className="py-3 px-4 whitespace-nowrap">📅 End Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {/* Add Phase Placeholder Row (Matching Image 2) */}
            <tr className="border-b bg-background">
              <td className="py-2.5 px-4 border-r text-center" />
              <td
                colSpan={6}
                onClick={() => setShowAddPhaseForm(true)}
                className="py-2.5 px-4 italic text-muted-foreground/70 text-[11px] cursor-pointer hover:text-primary hover:bg-accent/20 transition-colors"
              >
                Add Phase...
              </td>
            </tr>

            {phases.map((phase) => (
              <tr
                key={phase.id}
                className="hover:bg-accent/30 transition-colors border-b"
              >
                <td className="py-3 px-4 border-r text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(phase.id)}
                    onChange={() => toggleSelect(phase.id)}
                    className="rounded border-input text-primary h-4 w-4"
                  />
                </td>

                {/* Phase Name */}
                <td className="py-3 px-4 border-r font-semibold text-foreground whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-1 bg-red-500 rounded-full" />
                    <span>{phase.name}</span>
                  </div>
                </td>

                {/* % Progress */}
                <td className="py-3 px-4 border-r text-center font-mono font-medium text-foreground whitespace-nowrap">
                  {phase.progressPercent}%
                </td>

                {/* Status Badge */}
                <td className="py-3 px-4 border-r whitespace-nowrap">
                  <span className="inline-block rounded bg-emerald-600 px-3.5 py-1 text-[11px] font-bold text-white text-center w-full shadow-2xs">
                    {phase.status}
                  </span>
                </td>

                {/* Owner Avatar & Name */}
                <td className="py-3 px-4 border-r whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-white text-[10px] font-bold">
                      MN
                    </span>
                    <span className="font-medium text-foreground">
                      {phase.ownerName}
                    </span>
                  </div>
                </td>

                {/* Start Date */}
                <td className="py-3 px-4 border-r text-muted-foreground font-mono text-[11px] whitespace-nowrap">
                  {phase.startDate}
                </td>

                {/* End Date with Red Overdue Text (Matching Image 2) */}
                <td className="py-3 px-4 font-mono text-[11px] text-destructive whitespace-nowrap">
                  {phase.endDate}{" "}
                  {phase.overdueDaysText && (
                    <span className="text-[10px] font-semibold">
                      {phase.overdueDaysText}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
