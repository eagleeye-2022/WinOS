import { Metadata } from "next";
import { TasksBoard } from "@/features/setu/components/tasks/tasks-board";

export const metadata: Metadata = {
  title: "Tasks | Setu | WinOS",
  description: "Sales board: every lead and deal across Lead → Closed.",
};

export default function SetuTasksPage() {
  return <TasksBoard />;
}
