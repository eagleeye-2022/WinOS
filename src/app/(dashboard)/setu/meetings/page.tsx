import { Metadata } from "next";
import { MeetingsList } from "@/features/setu/components/meetings/meetings-list";

export const metadata: Metadata = {
  title: "Meetings | Setu | WinOS",
  description: "Customer meetings, sales discussions and follow-ups across every lead and deal.",
};

export default function SetuMeetingsPage() {
  return <MeetingsList />;
}
