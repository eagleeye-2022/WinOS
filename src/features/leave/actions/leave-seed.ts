"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function ensureLeaveDataSeeded() {
  try {
    // Check if LeaveTypes exist
    const typeCount = await db.leaveType.count();
    if (typeCount === 0) {
      // Seed default organization leave types
      await db.leaveType.createMany({
        data: [
          {
            name: "Paid Leave",
            code: "PL",
            description: "General paid time off for employees",
            icon: "Calendar",
            iconBgColor: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40",
            iconTextColor: "text-emerald-600",
            category: "PAID",
            allocationFrequency: "YEARLY",
            annualEntitlement: 12.0,
            allowCarryForward: true,
            carryForwardLimit: 5.0,
            balanceResetRule: "CARRY_FORWARD_UP_TO_LIMIT",
            exceededRule: "MARK_AS_LOP",
            applicableTo: "ALL_EMPLOYEES",
            allowFullDay: true,
            allowHalfDay: true,
            allowQuarterDay: false,
            allowHourly: true,
            effectiveDate: new Date("2025-01-01"),
            isActive: true,
          },
          {
            name: "Sick Leave",
            code: "SL",
            description: "For illness or medical reasons",
            icon: "Heart",
            iconBgColor: "bg-blue-50 text-blue-600 dark:bg-blue-950/40",
            iconTextColor: "text-blue-600",
            category: "PAID",
            allocationFrequency: "MONTHLY",
            annualEntitlement: 12.0,
            allowCarryForward: false,
            balanceResetRule: "LAPSE_ALL",
            exceededRule: "MARK_AS_LOP",
            applicableTo: "ALL_EMPLOYEES",
            allowFullDay: true,
            allowHalfDay: true,
            allowQuarterDay: false,
            allowHourly: true,
            effectiveDate: new Date("2025-01-01"),
            isActive: true,
          },
          {
            name: "Casual Leave",
            code: "CL",
            description: "For short personal work",
            icon: "Plane",
            iconBgColor: "bg-orange-50 text-orange-600 dark:bg-orange-950/40",
            iconTextColor: "text-orange-600",
            category: "PAID",
            allocationFrequency: "YEARLY",
            annualEntitlement: 6.0,
            allowCarryForward: false,
            balanceResetRule: "LAPSE_ALL",
            exceededRule: "MARK_AS_LOP",
            applicableTo: "ALL_EMPLOYEES",
            allowFullDay: true,
            allowHalfDay: true,
            allowQuarterDay: false,
            allowHourly: true,
            effectiveDate: new Date("2025-01-01"),
            isActive: true,
          },
          {
            name: "Maternity Leave",
            code: "ML",
            description: "For female employees",
            icon: "Baby",
            iconBgColor: "bg-purple-50 text-purple-600 dark:bg-purple-950/40",
            iconTextColor: "text-purple-600",
            category: "PAID",
            allocationFrequency: "YEARLY",
            annualEntitlement: 180.0,
            allowCarryForward: false,
            balanceResetRule: "LAPSE_ALL",
            exceededRule: "DO_NOT_ALLOW",
            applicableTo: "ALL_EMPLOYEES",
            allowFullDay: true,
            allowHalfDay: false,
            allowQuarterDay: false,
            allowHourly: false,
            effectiveDate: new Date("2025-01-01"),
            isActive: true,
          },
          {
            name: "Comp Off",
            code: "COMP",
            description: "Earned for extra weekend/holiday work",
            icon: "Clock",
            iconBgColor: "bg-amber-50 text-amber-600 dark:bg-amber-950/40",
            iconTextColor: "text-amber-600",
            category: "PAID",
            allocationFrequency: "ON_DEMAND",
            annualEntitlement: 0.0,
            allowCarryForward: true,
            balanceResetRule: "CARRY_FORWARD_UP_TO_LIMIT",
            exceededRule: "DO_NOT_ALLOW",
            applicableTo: "ALL_EMPLOYEES",
            allowFullDay: true,
            allowHalfDay: true,
            allowQuarterDay: true,
            allowHourly: false,
            effectiveDate: new Date("2025-01-01"),
            isActive: true,
          },
          {
            name: "Loss of Pay (LOP)",
            code: "LOP",
            description: "Unpaid leave beyond available quota",
            icon: "AlertTriangle",
            iconBgColor: "bg-rose-50 text-rose-600 dark:bg-rose-950/40",
            iconTextColor: "text-rose-600",
            category: "UNPAID",
            allocationFrequency: "ON_DEMAND",
            annualEntitlement: 0.0,
            allowCarryForward: false,
            balanceResetRule: "LAPSE_ALL",
            exceededRule: "ALLOW_WITHOUT_LIMIT",
            applicableTo: "ALL_EMPLOYEES",
            allowFullDay: true,
            allowHalfDay: true,
            allowQuarterDay: false,
            allowHourly: true,
            effectiveDate: new Date("2025-01-01"),
            isActive: true,
          },
          {
            name: "Early Leave",
            code: "EL",
            description: "Leave granted for leaving office early",
            icon: "Clock",
            iconBgColor: "bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40",
            iconTextColor: "text-cyan-600",
            category: "PAID",
            allocationFrequency: "YEARLY",
            annualEntitlement: 2.0,
            allowCarryForward: false,
            balanceResetRule: "LAPSE_ALL",
            exceededRule: "MARK_AS_LOP",
            applicableTo: "ALL_EMPLOYEES",
            allowFullDay: false,
            allowHalfDay: false,
            allowQuarterDay: false,
            allowHourly: true,
            effectiveDate: new Date("2025-01-01"),
            isActive: true,
          },
          {
            name: "Floating Holiday",
            code: "FH",
            description: "Optional holiday from designated list",
            icon: "Gift",
            iconBgColor: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40",
            iconTextColor: "text-emerald-600",
            category: "PAID",
            allocationFrequency: "YEARLY",
            annualEntitlement: 3.0,
            allowCarryForward: false,
            balanceResetRule: "LAPSE_ALL",
            exceededRule: "DO_NOT_ALLOW",
            applicableTo: "ALL_EMPLOYEES",
            allowFullDay: true,
            allowHalfDay: false,
            allowQuarterDay: false,
            allowHourly: false,
            effectiveDate: new Date("2025-01-01"),
            isActive: true,
          },
        ],
      });
    }

    // Check if Holidays exist
    const holidayCount = await db.holiday.count();
    if (holidayCount === 0) {
      await db.holiday.createMany({
        data: [
          { name: "New Year's Day", date: new Date("2025-01-01"), dayOfWeek: "Wednesday", year: 2025, type: "PUBLIC", description: "Global holiday celebrating the start of the year." },
          { name: "Republic Day", date: new Date("2025-01-26"), dayOfWeek: "Sunday", year: 2025, type: "PUBLIC", description: "Honours the date on which the Constitution of India came into effect." },
          { name: "Maha Shivaratri", date: new Date("2025-02-26"), dayOfWeek: "Wednesday", year: 2025, type: "OPTIONAL", description: "Hindu festival celebrated annually in honour of Lord Shiva." },
          { name: "Holi", date: new Date("2025-03-14"), dayOfWeek: "Friday", year: 2025, type: "PUBLIC", description: "Festival of colours celebrating the arrival of spring." },
          { name: "Good Friday", date: new Date("2025-04-18"), dayOfWeek: "Friday", year: 2025, type: "PUBLIC", description: "Christian holiday commemorating the crucifixion of Jesus." },
          { name: "Labour Day", date: new Date("2025-05-01"), dayOfWeek: "Thursday", year: 2025, type: "PUBLIC", description: "International Workers' Day." },
          { name: "Eid-ul-Adha", date: new Date("2025-06-07"), dayOfWeek: "Saturday", year: 2025, type: "PUBLIC", description: "Feast of the Sacrifice celebrated in Islam." },
          { name: "Independence Day", date: new Date("2025-08-15"), dayOfWeek: "Friday", year: 2025, type: "PUBLIC", description: "National holiday celebrating independence." },
          { name: "Gandhi Jayanti", date: new Date("2025-10-02"), dayOfWeek: "Thursday", year: 2025, type: "PUBLIC", description: "Birth anniversary of Mahatma Gandhi." },
          { name: "Dussehra", date: new Date("2025-10-02"), dayOfWeek: "Thursday", year: 2025, type: "PUBLIC", description: "Celebration of the victory of good over evil." },
          { name: "Diwali", date: new Date("2025-10-20"), dayOfWeek: "Monday", year: 2025, type: "PUBLIC", description: "Festival of Lights." },
          { name: "Christmas Day", date: new Date("2025-12-25"), dayOfWeek: "Thursday", year: 2025, type: "PUBLIC", description: "Annual festival commemorating the birth of Jesus Christ." },
        ],
      });
    }

    // Ensure logged-in user has leave balance records for the current year
    const session = await auth();
    if (session?.user?.id) {
      await ensureUserBalances(session.user.id, new Date().getFullYear());
    }
  } catch (error) {
    console.error("[Leave Seed] Error seeding initial data:", error);
  }
}

export async function ensureUserBalances(userId: string, year: number) {
  const leaveTypes = await db.leaveType.findMany({ where: { isActive: true } });
  for (const lt of leaveTypes) {
    const existing = await db.userLeaveBalance.findUnique({
      where: {
        userId_leaveTypeId_year: {
          userId,
          leaveTypeId: lt.id,
          year,
        },
      },
    });

    if (!existing) {
      await db.userLeaveBalance.create({
        data: {
          userId,
          leaveTypeId: lt.id,
          year,
          allocatedDays: lt.annualEntitlement,
          carriedForward: 0,
          adjustedDays: 0,
          bookedDays: 0,
          pendingDays: 0,
          lossOfPayDays: 0,
        },
      });
    }
  }
}
