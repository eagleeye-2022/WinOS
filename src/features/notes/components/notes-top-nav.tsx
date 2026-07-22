"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, FileText, Share2, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type NotesTopNavProps = {
  onNewBoardClick?: () => void;
};

export function NotesTopNav({ onNewBoardClick }: NotesTopNavProps) {
  const pathname = usePathname();

  const [activeModule, setActiveModule] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mod = params.get("module");
    if (mod) {
      setActiveModule(mod);
    } else {
      setActiveModule(null);
    }
  }, [pathname]);

  const isSharedWithMeActive = pathname === "/notes/shared-with-me";
  const isSharedByMeActive = pathname === "/notes/shared-by-me";
  const isMyNotesActive =
    (pathname === "/notes" || pathname.startsWith("/notes/member")) &&
    !isSharedWithMeActive &&
    !isSharedByMeActive;

  const getHref = (basePath: string) => {
    return activeModule ? `${basePath}?module=${activeModule}` : basePath;
  };

  return (
    <nav className="flex items-center  gap-1 bg-muted/65 p-1 rounded-sm border shadow-2xs backdrop-blur-xs select-none">
      {onNewBoardClick ? (
        <button
          type="button"
          onClick={onNewBoardClick}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer select-none text-muted-foreground hover:text-foreground hover:bg-background/40"
        >
          <Plus size={13} className="text-primary" />
          <span>New Board</span>
        </button>
      ) : (
        <Link
          href={getHref("/notes")}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer select-none text-muted-foreground hover:text-foreground hover:bg-background/40"
        >
          <Plus size={13} className="text-primary" />
          <span>New Board</span>
        </Link>
      )}

      <Link
        href={getHref("/notes")}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer select-none",
          isMyNotesActive
            ? "bg-background text-primary shadow-xs border-border/70 font-semibold"
            : "text-muted-foreground hover:text-foreground hover:bg-background/40"
        )}
      >
        <FileText
          size={13}
          className={isMyNotesActive ? "text-primary animate-pulse" : "text-muted-foreground/60"}
        />
        <span>My Notes</span>
      </Link>

      <Link
        href={getHref("/notes/shared-with-me")}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer select-none",
          isSharedWithMeActive
            ? "bg-background text-primary shadow-xs border-border/70 font-semibold"
            : "text-muted-foreground hover:text-foreground hover:bg-background/40"
        )}
      >
        <Share2
          size={13}
          className={isSharedWithMeActive ? "text-primary animate-pulse" : "text-muted-foreground/60"}
        />
        <span>Shared with Me</span>
      </Link>

      <Link
        href={getHref("/notes/shared-by-me")}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer select-none",
          isSharedByMeActive
            ? "bg-background text-primary shadow-xs border-border/70 font-semibold"
            : "text-muted-foreground hover:text-foreground hover:bg-background/40"
        )}
      >
        <Users
          size={13}
          className={isSharedByMeActive ? "text-primary animate-pulse" : "text-muted-foreground/60"}
        />
        <span>Shared by Me</span>
      </Link>
    </nav>
  );
}
