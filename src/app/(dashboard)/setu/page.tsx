import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";

// Setu opens on its first tab.
export default function SetuIndexPage() {
  redirect(ROUTES.setuMeetings);
}
