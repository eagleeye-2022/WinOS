"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronRight,
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
import { cn } from "@/lib/utils";

interface CreateLeaveTypeWizardProps {
  onCancel?: () => void;
  onSuccess?: () => void;
}

export function CreateLeaveTypeWizard({
  onCancel,
  onSuccess,
}: CreateLeaveTypeWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);

  // STEP 1: Basic Information
  const [leaveTypeName, setLeaveTypeName] = useState("Sick Leave");
  const [leaveCode, setLeaveCode] = useState("SL");
  const [status, setStatus] = useState("Active");
  const [description, setDescription] = useState(
    "Leave granted to employees when they are not feeling well and unable to attend work."
  );
  const [effectiveDate, setEffectiveDate] = useState("2025-06-01");
  const [expiryDate, setExpiryDate] = useState("");

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
  const [yearEndDate, setYearEndDate] = useState("2025-12-31");

  // STEP 3: Eligibility & Duration
  const [applicableTo, setApplicableTo] = useState("All Employees");
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
    "Employee's Direct Manager"
  );
  const [allowAdminApplyOnBehalf, setAllowAdminApplyOnBehalf] = useState(true);
  const [employeeVisibility, setEmployeeVisibility] = useState(
    "Complete Leave Summary"
  );
  const [balanceDisplayPreference, setBalanceDisplayPreference] = useState(
    "Leave request's start date"
  );

  const steps = [
    { number: 1, title: "Basic Information" },
    { number: 2, title: "Leave & Balance Setup" },
    { number: 3, title: "Eligibility & Duration" },
    { number: 4, title: "Application Rules" },
    { number: 5, title: "Policies & Documents" },
    { number: 6, title: "Review & Create" },
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

  const handleNext = () => {
    if (currentStep < 6) {
      setCurrentStep(currentStep + 1);
    } else {
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/pulse/leave/team");
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

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16 select-none">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <nav className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Link
              href="/pulse/leave/team"
              className="text-primary hover:underline hover:text-primary/80 transition-colors"
            >
              Leave Tracker
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
            <Link
              href="/pulse/leave/team"
              className="text-primary hover:underline hover:text-primary/80 transition-colors"
            >
              Leave Types
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
            <span className="text-foreground">Create New Leave Type</span>
          </nav>

          <div className="pt-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Create New Leave Type
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configure a new leave type and set the rules for allocation and application.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => (onCancel ? onCancel() : router.push("/pulse/leave/team"))}
          className="h-9 px-4 rounded-xl text-xs font-semibold gap-1.5 self-start sm:self-auto"
        >
          <X className="w-4 h-4" />
          <span>Cancel</span>
        </Button>
      </div>

      {/* 6-Step Stepper Bar */}
      <div className="bg-card border rounded-2xl p-4 shadow-2xs">
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
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-2xs",
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
                      "text-[11px] font-semibold text-center hidden md:block max-w-[120px] leading-tight",
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
        <div className="bg-card border rounded-2xl p-6 shadow-2xs space-y-6">
          <div className="pb-2 border-b">
            <h3 className="text-base font-bold text-foreground tracking-tight">
              Basic Information
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Provide the basic details of the leave type.
            </p>
          </div>

          <div className="space-y-5 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Leave Type Name */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">
                  Leave Type Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={leaveTypeName}
                  onChange={(e) => setLeaveTypeName(e.target.value)}
                  placeholder="e.g. Sick Leave"
                  className="h-10 rounded-xl text-xs bg-background font-medium"
                  required
                />
                <p className="text-[10px] text-muted-foreground">
                  Enter a clear and unique name for the leave type.
                </p>
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
                  className="h-10 rounded-xl text-xs bg-background font-medium"
                  required
                />
                <p className="text-[10px] text-muted-foreground">
                  Short code / abbreviation (e.g. SL).
                </p>
              </div>

              {/* Icon */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">
                  Icon <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
                    <Thermometer className="w-5 h-5" />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 flex-1 rounded-xl text-xs font-semibold gap-1.5 text-primary border-primary/30"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Change Icon</span>
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Choose an icon that represents this leave.
                </p>
              </div>
            </div>

            {/* Status */}
            <div className="max-w-md space-y-1.5">
              <label className="font-semibold text-foreground">
                Status <span className="text-red-500">*</span>
              </label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-10 rounded-xl text-xs bg-background font-medium">
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
              <p className="text-[10px] text-muted-foreground">
                Only active leave types are available for employees.
              </p>
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
                className="min-h-[80px] text-xs resize-none bg-background rounded-xl p-3"
              />
              <p className="text-[10px] text-muted-foreground">
                Provide a short description of this leave type.
              </p>
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
                  className="h-10 rounded-xl text-xs bg-background"
                  required
                />
                <p className="text-[10px] text-muted-foreground">
                  From when this leave type will be available.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">
                  Expiry Date (Optional)
                </label>
                <Input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="h-10 rounded-xl text-xs bg-background"
                />
                <p className="text-[10px] text-muted-foreground">
                  Leave blank if there is no expiry.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: LEAVE & BALANCE SETUP (Image 3) */}
      {currentStep === 2 && (
        <div className="bg-card border rounded-2xl p-6 shadow-2xs space-y-6">
          <div className="pb-2 border-b">
            <h3 className="text-base font-bold text-foreground tracking-tight">
              Leave & Balance Setup
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Define allocation, balance rules and how excess leaves will be handled.
            </p>
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
                  <SelectTrigger className="h-10 rounded-xl text-xs bg-background">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Unpaid">Unpaid</SelectItem>
                    <SelectItem value="Partially Paid">Partially Paid</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  Type of leave and its payment nature.
                </p>
              </div>

              {/* Allocation Frequency */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">
                  Allocation Frequency <span className="text-red-500">*</span>
                </label>
                <Select value={allocationFreq} onValueChange={setAllocationFreq}>
                  <SelectTrigger className="h-10 rounded-xl text-xs bg-background">
                    <SelectValue placeholder="Frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                    <SelectItem value="Quarterly">Quarterly</SelectItem>
                    <SelectItem value="Yearly">Yearly</SelectItem>
                    <SelectItem value="On-Demand">On-Demand</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  How often the leave will be allocated.
                </p>
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
                    className="h-10 pr-12 rounded-xl text-xs bg-background font-semibold"
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-xs">
                    Days
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Total number of leave days in a year.
                </p>
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
                <p className="text-[10px] text-muted-foreground">
                  Employees can carry forward remaining balance.
                </p>
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
                    className="h-10 pr-12 rounded-xl text-xs bg-background font-semibold"
                    disabled={!allowCarryForward}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-xs">
                    Days
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Maximum days that can be carried forward.
                </p>
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
                  <SelectTrigger className="h-10 rounded-xl text-xs bg-background">
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
                <p className="text-[10px] text-muted-foreground">
                  What happens to balance at the end of the year.
                </p>
              </div>
            </div>

            {/* Exceeded Leave Entitlement Card */}
            <div className="bg-muted/30 border rounded-2xl p-5 space-y-4">
              <div>
                <h4 className="text-xs font-bold text-foreground">
                  Exceeded Leave Entitlement
                </h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Define how to manage leave requests that exceed the entitled balance.
                </p>
              </div>

              {/* 4 Option Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Do not allow */}
                <div
                  onClick={() => setExcessOption("DO_NOT_ALLOW")}
                  className={cn(
                    "p-3.5 rounded-xl border bg-background cursor-pointer transition-all space-y-1.5",
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
                  <p className="text-[10px] text-muted-foreground pl-5 leading-tight">
                    Employees cannot apply when balance is 0.
                  </p>
                </div>

                {/* 2. Allow without limit */}
                <div
                  onClick={() => setExcessOption("WITHOUT_LIMIT")}
                  className={cn(
                    "p-3.5 rounded-xl border bg-background cursor-pointer transition-all space-y-1.5",
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
                  <p className="text-[10px] text-muted-foreground pl-5 leading-tight">
                    Allow leave requests even if balance is 0.
                  </p>
                </div>

                {/* 3. Allow until year end limit */}
                <div
                  onClick={() => setExcessOption("YEAR_END")}
                  className={cn(
                    "p-3.5 rounded-xl border bg-background cursor-pointer transition-all space-y-1.5",
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
                  <p className="text-[10px] text-muted-foreground pl-5 leading-tight">
                    Allow extra leaves up to year end limit.
                  </p>
                </div>

                {/* 4. Mark excess as LOP */}
                <div
                  onClick={() => setExcessOption("LOP")}
                  className={cn(
                    "p-3.5 rounded-xl border bg-background cursor-pointer transition-all space-y-1.5",
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
                  <p className="text-[10px] text-muted-foreground pl-5 leading-tight">
                    Excess leaves will be marked as Loss of Pay (LOP).
                  </p>
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
                  className="h-10 rounded-xl text-xs bg-background"
                />
                <p className="text-[10px] text-muted-foreground">
                  Year end date for entitlement calculation.
                </p>
              </div>

              {/* Info Notice Banner */}
              <div className="flex items-center gap-2 p-3 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-xl text-xs text-blue-700 dark:text-blue-300">
                <Info className="w-4 h-4 shrink-0" />
                <span>
                  Employees can apply beyond their balance. Excess days will be marked as Loss of Pay.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: ELIGIBILITY & DURATION (New Image 1) */}
      {currentStep === 3 && (
        <div className="bg-card border rounded-2xl p-6 shadow-2xs space-y-6">
          <div className="pb-2 border-b">
            <h3 className="text-base font-bold text-foreground tracking-tight">
              Eligibility & Duration
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Define who can apply for this leave and the type of leave duration allowed.
            </p>
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
                  <SelectTrigger className="h-10 rounded-xl text-xs bg-background font-medium">
                    <SelectValue placeholder="Applicable to" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Employees">All Employees</SelectItem>
                    <SelectItem value="Full Time Only">Full Time Only</SelectItem>
                    <SelectItem value="Probationary">Probationary</SelectItem>
                    <SelectItem value="Contractors">Contractors</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  Select the employees who can apply for this leave.
                </p>
              </div>

              {/* Departments */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">
                  Departments
                </label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger className="h-10 rounded-xl text-xs bg-background font-medium">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Departments">All Departments</SelectItem>
                    <SelectItem value="Engineering">Engineering</SelectItem>
                    <SelectItem value="Product">Product</SelectItem>
                    <SelectItem value="Design">Design</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                    <SelectItem value="HR">HR</SelectItem>
                    <SelectItem value="Finance">Finance</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  Select specific departments (optional).
                </p>
              </div>

              {/* Employment Type */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">
                  Employment Type
                </label>
                <Select value={employmentType} onValueChange={setEmploymentType}>
                  <SelectTrigger className="h-10 rounded-xl text-xs bg-background font-medium">
                    <SelectValue placeholder="All Employment Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Employment Types">All Employment Types</SelectItem>
                    <SelectItem value="Permanent">Permanent</SelectItem>
                    <SelectItem value="Intern">Intern</SelectItem>
                    <SelectItem value="Contract">Contract</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  Select employment types (optional).
                </p>
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
                  className="h-10 rounded-xl text-xs bg-background w-32 font-semibold"
                />
                <Select value={minServiceUnit} onValueChange={setMinServiceUnit}>
                  <SelectTrigger className="h-10 rounded-xl text-xs bg-background w-32 font-medium">
                    <SelectValue placeholder="Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Months">Months</SelectItem>
                    <SelectItem value="Days">Days</SelectItem>
                    <SelectItem value="Years">Years</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Employees must complete this service period to be eligible for this leave.
              </p>
            </div>

            {/* Allowed Durations */}
            <div className="space-y-3 pt-2">
              <div>
                <label className="font-semibold text-foreground">
                  Allowed Durations <span className="text-red-500">*</span>
                </label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Choose the duration types that employees can request for this leave.
                </p>
              </div>

              {/* 4 Selectable Duration Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Full Day */}
                <div
                  onClick={() =>
                    setDurations((prev) => ({ ...prev, fullDay: !prev.fullDay }))
                  }
                  className={cn(
                    "p-3.5 rounded-xl border bg-background cursor-pointer transition-all space-y-1.5",
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
                  <p className="text-[10px] text-muted-foreground pl-6 leading-tight">
                    Employees can apply for full day leave.
                  </p>
                </div>

                {/* 2. Half Day */}
                <div
                  onClick={() =>
                    setDurations((prev) => ({ ...prev, halfDay: !prev.halfDay }))
                  }
                  className={cn(
                    "p-3.5 rounded-xl border bg-background cursor-pointer transition-all space-y-1.5",
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
                  <p className="text-[10px] text-muted-foreground pl-6 leading-tight">
                    Employees can apply for half day leave.
                  </p>
                </div>

                {/* 3. Quarter Day */}
                <div
                  onClick={() =>
                    setDurations((prev) => ({ ...prev, quarterDay: !prev.quarterDay }))
                  }
                  className={cn(
                    "p-3.5 rounded-xl border bg-background cursor-pointer transition-all space-y-1.5",
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
                  <p className="text-[10px] text-muted-foreground pl-6 leading-tight">
                    Employees can apply for quarter day leave.
                  </p>
                </div>

                {/* 4. Hourly */}
                <div
                  onClick={() =>
                    setDurations((prev) => ({ ...prev, hourly: !prev.hourly }))
                  }
                  className={cn(
                    "p-3.5 rounded-xl border bg-background cursor-pointer transition-all space-y-1.5",
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
                  <p className="text-[10px] text-muted-foreground pl-6 leading-tight">
                    Employees can apply for leave in hours.
                  </p>
                </div>
              </div>

              {/* Info Notice */}
              <div className="flex items-center gap-2 p-3 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-xl text-xs text-blue-700 dark:text-blue-300">
                <Info className="w-4 h-4 shrink-0" />
                <span>
                  Employees will be able to request leave only in the selected duration types.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: APPLICATION RULES (New Image 2) */}
      {currentStep === 4 && (
        <div className="bg-card border rounded-2xl p-6 shadow-2xs space-y-6">
          <div className="pb-2 border-b">
            <h3 className="text-base font-bold text-foreground tracking-tight">
              Application Rules
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Define when and how employees can apply for this leave.
            </p>
          </div>

          <div className="space-y-6 text-xs">
            {/* Card 1: Application Date Rules */}
            <div className="bg-card border rounded-2xl p-5 shadow-2xs space-y-4">
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
                      className="h-10 rounded-xl text-xs bg-background w-24 font-semibold"
                      disabled={!allowPastDays}
                    />
                    <Select
                      value={pastDaysUnit}
                      onValueChange={setPastDaysUnit}
                      disabled={!allowPastDays}
                    >
                      <SelectTrigger className="h-10 rounded-xl text-xs bg-background w-28 font-medium">
                        <SelectValue placeholder="Days" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Days">Days</SelectItem>
                        <SelectItem value="Weeks">Weeks</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Employees can apply for leave in the past.
                  </p>
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
                      className="h-10 rounded-xl text-xs bg-background w-24 font-semibold"
                      disabled={!allowAdvanceDays}
                    />
                    <Select
                      value={advanceDaysUnit}
                      onValueChange={setAdvanceDaysUnit}
                      disabled={!allowAdvanceDays}
                    >
                      <SelectTrigger className="h-10 rounded-xl text-xs bg-background w-28 font-medium">
                        <SelectValue placeholder="Days" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Days">Days</SelectItem>
                        <SelectItem value="Months">Months</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Employees can apply for leave in advance.
                  </p>
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
                      className="h-10 rounded-xl text-xs bg-background w-20 font-semibold"
                    />
                    <Select value={minAdvanceUnit} onValueChange={setMinAdvanceUnit}>
                      <SelectTrigger className="h-10 rounded-xl text-xs bg-background w-28 font-medium">
                        <SelectValue placeholder="Days" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Days">Days</SelectItem>
                        <SelectItem value="Hours">Hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Notice required before the leave start date.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 2: Leave Request Limits */}
            <div className="bg-card border rounded-2xl p-5 shadow-2xs space-y-4">
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
                      className="h-10 pr-12 rounded-xl text-xs bg-background font-semibold"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">
                      Days
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Smallest leave duration allowed.
                  </p>
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
                      className="h-10 pr-12 rounded-xl text-xs bg-background font-semibold"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">
                      Days
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Largest leave duration allowed per request.
                  </p>
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
                      className="h-10 pr-12 rounded-xl text-xs bg-background font-semibold"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">
                      Days
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Maximum consecutive days allowed.
                  </p>
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
                      className="h-10 pr-12 rounded-xl text-xs bg-background font-semibold"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">
                      Days
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Minimum gap between two requests.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 3: Two Column Box */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Left: Maximum Number of Requests */}
              <div className="bg-card border rounded-2xl p-5 shadow-2xs space-y-3">
                <span className="font-bold text-foreground flex items-center gap-1 text-xs">
                  Maximum Number of Requests
                  <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                </span>

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-muted-foreground text-xs font-medium">
                    An employee can make
                  </span>
                  <Input
                    type="number"
                    min={1}
                    value={maxRequestsCount}
                    onChange={(e) => setMaxRequestsCount(Number(e.target.value))}
                    className="h-10 rounded-xl text-xs bg-background w-16 text-center font-semibold"
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
                    <SelectTrigger className="h-10 rounded-xl text-xs bg-background w-32 font-medium">
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Month">Month</SelectItem>
                      <SelectItem value="Quarter">Quarter</SelectItem>
                      <SelectItem value="Year">Year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <p className="text-[10px] text-muted-foreground pt-1">
                  Limit the number of leave requests within the selected period.
                </p>
              </div>

              {/* Right: Days chips */}
              <div className="bg-card border rounded-2xl p-5 shadow-2xs space-y-3">
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
                          "px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer",
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

                <p className="text-[10px] text-muted-foreground pt-2">
                  Select the days of the week when this leave can be applied.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 5: POLICIES & DOCUMENTS (New Image 4) */}
      {currentStep === 5 && (
        <div className="bg-card border rounded-2xl p-6 shadow-2xs space-y-6">
          <div className="pb-2 border-b">
            <h3 className="text-base font-bold text-foreground tracking-tight">
              Policies & Documents
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configure special policies and document requirements for this leave type.
            </p>
          </div>

          <div className="space-y-6 text-xs">
            {/* Card 1: Sandwich & Clubbing Policies */}
            <div className="bg-card border rounded-2xl p-5 shadow-2xs grid grid-cols-1 md:grid-cols-2 gap-6">
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
                <p className="text-[10px] text-muted-foreground">
                  Weekends and company holidays between the leave period will be counted as leave.
                </p>

                {sandwichPolicy && (
                  <div className="space-y-2 pt-1">
                    <span className="text-[11px] font-semibold text-muted-foreground">
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
                <p className="text-[10px] text-muted-foreground">
                  Select leave types that cannot be taken together with this leave.
                </p>

                <Select onValueChange={(val) => {
                  if (!clubbingLeaveTypes.includes(val)) {
                    setClubbingLeaveTypes([...clubbingLeaveTypes, val]);
                  }
                }}>
                  <SelectTrigger className="h-10 rounded-xl text-xs bg-background">
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
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                    >
                      <span>{type}</span>
                      <button
                        type="button"
                        onClick={() => removeClubbingType(type)}
                        className="hover:text-blue-900 dark:hover:text-blue-100"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                <p className="text-[10px] text-muted-foreground">
                  Employees cannot take this leave along with the selected leave types.
                </p>
              </div>
            </div>

            {/* Card 2: Supporting Documents & File Types */}
            <div className="bg-card border rounded-2xl p-5 shadow-2xs grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: Supporting Document Policy */}
              <div className="space-y-4">
                <span className="font-bold text-foreground flex items-center gap-1 text-xs">
                  Supporting Document Policy
                  <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                </span>
                <p className="text-[10px] text-muted-foreground">
                  Define when employees need to upload supporting documents.
                </p>

                {/* 3 Radio options */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Not Required */}
                  <div
                    onClick={() => setSupportingDocPolicy("NOT_REQUIRED")}
                    className={cn(
                      "p-3 rounded-xl border bg-background cursor-pointer transition-all space-y-1",
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
                      <span className="font-bold text-foreground text-[11px]">
                        Not Required
                      </span>
                    </div>
                    <p className="text-[9px] text-muted-foreground pl-5 leading-tight">
                      No supporting document is required to apply for this leave.
                    </p>
                  </div>

                  {/* Always Required */}
                  <div
                    onClick={() => setSupportingDocPolicy("ALWAYS")}
                    className={cn(
                      "p-3 rounded-xl border bg-background cursor-pointer transition-all space-y-1",
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
                      <span className="font-bold text-foreground text-[11px]">
                        Always Required
                      </span>
                    </div>
                    <p className="text-[9px] text-muted-foreground pl-5 leading-tight">
                      Employees must upload a supporting document for every request.
                    </p>
                  </div>

                  {/* Required when exceeds */}
                  <div
                    onClick={() => setSupportingDocPolicy("EXCEEDS")}
                    className={cn(
                      "p-3 rounded-xl border bg-background cursor-pointer transition-all space-y-1.5",
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
                      <span className="font-bold text-foreground text-[11px] leading-tight">
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
                <div className="flex items-center gap-2 p-3 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-xl text-xs text-blue-700 dark:text-blue-300">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>
                    Employees must upload a supporting document if the applied leave period exceeds the specified number of days.
                  </span>
                </div>
              </div>

              {/* Right: Accepted File Types */}
              <div className="space-y-4">
                <span className="font-bold text-foreground flex items-center gap-1 text-xs">
                  Accepted File Types
                  <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                </span>
                <p className="text-[10px] text-muted-foreground">
                  Allow only specific file types and set size limits.
                </p>

                {/* File Types select & pills */}
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    File Types
                  </span>
                  <div className="p-2 border rounded-xl bg-background flex flex-wrap items-center gap-2">
                    {acceptedFileTypes.map((type) => (
                      <span
                        key={type}
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                      >
                        <span>{type}</span>
                        <button
                          type="button"
                          onClick={() => removeFileType(type)}
                          className="hover:text-blue-900 dark:hover:text-blue-100"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Max file size */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    Max File Size
                  </span>
                  <Select value={maxFileSize} onValueChange={setMaxFileSize}>
                    <SelectTrigger className="h-10 rounded-xl text-xs bg-background font-medium">
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
        <div className="bg-card border rounded-2xl p-6 shadow-2xs space-y-6">
          <div className="pb-2 border-b">
            <h3 className="text-base font-bold text-foreground tracking-tight">
              Approval & Visibility
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Set approval process and define what employees can view in their leave reports.
            </p>
          </div>

          <div className="space-y-6 text-xs">
            {/* Card 1: Approval Settings & Allow Admin on Behalf */}
            <div className="bg-card border rounded-2xl p-5 shadow-2xs grid grid-cols-1 md:grid-cols-2 gap-6">
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
                <p className="text-[10px] text-muted-foreground">
                  Yes, require manager approval for this leave. If disabled, leave requests will be auto-approved.
                </p>

                {managerApprovalRequired && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      Approval Flow
                    </span>
                    <Select value={approvalFlow} onValueChange={setApprovalFlow}>
                      <SelectTrigger className="h-10 rounded-xl text-xs bg-background font-medium">
                        <SelectValue placeholder="Select approval flow" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Employee's Direct Manager">
                          Employee&apos;s Direct Manager
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
                    <p className="text-[10px] text-muted-foreground">
                      Select who should approve the leave requests.
                    </p>
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
                    Allow administrators to apply this leave on employee&apos;s behalf.
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Useful for special cases like maternity, bereavement, etc.
                </p>
              </div>
            </div>

            {/* Card 2: Employee Leave Visibility */}
            <div className="bg-card border rounded-2xl p-5 shadow-2xs space-y-4">
              <div>
                <h4 className="text-xs font-bold text-foreground">
                  Employee Leave Visibility
                </h4>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Choose what employees can see in their leave reports.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left: Preferences */}
                <div className="space-y-4">
                  {/* Allow employees to view */}
                  <div className="space-y-1.5">
                    <span className="font-semibold text-foreground">
                      Allow employees to view
                    </span>
                    <Select
                      value={employeeVisibility}
                      onValueChange={setEmployeeVisibility}
                    >
                      <SelectTrigger className="h-10 rounded-xl text-xs bg-background font-medium">
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
                    <p className="text-[10px] text-muted-foreground">
                      Employees will be able to see full details including balance, taken leaves, upcoming leaves and history.
                    </p>
                  </div>

                  {/* Balance Display Preference */}
                  <div className="space-y-1.5">
                    <span className="font-semibold text-foreground">
                      Balance Display Preference
                    </span>
                    <p className="text-[10px] text-muted-foreground">
                      Balance is to be displayed as
                    </p>
                    <Select
                      value={balanceDisplayPreference}
                      onValueChange={setBalanceDisplayPreference}
                    >
                      <SelectTrigger className="h-10 rounded-xl text-xs bg-background font-medium">
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
                    <p className="text-[10px] text-muted-foreground">
                      Balance will be calculated based on the start date of the leave request.
                    </p>
                  </div>
                </div>

                {/* Right: Blue Callout Card */}
                <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 space-y-2 flex flex-col justify-center">
                  <div className="flex items-center gap-2 text-primary font-bold text-xs">
                    <Info className="w-4 h-4 text-primary shrink-0" />
                    <span>About Balance Display</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    This setting determines the date on which the leave balance is calculated and shown in reports.
                  </p>
                  <p className="text-[11px] text-primary/90 font-medium">
                    <strong className="text-foreground">Example:</strong> If an employee has applied leave for 10th June, balance will be shown as on 10th June.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer Navigation Bar */}
      <div className="bg-card border rounded-2xl p-4 shadow-2xs flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={handleBack}
          className="h-10 px-6 rounded-xl text-xs font-semibold gap-1.5"
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
          onClick={handleNext}
          className="h-10 px-8 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs gap-1.5"
        >
          <span>
            {currentStep === 6
              ? "Review & Create"
              : "Save & Next"}
          </span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
