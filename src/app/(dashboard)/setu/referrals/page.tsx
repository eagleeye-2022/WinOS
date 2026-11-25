import { Metadata } from "next";
import { ReferralsView } from "@/features/setu/components/bni/referrals-view";

export const metadata: Metadata = {
  title: "Referrals | Setu | WinOS",
  description: "Referrals received from and given to BNI members.",
};

export default function SetuReferralsPage() {
  return <ReferralsView />;
}
