export interface ShiftSummaryItem {
  id: string;
  dateStr?: string; // e.g. "19/08/2026 Wed"
  employeeName?: string;
  designation?: string;
  avatarUrl?: string;
  status: "Present" | "Weekend" | "Absent" | "On Leave";
  attendanceTime?: string; // "09:56 AM → 06:47 PM"
  totalHours?: string; // "08:51"
  checkInDiff?: {
    type: "early" | "late" | "on-time";
    label: string; // "04 min Early" or "12 min Late"
  };
  checkOutDiff?: {
    type: "early" | "late" | "on-time";
    label: string; // "17 min Late" or "25 min Early" or "0 min"
  };
  netHours?: {
    type: "positive" | "negative" | "neutral";
    label: string; // "+00:21" or "-00:12"
  };
  workMode: "Remote" | "Office" | "Weekend";
}

export interface TeamPayrollItem {
  id: string;
  name: string;
  designation: string;
  avatarUrl?: string;
  companyWorkingDays: number;
  expectedPayableDays: number;
  presentDays: number;
  halfDays: number;
  paidOffs: number;
  absentDays: number;
  totalDays: number;
}

export interface MyMonthlyPayrollItem {
  id: string;
  month: string; // "May 2025"
  companyWorkingDays: number;
  expectedPayableDays: number;
  presentDays: number;
  halfDays: number;
  paidOffs: number;
  absentDays: number;
  totalDays: number;
}

export const DUMMY_TEAM_SHIFT_SUMMARY: ShiftSummaryItem[] = [
  {
    id: "shift-1",
    employeeName: "Rahul Sharma",
    designation: "UI/UX Designer",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
    status: "Present",
    attendanceTime: "09:56 AM → 06:47 PM",
    totalHours: "08:51",
    checkInDiff: { type: "early", label: "04 min Early" },
    checkOutDiff: { type: "late", label: "17 min Late" },
    netHours: { type: "positive", label: "+00:21" },
    workMode: "Remote",
  },
  {
    id: "shift-2",
    employeeName: "Priya Singh",
    designation: "Frontend Developer",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
    status: "Present",
    attendanceTime: "10:12 AM → 06:30 PM",
    totalHours: "08:18",
    checkInDiff: { type: "late", label: "12 min Late" },
    checkOutDiff: { type: "on-time", label: "0 min" },
    netHours: { type: "negative", label: "-00:12" },
    workMode: "Office",
  },
  {
    id: "shift-3",
    employeeName: "Arjun Kumar",
    designation: "Backend Developer",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80",
    status: "Present",
    attendanceTime: "09:53 AM → 06:53 PM",
    totalHours: "09:00",
    checkInDiff: { type: "early", label: "07 min Early" },
    checkOutDiff: { type: "late", label: "23 min Late" },
    netHours: { type: "positive", label: "+00:30" },
    workMode: "Remote",
  },
  {
    id: "shift-4",
    employeeName: "Ananya Das",
    designation: "Product Designer",
    avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80",
    status: "Present",
    attendanceTime: "09:46 AM → 06:36 PM",
    totalHours: "08:50",
    checkInDiff: { type: "early", label: "14 min Early" },
    checkOutDiff: { type: "late", label: "06 min Late" },
    netHours: { type: "positive", label: "+00:20" },
    workMode: "Remote",
  },
  {
    id: "shift-5",
    employeeName: "Rohan Verma",
    designation: "QA Engineer",
    avatarUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100&auto=format&fit=crop&q=80",
    status: "Present",
    attendanceTime: "10:25 AM → 06:05 PM",
    totalHours: "07:40",
    checkInDiff: { type: "late", label: "25 min Late" },
    checkOutDiff: { type: "early", label: "25 min Early" },
    netHours: { type: "negative", label: "-00:40" },
    workMode: "Office",
  },
  {
    id: "shift-6",
    employeeName: "Neha Patel",
    designation: "DevOps Engineer",
    avatarUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&auto=format&fit=crop&q=80",
    status: "Weekend",
    workMode: "Weekend",
  },
  {
    id: "shift-7",
    employeeName: "Sourav Roy",
    designation: "UI Developer",
    avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&auto=format&fit=crop&q=80",
    status: "Present",
    attendanceTime: "09:59 AM → 06:41 PM",
    totalHours: "08:42",
    checkInDiff: { type: "early", label: "01 min Early" },
    checkOutDiff: { type: "late", label: "11 min Late" },
    netHours: { type: "positive", label: "+00:12" },
    workMode: "Remote",
  },
  {
    id: "shift-8",
    employeeName: "Kavya Nair",
    designation: "HR Executive",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
    status: "Weekend",
    workMode: "Weekend",
  },
];

