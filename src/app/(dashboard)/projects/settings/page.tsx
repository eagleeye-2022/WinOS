import { AdminSettingsView } from "@/features/projects/components/views/admin-settings-view";

export default function SettingsPage() {
  return (
    <div className="flex flex-col h-screen w-full bg-background overflow-hidden">
      <AdminSettingsView />
    </div>
  );
}
