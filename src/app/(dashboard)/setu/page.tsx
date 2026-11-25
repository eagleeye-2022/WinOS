import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";

// Setu opens on 121 Meetings (the start of the referral → prospect flow).
export default function SetuIndexPage() {
  redirect(ROUTES.setu121);
}
