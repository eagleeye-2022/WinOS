"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

// No-op subscription — the snapshot only differs once, between the
// server render and the first client render, so there's nothing to
// subscribe to. This flips `mounted` to true after hydration without
// the setState-in-effect anti-pattern.
const subscribeNever = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeNever, getClientSnapshot, getServerSnapshot);
  const [rippleKey, setRippleKey] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isDark = mounted && resolvedTheme === "dark";

  const toggleTheme = () => {
    const next = isDark ? "light" : "dark";
    const button = buttonRef.current;

    setRippleKey((key) => key + 1);

    if (!document.startViewTransition || !button) {
      setTheme(next);
      return;
    }

    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const root = document.documentElement;
    root.style.setProperty("--vt-x", `${x}px`);
    root.style.setProperty("--vt-y", `${y}px`);
    root.style.setProperty("--vt-r", `${radius}px`);

    document.startViewTransition(() => {
      setTheme(next);
    });
  };

  const glowColor = isDark
    ? "rgba(251, 191, 36, 0.45)" // amber — switching to light
    : "rgba(99, 102, 241, 0.45)"; // indigo — switching to dark

  return (
    <button
      ref={buttonRef}
      type="button"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggleTheme}
      className="group relative isolate rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-full opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `radial-gradient(circle, ${glowColor}, transparent 70%)` }}
      />
      <span
        key={rippleKey}
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-full"
        style={
          rippleKey
            ? {
                background: `radial-gradient(circle, ${glowColor}, transparent 65%)`,
                animation: "theme-toggle-ripple 550ms ease-out",
              }
            : undefined
        }
      />
      <span
        className="relative block transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
        style={{
          transform: isDark
            ? "rotate(0deg) scale(1)"
            : "rotate(-90deg) scale(1)",
        }}
      >
        {isDark ? <Sun size={16} /> : <Moon size={16} />}
      </span>
    </button>
  );
}
