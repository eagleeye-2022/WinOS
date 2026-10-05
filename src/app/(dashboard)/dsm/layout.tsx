import { requireModuleAccess } from "@/features/users/actions/module-guard";
import { ActiveTimerProvider } from "@/features/projects/context/active-timer-context";

export default async function DsmLayout({ children }: { children: React.ReactNode }) {
  await requireModuleAccess("STANDUP");
  return <ActiveTimerProvider>{children}</ActiveTimerProvider>;
}