export const DUMMY_MY_SHIFT_SUMMARY: ShiftSummaryItem[] = [
  {
    id: "my-shift-1",
    dateStr: "19/08/2026 Wed",
    status: "Present",
    attendanceTime: "09:56 AM → 06:47 PM",
    totalHours: "08:51",
    checkInDiff: { type: "early", label: "04 min Early" },
    checkOutDiff: { type: "late", label: "17 min Late" },
    netHours: { type: "positive", label: "+00:21" },
    workMode: "Remote",
  },
  {
    id: "my-shift-2",
    dateStr: "20/08/2026 Thu",
    status: "Present",
    attendanceTime: "09:57 AM → 06:32 PM",
    totalHours: "08:35",
    checkInDiff: { type: "early", label: "03 min Early" },
    checkOutDiff: { type: "late", label: "02 min Late" },
    netHours: { type: "positive", label: "+00:05" },
    workMode: "Remote",
  },
  {
    id: "my-shift-3",
    dateStr: "21/08/2026 Fri",
    status: "Present",
    attendanceTime: "09:53 AM → 06:53 PM",
    totalHours: "09:00",
    checkInDiff: { type: "early", label: "07 min Early" },
    checkOutDiff: { type: "late", label: "23 min Late" },
    netHours: { type: "positive", label: "+00:30" },
    workMode: "Office",
  },
  {
    id: "my-shift-4",
    dateStr: "22/08/2026 Sat",
    status: "Present",
    attendanceTime: "09:46 AM → 06:36 PM",
    totalHours: "08:50",
    checkInDiff: { type: "early", label: "14 min Early" },
    checkOutDiff: { type: "late", label: "06 min Late" },
    netHours: { type: "positive", label: "+00:20" },
    workMode: "Remote",
  },
  {
    id: "my-shift-5",
    dateStr: "23/08/2026 Sun",
    status: "Weekend",
    checkInDiff: { type: "on-time", label: "0 min" },
    checkOutDiff: { type: "on-time", label: "0 min" },
    workMode: "Weekend",
  },
  {
    id: "my-shift-6",
    dateStr: "24/08/2026 Mon",
    status: "Present",
    attendanceTime: "09:59 AM → 06:41 PM",
    totalHours: "08:42",
    checkInDiff: { type: "early", label: "01 min Early" },
    checkOutDiff: { type: "late", label: "11 min Late" },
    netHours: { type: "positive", label: "+00:12" },
    workMode: "Remote",
  },
  {
    id: "my-shift-7",
    dateStr: "25/08/2026 Tue",
    status: "Present",
    attendanceTime: "10:12 AM → 06:30 PM",
    totalHours: "08:18",
    checkInDiff: { type: "late", label: "12 min Late" },
    checkOutDiff: { type: "on-time", label: "0 min" },
    netHours: { type: "negative", label: "-00:12" },
    workMode: "Remote",
  },
  {
    id: "my-shift-8",
    dateStr: "26/08/2026 Wed",
    status: "Present",
    attendanceTime: "10:25 AM → 06:05 PM",
    totalHours: "07:40",
    checkInDiff: { type: "late", label: "25 min Late" },
    checkOutDiff: { type: "early", label: "25 min Early" },
    netHours: { type: "negative", label: "-00:40" },
    workMode: "Office",
  },
  {
    id: "my-shift-9",
    dateStr: "27/08/2026 Thu",
    status: "Weekend",
    checkInDiff: { type: "on-time", label: "0 min" },
    checkOutDiff: { type: "on-time", label: "0 min" },
    workMode: "Weekend",
  },
];

