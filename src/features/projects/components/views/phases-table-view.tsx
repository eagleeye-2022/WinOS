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
  ListTodo,
  CheckCircle2,
} from "lucide-react";
import { getProjectByIdAction, getProjectsAction, getProjectTasksAction } from "../../actions/project-actions";
import { TaskItem } from "../../types";

interface PhaseRow {
  id: string;
  code?: string;
  name: string;
  taskCount: number;
  progressPercent: number;
  status: string;
  ownerName: string;
  startDate: string;
  endDate: string;
  overdueDaysText: string;
}

interface PhasesTableViewProps {
  projectId?: string;
  onOpenAddModal?: (phaseCode?: string) => void;
}

export function PhasesTableView({ projectId, onOpenAddModal }: PhasesTableViewProps) {
  const [phases, setPhases] = useState<PhaseRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPhaseFilter, setSelectedPhaseFilter] = useState("All Phases");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showAddPhaseForm, setShowAddPhaseForm] = useState(false);
  const [newPhaseName, setNewPhaseName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadPhases() {
      setIsLoading(true);
      try {
        if (projectId) {
          const proj = await getProjectByIdAction(projectId);
          const projectTasks: TaskItem[] = await getProjectTasksAction(projectId);
          if (proj && proj.phases) {
            const mappedPhases: PhaseRow[] = (proj.phases || []).map((ph) => {
              const matchingTasks = projectTasks.filter(
                (t: TaskItem) => t.phaseCode === ph.code || (t.phaseName && t.phaseName.toLowerCase().includes(ph.name.toLowerCase()))
              );
              return {
                id: ph.id,
                code: ph.code,
                name: ph.name,
                taskCount: matchingTasks.length,
                progressPercent: ph.isCompleted ? 100 : matchingTasks.length > 0 ? 35 : 0,
                status: ph.isCompleted ? "Completed" : "Active",
                ownerName: proj.owner.name,
                startDate: proj.startDate || "--",
                endDate: proj.deadline || "--",
                overdueDaysText: "",
              };
            });
            setPhases(mappedPhases);
          }
        } else {
          const projects = await getProjectsAction();
          if (projects.length > 0) {
            const firstProj = projects[0];
            const projectTasks: TaskItem[] = await getProjectTasksAction(firstProj.id);
            const mappedPhases: PhaseRow[] = (firstProj.phases || []).map((ph) => {
              const matchingTasks = projectTasks.filter(
                (t: TaskItem) => t.phaseCode === ph.code || (t.phaseName && t.phaseName.toLowerCase().includes(ph.name.toLowerCase()))
              );
              return {
                id: ph.id,
                code: ph.code,
                name: ph.name,
                taskCount: matchingTasks.length,
                progressPercent: ph.isCompleted ? 100 : matchingTasks.length > 0 ? 35 : 0,
                status: ph.isCompleted ? "Completed" : "Active",
                ownerName: firstProj.owner.name,
                startDate: firstProj.startDate || "--",
                endDate: firstProj.deadline || "--",
                overdueDaysText: "",
              };
            });
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
      taskCount: 0,
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

  const filteredPhases = phases.filter((p) => {
    if (selectedPhaseFilter === "Active Phases") return p.status === "Active";
    if (selectedPhaseFilter === "Completed Phases") return p.status === "Completed";
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden">
      {/* Top Action Toolbar */}
      <div className="flex items-center justify-between border-b px-6 py-2.5 bg-muted/20">
        <div className="flex items-center gap-3 text-xs">
          <div className="relative">
            <select
              value={selectedPhaseFilter}
              onChange={(e) => setSelectedPhaseFilter(e.target.value)}
              className="rounded border border-input bg-background px-3 py-1.5 font-medium text-info outline-hidden cursor-pointer appearance-none pr-8"
            >
              <option value="All Phases">All 17 SOP Phases</option>
              <option value="Active Phases">Active Phases</option>
              <option value="Completed Phases">Completed Phases</option>
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-info pointer-events-none"
            />
          </div>
          <span className="text-muted-foreground text-[11px] font-semibold">
            Hierarchy: Project → Phase → Task
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Filter"
          >
            <Filter size={15} />
          </button>

          <button
            type="button"
            className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Download CSV"
          >
            <Download size={15} />
          </button>

          <button
            type="button"
            onClick={() => {
              setIsLoading(true);
              setTimeout(() => setIsLoading(false), 300);
            }}
            className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Refresh"
          >
            <RotateCw size={15} />
          </button>

          <div className="h-4 w-px bg-border mx-0.5" />

          <button
            type="button"
            onClick={() => setShowAddPhaseForm(true)}
            className="flex items-center gap-1.5 rounded-md bg-[#0088ff] hover:bg-[#0077ee] text-white px-3.5 py-1.5 text-xs font-bold transition-all shadow-2xs cursor-pointer"
          >
            <Plus size={15} /> Add Phase
          </button>
        </div>
      </div>

      {/* Inline Add Phase Form */}
      {showAddPhaseForm && (
        <form
          onSubmit={handleAddPhaseSubmit}
          className="flex items-center gap-3 border-b p-3 bg-info/10 text-xs animate-in fade-in duration-150"
        >
          <input
            type="text"
            required
            value={newPhaseName}
            onChange={(e) => setNewPhaseName(e.target.value)}
            placeholder="Enter new phase name (e.g. 7.8 Custom SOP Phase)..."
            className="flex-1 rounded border px-3 py-1.5 bg-background text-xs outline-hidden focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-1.5 rounded bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting && <Loader2 size={12} className="animate-spin" />}
            Save Phase
          </button>
          <button
            type="button"
            onClick={() => setShowAddPhaseForm(false)}
            className="rounded border px-3 py-1.5 text-xs hover:bg-accent cursor-pointer"
          >
            Cancel
          </button>
        </form>
      )}

      {/* Main Phases Data Table */}
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b bg-muted/40 text-muted-foreground font-semibold">
              <th className="py-3 px-4 border-r w-12 text-center">
                <input
                  type="checkbox"
                  checked={selectedIds.length === phases.length && phases.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-input text-primary h-4 w-4 cursor-pointer"
                />
              </th>
              <th className="py-3 px-4 border-r whitespace-nowrap min-w-[300px]">
                Phase Name
              </th>
              <th className="py-3 px-4 border-r whitespace-nowrap w-28 text-center">
                Tasks Count
              </th>
              <th className="py-3 px-4 border-r whitespace-nowrap w-24 text-center">
                <span className="inline-flex items-center gap-1">
                  % Progress <Info size={12} />
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
            {/* Add Phase Placeholder Row */}
            <tr className="border-b bg-background">
              <td className="py-2.5 px-4 border-r text-center" />
              <td
                colSpan={7}
                onClick={() => setShowAddPhaseForm(true)}
                className="py-2.5 px-4 italic text-muted-foreground/70 text-[11px] cursor-pointer hover:text-primary hover:bg-accent/20 transition-colors"
              >
                + Click here to add a new Phase...
              </td>
            </tr>

            {filteredPhases.map((phase) => {
              const isEmp = phase.taskCount === 0;
              return (
                <tr
                  key={phase.id}
                  className="hover:bg-accent/30 transition-colors border-b group"
                >
                  <td className="py-3 px-4 border-r text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(phase.id)}
                      onChange={() => toggleSelect(phase.id)}
                      className="rounded border-input text-primary h-4 w-4 cursor-pointer"
                    />
                  </td>

                  {/* Phase Name */}
                  <td className="py-3 px-4 border-r font-semibold text-foreground whitespace-nowrap">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`h-4 w-1 rounded-full ${isEmp ? "bg-amber-400" : "bg-sky-500"}`} />
                        <span>{phase.name}</span>
                      </div>
                      {isEmp && (
                        <button
                          type="button"
                          onClick={() => onOpenAddModal?.(phase.code)}
                          className="hidden group-hover:inline-flex items-center gap-1 rounded bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground px-2 py-0.5 text-[10px] font-bold transition-colors cursor-pointer"
                        >
                          <Plus size={11} /> Add Task
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Task Count Badge */}
                  <td className="py-3 px-4 border-r text-center font-mono whitespace-nowrap">
                    {isEmp ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                        No tasks added yet
                      </span>
                    ) : (
                      <span className="inline-block rounded-full bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 px-2.5 py-0.5 text-[10px] font-bold">
                        {phase.taskCount} task{phase.taskCount === 1 ? "" : "s"}
                      </span>
                    )}
                  </td>

                  {/* % Progress */}
                  <td className="py-3 px-4 border-r text-center font-mono font-medium text-foreground whitespace-nowrap">
                    {phase.progressPercent}%
                  </td>

                  {/* Status Badge */}
                  <td className="py-3 px-4 border-r whitespace-nowrap">
                    <span className={`inline-block rounded px-3 py-0.5 text-[11px] font-bold text-center w-full shadow-2xs ${
                      phase.status === "Completed"
                        ? "bg-emerald-600 text-white"
                        : "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                    }`}>
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

                  {/* End Date */}
                  <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                    {phase.endDate}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
