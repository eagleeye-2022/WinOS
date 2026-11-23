import { Metadata } from "next";
import { MeetingScheduler } from "@/features/setu/components/meetings/meeting-scheduler";

export const metadata: Metadata = {
  title: "Schedule Meeting | Setu | WinOS",
};

// ?deal=<id> preselects the related lead / deal (from a deal's Meetings tab).
export default function SetuScheduleMeetingPage() {
  return <MeetingScheduler />;
}
