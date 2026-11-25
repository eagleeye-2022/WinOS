import { Metadata } from "next";
import { MeetingsView } from "@/features/setu/components/bni/meetings-view";

export const metadata: Metadata = {
  title: "121 Meetings | Setu | WinOS",
  description: "One-on-one meetings with BNI members and the referrals exchanged.",
};

export default function Setu121MeetingsPage() {
  return <MeetingsView />;
}
