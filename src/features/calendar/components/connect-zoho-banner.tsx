import Link from "next/link";
import { CalendarDays } from "lucide-react";

export function ConnectZohoBanner() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        <CalendarDays size={26} className="text-primary" />
      </span>
      <div>
        <h2 className="text-base font-semibold text-foreground">Connect your Zoho Calendar</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Connect your Zoho account to view and create events, and invite teammates to
          collaborative meetings directly from WinOS.
        </p>
      </div>
      <Link
        href="/api/auth/zoho/login"
        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
      >
        Connect Zoho Calendar
      </Link>
    </div>
  );
}
