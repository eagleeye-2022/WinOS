import "@/features/setu/setu.css";
import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import { requireSetuUser } from "@/features/setu/server/guard";
import { getSetuSnapshot } from "@/features/setu/server/data";
import { SetuStoreProvider } from "@/features/setu/provider";

// Every Setu page renders inside the Setu design scope (see setu.css) and reads one data snapshot
// (all internal staff see all Setu data). Any Setu write calls revalidatePath("/setu", "layout"),
// which re-renders this layout with a fresh snapshot.
export default async function SetuLayout({ children }: { children: React.ReactNode }) {
  const me = await requireSetuUser();
  if (!me) redirect(ROUTES.restricted);
  const snapshot = await getSetuSnapshot(me);
  return (
    <div className="setu-scope setu-canvas h-full">
      <SetuStoreProvider snapshot={snapshot}>{children}</SetuStoreProvider>
    </div>
  );
}
