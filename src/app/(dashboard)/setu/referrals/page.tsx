import { Metadata } from "next";
import { ReferralsWorkspace } from "@/features/setu/components/referrals-workspace";

export const metadata: Metadata = {
  title: "Referrals | Setu | WinOS",
  description: "Referrals received from and given to BNI members.",
};

export default function SetuReferralsPage() {
  return <ReferralsWorkspace />;
}
