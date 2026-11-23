import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";

// "Activities" is a sidebar group; its first page is Tasks.
export default function SetuActivitiesPage() {
  redirect(ROUTES.setuTasks);
}
