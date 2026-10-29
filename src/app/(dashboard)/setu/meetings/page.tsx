import { Metadata } from "next";
import { MeetingsWorkspace } from "@/features/setu/components/meetings/meetings-workspace";

export const metadata: Metadata = {
  title: "121 Meetings | Setu | WinOS",
  description: "One-on-one meetings with BNI members and the referrals exchanged.",
};

export default function SetuMeetingsPage() {
  return <MeetingsWorkspace />;
}