export const DUMMY_TEAM_PAYROLL_DATA: TeamPayrollItem[] = [
  {
    id: "tp-1",
    name: "Rahul Sharma",
    designation: "Software Engineer",
    companyWorkingDays: 22,
    expectedPayableDays: 22,
    presentDays: 18,
    halfDays: 2,
    paidOffs: 1,
    absentDays: 1,
    totalDays: 22,
  },
  {
    id: "tp-2",
    name: "Priya Nair",
    designation: "UI/UX Designer",
    companyWorkingDays: 22,
    expectedPayableDays: 22,
    presentDays: 20,
    halfDays: 1,
    paidOffs: 1,
    absentDays: 0,
    totalDays: 22,
  },
  {
    id: "tp-3",
    name: "Arjun Mehta",
    designation: "Frontend Developer",
    companyWorkingDays: 22,
    expectedPayableDays: 22,
    presentDays: 16,
    halfDays: 2,
    paidOffs: 2,
    absentDays: 2,
    totalDays: 22,
  },
  {
    id: "tp-4",
    name: "Sneha Iyer",
    designation: "QA Engineer",
    companyWorkingDays: 22,
    expectedPayableDays: 22,
    presentDays: 19,
    halfDays: 1,
    paidOffs: 1,
    absentDays: 1,
    totalDays: 22,
  },
  {
    id: "tp-5",
    name: "Karthik Reddy",
    designation: "Backend Developer",
    companyWorkingDays: 22,
    expectedPayableDays: 22,
    presentDays: 17,
    halfDays: 2,
    paidOffs: 2,
    absentDays: 1,
    totalDays: 22,
  },
  {
    id: "tp-6",
    name: "Megha Varma",
    designation: "Product Analyst",
    companyWorkingDays: 22,
    expectedPayableDays: 22,
    presentDays: 20,
    halfDays: 0,
    paidOffs: 2,
    absentDays: 0,
    totalDays: 22,
  },
];

export const DUMMY_MY_PAYROLL_DATA: MyMonthlyPayrollItem[] = [
  {
    id: "mp-1",
    month: "May 2025",
    companyWorkingDays: 22,
    expectedPayableDays: 22.0,
    presentDays: 19,
    halfDays: 1,
    paidOffs: 1.0,
    absentDays: 1.0,
    totalDays: 22.0,
  },
  {
    id: "mp-2",
    month: "Apr 2025",
    companyWorkingDays: 22,
    expectedPayableDays: 22.0,
    presentDays: 18,
    halfDays: 2,
    paidOffs: 1.0,
    absentDays: 1.0,
    totalDays: 22.0,
  },
  {
    id: "mp-3",
    month: "Mar 2025",
    companyWorkingDays: 21,
    expectedPayableDays: 21.0,
    presentDays: 17,
    halfDays: 1,
    paidOffs: 2.0,
    absentDays: 1.0,
    totalDays: 21.0,
  },
  {
    id: "mp-4",
    month: "Feb 2025",
    companyWorkingDays: 20,
    expectedPayableDays: 20.0,
    presentDays: 16,
    halfDays: 2,
    paidOffs: 1.0,
    absentDays: 1.0,
    totalDays: 20.0,
  },
  {
    id: "mp-5",
    month: "Jan 2025",
    companyWorkingDays: 23,
    expectedPayableDays: 23.0,
    presentDays: 20,
    halfDays: 1,
    paidOffs: 1.0,
    absentDays: 1.0,
    totalDays: 23.0,
  },
  {
    id: "mp-6",
    month: "Dec 2024",
    companyWorkingDays: 22,
    expectedPayableDays: 22.0,
    presentDays: 18,
    halfDays: 2,
    paidOffs: 1.0,
    absentDays: 1.0,
    totalDays: 22.0,
  },
  {
    id: "mp-7",
    month: "Nov 2024",
    companyWorkingDays: 21,
    expectedPayableDays: 21.0,
    presentDays: 17,
    halfDays: 1,
    paidOffs: 2.0,
    absentDays: 1.0,
    totalDays: 21.0,
  },
  {
    id: "mp-8",
    month: "Oct 2024",
    companyWorkingDays: 23,
    expectedPayableDays: 23.0,
    presentDays: 20,
    halfDays: 1,
    paidOffs: 1.0,
    absentDays: 1.0,
    totalDays: 23.0,
  },
  {
    id: "mp-9",
    month: "Sep 2024",
    companyWorkingDays: 22,
    expectedPayableDays: 22.0,
    presentDays: 18,
    halfDays: 2,
    paidOffs: 1.0,
    absentDays: 1.0,
    totalDays: 22.0,
  },
  {
    id: "mp-10",
    month: "Aug 2024",
    companyWorkingDays: 22,
    expectedPayableDays: 22.0,
    presentDays: 19,
    halfDays: 1,
    paidOffs: 1.0,
    absentDays: 1.0,
    totalDays: 22.0,
  },
  {
    id: "mp-11",
    month: "Jul 2024",
    companyWorkingDays: 22,
    expectedPayableDays: 22.0,
    presentDays: 17,
    halfDays: 1,
    paidOffs: 2.0,
    absentDays: 2.0,
    totalDays: 22.0,
  },
  {
    id: "mp-12",
    month: "Jun 2024",
    companyWorkingDays: 20,
    expectedPayableDays: 20.0,
    presentDays: 16,
    halfDays: 2,
    paidOffs: 1.0,
    absentDays: 1.0,
    totalDays: 20.0,
  },
];
