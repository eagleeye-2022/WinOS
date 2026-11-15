"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  X,
  Edit2,
  Calendar,
  Cloud,
  ArrowLeft,
  ArrowRight,
  Info,
  Thermometer,
  CalendarDays,
  Clock,
  PieChart,
  HelpCircle,
  ShieldCheck,
  FileText,
  UserCheck,
  CheckCircle2,
  Sparkles,
  Heart,
  Plane,
  Baby,
  Users,
  Gift,
  AlertTriangle,
  Pill,
  Laptop2,
  Coffee,
  Sun,
  Briefcase,
  TimerReset,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { DEPARTMENTS, EMPLOYMENT_TYPES } from "@/features/users/constants";
import { createLeaveTypeAction, getLeaveTypeForEditAction, updateLeaveTypeAction } from "../actions/leave-actions";
import { getLeaveTypesAction } from "../queries/leave-queries";
import { istDateKey } from "@/features/attendance/utils";
import { errorMessage, unwrap } from "../action-result";

// Wizard labels → the enum values createLeaveTypeAction stores.
const CATEGORY_MAP: Record<string, "PAID" | "UNPAID" | "PARTIALLY_PAID"> = {
  Paid: "PAID",
  Unpaid: "UNPAID",
  "Partially Paid": "PARTIALLY_PAID",
};
const ALLOCATION_MAP: Record<string, "YEARLY" | "MONTHLY" | "QUARTERLY" | "ON_DEMAND"> = {
  Monthly: "MONTHLY",
  Quarterly: "QUARTERLY",
  Yearly: "YEARLY",
  "On-Demand": "ON_DEMAND",
};
const RESET_RULE_MAP: Record<string, "CARRY_FORWARD_UP_TO_LIMIT" | "ENCASH_UNUSED" | "LAPSE_ALL"> = {
  "Carry forward up to a limit": "CARRY_FORWARD_UP_TO_LIMIT",
  "Encash unused balance": "ENCASH_UNUSED",
  "Lapse all unused balance": "LAPSE_ALL",
};
const EXCESS_MAP: Record<string, "DO_NOT_ALLOW" | "ALLOW_WITHOUT_LIMIT" | "ALLOW_UNTIL_YEAR_END" | "MARK_AS_LOP"> = {
  DO_NOT_ALLOW: "DO_NOT_ALLOW",
  WITHOUT_LIMIT: "ALLOW_WITHOUT_LIMIT",
  YEAR_END: "ALLOW_UNTIL_YEAR_END",
  LOP: "MARK_AS_LOP",
};
const AUDIENCE_MAP: Record<string, "ALL_EMPLOYEES" | "FULL_TIME_ONLY" | "PROBATIONARY" | "CONTRACTORS"> = {
  "All Team Members": "ALL_EMPLOYEES",
  "Full Time Only": "FULL_TIME_ONLY",
  Probationary: "PROBATIONARY",
  Contractors: "CONTRACTORS",
};
type TimeUnitValue = "DAYS" | "WEEKS" | "MONTHS" | "YEARS" | "HOURS";
const UNIT_MAP: Record<string, TimeUnitValue | undefined> = {
  Days: "DAYS",
  Weeks: "WEEKS",
  Months: "MONTHS",
  Years: "YEARS",
  Hours: "HOURS",
};
const REQUEST_PERIOD_MAP: Record<string, TimeUnitValue | undefined> = { Month: "MONTHS", Year: "YEARS" };
const DOC_POLICY_MAP = {
  NOT_REQUIRED: "NOT_REQUIRED",
  ALWAYS: "ALWAYS_REQUIRED",
  EXCEEDS: "REQUIRED_WHEN_EXCEEDS",
} as const;
const APPROVAL_FLOW_MAP: Record<string, "DIRECT_MANAGER" | "DEPARTMENT_HEAD" | "HR_ADMIN" | "CUSTOM_TWO_STEP"> = {
  "Team Member's Direct Manager": "DIRECT_MANAGER",
  "Department Head": "DEPARTMENT_HEAD",
  "HR Admin": "HR_ADMIN",
  "Custom 2-Step Approval": "CUSTOM_TWO_STEP",
};
const VISIBILITY_MAP: Record<string, "COMPLETE_LEAVE_SUMMARY" | "REMAINING_BALANCE_ONLY" | "HIDE_IN_SELF_SERVICE"> = {
  "Complete Leave Summary": "COMPLETE_LEAVE_SUMMARY",
  "Remaining Balance Only": "REMAINING_BALANCE_ONLY",
  "Hide in Self Service": "HIDE_IN_SELF_SERVICE",
};
const BALANCE_DISPLAY_MAP: Record<string, "LEAVE_REQUEST_START_DATE" | "CURRENT_DATE" | "YEAR_END_PROJECTION"> = {
  "Leave request's start date": "LEAVE_REQUEST_START_DATE",
  "Current date": "CURRENT_DATE",
  "Year end projection": "YEAR_END_PROJECTION",
};
const CLUBBING_CODE_MAP: Record<string, string> = {
  "Sick Leave": "SL",
  "Casual Leave": "CL",
  "Compensatory Off": "COMP",
  "Paid Leave": "PL",
  "Maternity Leave": "ML",
};

const AVAILABLE_ICONS = [
  { name: "Thermometer", label: "Medical / Sick", component: Thermometer },
  { name: "Heart", label: "Health / Care", component: Heart },
  { name: "Pill", label: "Sick / Medicine", component: Pill },
  { name: "Plane", label: "Casual / Travel", component: Plane },
  { name: "Calendar", label: "Paid Leave", component: Calendar },
  { name: "CalendarDays", label: "Annual / General", component: CalendarDays },
  { name: "Baby", label: "Maternity", component: Baby },
  { name: "Users", label: "Paternity / Family", component: Users },
  { name: "Clock", label: "Comp Off", component: Clock },
  { name: "Gift", label: "Floating Holiday", component: Gift },
  { name: "AlertTriangle", label: "Loss of Pay", component: AlertTriangle },
  { name: "Sparkles", label: "Special Event", component: Sparkles },
  { name: "FileText", label: "Sabbatical / Study", component: FileText },
  { name: "Laptop2", label: "Remote / WFH", component: Laptop2 },
  { name: "Coffee", label: "Break / Rest", component: Coffee },
  { name: "Sun", label: "Vacation", component: Sun },
  { name: "Briefcase", label: "Official Duty", component: Briefcase },
  { name: "TimerReset", label: "Shift / Hours", component: TimerReset },
];

