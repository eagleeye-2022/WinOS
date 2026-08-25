"use client";

import React, { useState } from "react";
import {
  X,
  Info,
  Calendar,
  Lock,
  ChevronDown,
  ChevronUp,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Outdent,
  Indent,
  Sparkles,
  Sun,
  Moon,
  Maximize2,
  Search,
  Loader2,
  Check,
  AlignLeft,
} from "lucide-react";
import { TimeLogEntry, Project } from "../../types";
import { createTimeLogAction, getProjectsAction, getTasksAction, getCurrentUserContextAction } from "../../actions/project-actions";

interface NewTimeLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProject?: string;
  initialTaskCode?: string;
  projectId?: string;
  projectName?: string;
  assignedUsers?: string[];
  onLogAdded?: (newLog: TimeLogEntry) => void;
}

const FALLBACK_TASK_OPTIONS = [
  { code: "WI1-T11", title: "V1 Keyword Research & Figma Layout" },
  { code: "WI1-T12", title: "Competitor UI & Component Audit" },
  { code: "WI1-T13", title: "Stakeholder Design Interviews" },
  { code: "EC2-T33", title: "Database Schema Optimization" },
  { code: "EC2-T34", title: "SEO Technical Audit & Meta Tags" },
  { code: "EC2-T35", title: "QA Automated Cypress Tests" },
];

