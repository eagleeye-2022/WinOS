import { Briefcase } from "lucide-react";

export default function ProjectsPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-6 text-center bg-background text-foreground animate-in fade-in duration-200">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary mb-4 shadow-xs">
        <Briefcase size={28} />
      </div>
      <h1 className="text-xl font-bold tracking-tight">Projects Dashboard</h1>
      <p className="text-xs text-muted-foreground mt-1.5 max-w-sm">
        Track projects, boards, milestones, and daily checklist workflows. This module is currently under active development.
      </p>
    </div>
  );
}
