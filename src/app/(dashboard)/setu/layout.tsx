import "@/features/setu/setu.css";
import { SetuShell } from "@/features/setu/components/setu-shell";

// Every Setu tab renders inside the Setu design scope (see setu.css) and the shared header + tabs.
export default function SetuLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="setu-scope setu-canvas h-full">
      <SetuShell>{children}</SetuShell>
    </div>
  );
}
