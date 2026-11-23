import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";

// Setu opens on the Tasks board.
export default function SetuIndexPage() {
  redirect(ROUTES.setuTasks);
}
