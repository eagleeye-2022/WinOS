"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ROUTES } from "@/constants/routes";

const MODULE_LABEL: Record<string, string> = {
  STANDUP: "Standup",
  PROJECTS: "Projects",
  USER_MANAGEMENT: "User Management",
};

function RestrictedContent() {
  const params = useSearchParams();
  const moduleKey = params.get("module");
  const moduleLabel = moduleKey ? MODULE_LABEL[moduleKey] ?? moduleKey : "this section";

  return (
    <div className="restricted-screen">
      <div className="restricted-logo-bg" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/winos-logo.png" alt="" className="restricted-logo-img dark:hidden" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/winos-logo-dark.png" alt="" className="restricted-logo-img hidden dark:block" />
      </div>
      <div className="restricted-content">
        <span className="restricted-badge">403</span>
        <p className="restricted-glitch" data-text="ACCESS RESTRICTED">
          ACCESS RESTRICTED
        </p>
        <p className="restricted-sub">
          You don&apos;t have permission to view <strong>{moduleLabel}</strong>
        </p>
        <p className="restricted-hint">(don&apos;t worry)</p>
        <Link href={ROUTES.dashboard} className="restricted-link">
          (click here to go back to WinOS)
        </Link>
      </div>

      <style jsx>{`
        .restricted-screen {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--background);
          overflow: hidden;
        }
        .restricted-logo-bg {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.12;
          filter: blur(2px);
          pointer-events: none;
        }
        .restricted-logo-img {
          width: min(140%, 1800px);
          height: auto;
          object-fit: contain;
        }
        .restricted-content {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          text-align: center;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          padding: 1.5rem;
        }
        .restricted-badge {
          background: var(--foreground);
          color: var(--background);
          font-weight: 800;
          font-size: 1.5rem;
          padding: 0.25rem 0.9rem;
          letter-spacing: 0.05em;
        }
        .restricted-glitch {
          position: relative;
          color: var(--foreground);
          font-size: clamp(1.1rem, 3vw, 1.6rem);
          letter-spacing: 0.15em;
          font-weight: 700;
          margin: 0.5rem 0 0;
        }
        .restricted-glitch::before,
        .restricted-glitch::after {
          content: attr(data-text);
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          overflow: hidden;
        }
        .restricted-glitch::before {
          color: #ff003c;
          clip-path: inset(0 0 60% 0);
          animation: restricted-glitch-a 2.5s infinite linear alternate-reverse;
        }
        .restricted-glitch::after {
          color: #00e5ff;
          clip-path: inset(60% 0 0 0);
          animation: restricted-glitch-b 2.5s infinite linear alternate-reverse;
        }
        @keyframes restricted-glitch-a {
          0% {
            transform: translate(0, 0);
          }
          20% {
            transform: translate(-2px, -1px);
          }
          40% {
            transform: translate(2px, 1px);
          }
          60% {
            transform: translate(-1px, 1px);
          }
          80% {
            transform: translate(1px, -1px);
          }
          100% {
            transform: translate(0, 0);
          }
        }
        @keyframes restricted-glitch-b {
          0% {
            transform: translate(0, 0);
          }
          20% {
            transform: translate(2px, 1px);
          }
          40% {
            transform: translate(-2px, -1px);
          }
          60% {
            transform: translate(1px, -1px);
          }
          80% {
            transform: translate(-1px, 1px);
          }
          100% {
            transform: translate(0, 0);
          }
        }
        .restricted-sub {
          color: var(--muted-foreground);
          font-size: 0.85rem;
          letter-spacing: 0.05em;
        }
        .restricted-hint {
          color: var(--muted-foreground);
          font-size: 0.75rem;
        }
        .restricted-link {
          color: var(--muted-foreground);
          font-size: 0.85rem;
          text-decoration: underline;
          text-underline-offset: 3px;
          transition: color 0.2s;
        }
        .restricted-link:hover {
          color: var(--foreground);
        }
      `}</style>
    </div>
  );
}

export default function RestrictedPage() {
  return (
    <Suspense fallback={null}>
      <RestrictedContent />
    </Suspense>
  );
}