const COLOR_THEMES = [
  { id: "emerald", label: "Emerald", bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800" },
  { id: "blue", label: "Blue", bg: "bg-blue-50 dark:bg-accent", text: "text-primary", border: "border-blue-200 dark:border-zinc-700" },
  { id: "purple", label: "Purple", bg: "bg-purple-50 dark:bg-purple-950/40", text: "text-purple-600 dark:text-purple-400", border: "border-purple-200 dark:border-purple-800" },
  { id: "orange", label: "Amber / Orange", bg: "bg-orange-50 dark:bg-orange-950/40", text: "text-orange-600 dark:text-orange-400", border: "border-orange-200 dark:border-orange-800" },
  { id: "rose", label: "Rose / Red", bg: "bg-rose-50 dark:bg-rose-950/40", text: "text-rose-600 dark:text-rose-400", border: "border-rose-200 dark:border-rose-800" },
  { id: "cyan", label: "Cyan", bg: "bg-cyan-50 dark:bg-cyan-950/40", text: "text-cyan-600 dark:text-cyan-400", border: "border-cyan-200 dark:border-cyan-800" },
  { id: "indigo", label: "Indigo", bg: "bg-indigo-50 dark:bg-accent", text: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-200 dark:border-zinc-700" },
  { id: "slate", label: "Slate", bg: "bg-muted", text: "text-foreground", border: "border-input" },
];

const PRESET_LEAVE_TYPES = [
  { name: "Sick Leave", code: "SL", category: "Paid", entitlement: 12, desc: "Leave granted to team members when they are not feeling well and unable to attend work." },
  { name: "Casual Leave", code: "CL", category: "Paid", entitlement: 6, desc: "For short personal affairs, family events, or unforeseen matters." },
  { name: "Paid Leave", code: "PL", category: "Paid", entitlement: 12, desc: "General earned / annual time off for team members." },
  { name: "Privilege Leave", code: "PL", category: "Paid", entitlement: 15, desc: "Earned leave accrued through service tenure." },
  { name: "Maternity Leave", code: "ML", category: "Paid", entitlement: 180, desc: "Statutory paid leave for female team members for prenatal and postnatal care." },
  { name: "Paternity Leave", code: "PTL", category: "Paid", entitlement: 15, desc: "Leave granted to male team members around the birth/adoption of a child." },
  { name: "Comp Off", code: "COMP", category: "Paid", entitlement: 0, desc: "Compensatory time off earned by working extra hours, holidays or weekends." },
  { name: "Loss of Pay (LOP)", code: "LOP", category: "Unpaid", entitlement: 0, desc: "Unpaid leave for absences beyond allotted paid leave quota." },
  { name: "Floating Holiday", code: "FH", category: "Paid", entitlement: 3, desc: "Optional cultural, festive or religious holiday from designated list." },
  { name: "Early Leave", code: "EL", category: "Paid", entitlement: 2, desc: "Short permission to leave workplace 1-2 hours early." },
  { name: "Bereavement Leave", code: "BL", category: "Paid", entitlement: 5, desc: "Compassionate leave following the death of an immediate family member." },
  { name: "Marriage Leave", code: "MRL", category: "Paid", entitlement: 5, desc: "Special leave granted for a team member's own wedding." },
  { name: "Sabbatical Leave", code: "SBL", category: "Unpaid", entitlement: 30, desc: "Extended unpaid career break for study, research or personal development." },
  { name: "Work From Home", code: "WFH", category: "Paid", entitlement: 24, desc: "Remote work authorization request." },
];

/** The wizard label whose stored value is `value` (reverse of the *_MAP lookups above). */
function labelOf<T extends string>(map: Record<string, T | undefined>, value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return Object.keys(map).find((k) => map[k] === value);
}

interface CreateLeaveTypeWizardProps {
  onCancel?: () => void;
  onSuccess?: () => void;
  /** Open an existing leave type for editing (its settings are loaded into every step). */
  editId?: string;
}

export function CreateLeaveTypeWizard({
  onCancel,
  onSuccess,
  editId,
}: CreateLeaveTypeWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const isEdit = Boolean(editId);
  /** Code of the type being edited — it's allowed to keep its own code. */
  const [originalCode, setOriginalCode] = useState("");
  const [isLoadingEdit, setIsLoadingEdit] = useState(isEdit);
  const [loadError, setLoadError] = useState<string | null>(null);

  // STEP 1: Basic Information — starts empty (pick a preset from the name suggestions to prefill).
  const [leaveTypeName, setLeaveTypeName] = useState("");
  const [leaveCode, setLeaveCode] = useState("");
  const [status, setStatus] = useState("Active");
  const [description, setDescription] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(() => istDateKey());
  const [expiryDate, setExpiryDate] = useState("");

  // Codes already in use, so a duplicate is caught on step 1 instead of after all six steps.
  const [takenCodes, setTakenCodes] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    getLeaveTypesAction()
      .then((d) => setTakenCodes(new Map(d.leaveTypes.map((t) => [t.code.toUpperCase(), t.name]))))
      .catch(() => {});
  }, []);
  const normalizedCode = leaveCode.trim().toUpperCase();
  const step1Error = !leaveTypeName.trim()
    ? "Enter a leave type name."
    : !/^[A-Z0-9_]{1,10}$/.test(normalizedCode)
    ? "The leave code must be 1–10 letters or digits."
    : takenCodes.has(normalizedCode) && normalizedCode !== originalCode
    ? `The code ${normalizedCode} is already used by ${takenCodes.get(normalizedCode)}.`
    : !effectiveDate
    ? "Pick an effective date."
    : expiryDate && expiryDate < effectiveDate
    ? "The expiry date can't be before the effective date."
    : null;

  // Autocomplete dropdown state
  const [isNameDropdownOpen, setIsNameDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Icon & Color State
  const [selectedIcon, setSelectedIcon] = useState("Thermometer");
  const [selectedColorTheme, setSelectedColorTheme] = useState("emerald");
  const [isIconModalOpen, setIsIconModalOpen] = useState(false);

  const currentColor = useMemo(() => {
    return (
      COLOR_THEMES.find((c) => c.id === selectedColorTheme) || COLOR_THEMES[0]
    );
  }, [selectedColorTheme]);

  const renderIconComponent = (iconName: string, className = "w-5 h-5") => {
    switch (iconName) {
      case "Thermometer":
        return <Thermometer className={className} />;
      case "Heart":
        return <Heart className={className} />;
      case "Pill":
        return <Pill className={className} />;
      case "Plane":
        return <Plane className={className} />;
      case "Calendar":
        return <Calendar className={className} />;
      case "CalendarDays":
        return <CalendarDays className={className} />;
      case "Baby":
        return <Baby className={className} />;
      case "Users":
        return <Users className={className} />;
      case "Clock":
        return <Clock className={className} />;
      case "Gift":
        return <Gift className={className} />;
      case "AlertTriangle":
        return <AlertTriangle className={className} />;
      case "Sparkles":
        return <Sparkles className={className} />;
      case "FileText":
        return <FileText className={className} />;
      case "Laptop2":
        return <Laptop2 className={className} />;
      case "Coffee":
        return <Coffee className={className} />;
      case "Sun":
        return <Sun className={className} />;
      case "Briefcase":
        return <Briefcase className={className} />;
      case "TimerReset":
        return <TimerReset className={className} />;
      default:
        return <Thermometer className={className} />;
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsNameDropdownOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsNameDropdownOpen(false);
        setIsIconModalOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const filteredPresets = useMemo(() => {
    if (!leaveTypeName.trim()) return PRESET_LEAVE_TYPES;
    return PRESET_LEAVE_TYPES.filter(
      (p) =>
        p.name.toLowerCase().includes(leaveTypeName.toLowerCase()) ||
        p.code.toLowerCase().includes(leaveTypeName.toLowerCase())
    );
  }, [leaveTypeName]);

  const handleSelectSuggestion = (preset: (typeof PRESET_LEAVE_TYPES)[0]) => {
    setLeaveTypeName(preset.name);
    setLeaveCode(preset.code);
    setDescription(preset.desc);
    setLeaveCategory(preset.category);
    setAnnualEntitlement(preset.entitlement);
    if (preset.name.includes("Sick") || preset.name.includes("Medical")) {
      setSelectedIcon("Thermometer");
      setSelectedColorTheme("blue");
    } else if (preset.name.includes("Casual") || preset.name.includes("Holiday")) {
      setSelectedIcon("Plane");
      setSelectedColorTheme("orange");
    } else if (preset.name.includes("Maternity") || preset.name.includes("Paternity")) {
      setSelectedIcon("Baby");
      setSelectedColorTheme("purple");
    } else if (preset.name.includes("Comp")) {
      setSelectedIcon("Clock");
      setSelectedColorTheme("orange");
    } else if (preset.name.includes("Loss of Pay")) {
      setSelectedIcon("AlertTriangle");
      setSelectedColorTheme("rose");
    } else {
      setSelectedIcon("Calendar");
      setSelectedColorTheme("emerald");
    }
    setIsNameDropdownOpen(false);
  };

  // STEP 2: Leave & Balance Setup
  const [leaveCategory, setLeaveCategory] = useState("Paid");
  const [allocationFreq, setAllocationFreq] = useState("Yearly");
  const [annualEntitlement, setAnnualEntitlement] = useState(12);
  const [allowCarryForward, setAllowCarryForward] = useState(true);
  const [carryForwardLimit, setCarryForwardLimit] = useState(5);
  const [balanceResetRule, setBalanceResetRule] = useState(
    "Carry forward up to a limit"
  );
  const [excessOption, setExcessOption] = useState("LOP"); // "DO_NOT_ALLOW" | "WITHOUT_LIMIT" | "YEAR_END" | "LOP"
  const [yearEndDate, setYearEndDate] = useState(() => `${istDateKey().slice(0, 4)}-12-31`);

  // STEP 3: Eligibility & Duration
  const [applicableTo, setApplicableTo] = useState("All Team Members");
  const [department, setDepartment] = useState("All Departments");
  const [employmentType, setEmploymentType] = useState("All Employment Types");
  const [minServicePeriod, setMinServicePeriod] = useState(6);
  const [minServiceUnit, setMinServiceUnit] = useState("Months");
  const [durations, setDurations] = useState({
    fullDay: true,
    halfDay: true,
    quarterDay: false,
    hourly: true,
  });

  // STEP 4: Application Rules
  const [allowPastDays, setAllowPastDays] = useState(true);
  const [pastDaysLimit, setPastDaysLimit] = useState(7);
  const [pastDaysUnit, setPastDaysUnit] = useState("Days");
  const [allowAdvanceDays, setAllowAdvanceDays] = useState(true);
  const [advanceDaysLimit, setAdvanceDaysLimit] = useState(90);
  const [advanceDaysUnit, setAdvanceDaysUnit] = useState("Days");
  const [minAdvanceNotice, setMinAdvanceNotice] = useState(2);
  const [minAdvanceUnit, setMinAdvanceUnit] = useState("Days");

  const [minLeavePerRequest, setMinLeavePerRequest] = useState(0.5);
  const [maxLeavePerRequest, setMaxLeavePerRequest] = useState(10);
  const [maxConsecutiveDays, setMaxConsecutiveDays] = useState(15);
  const [minGapBetweenRequests, setMinGapBetweenRequests] = useState(2);

  const [maxRequestsCount, setMaxRequestsCount] = useState(3);
  const [maxRequestsPeriod, setMaxRequestsPeriod] = useState("Month");
  const [applicableDays, setApplicableDays] = useState<string[]>([
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
  ]);

  // STEP 5: Policies & Documents
  const [sandwichPolicy, setSandwichPolicy] = useState(true);
  const [sandwichWeekends, setSandwichWeekends] = useState(true);
  const [sandwichHolidays, setSandwichHolidays] = useState(true);
  const [clubbingLeaveTypes, setClubbingLeaveTypes] = useState<string[]>([
    "Sick Leave",
    "Casual Leave",
    "Compensatory Off",
  ]);
  const [supportingDocPolicy, setSupportingDocPolicy] = useState<
    "NOT_REQUIRED" | "ALWAYS" | "EXCEEDS"
  >("EXCEEDS");
  const [docExceedsDays, setDocExceedsDays] = useState(3);
  const [docExceedsUnit, setDocExceedsUnit] = useState("Days");
  const [acceptedFileTypes, setAcceptedFileTypes] = useState<string[]>([
    "PDF",
    "JPG",
    "PNG",
  ]);
  const [maxFileSize, setMaxFileSize] = useState("5 MB");

  // STEP 6: Approval & Visibility
  const [managerApprovalRequired, setManagerApprovalRequired] = useState(true);
  const [approvalFlow, setApprovalFlow] = useState(
    "Team Member's Direct Manager"
  );
  const [allowAdminApplyOnBehalf, setAllowAdminApplyOnBehalf] = useState(true);
  const [employeeVisibility, setEmployeeVisibility] = useState(
    "Complete Leave Summary"
  );
  const [balanceDisplayPreference, setBalanceDisplayPreference] = useState(
    "Leave request's start date"
  );

  // Edit mode: load the saved leave type into every step.
  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    setIsLoadingEdit(true);
    getLeaveTypeForEditAction(editId)
      .then((t) => {
        if (cancelled) return;
        setOriginalCode(t.code.toUpperCase());
        // Step 1
        setLeaveTypeName(t.name);
        setLeaveCode(t.code);
        setStatus(t.isActive ? "Active" : "Inactive");
        setDescription(t.description || "");
        setEffectiveDate(t.effectiveDate);
        setExpiryDate(t.expiryDate || "");
        setSelectedIcon(t.icon || "Thermometer");
        setSelectedColorTheme(COLOR_THEMES.find((c) => c.bg === t.iconBgColor)?.id ?? "emerald");
        // Step 2
        setLeaveCategory(labelOf(CATEGORY_MAP, t.category) ?? "Paid");
        setAllocationFreq(labelOf(ALLOCATION_MAP, t.allocationFrequency) ?? "Yearly");
        setAnnualEntitlement(t.annualEntitlement);
        setAllowCarryForward(t.allowCarryForward);
        setCarryForwardLimit(t.carryForwardLimit ?? 5);
        setBalanceResetRule(labelOf(RESET_RULE_MAP, t.balanceResetRule) ?? "Carry forward up to a limit");
        setExcessOption(labelOf(EXCESS_MAP, t.exceededRule) ?? "LOP");
        if (t.yearEndDate) setYearEndDate(t.yearEndDate);
        // Step 3
        setApplicableTo(labelOf(AUDIENCE_MAP, t.applicableTo) ?? "All Team Members");
        setDepartment(t.departments[0] ?? "All Departments");
        setEmploymentType(t.employmentTypes[0] ?? "All Employment Types");
        setMinServicePeriod(t.minServicePeriod ?? 6);
        setMinServiceUnit(labelOf(UNIT_MAP, t.minServiceUnit) ?? "Months");
        setDurations({ fullDay: t.allowFullDay, halfDay: t.allowHalfDay, quarterDay: t.allowQuarterDay, hourly: t.allowHourly });
        // Step 4
        setAllowPastDays(t.allowPastDays);
        setPastDaysLimit(t.pastDaysLimit);
        setPastDaysUnit(labelOf(UNIT_MAP, t.pastDaysUnit) ?? "Days");
        setAllowAdvanceDays(t.allowAdvanceDays);
        setAdvanceDaysLimit(t.advanceDaysLimit);
        setAdvanceDaysUnit(labelOf(UNIT_MAP, t.advanceDaysUnit) ?? "Days");
        setMinAdvanceNotice(t.minAdvanceNotice);
        setMinAdvanceUnit(labelOf(UNIT_MAP, t.minAdvanceNoticeUnit) ?? "Days");
        setMinLeavePerRequest(t.minLeavePerRequest);
        setMaxLeavePerRequest(t.maxLeavePerRequest);
        setMaxConsecutiveDays(t.maxConsecutiveDays);
        setMinGapBetweenRequests(t.minGapBetweenRequests ?? 2);
        setMaxRequestsCount(t.maxRequestsCount ?? 3);
        setMaxRequestsPeriod(labelOf(REQUEST_PERIOD_MAP, t.maxRequestsPeriod) ?? "Month");
        setApplicableDays(t.applicableDays);
        // Step 5
        setSandwichPolicy(t.sandwichPolicy);
        setSandwichWeekends(t.sandwichWeekends);
        setSandwichHolidays(t.sandwichHolidays);
        setClubbingLeaveTypes(t.clubbingRestrictedCodes.map((c) => labelOf(CLUBBING_CODE_MAP, c) ?? c));
        setSupportingDocPolicy((labelOf(DOC_POLICY_MAP, t.supportingDocPolicy) as "NOT_REQUIRED" | "ALWAYS" | "EXCEEDS") ?? "EXCEEDS");
        setDocExceedsDays(t.docExceedsDays ?? 3);
        setDocExceedsUnit("Days");
        setAcceptedFileTypes(t.acceptedFileTypes);
        setMaxFileSize(`${t.maxFileSizeMb ?? 5} MB`);
        // Step 6
        setManagerApprovalRequired(t.managerApprovalRequired);
        setApprovalFlow(labelOf(APPROVAL_FLOW_MAP, t.approvalFlow) ?? "Team Member's Direct Manager");
        setAllowAdminApplyOnBehalf(t.allowAdminApplyOnBehalf);
        setEmployeeVisibility(labelOf(VISIBILITY_MAP, t.employeeVisibility) ?? "Complete Leave Summary");
        setBalanceDisplayPreference(labelOf(BALANCE_DISPLAY_MAP, t.balanceDisplayPref) ?? "Leave request's start date");
      })
      .catch((err) => !cancelled && setLoadError(errorMessage(err, "Couldn't load this leave type.")))
      .finally(() => !cancelled && setIsLoadingEdit(false));
    return () => {
      cancelled = true;
    };
  }, [editId]);

  const steps = [
    { number: 1, title: "Basic Information" },
    { number: 2, title: "Leave & Balance Setup" },
    { number: 3, title: "Eligibility & Duration" },
    { number: 4, title: "Application Rules" },
    { number: 5, title: "Policies & Documents" },
    { number: 6, title: isEdit ? "Review & Save" : "Review & Create" },
  ];

  const toggleDay = (day: string) => {
    setApplicableDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const removeClubbingType = (type: string) => {
    setClubbingLeaveTypes((prev) => prev.filter((t) => t !== type));
  };

  const removeFileType = (type: string) => {
    setAcceptedFileTypes((prev) => prev.filter((t) => t !== type));
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleNext = async () => {
    if (step1Error && (currentStep === 1 || currentStep === 6)) {
      setSubmitError(step1Error);
      setCurrentStep(1);
      return;
    }
    setSubmitError(null);
    if (currentStep < 6) {
      setCurrentStep(currentStep + 1);
    } else {
      setIsSubmitting(true);
      setSubmitError(null);
      // Same payload either way: edit saves over the existing type, create adds a new one.
      const save = (payload: Parameters<typeof createLeaveTypeAction>[0]) =>
        editId ? updateLeaveTypeAction(editId, payload) : createLeaveTypeAction(payload);
      try {
        unwrap(
          await save({
            name: leaveTypeName.trim(),
            code: normalizedCode,
            description: description.trim() || undefined,
            icon: selectedIcon,
            iconBgColor: currentColor.bg,
            iconTextColor: currentColor.text,
            isActive: status === "Active",
            effectiveDate,
            expiryDate: expiryDate || undefined,
            category: CATEGORY_MAP[leaveCategory] ?? "PAID",
            allocationFrequency: ALLOCATION_MAP[allocationFreq] ?? "YEARLY",
            annualEntitlement,
            allowCarryForward,
            carryForwardLimit,
            balanceResetRule: RESET_RULE_MAP[balanceResetRule] ?? "CARRY_FORWARD_UP_TO_LIMIT",
            exceededRule: EXCESS_MAP[excessOption] ?? "MARK_AS_LOP",
            yearEndDate: excessOption === "YEAR_END" ? yearEndDate : undefined,
            applicableTo: AUDIENCE_MAP[applicableTo] ?? "ALL_EMPLOYEES",
            departments: department === "All Departments" ? [] : [department],
            employmentTypes: employmentType === "All Employment Types" ? [] : [employmentType],
            minServicePeriod,
            minServiceUnit: UNIT_MAP[minServiceUnit],
            allowFullDay: durations.fullDay,
            allowHalfDay: durations.halfDay,
            allowQuarterDay: durations.quarterDay,
            allowHourly: durations.hourly,
            allowPastDays,
            pastDaysLimit,
            pastDaysUnit: UNIT_MAP[pastDaysUnit],
            allowAdvanceDays,
            advanceDaysLimit,
            advanceDaysUnit: UNIT_MAP[advanceDaysUnit],
            minAdvanceNotice,
            minAdvanceNoticeUnit: UNIT_MAP[minAdvanceUnit],
            minLeavePerRequest,
            maxLeavePerRequest,
            maxConsecutiveDays,
            minGapBetweenRequests,
            maxRequestsCount,
            maxRequestsPeriod: REQUEST_PERIOD_MAP[maxRequestsPeriod],
            applicableDays,
            sandwichPolicy,
            sandwichWeekends,
            sandwichHolidays,
            clubbingRestrictedCodes: clubbingLeaveTypes.map((t) => CLUBBING_CODE_MAP[t] ?? t),
            supportingDocPolicy: DOC_POLICY_MAP[supportingDocPolicy],
            // The threshold is a leave amount; hours are converted at 8 working hours per day.
            docExceedsDays: docExceedsUnit === "Hours" ? Math.round((docExceedsDays / 8) * 100) / 100 : docExceedsDays,
            acceptedFileTypes,
            maxFileSizeMb: parseInt(maxFileSize, 10) || 5,
            managerApprovalRequired,
            approvalFlow: APPROVAL_FLOW_MAP[approvalFlow] ?? "DIRECT_MANAGER",
            allowAdminApplyOnBehalf,
            employeeVisibility: VISIBILITY_MAP[employeeVisibility] ?? "COMPLETE_LEAVE_SUMMARY",
            balanceDisplayPref: BALANCE_DISPLAY_MAP[balanceDisplayPreference] ?? "LEAVE_REQUEST_START_DATE",
          })
        );

        if (onSuccess) {
          onSuccess();
        } else {
          router.push("/pulse/leave/team");
        }
      } catch (err) {
        setSubmitError(errorMessage(err, isEdit ? "Failed to save the leave type." : "Failed to create leave type."));
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      if (onCancel) {
        onCancel();
      } else {
        router.push("/pulse/leave/team");
      }
    }
  };

  // Edit mode waits for the saved settings so no step briefly shows the create defaults.
  if (isEdit && (isLoadingEdit || loadError)) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border/70 bg-card py-20 text-sm text-muted-foreground">
        {loadError ? (
          <>
            <p className="text-rose-600 dark:text-rose-400">{loadError}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => (onCancel ? onCancel() : router.push("/pulse/leave/team"))}>
              Back to Leave Policy
            </Button>
          </>
        ) : (
          <p>Loading leave type…</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full pb-16 select-none">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              {isEdit ? `Edit Leave Type${leaveTypeName ? ` — ${leaveTypeName}` : ""}` : "Create New Leave Type"}
            </h1>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => (onCancel ? onCancel() : router.push("/pulse/leave/team"))}
          className="h-9 px-4 rounded-md text-xs font-semibold gap-1.5 self-start sm:self-auto"
        >
          <X className="w-4 h-4" />
          <span>Cancel</span>
        </Button>
      </div>

      {/* 6-Step Stepper Bar */}
      <div className="bg-card border rounded-lg p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between relative">
          {steps.map((step, idx) => {
            const isCompleted = currentStep > step.number;
            const isCurrent = currentStep === step.number;

            return (
              <React.Fragment key={step.number}>
                <div
                  className="flex flex-col items-center gap-2 cursor-pointer z-10 flex-1"
                  onClick={() => setCurrentStep(step.number)}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
                      isCompleted
                        ? "bg-primary text-primary-foreground"
                        : isCurrent
                        ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                        : "bg-muted text-muted-foreground border"
                    )}
                  >
                    {isCompleted ? <Check className="w-4 h-4 stroke-[2.5]" /> : step.number}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-semibold text-center hidden md:block max-w-[120px] leading-tight",
                      isCurrent
                        ? "text-primary font-bold"
                        : isCompleted
                        ? "text-foreground font-medium"
                        : "text-muted-foreground"
                    )}
                  >
                    {step.title}
                  </span>
                </div>

                {idx < steps.length - 1 && (
                  <div
                    className={cn(
                      "h-0.5 flex-1 -mt-5 hidden md:block transition-all",
                      currentStep > step.number ? "bg-primary" : "bg-border"
                    )}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* STEP 1: BASIC INFORMATION (Image 2) */}
      {currentStep === 1 && (
        <div className="bg-card border rounded-lg p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-6">
          <div className="pb-2 border-b">
            <h3 className="text-base font-bold text-foreground tracking-tight">
              Basic Information
            </h3>
          </div>

          <div className="space-y-5 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Leave Type Name with Autocomplete */}
              <div ref={dropdownRef} className="space-y-1.5 relative">
                <label className="font-semibold text-foreground">
                  Leave Type Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Input
                    value={leaveTypeName}
                    onChange={(e) => {
                      setLeaveTypeName(e.target.value);
                      setIsNameDropdownOpen(true);
                    }}
                    onFocus={() => setIsNameDropdownOpen(true)}
                    placeholder="Type leave name (e.g. Casual Leave, Sick Leave)"
                    className="h-10 rounded-md text-xs bg-background font-medium"
                    required
                  />
                  {filteredPresets.length > 0 && isNameDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-popover border border-border/80 rounded-md shadow-lg max-h-64 overflow-y-auto divide-y divide-border/40 scrollbar-thin">
                      <div className="px-3 py-1.5 bg-muted/40 text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-primary" />
                        <span>Suggested Leave Types (Click to auto-fill)</span>
                      </div>
                      {filteredPresets.map((preset) => (
                        <div
                          key={preset.name}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectSuggestion(preset);
                          }}
                          className="px-3 py-2 hover:bg-primary/5 cursor-pointer transition-colors flex flex-col gap-0.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-foreground">{preset.name}</span>
                              <span className="text-xs font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                                {preset.code}
                              </span>
                            </div>
                            <span className={cn(
                              "text-xs font-medium px-1.5 py-0.5 rounded-full",
                              preset.category === "Paid"
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200"
                            )}>
                              {preset.category} • {preset.entitlement}d/yr
                            </span>
                          </div>
                          {preset.desc && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {preset.desc}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Leave Code */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">
                  Leave Code <span className="text-red-500">*</span>
                </label>
                <Input
                  value={leaveCode}
                  onChange={(e) => setLeaveCode(e.target.value)}
                  placeholder="e.g. SL"
                  className="h-10 rounded-md text-xs bg-background font-medium"
                  required
                />
              </div>

              {/* Icon */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">
                  Icon & Badge Color <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsIconModalOpen(true)}
                    title="Click to change icon and color theme"
                    className={cn(
                      "w-11 h-11 rounded-md flex items-center justify-center border transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-[0_1px_2px_rgba(15,23,42,0.04)] shrink-0 group relative",
                      currentColor.bg,
                      currentColor.text,
                      currentColor.border
                    )}
                  >
                    {renderIconComponent(selectedIcon, "w-5 h-5 group-hover:scale-110 transition-transform")}
                  </button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsIconModalOpen(true)}
                    className="h-11 flex-1 rounded-md text-xs font-semibold gap-2 text-primary border-primary/30 hover:bg-primary/5 hover:border-primary/50 cursor-pointer shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Change Icon & Color</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="max-w-md space-y-1.5">
              <label className="font-semibold text-foreground">
                Status <span className="text-red-500">*</span>
              </label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-10 rounded-md text-xs bg-background font-medium">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    <span>{status}</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">
                Description
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide a short description of this leave type..."
                className="min-h-[80px] text-xs resize-none bg-background rounded-md p-3"
              />
            </div>

            {/* Effective & Expiry Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">
                  Effective Date <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  className="h-10 rounded-md text-xs bg-background"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">
                  Expiry Date (Optional)
                </label>
                <Input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="h-10 rounded-md text-xs bg-background"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: LEAVE & BALANCE SETUP (Image 3) */}
      {currentStep === 2 && (
        <div className="bg-card border rounded-lg p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-6">
          <div className="pb-2 border-b">
            <h3 className="text-base font-bold text-foreground tracking-tight">
              Leave & Balance Setup
            </h3>
          </div>

          <div className="space-y-6 text-xs">
            {/* Top 3 Row Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Leave Category */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">
                  Leave Category <span className="text-red-500">*</span>
                </label>
                <Select value={leaveCategory} onValueChange={setLeaveCategory}>
                  <SelectTrigger className="h-10 rounded-md text-xs bg-background">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Unpaid">Unpaid</SelectItem>
                    <SelectItem value="Partially Paid">Partially Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Allocation Frequency */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">
                  Allocation Frequency <span className="text-red-500">*</span>
                </label>
                <Select value={allocationFreq} onValueChange={setAllocationFreq}>
                  <SelectTrigger className="h-10 rounded-md text-xs bg-background">
                    <SelectValue placeholder="Frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                    <SelectItem value="Quarterly">Quarterly</SelectItem>
                    <SelectItem value="Yearly">Yearly</SelectItem>
                    <SelectItem value="On-Demand">On-Demand</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Annual Entitlement */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">
                  Annual Entitlement <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={annualEntitlement}
                    onChange={(e) => setAnnualEntitlement(Number(e.target.value))}
                    className="h-10 pr-12 rounded-md text-xs bg-background font-semibold"
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-xs">
                    Days
                  </span>
                </div>
              </div>
            </div>

            {/* Carry Forward Settings */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
              {/* Carry Forward Switch */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">
                  Carry Forward
                </label>
                <div className="flex items-center gap-3 pt-1">
                  <Switch
                    checked={allowCarryForward}
                    onCheckedChange={setAllowCarryForward}
                  />
                  <span className="font-medium text-foreground">
                    Allow carry forward of unused balance
                  </span>
                </div>
              </div>

              {/* Carry Forward Limit */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">
                  Carry Forward Limit
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    min={0}
                    value={carryForwardLimit}
                    onChange={(e) => setCarryForwardLimit(Number(e.target.value))}
                    className="h-10 pr-12 rounded-md text-xs bg-background font-semibold"
                    disabled={!allowCarryForward}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-xs">
                    Days
                  </span>
                </div>
              </div>

              {/* Balance Reset Rule */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">
                  Balance Reset Rule <span className="text-red-500">*</span>
                </label>
                <Select
                  value={balanceResetRule}
                  onValueChange={setBalanceResetRule}
                  disabled={!allowCarryForward}
                >
                  <SelectTrigger className="h-10 rounded-md text-xs bg-background">
                    <SelectValue placeholder="Reset rule" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Carry forward up to a limit">
                      Carry forward up to a limit
                    </SelectItem>
                    <SelectItem value="Encash unused balance">
                      Encash unused balance
                    </SelectItem>
                    <SelectItem value="Lapse all unused balance">
                      Lapse all unused balance
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Exceeded Leave Entitlement Card */}
            <div className="bg-muted/30 border rounded-lg p-5 space-y-4">
              <div>
                <h4 className="text-xs font-bold text-foreground">
                  Exceeded Leave Entitlement
                </h4>
              </div>

              {/* 4 Option Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Do not allow */}
                <div
                  onClick={() => setExcessOption("DO_NOT_ALLOW")}
                  className={cn(
                    "p-3.5 rounded-md border bg-background cursor-pointer transition-all space-y-1.5",
                    excessOption === "DO_NOT_ALLOW"
                      ? "ring-2 ring-primary border-primary bg-primary/5"
                      : "hover:border-primary/50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="excessOption"
                      checked={excessOption === "DO_NOT_ALLOW"}
                      onChange={() => setExcessOption("DO_NOT_ALLOW")}
                      className="accent-primary"
                    />
                    <span className="font-bold text-foreground text-xs">
                      Do not allow request
                    </span>
                  </div>
                </div>

                {/* 2. Allow without limit */}
                <div
                  onClick={() => setExcessOption("WITHOUT_LIMIT")}
                  className={cn(
                    "p-3.5 rounded-md border bg-background cursor-pointer transition-all space-y-1.5",
                    excessOption === "WITHOUT_LIMIT"
                      ? "ring-2 ring-primary border-primary bg-primary/5"
                      : "hover:border-primary/50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="excessOption"
                      checked={excessOption === "WITHOUT_LIMIT"}
                      onChange={() => setExcessOption("WITHOUT_LIMIT")}
                      className="accent-primary"
                    />
                    <span className="font-bold text-foreground text-xs">
                      Allow without limit
                    </span>
                  </div>
                </div>

                {/* 3. Allow until year end limit */}
                <div
                  onClick={() => setExcessOption("YEAR_END")}
                  className={cn(
                    "p-3.5 rounded-md border bg-background cursor-pointer transition-all space-y-1.5",
                    excessOption === "YEAR_END"
                      ? "ring-2 ring-primary border-primary bg-primary/5"
                      : "hover:border-primary/50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="excessOption"
                      checked={excessOption === "YEAR_END"}
                      onChange={() => setExcessOption("YEAR_END")}
                      className="accent-primary"
                    />
                    <span className="font-bold text-foreground text-xs">
                      Allow until year end limit
                    </span>
                  </div>
                </div>

                {/* 4. Mark excess as LOP */}
                <div
                  onClick={() => setExcessOption("LOP")}
                  className={cn(
                    "p-3.5 rounded-md border bg-background cursor-pointer transition-all space-y-1.5",
                    excessOption === "LOP"
                      ? "ring-2 ring-primary border-primary bg-primary/5 shadow-2xs"
                      : "hover:border-primary/50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="excessOption"
                      checked={excessOption === "LOP"}
                      onChange={() => setExcessOption("LOP")}
                      className="accent-primary"
                    />
                    <span className="font-bold text-foreground text-xs text-primary">
                      Mark excess as LOP
                    </span>
                  </div>
                </div>
              </div>

              {/* Year End Date */}
              <div className="max-w-xs space-y-1.5 pt-2">
                <label className="font-semibold text-foreground">
                  Year End Date
                </label>
                <Input
                  type="date"
                  value={yearEndDate}
                  onChange={(e) => setYearEndDate(e.target.value)}
                  className="h-10 rounded-md text-xs bg-background"
                />
              </div>

              {/* Info Notice Banner */}
              <div className="flex items-center gap-2 p-3 bg-blue-50/80 dark:bg-accent border border-blue-100 dark:border-zinc-700/40 rounded-md text-xs text-blue-700 dark:text-blue-300">
                <Info className="w-4 h-4 shrink-0" />
                <span>
                  Team members can apply beyond their balance. Excess days will be marked as Loss of Pay.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: ELIGIBILITY & DURATION (New Image 1) */}
      {currentStep === 3 && (
        <div className="bg-card border rounded-lg p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-6">
          <div className="pb-2 border-b">
            <h3 className="text-base font-bold text-foreground tracking-tight">
              Eligibility & Duration
            </h3>
          </div>

          <div className="space-y-6 text-xs">
            {/* 3 Dropdowns Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Applicable To */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">
                  Applicable To <span className="text-red-500">*</span>
                </label>
                <Select value={applicableTo} onValueChange={setApplicableTo}>
                  <SelectTrigger className="h-10 rounded-md text-xs bg-background font-medium">
                    <SelectValue placeholder="Applicable to" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Team Members">All Team Members</SelectItem>
                    <SelectItem value="Full Time Only">Full Time Only</SelectItem>
                    <SelectItem value="Probationary">Probationary</SelectItem>
                    <SelectItem value="Contractors">Contractors</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Departments */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">
                  Departments
                </label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger className="h-10 rounded-md text-xs bg-background font-medium">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Departments">All Departments</SelectItem>
                    {/* The app's departments (same list as User Management / member profiles). */}
                    {DEPARTMENTS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Employment Type */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">
                  Employment Type
                </label>
                <Select value={employmentType} onValueChange={setEmploymentType}>
                  <SelectTrigger className="h-10 rounded-md text-xs bg-background font-medium">
                    <SelectValue placeholder="All Employment Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Employment Types">All Employment Types</SelectItem>
                    {/* Same list as a member's Employment Type in User Management. */}
                    {EMPLOYMENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Minimum Service Period */}
            <div className="max-w-md space-y-1.5">
              <label className="font-semibold text-foreground">
                Minimum Service Period (Optional)
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  value={minServicePeriod}
                  onChange={(e) => setMinServicePeriod(Number(e.target.value))}
                  className="h-10 rounded-md text-xs bg-background w-32 font-semibold"
                />
                <Select value={minServiceUnit} onValueChange={setMinServiceUnit}>
                  <SelectTrigger className="h-10 rounded-md text-xs bg-background w-32 font-medium">
                    <SelectValue placeholder="Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Months">Months</SelectItem>
                    <SelectItem value="Days">Days</SelectItem>
                    <SelectItem value="Years">Years</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Allowed Durations */}
            <div className="space-y-3 pt-2">
              <div>
                <label className="font-semibold text-foreground">
                  Allowed Durations <span className="text-red-500">*</span>
                </label>
              </div>

              {/* 4 Selectable Duration Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Full Day */}
                <div
                  onClick={() =>
                    setDurations((prev) => ({ ...prev, fullDay: !prev.fullDay }))
                  }
                  className={cn(
                    "p-3.5 rounded-md border bg-background cursor-pointer transition-all space-y-1.5",
                    durations.fullDay
                      ? "ring-2 ring-primary border-primary bg-primary/5"
                      : "hover:border-primary/50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={durations.fullDay}
                      onChange={() => {}}
                      className="accent-primary rounded"
                    />
                    <Calendar className="w-4 h-4 text-primary" />
                    <span className="font-bold text-foreground text-xs">
                      Full Day
                    </span>
                  </div>
                </div>

                {/* 2. Half Day */}
                <div
                  onClick={() =>
                    setDurations((prev) => ({ ...prev, halfDay: !prev.halfDay }))
                  }
                  className={cn(
                    "p-3.5 rounded-md border bg-background cursor-pointer transition-all space-y-1.5",
                    durations.halfDay
                      ? "ring-2 ring-primary border-primary bg-primary/5"
                      : "hover:border-primary/50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={durations.halfDay}
                      onChange={() => {}}
                      className="accent-primary rounded"
                    />
                    <PieChart className="w-4 h-4 text-primary" />
                    <span className="font-bold text-foreground text-xs">
                      Half Day
                    </span>
                  </div>
                </div>

                {/* 3. Quarter Day */}
                <div
                  onClick={() =>
                    setDurations((prev) => ({ ...prev, quarterDay: !prev.quarterDay }))
                  }
                  className={cn(
                    "p-3.5 rounded-md border bg-background cursor-pointer transition-all space-y-1.5",
                    durations.quarterDay
                      ? "ring-2 ring-primary border-primary bg-primary/5"
                      : "hover:border-primary/50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={durations.quarterDay}
                      onChange={() => {}}
                      className="accent-primary rounded"
                    />
                    <PieChart className="w-4 h-4 text-muted-foreground" />
                    <span className="font-bold text-foreground text-xs">
                      Quarter Day
                    </span>
                  </div>
                </div>

                {/* 4. Hourly */}
                <div
                  onClick={() =>
                    setDurations((prev) => ({ ...prev, hourly: !prev.hourly }))
                  }
                  className={cn(
                    "p-3.5 rounded-md border bg-background cursor-pointer transition-all space-y-1.5",
                    durations.hourly
                      ? "ring-2 ring-primary border-primary bg-primary/5"
                      : "hover:border-primary/50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={durations.hourly}
                      onChange={() => {}}
                      className="accent-primary rounded"
                    />
                    <Clock className="w-4 h-4 text-primary" />
                    <span className="font-bold text-foreground text-xs">
                      Hourly
                    </span>
                  </div>
                </div>
              </div>

              {/* Info Notice */}
              <div className="flex items-center gap-2 p-3 bg-blue-50/80 dark:bg-accent border border-blue-100 dark:border-zinc-700/40 rounded-md text-xs text-blue-700 dark:text-blue-300">
                <Info className="w-4 h-4 shrink-0" />
                <span>
                  Team members will be able to request leave only in the selected duration types.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: APPLICATION RULES (New Image 2) */}
      {currentStep === 4 && (
        <div className="bg-card border rounded-lg p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-6">
          <div className="pb-2 border-b">
            <h3 className="text-base font-bold text-foreground tracking-tight">
              Application Rules
            </h3>
          </div>

          <div className="space-y-6 text-xs">
            {/* Card 1: Application Date Rules */}
            <div className="bg-card border rounded-lg p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-4">
              <h4 className="text-xs font-bold text-foreground">
                Application Date Rules
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Allow Past */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={allowPastDays}
                      onCheckedChange={setAllowPastDays}
                    />
                    <span className="font-semibold text-foreground flex items-center gap-1">
                      Allow up to
                      <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      value={pastDaysLimit}
                      onChange={(e) => setPastDaysLimit(Number(e.target.value))}
                      className="h-10 rounded-md text-xs bg-background w-24 font-semibold"
                      disabled={!allowPastDays}
                    />
                    <Select
                      value={pastDaysUnit}
                      onValueChange={setPastDaysUnit}
                      disabled={!allowPastDays}
                    >
                      <SelectTrigger className="h-10 rounded-md text-xs bg-background w-28 font-medium">
                        <SelectValue placeholder="Days" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Days">Days</SelectItem>
                        <SelectItem value="Weeks">Weeks</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Allow Advance */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={allowAdvanceDays}
                      onCheckedChange={setAllowAdvanceDays}
                    />
                    <span className="font-semibold text-foreground flex items-center gap-1">
                      Allow up to
                      <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      value={advanceDaysLimit}
                      onChange={(e) => setAdvanceDaysLimit(Number(e.target.value))}
                      className="h-10 rounded-md text-xs bg-background w-24 font-semibold"
                      disabled={!allowAdvanceDays}
                    />
                    <Select
                      value={advanceDaysUnit}
                      onValueChange={setAdvanceDaysUnit}
                      disabled={!allowAdvanceDays}
                    >
                      <SelectTrigger className="h-10 rounded-md text-xs bg-background w-28 font-medium">
                        <SelectValue placeholder="Days" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Days">Days</SelectItem>
                        <SelectItem value="Months">Months</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Minimum Advance Notice */}
                <div className="space-y-2">
                  <span className="font-semibold text-foreground flex items-center gap-1">
                    Minimum Advance Notice
                    <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-medium">At least</span>
                    <Input
                      type="number"
                      min={0}
                      value={minAdvanceNotice}
                      onChange={(e) => setMinAdvanceNotice(Number(e.target.value))}
                      className="h-10 rounded-md text-xs bg-background w-20 font-semibold"
                    />
                    <Select value={minAdvanceUnit} onValueChange={setMinAdvanceUnit}>
                      <SelectTrigger className="h-10 rounded-md text-xs bg-background w-28 font-medium">
                        <SelectValue placeholder="Days" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Days">Days</SelectItem>
                        <SelectItem value="Hours">Hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Leave Request Limits */}
            <div className="bg-card border rounded-lg p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-4">
              <h4 className="text-xs font-bold text-foreground">
                Leave Request Limits
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Min Leave Per Request */}
                <div className="space-y-1.5">
                  <span className="font-semibold text-foreground flex items-center gap-1">
                    Minimum Leave per Request
                    <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                  </span>
                  <div className="relative">
                    <Input
                      type="number"
                      step={0.5}
                      min={0}
                      value={minLeavePerRequest}
                      onChange={(e) => setMinLeavePerRequest(Number(e.target.value))}
                      className="h-10 pr-12 rounded-md text-xs bg-background font-semibold"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">
                      Days
                    </span>
                  </div>
                </div>

                {/* Max Leave Per Request */}
                <div className="space-y-1.5">
                  <span className="font-semibold text-foreground flex items-center gap-1">
                    Maximum Leave per Request
                    <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                  </span>
                  <div className="relative">
                    <Input
                      type="number"
                      min={1}
                      value={maxLeavePerRequest}
                      onChange={(e) => setMaxLeavePerRequest(Number(e.target.value))}
                      className="h-10 pr-12 rounded-md text-xs bg-background font-semibold"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">
                      Days
                    </span>
                  </div>
                </div>

                {/* Max Consecutive Days */}
                <div className="space-y-1.5">
                  <span className="font-semibold text-foreground flex items-center gap-1">
                    Maximum Consecutive Days
                    <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                  </span>
                  <div className="relative">
                    <Input
                      type="number"
                      min={1}
                      value={maxConsecutiveDays}
                      onChange={(e) => setMaxConsecutiveDays(Number(e.target.value))}
                      className="h-10 pr-12 rounded-md text-xs bg-background font-semibold"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">
                      Days
                    </span>
                  </div>
                </div>

                {/* Min Gap Between Requests */}
                <div className="space-y-1.5">
                  <span className="font-semibold text-foreground flex items-center gap-1">
                    Minimum Gap Between Requests
                    <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                  </span>
                  <div className="relative">
                    <Input
                      type="number"
                      min={0}
                      value={minGapBetweenRequests}
                      onChange={(e) => setMinGapBetweenRequests(Number(e.target.value))}
                      className="h-10 pr-12 rounded-md text-xs bg-background font-semibold"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">
                      Days
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: Two Column Box */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Left: Maximum Number of Requests */}
              <div className="bg-card border rounded-lg p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-3">
                <span className="font-bold text-foreground flex items-center gap-1 text-xs">
                  Maximum Number of Requests
                  <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                </span>

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-muted-foreground text-xs font-medium">
                    A team member can make
                  </span>
                  <Input
                    type="number"
                    min={1}
                    value={maxRequestsCount}
                    onChange={(e) => setMaxRequestsCount(Number(e.target.value))}
                    className="h-10 rounded-md text-xs bg-background w-16 text-center font-semibold"
                  />
                  <span className="text-muted-foreground text-xs font-medium">
                    request(s)
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-muted-foreground text-xs font-medium">
                    within
                  </span>
                  <Select
                    value={maxRequestsPeriod}
                    onValueChange={setMaxRequestsPeriod}
                  >
                    <SelectTrigger className="h-10 rounded-md text-xs bg-background w-32 font-medium">
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Month">Month</SelectItem>
                      {/* No "Quarter": the database has no quarter unit, so it used to save as Month. */}
                      <SelectItem value="Year">Year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

              </div>

              {/* Right: Days chips */}
              <div className="bg-card border rounded-lg p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-3">
                <span className="font-bold text-foreground flex items-center gap-1 text-xs">
                  This leave can be applied only on
                  <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                </span>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => {
                    const isSelected = applicableDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={cn(
                          "px-3 py-1.5 rounded-md border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer",
                          isSelected
                            ? "bg-primary/5 border-primary text-primary shadow-2xs"
                            : "bg-background border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <span>{day}</span>
                        {isSelected ? (
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        ) : (
                          <span className="w-3.5 h-3.5 border border-muted-foreground/40 rounded-sm inline-block" />
                        )}
                      </button>
                    );
                  })}
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 5: POLICIES & DOCUMENTS (New Image 4) */}
      {currentStep === 5 && (
        <div className="bg-card border rounded-lg p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-6">
          <div className="pb-2 border-b">
            <h3 className="text-base font-bold text-foreground tracking-tight">
              Policies & Documents
            </h3>
          </div>

          <div className="space-y-6 text-xs">
            {/* Card 1: Sandwich & Clubbing Policies */}
            <div className="bg-card border rounded-lg p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: Sandwich Leave Policy */}
              <div className="space-y-4">
                <span className="font-bold text-foreground flex items-center gap-1 text-xs">
                  Sandwich Leave Policy
                  <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                </span>

                <div className="flex items-center gap-3">
                  <Switch
                    checked={sandwichPolicy}
                    onCheckedChange={setSandwichPolicy}
                  />
                  <span className="font-medium text-foreground">
                    Enable sandwich leave policy
                  </span>
                </div>

                {sandwichPolicy && (
                  <div className="space-y-2 pt-1">
                    <span className="text-xs font-semibold text-muted-foreground">
                      Applies to
                    </span>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sandwichWeekends}
                          onChange={(e) => setSandwichWeekends(e.target.checked)}
                          className="accent-primary rounded"
                        />
                        <span className="font-medium text-foreground">Weekends</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sandwichHolidays}
                          onChange={(e) => setSandwichHolidays(e.target.checked)}
                          className="accent-primary rounded"
                        />
                        <span className="font-medium text-foreground">
                          Company Holidays
                        </span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Clubbing Policy */}
              <div className="space-y-3">
                <span className="font-bold text-foreground flex items-center gap-1 text-xs">
                  Clubbing Policy
                  <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                </span>

                <Select onValueChange={(val) => {
                  if (!clubbingLeaveTypes.includes(val)) {
                    setClubbingLeaveTypes([...clubbingLeaveTypes, val]);
                  }
                }}>
                  <SelectTrigger className="h-10 rounded-md text-xs bg-background">
                    <SelectValue placeholder="Select leave types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sick Leave">Sick Leave</SelectItem>
                    <SelectItem value="Casual Leave">Casual Leave</SelectItem>
                    <SelectItem value="Compensatory Off">Compensatory Off</SelectItem>
                    <SelectItem value="Paid Leave">Paid Leave</SelectItem>
                    <SelectItem value="Maternity Leave">Maternity Leave</SelectItem>
                  </SelectContent>
                </Select>

                {/* Selected Tags */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {clubbingLeaveTypes.map((type) => (
                    <span
                      key={type}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-accent dark:text-blue-300 border border-blue-200 dark:border-zinc-700"
                    >
                      <span>{type}</span>
                      <button
                        type="button"
                        onClick={() => removeClubbingType(type)}
                        className="hover:text-foreground"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

              </div>
            </div>

            {/* Card 2: Supporting Documents & File Types */}
            <div className="bg-card border rounded-lg p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: Supporting Document Policy */}
              <div className="space-y-4">
                <span className="font-bold text-foreground flex items-center gap-1 text-xs">
                  Supporting Document Policy
                  <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                </span>

                {/* 3 Radio options */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Not Required */}
                  <div
                    onClick={() => setSupportingDocPolicy("NOT_REQUIRED")}
                    className={cn(
                      "p-3 rounded-md border bg-background cursor-pointer transition-all space-y-1",
                      supportingDocPolicy === "NOT_REQUIRED"
                        ? "ring-2 ring-primary border-primary bg-primary/5"
                        : "hover:border-primary/50"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="docPolicy"
                        checked={supportingDocPolicy === "NOT_REQUIRED"}
                        onChange={() => setSupportingDocPolicy("NOT_REQUIRED")}
                        className="accent-primary"
                      />
                      <span className="font-bold text-foreground text-xs">
                        Not Required
                      </span>
                    </div>
                  </div>

                  {/* Always Required */}
                  <div
                    onClick={() => setSupportingDocPolicy("ALWAYS")}
                    className={cn(
                      "p-3 rounded-md border bg-background cursor-pointer transition-all space-y-1",
                      supportingDocPolicy === "ALWAYS"
                        ? "ring-2 ring-primary border-primary bg-primary/5"
                        : "hover:border-primary/50"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="docPolicy"
                        checked={supportingDocPolicy === "ALWAYS"}
                        onChange={() => setSupportingDocPolicy("ALWAYS")}
                        className="accent-primary"
                      />
                      <span className="font-bold text-foreground text-xs">
                        Always Required
                      </span>
                    </div>
                  </div>

                  {/* Required when exceeds */}
                  <div
                    onClick={() => setSupportingDocPolicy("EXCEEDS")}
                    className={cn(
                      "p-3 rounded-md border bg-background cursor-pointer transition-all space-y-1.5",
                      supportingDocPolicy === "EXCEEDS"
                        ? "ring-2 ring-primary border-primary bg-primary/5"
                        : "hover:border-primary/50"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="docPolicy"
                        checked={supportingDocPolicy === "EXCEEDS"}
                        onChange={() => setSupportingDocPolicy("EXCEEDS")}
                        className="accent-primary"
                      />
                      <span className="font-bold text-foreground text-xs leading-tight">
                        Required when leave exceeds
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 pl-5 pt-0.5">
                      <Input
                        type="number"
                        min={1}
                        value={docExceedsDays}
                        onChange={(e) => setDocExceedsDays(Number(e.target.value))}
                        className="h-8 w-12 text-center text-xs p-1 rounded-lg bg-background font-semibold"
                        disabled={supportingDocPolicy !== "EXCEEDS"}
                      />
                      <Select
                        value={docExceedsUnit}
                        onValueChange={setDocExceedsUnit}
                        disabled={supportingDocPolicy !== "EXCEEDS"}
                      >
                        <SelectTrigger className="h-8 rounded-lg text-xs bg-background w-20">
                          <SelectValue placeholder="Days" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Days">Days</SelectItem>
                          <SelectItem value="Hours">Hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Banner notice */}
                <div className="flex items-center gap-2 p-3 bg-blue-50/80 dark:bg-accent border border-blue-100 dark:border-zinc-700/40 rounded-md text-xs text-blue-700 dark:text-blue-300">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>
                    Team members must upload a supporting document if the applied leave period exceeds the specified number of days.
                  </span>
                </div>
              </div>

              {/* Right: Accepted File Types */}
              <div className="space-y-4">
                <span className="font-bold text-foreground flex items-center gap-1 text-xs">
                  Accepted File Types
                  <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                </span>

                {/* File Types select & pills */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    File Types
                  </span>
                  <div className="p-2 border rounded-md bg-background flex flex-wrap items-center gap-2">
                    {acceptedFileTypes.map((type) => (
                      <span
                        key={type}
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-accent dark:text-blue-300 border border-blue-200 dark:border-zinc-700"
                      >
                        <span>{type}</span>
                        <button
                          type="button"
                          onClick={() => removeFileType(type)}
                          className="hover:text-foreground"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Max file size */}
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Max File Size
                  </span>
                  <Select value={maxFileSize} onValueChange={setMaxFileSize}>
                    <SelectTrigger className="h-10 rounded-md text-xs bg-background font-medium">
                      <SelectValue placeholder="Size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2 MB">2 MB</SelectItem>
                      <SelectItem value="5 MB">5 MB</SelectItem>
                      <SelectItem value="10 MB">10 MB</SelectItem>
                      <SelectItem value="25 MB">25 MB</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 6: APPROVAL & VISIBILITY / REVIEW & CREATE (New Image 3) */}
      {currentStep === 6 && (
        <div className="bg-card border rounded-lg p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-6">
          <div className="pb-2 border-b">
            <h3 className="text-base font-bold text-foreground tracking-tight">
              Approval & Visibility
            </h3>
          </div>

          <div className="space-y-6 text-xs">
            {/* Card 1: Approval Settings & Allow Admin on Behalf */}
            <div className="bg-card border rounded-lg p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: Approval Settings */}
              <div className="space-y-4">
                <span className="font-bold text-foreground text-xs">
                  Approval Settings
                </span>

                <div className="flex items-center gap-3">
                  <Switch
                    checked={managerApprovalRequired}
                    onCheckedChange={setManagerApprovalRequired}
                  />
                  <span className="font-medium text-foreground">
                    Manager Approval Required
                  </span>
                </div>

                {managerApprovalRequired && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-xs font-semibold text-muted-foreground">
                      Approval Flow
                    </span>
                    <Select value={approvalFlow} onValueChange={setApprovalFlow}>
                      <SelectTrigger className="h-10 rounded-md text-xs bg-background font-medium">
                        <SelectValue placeholder="Select approval flow" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Team Member's Direct Manager">
                          Team Member&apos;s Direct Manager
                        </SelectItem>
                        <SelectItem value="Department Head">
                          Department Head
                        </SelectItem>
                        <SelectItem value="HR Admin">HR Admin</SelectItem>
                        <SelectItem value="Custom 2-Step Approval">
                          Custom 2-Step Approval
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Right: Allow Admin to Apply on Behalf */}
              <div className="space-y-3">
                <span className="font-bold text-foreground text-xs">
                  Allow Admin to Apply on Behalf
                </span>

                <div className="flex items-center gap-3 pt-1">
                  <Switch
                    checked={allowAdminApplyOnBehalf}
                    onCheckedChange={setAllowAdminApplyOnBehalf}
                  />
                  <span className="font-medium text-foreground">
                    Allow administrators to apply this leave on a team member&apos;s behalf.
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Employee Leave Visibility */}
            <div className="bg-card border rounded-lg p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-4">
              <div>
                <h4 className="text-xs font-bold text-foreground">
                  Team Member Leave Visibility
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left: Preferences */}
                <div className="space-y-4">
                  {/* Allow employees to view */}
                  <div className="space-y-1.5">
                    <span className="font-semibold text-foreground">
                      Allow team members to view
                    </span>
                    <Select
                      value={employeeVisibility}
                      onValueChange={setEmployeeVisibility}
                    >
                      <SelectTrigger className="h-10 rounded-md text-xs bg-background font-medium">
                        <SelectValue placeholder="Visibility" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Complete Leave Summary">
                          Complete Leave Summary
                        </SelectItem>
                        <SelectItem value="Remaining Balance Only">
                          Remaining Balance Only
                        </SelectItem>
                        <SelectItem value="Hide in Self Service">
                          Hide in Self Service
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Balance Display Preference */}
                  <div className="space-y-1.5">
                    <span className="font-semibold text-foreground">
                      Balance Display Preference
                    </span>
                    <Select
                      value={balanceDisplayPreference}
                      onValueChange={setBalanceDisplayPreference}
                    >
                      <SelectTrigger className="h-10 rounded-md text-xs bg-background font-medium">
                        <SelectValue placeholder="Preference" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Leave request's start date">
                          Leave request&apos;s start date
                        </SelectItem>
                        <SelectItem value="Current date">Current date</SelectItem>
                        <SelectItem value="Year end projection">
                          Year end projection
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Right: Blue Callout Card */}
                <div className="p-4 rounded-md bg-blue-50/70 dark:bg-accent border border-blue-100 dark:border-zinc-700/50 space-y-2 flex flex-col justify-center">
                  <div className="flex items-center gap-2 text-primary font-bold text-xs">
                    <Info className="w-4 h-4 text-primary shrink-0" />
                    <span>About Balance Display</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    This setting determines the date on which the leave balance is calculated and shown in reports.
                  </p>
                  <p className="text-xs text-primary/90 font-medium">
                    <strong className="text-foreground">Example:</strong> If a team member has applied leave for 10th June, balance will be shown as on 10th June.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {submitError && (
        <div className="px-4 py-3 rounded-md bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs font-medium text-rose-700 dark:text-rose-300">
          {submitError}
        </div>
      )}

      {/* Footer Navigation Bar */}
      <div className="bg-card border rounded-lg p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={handleBack}
          className="h-10 px-6 rounded-lg text-xs font-semibold gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </Button>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
          <Cloud className="w-4 h-4 text-blue-500" />
          <span>Draft saved just now</span>
        </div>

        <Button
          type="button"
          disabled={isSubmitting}
          onClick={handleNext}
          className="h-10 px-8 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] gap-1.5"
        >
          <span>
            {isSubmitting
              ? isEdit
                ? "Saving..."
                : "Creating..."
              : currentStep === 6
              ? isEdit
                ? "Save Changes"
                : "Review & Create"
              : "Save & Next"}
          </span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </div>
      {/* Icon & Color Theme Picker Dialog Modal */}
      {isIconModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setIsIconModalOpen(false)}
        >
          <div
            className="bg-card border rounded-lg shadow-2xl max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 duration-150 text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Choose Icon & Color Theme
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsIconModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 pt-1 text-xs">
              {/* Live Preview Box */}
              <div className="flex items-center justify-between p-3.5 rounded-md border bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className={cn("w-12 h-12 rounded-md flex items-center justify-center border shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all", currentColor.bg, currentColor.text, currentColor.border)}>
                    {renderIconComponent(selectedIcon, "w-6 h-6")}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-foreground">
                      {leaveTypeName || "Leave Type"} {leaveCode ? `(${leaveCode})` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Preview: <span className="font-semibold text-foreground">{selectedIcon}</span> with <span className="font-semibold text-foreground">{currentColor.label}</span> badge
                    </div>
                  </div>
                </div>
              </div>

              {/* Select Icon Grid */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">
                    Select Icon
                  </label>
                  <span className="text-xs font-medium text-primary">
                    {selectedIcon}
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto p-1.5 scrollbar-thin border rounded-md bg-background/50">
                  {AVAILABLE_ICONS.map((item) => {
                    const IconComp = item.component;
                    const isSelected = selectedIcon === item.name;
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => setSelectedIcon(item.name)}
                        className={cn(
                          "h-12 rounded-md flex flex-col items-center justify-center gap-1 border transition-all cursor-pointer",
                          isSelected
                            ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/40 shadow-xs"
                            : "border-border/60 hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                        )}
                        title={item.label}
                      >
                        <IconComp className="w-5 h-5" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Select Color Theme */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">
                    Select Color Theme
                  </label>
                  <span className="text-xs font-medium text-primary">
                    {currentColor.label}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {COLOR_THEMES.map((theme) => {
                    const isSelected = selectedColorTheme === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => setSelectedColorTheme(theme.id)}
                        className={cn(
                          "flex items-center gap-1.5 p-2 rounded-md border text-xs font-medium transition-all cursor-pointer",
                          theme.bg,
                          theme.text,
                          isSelected
                            ? "ring-2 ring-primary border-primary font-bold shadow-xs scale-102"
                            : "border-border/60 opacity-80 hover:opacity-100"
                        )}
                      >
                        <span className="w-2.5 h-2.5 rounded-full border shrink-0" style={{ backgroundColor: "currentColor" }} />
                        <span className="text-xs truncate">{theme.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3">
                <Button
                  type="button"
                  onClick={() => setIsIconModalOpen(false)}
                  className="w-full h-10 rounded-md text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                >
                  Apply & Done
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
