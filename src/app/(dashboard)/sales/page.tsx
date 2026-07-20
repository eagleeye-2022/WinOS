import { TrendingUp } from "lucide-react";

export default function SalesPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-6 text-center bg-background text-foreground animate-in fade-in duration-200">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary mb-4 shadow-xs">
        <TrendingUp size={28} />
      </div>
      <h1 className="text-xl font-bold tracking-tight">Sales Hub</h1>
      <p className="text-xs text-muted-foreground mt-1.5 max-w-sm">
        Monitor leads, conversion funnels, deals, and sales pipelines. This module is currently under active development.
      </p>
    </div>
  );
}
