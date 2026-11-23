import { Metadata } from "next";
import { TasksBoard } from "@/features/setu/components/tasks/tasks-board";

export const metadata: Metadata = {
  title: "Tasks & Board | Setu | WinOS",
  description: "Sales board: visual drag-and-drop deal pipeline across stages.",
};

export default function SetuTasksPage() {
  return <TasksBoard />;
}
