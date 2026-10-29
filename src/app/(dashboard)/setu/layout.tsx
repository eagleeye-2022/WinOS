import "@/features/setu/setu.css";

// Every Setu page renders inside the Setu design scope (see setu.css).
export default function SetuLayout({ children }: { children: React.ReactNode }) {
  return <div className="setu-scope setu-canvas h-full">{children}</div>;
}
