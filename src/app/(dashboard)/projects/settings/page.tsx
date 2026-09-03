import { Shield } from "lucide-react";
import { AdminSettingsView } from "@/features/projects/components/views/admin-settings-view";
import { getCurrentUserRoleAction } from "@/features/projects/actions/project-actions";

export default async function SettingsPage() {
  const role = await getCurrentUserRoleAction();

  if (role !== "ADMIN") {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-2 bg-background p-8 text-center text-muted-foreground">
        <Shield size={32} className="text-primary" />
        <h3 className="text-lg font-bold text-foreground">Managers Only</h3>
        <p className="max-w-sm text-xs">
          You don&apos;t have permission to view or edit workspace settings and project templates.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-background overflow-hidden">
      <AdminSettingsView />
    </div>
  );
}
