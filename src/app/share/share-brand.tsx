import Image from "next/image";
import { APP_CONFIG } from "@/config/app";

/** Logo + caption header used by the public /share pages. */
export function ShareBrand({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      {/* The logo PNG is square with lots of transparent padding, so render it large and trim the
          padding with negative margins — the visible mark is ~38px tall without growing the header. */}
      <Image
        src="/winos-logo.png"
        alt={APP_CONFIG.name}
        width={600}
        height={600}
        unoptimized
        className="-my-10 -ml-2 h-32 w-auto object-contain dark:hidden"
        priority
      />
      <Image
        src="/winos-logo-dark.png"
        alt={APP_CONFIG.name}
        width={600}
        height={600}
        unoptimized
        className="-my-10 -ml-2 h-32 w-auto object-contain hidden dark:block"
        priority
      />
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{label}</span>
    </div>
  );
}
