import { Metadata } from "next";
import { MeetingScheduler } from "@/features/setu/components/meetings/meeting-scheduler";

export const metadata: Metadata = {
  title: "Edit Meeting | Setu | WinOS",
};

export default async function SetuEditMeetingPage({ params }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = await params;
  return <MeetingScheduler meetingId={meetingId} />;
}
