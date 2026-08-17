"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { checkSessionAction } from "@/features/auth/actions/check-session";
import { ROUTES } from "@/constants/routes";

export function SessionGuard() {
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function verifySession() {
      try {
        const res = await checkSessionAction();
        if (isMounted && !res.active) {
          router.replace(ROUTES.login);
          router.refresh();
        }
      } catch {
        // Ignore network failure
      }
    }

    // Periodically verify session active state (every 5 seconds)
    const interval = setInterval(verifySession, 5000);

    // Re-verify on tab focus / visibility change
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        verifySession();
      }
    }

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", verifySession);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", verifySession);
    };
  }, [router]);

  return null;
}
