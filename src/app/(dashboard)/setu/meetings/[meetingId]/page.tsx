import { Metadata } from "next";
import { MeetingDetail } from "@/features/setu/components/meetings/meeting-detail";

export const metadata: Metadata = {
  title: "Meeting | Setu | WinOS",
};

export default async function SetuMeetingPage({ params }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = await params;
  return <MeetingDetail meetingId={meetingId} />;
}
