import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";

/** Team Leave opens on its Leave Requests tab. */
export default function TeamLeaveIndexPage() {
  redirect(ROUTES.pulseTeamLeaveRequests);
}