export function NewTimeLogModal({
  isOpen,
  onClose,
  initialProject = "",
  initialTaskCode = "",
  projectId,
  projectName,
  onLogAdded,
}: NewTimeLogModalProps) {
  // When opened from inside a project, the log always belongs to that project — no picker.
  const isProjectLocked = Boolean(projectId && projectName);

  // State
  const [selectedProject, setSelectedProject] = useState(
    projectName || initialProject || ""
  );
  const [realProjects, setRealProjects] = useState<Project[]>([]);

  React.useEffect(() => {
    if (!isOpen || isProjectLocked) return;
    getProjectsAction()
      .then(setRealProjects)
      .catch((err) => console.error("Failed to load projects:", err));
  }, [isOpen, isProjectLocked]);

  // Tasks State
  const [projectTasksList, setProjectTasksList] = useState<{ code: string; title: string }[]>([]);
  const [selectedTaskOption, setSelectedTaskOption] = useState("");
  const [taskSearchQuery, setTaskSearchQuery] = useState(initialTaskCode || "");

  // Resolve the active project's real id: locked projects pass it in directly,
  // otherwise look it up from the loaded project list by the selected name.
  const activeProjectId = projectId || realProjects.find((p) => p.name === selectedProject)?.id;

  React.useEffect(() => {
    if (!isOpen || !activeProjectId) {
      return;
    }
    let cancelled = false;

    getTasksAction(activeProjectId)
      .then((tasks) => {
        if (cancelled) return;
        setProjectTasksList(tasks.map((t) => ({ code: t.code || t.id, title: t.title })));
        if (initialTaskCode) {
          const match = tasks.find((t) => (t.code || t.id) === initialTaskCode);
          if (match) {
            const option = `${match.code || match.id} - ${match.title}`;
            setTaskSearchQuery(option);
            setSelectedTaskOption(option);
          }
        }
      })
      .catch((err) => console.error("Failed to load project tasks:", err));

    return () => {
      cancelled = true;
    };
  }, [isOpen, activeProjectId, initialTaskCode]);

  // Clear a stale task selection when the user switches projects manually.
  const [prevActiveProjectId, setPrevActiveProjectId] = useState(activeProjectId);
  if (activeProjectId !== prevActiveProjectId) {
    setPrevActiveProjectId(activeProjectId);
    setSelectedTaskOption("");
    setTaskSearchQuery(initialTaskCode || "");
    if (!activeProjectId) {
      setProjectTasksList([]);
    }
  }

  const allTaskOptions = activeProjectId ? projectTasksList : FALLBACK_TASK_OPTIONS;

  const [isGeneralLog, setIsGeneralLog] = useState(false);
  const [logTitle, setLogTitle] = useState("");
  
  // Section toggle
  const [isTimeLogInfoExpanded, setIsTimeLogInfoExpanded] = useState(true);

  // Time Log Info state
  const [logDate, setLogDate] = useState(() => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  });

  // The log always belongs to whoever is signed in and adding it — the server
  // attributes it to the session user regardless, so this just mirrors that.
  const [currentUserName, setCurrentUserName] = useState("");

  React.useEffect(() => {
    if (!isOpen) return;
    getCurrentUserContextAction()
      .then((ctx) => setCurrentUserName(ctx?.name || ""))
      .catch((err) => console.error("Failed to load current user:", err));
  }, [isOpen]);

  const [useHoursMode, setUseHoursMode] = useState(false);
  const [startTime, setStartTime] = useState("10:27 am");
  const [endTime, setEndTime] = useState("10:27 am");
  const [hoursDuration, setHoursDuration] = useState("00:30");
  const [billingType, setBillingType] = useState<"Billable" | "Non Billable">("Billable");

  // Rich Text Editor states
  const [notesText, setNotesText] = useState("");
  const [fontFamily, setFontFamily] = useState("Puvi");
  const [fontSize, setFontSize] = useState("13");
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);

  // Time & Duration Validation Helpers
  const isValidTimeFormat = (val: string): boolean => {
    if (!val || !val.trim()) return false;
    const trimmed = val.trim();
    // 12-hr (10:27 am, 9:15 PM) or 24-hr (14:30, 09:15)
    const regex = /^(0?[1-9]|1[0-2]):[0-5][0-9]\s*(am|pm|AM|PM)$|^(0?[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;
    return regex.test(trimmed);
  };

  // Parses "10:27 am" or "14:30" into minutes-since-midnight
  const parseTimeToMinutes = (val: string): number | null => {
    const trimmed = val.trim();
    const match12 = trimmed.match(/^(0?[1-9]|1[0-2]):([0-5][0-9])\s*(am|pm)$/i);
    if (match12) {
      let h = parseInt(match12[1], 10);
      const m = parseInt(match12[2], 10);
      const period = match12[3].toLowerCase();
      if (period === "pm" && h !== 12) h += 12;
      if (period === "am" && h === 12) h = 0;
      return h * 60 + m;
    }
    const match24 = trimmed.match(/^([01]?[0-9]|2[0-3]):([0-5][0-9])$/);
    if (match24) {
      return parseInt(match24[1], 10) * 60 + parseInt(match24[2], 10);
    }
    return null;
  };

  const isValidDurationFormat = (val: string): boolean => {
    if (!val || !val.trim()) return false;
    const trimmed = val.trim();
    // HH:MM (00:30, 02:15) or numeric hours (1.5, 2)
    const regex = /^(\d+):([0-5][0-9])$|^(\d+(\.\d+)?)$/;
    return regex.test(trimmed);
  };

  // Future date check
  const [dateError, setDateError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const timeError = React.useMemo(() => {
    if (!useHoursMode) {
      if (startTime && !isValidTimeFormat(startTime)) {
        return "Invalid start time format (e.g. 10:27 am or 14:30)";
      }
      if (endTime && !isValidTimeFormat(endTime)) {
        return "Invalid end time format (e.g. 10:27 am or 14:30)";
      }
    } else {
      if (hoursDuration && !isValidDurationFormat(hoursDuration)) {
        return "Invalid duration format (e.g. 00:30 or 1.5)";
      }
    }
    return "";
  }, [useHoursMode, startTime, endTime, hoursDuration]);

  // Daily Log Hours, derived live from Start/End Time whenever the time period changes
  const computedRangeDuration = React.useMemo(() => {
    if (useHoursMode) return null;
    const startMin = parseTimeToMinutes(startTime);
    const endMin = parseTimeToMinutes(endTime);
    if (startMin === null || endMin === null) return null;
    let diff = endMin - startMin;
    if (diff < 0) diff += 24 * 60;
    return `${String(Math.floor(diff / 60)).padStart(2, "0")}:${String(diff % 60).padStart(2, "0")}`;
  }, [useHoursMode, startTime, endTime]);

  if (!isOpen) return null;

  const handleDateChange = (val: string) => {
    setLogDate(val);
    const parts = val.split(/[/.-]/);
    if (parts.length === 3) {
      let d: number, m: number, y: number;
      if (parts[0].length === 4) {
        y = parseInt(parts[0], 10);
        m = parseInt(parts[1], 10) - 1;
        d = parseInt(parts[2], 10);
      } else {
        d = parseInt(parts[0], 10);
        m = parseInt(parts[1], 10) - 1;
        y = parseInt(parts[2], 10);
      }
      const selected = new Date(y, m, d);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (selected > today) {
        setDateError("Time logging is not allowed for future dates and times.");
      } else {
        setDateError("");
      }
    } else {
      setDateError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (dateError || timeError) return;

    setIsSubmitting(true);

    const title = isGeneralLog
      ? logTitle || "General Time Log"
      : taskSearchQuery || "Task Log";

    const durationStr = useHoursMode
      ? hoursDuration
      : computedRangeDuration || "00:00";

    const timePeriodStr = useHoursMode ? "Custom Duration" : `${startTime} - ${endTime}`;

    const taskCode = !isGeneralLog && taskSearchQuery
      ? taskSearchQuery.split(" - ")[0].trim()
      : undefined;

    const newLogData: TimeLogEntry = {
      id: `tl-${Date.now()}`,
      code: `TL-${Math.floor(1000 + Math.random() * 9000)}`,
      title: title,
      project: selectedProject,
      taskCode,
      duration: durationStr,
      timePeriod: timePeriodStr,
      date: logDate,
      billingType: billingType === "Billable" ? "BILLABLE" : "NON BILLABLE",
      remarks: notesText || "No additional notes",
      approvalStatus: "Pending",
    };

    try {
      const savedLog = await createTimeLogAction(newLogData, projectId);
      if (onLogAdded) {
        onLogAdded(savedLog);
      }
      setIsSubmitting(false);
      onClose();
    } catch (err) {
      console.error("Failed to save time log:", err);
      setSubmitError("Failed to add time log. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-[620px] rounded-lg border border-border bg-card text-card-foreground shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
          <h2 className="text-base font-bold text-foreground tracking-wide">
            New Time Log
          </h2>
          <div className="flex items-center gap-3">
            {selectedProject && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs bg-muted text-muted-foreground border border-border font-medium">
                <span>{selectedProject}</span>
                <Lock size={12} className="text-muted-foreground" />
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-accent transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {/* Information Alert Box using app info tokens */}
          <div className="flex items-center gap-2.5 rounded-md border border-info/30 bg-info/10 px-4 py-3 text-foreground">
            <Info size={16} className="text-info shrink-0" />
            <span className="text-[12px] font-medium">
              Time logging is not allowed for future dates and times
            </span>
          </div>

          {dateError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-destructive text-xs font-medium">
              {dateError}
            </div>
          )}

          {/* Field: Project */}
          <div className="space-y-1.5">
            <label className="font-semibold text-muted-foreground flex items-center gap-0.5 text-xs">
              Project<span className="text-destructive">*</span>
            </label>
            {isProjectLocked ? (
              <div className="flex items-center gap-2 rounded-md border border-input bg-muted/40 px-3.5 py-2 text-xs text-foreground">
                <Lock size={13} className="text-muted-foreground" />
                <span>{projectName}</span>
              </div>
            ) : (
              <div className="relative">
                <select
                  required
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="w-full appearance-none rounded-md border border-input bg-background px-3.5 py-2 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer pr-10"
                >
                  <option value="" disabled>
                    Select Project
                  </option>
                  {realProjects.map((p) => (
                    <option key={p.id} value={p.name} className="bg-background text-foreground">
                      {p.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="absolute right-3 top-2.5 text-muted-foreground pointer-events-none"
                />
              </div>
            )}
          </div>

          {/* Conditional Field: Tasks/Bugs */}
          {selectedProject && (
            <div className="space-y-1.5 animate-in fade-in duration-200">
              <label className="font-semibold text-muted-foreground flex items-center gap-0.5 text-xs">
                Tasks/Bugs<span className="text-destructive">*</span>
              </label>

              {!isGeneralLog ? (
                <div className="space-y-1.5">
                  {/* Single Clean Dropdown Select for Tasks/Bugs */}
                  <div className="relative">
                    <select
                      value={taskSearchQuery}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTaskSearchQuery(val);
                        setSelectedTaskOption(val);
                      }}
                      className="w-full appearance-none rounded-md border border-input bg-background px-3.5 py-2 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer pr-10"
                    >
                      <option value="">
                        Select Task/Bug...
                      </option>
                      {allTaskOptions.map((t) => (
                        <option key={t.code} value={`${t.code} - ${t.title}`} className="bg-background text-foreground">
                          {t.code}: {t.title}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={16}
                      className="absolute right-3 top-2.5 text-muted-foreground pointer-events-none"
                    />
                  </div>

                  {/* Enter General Log toggle (Commented out per user request)
                  <button
                    type="button"
                    onClick={() => setIsGeneralLog(true)}
                    className="text-primary hover:underline font-medium text-[11px] cursor-pointer"
                  >
                    Enter General Log
                  </button>
                  */}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <input
                    type="text"
                    required
                    value={logTitle}
                    onChange={(e) => setLogTitle(e.target.value)}
                    placeholder="Enter general log title..."
                    className="w-full rounded-md border border-input bg-background px-3.5 py-2 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                  />
                  {/* Select Task/Bug Log toggle (Commented out per user request)
                  <button
                    type="button"
                    onClick={() => setIsGeneralLog(false)}
                    className="text-primary hover:underline font-medium text-[11px] cursor-pointer"
                  >
                    Select Task/Bug Log
                  </button>
                  */}
                </div>
              )}
            </div>
          )}

          {/* Time Log Information Accordion */}
          {selectedProject && (
            <div className="space-y-4 pt-1 animate-in fade-in duration-200">
              {/* Accordion Toggle Header */}
              <button
                type="button"
                onClick={() => setIsTimeLogInfoExpanded(!isTimeLogInfoExpanded)}
                className="flex items-center gap-2 font-bold text-foreground text-xs hover:text-primary transition-colors w-full text-left"
              >
                {isTimeLogInfoExpanded ? (
                  <ChevronDown size={16} className="text-muted-foreground" />
                ) : (
                  <ChevronUp size={16} className="text-muted-foreground" />
                )}
                <span>Time Log Information</span>
              </button>

              {isTimeLogInfoExpanded && (
                <div className="space-y-4 pt-1">
                  {/* Row: Date & User */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Date */}
                    <div className="space-y-1.5">
                      <label className="font-semibold text-muted-foreground flex items-center gap-0.5 text-xs">
                        Date<span className="text-destructive">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={logDate}
                          onChange={(e) => handleDateChange(e.target.value)}
                          placeholder="DD/MM/YYYY"
                          className="w-full rounded-md border border-input bg-background px-3.5 py-2 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary pr-10"
                        />
                        <Calendar
                          size={15}
                          className="absolute right-3 top-2.5 text-muted-foreground pointer-events-none"
                        />
                      </div>
                    </div>

                    {/* User */}
                    <div className="space-y-1.5">
                      <label className="font-semibold text-muted-foreground flex items-center gap-1 text-xs">
                        <span>User</span>
                        <span className="text-destructive">*</span>
                        <Info size={13} className="text-info shrink-0" />
                      </label>
                      <div className="flex items-center gap-2 rounded-md border border-input bg-muted/40 px-3.5 py-2 text-xs text-foreground">
                        <Lock size={13} className="text-muted-foreground shrink-0" />
                        <span>{currentUserName || "Loading..."}</span>
                      </div>
                    </div>
                  </div>

                  {/* Row: Daily Log & Billing Type */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Daily Log */}
                    <div className="space-y-1.5">
                      <label className="font-semibold text-muted-foreground flex items-center gap-0.5 text-xs">
                        Daily Log<span className="text-destructive">*</span>
                      </label>

                      {!useHoursMode ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={startTime}
                              onChange={(e) => setStartTime(e.target.value)}
                              placeholder="10:27 am"
                              className={`w-full rounded-md border bg-background px-3 py-2 text-xs text-foreground text-center outline-none focus:ring-1 ${
                                startTime && !isValidTimeFormat(startTime)
                                  ? "border-destructive focus:ring-destructive"
                                  : "border-input focus:border-primary focus:ring-primary"
                              }`}
                            />
                            <span className="text-muted-foreground text-xs font-medium">to</span>
                            <input
                              type="text"
                              value={endTime}
                              onChange={(e) => setEndTime(e.target.value)}
                              placeholder="10:27 am"
                              className={`w-full rounded-md border bg-background px-3 py-2 text-xs text-foreground text-center outline-none focus:ring-1 ${
                                endTime && !isValidTimeFormat(endTime)
                                  ? "border-destructive focus:ring-destructive"
                                  : "border-input focus:border-primary focus:ring-primary"
                              }`}
                            />
                          </div>
                          {computedRangeDuration && (
                            <p className="text-[11px] font-semibold text-foreground">
                              Daily Log Hours: <span className="font-mono text-primary">{computedRangeDuration} h</span>
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={() => setUseHoursMode(true)}
                            className="text-primary hover:underline font-medium text-[11px] cursor-pointer"
                          >
                            Enter Hours
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <input
                            type="text"
                            value={hoursDuration}
                            onChange={(e) => setHoursDuration(e.target.value)}
                            placeholder="00:30"
                            className={`w-full rounded-md border bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-1 ${
                              hoursDuration && !isValidDurationFormat(hoursDuration)
                                ? "border-destructive focus:ring-destructive"
                                : "border-input focus:border-primary focus:ring-primary"
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => setUseHoursMode(false)}
                            className="text-primary hover:underline font-medium text-[11px] cursor-pointer"
                          >
                            Enter Time Range
                          </button>
                        </div>
                      )}
                      {timeError && (
                        <p className="text-[11px] font-semibold text-destructive pt-0.5">
                          {timeError}
                        </p>
                      )}
                    </div>

                    {/* Billing Type */}
                    <div className="space-y-1.5">
                      <label className="font-semibold text-muted-foreground text-xs">
                        Billing Type
                      </label>
                      <div className="relative">
                        <select
                          value={billingType}
                          onChange={(e) =>
                            setBillingType(e.target.value as "Billable" | "Non Billable")
                          }
                          className="w-full appearance-none rounded-md border border-input bg-background px-3.5 py-2 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer pr-10"
                        >
                          <option value="Billable" className="bg-background text-foreground">Billable</option>
                          <option value="Non Billable" className="bg-background text-foreground">Non Billable</option>
                        </select>
                        <ChevronDown
                          size={16}
                          className="absolute right-3 top-2.5 text-muted-foreground pointer-events-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Notes Section with Rich Editor Toolbar */}
                  <div className="space-y-1.5 pt-1">
                    <label className="font-semibold text-muted-foreground text-xs">
                      Notes
                    </label>

                    <div className="rounded-md border border-input bg-background overflow-hidden focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                      {/* Editor Toolbar (Commented out per user request) ────────────────
                      <div className="flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 border-b border-border bg-muted/40">
                        <button
                          type="button"
                          onClick={() => setIsBold(!isBold)}
                          className={`p-1.5 rounded hover:bg-accent ${
                            isBold ? "bg-accent text-foreground" : "text-muted-foreground"
                          }`}
                          title="Bold"
                        >
                          <Bold size={13} />
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsItalic(!isItalic)}
                          className={`p-1.5 rounded hover:bg-accent ${
                            isItalic ? "bg-accent text-foreground" : "text-muted-foreground"
                          }`}
                          title="Italic"
                        >
                          <Italic size={13} />
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsUnderline(!isUnderline)}
                          className={`p-1.5 rounded hover:bg-accent ${
                            isUnderline ? "bg-accent text-foreground" : "text-muted-foreground"
                          }`}
                          title="Underline"
                        >
                          <Underline size={13} />
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsStrikethrough(!isStrikethrough)}
                          className={`p-1.5 rounded hover:bg-accent ${
                            isStrikethrough ? "bg-accent text-foreground" : "text-muted-foreground"
                          }`}
                          title="Strikethrough"
                        >
                          <Strikethrough size={13} />
                        </button>

                        <div className="h-4 w-px bg-border mx-0.5" />

                        <select
                          value={fontFamily}
                          onChange={(e) => setFontFamily(e.target.value)}
                          className="bg-transparent text-foreground text-[11px] outline-none cursor-pointer px-1"
                        >
                          <option value="Puvi" className="bg-background text-foreground">Puvi</option>
                          <option value="Inter" className="bg-background text-foreground">Inter</option>
                          <option value="Roboto" className="bg-background text-foreground">Roboto</option>
                        </select>

                        <select
                          value={fontSize}
                          onChange={(e) => setFontSize(e.target.value)}
                          className="bg-transparent text-foreground text-[11px] outline-none cursor-pointer px-1"
                        >
                          <option value="12" className="bg-background text-foreground">12</option>
                          <option value="13" className="bg-background text-foreground">13</option>
                          <option value="14" className="bg-background text-foreground">14</option>
                        </select>

                        <div className="h-4 w-px bg-border mx-0.5" />

                        <button
                          type="button"
                          className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-accent"
                          title="Text Alignment"
                        >
                          <AlignLeft size={13} />
                        </button>

                        <button
                          type="button"
                          className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-accent"
                          title="Bullet List"
                        >
                          <List size={13} />
                        </button>

                        <button
                          type="button"
                          className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-accent"
                          title="Numbered List"
                        >
                          <ListOrdered size={13} />
                        </button>

                        <div className="h-4 w-px bg-border mx-0.5" />

                        <button
                          type="button"
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-500/30 text-[10px] font-semibold hover:bg-purple-500/30"
                          title="AI Assistant"
                        >
                          <Sparkles size={11} />
                          <ChevronDown size={10} />
                        </button>

                        <div className="flex-1" />

                        <button
                          type="button"
                          className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-accent"
                          title="Maximize"
                        >
                          <Maximize2 size={13} />
                        </button>
                      </div>
                      ──────────────────────────────────────────────────────────────────────────── */}

                      {/* Text Area */}
                      <textarea
                        rows={3}
                        value={notesText}
                        onChange={(e) => setNotesText(e.target.value)}
                        placeholder="Add notes or task details..."
                        className="w-full bg-transparent p-3 text-xs text-foreground outline-none resize-y min-h-[70px]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons using App Theme Buttons */}
          <div className="flex items-center gap-3 pt-4 border-t border-border">
            <button
              type="submit"
              disabled={isSubmitting || !!dateError || !!timeError}
              className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-semibold px-6 py-2 rounded-md text-xs transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
            >
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              Add
            </button>
            <button
              type="button"
              onClick={onClose}
              className="border border-border bg-background hover:bg-accent text-foreground font-semibold px-6 py-2 rounded-md text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
