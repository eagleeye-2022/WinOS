"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Building2, Check, Copy, Home, Info, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAvatarColor, getInitials } from "@/lib/avatar";
import { ROUTES } from "@/constants/routes";
import type { UserCardPresence, UserCardUser } from "@/features/users/user-card-data";

export type UserCardTarget = { userId?: string | null; name?: string | null; email?: string | null };

type OpenUserCard = (who: UserCardTarget, anchor: HTMLElement) => void;

const UserCardContext = createContext<OpenUserCard | null>(null);

/**
 * Pickers and dropdown triggers. An avatar or name inside one of these keeps the parent's behaviour
 * (choosing an assignee, opening a select…) instead of opening the card. Everywhere else — clickable
 * cards, links, table rows, drawers — the card wins and the parent's click is suppressed.
 */
const INTERACTIVE_ANCESTOR = [
  "select",
  "label",
  '[role="option"]',
  '[role="listbox"]',
  '[role="combobox"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="checkbox"]',
  '[role="tab"]',
  '[aria-haspopup]:not([aria-haspopup="false"])',
  "[data-no-user-card]",
].join(", ");

/**
 * Click handler for anything that should open the user card. Returns undefined outside the
 * provider (e.g. the client portal) so call sites render exactly as before there.
 */
export function useUserCardTrigger(who: UserCardTarget) {
  const open = useContext(UserCardContext);
  const { userId, name, email } = who;
  const hasTarget = Boolean(userId || email || name?.trim());

  const onClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (!open) return;
      const el = e.currentTarget;
      if (el.parentElement?.closest(INTERACTIVE_ANCESTOR)) return;
      // Don't let a clickable row/card behind the avatar navigate away as well.
      e.preventDefault();
      e.stopPropagation();
      open({ userId, name, email }, el);
    },
    [open, userId, name, email],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      if (!open || e.currentTarget.parentElement?.closest(INTERACTIVE_ANCESTOR)) return;
      e.preventDefault();
      e.stopPropagation();
      open({ userId, name, email }, e.currentTarget);
    },
    [open, userId, name, email],
  );

  return open && hasTarget ? { onClick, onKeyDown } : undefined;
}

/** A person's name that opens their card on click. */
export function UserName({
  userId,
  name,
  email,
  className,
  children,
}: UserCardTarget & { className?: string; children?: React.ReactNode }) {
  const trigger = useUserCardTrigger({ userId, name, email });
  return (
    <span
      className={cn(trigger && "cursor-pointer hover:underline underline-offset-2", className)}
      onClick={trigger?.onClick}
      onKeyDown={trigger?.onKeyDown}
    >
      {children ?? name}
    </span>
  );
}

// ── Provider + the single popover instance ──────────────────────────────────

type CardState = { who: UserCardTarget; anchor: HTMLElement; key: string };

export function UserCardProvider({
  users,
  viewerId,
  viewerIsManager,
  children,
}: {
  /** Everyone the card can show, loaded once by the dashboard layout. */
  users: UserCardUser[];
  viewerId: string;
  viewerIsManager: boolean;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<CardState | null>(null);

  // Most call sites only know a display name, so resolve by id, then email, then name.
  const find = useMemo(() => {
    const byId = new Map<string, UserCardUser>();
    const byEmail = new Map<string, UserCardUser>();
    const byName = new Map<string, UserCardUser>();
    for (const u of users) {
      byId.set(u.id, u);
      byEmail.set(u.email.toLowerCase(), u);
      const key = u.name?.trim().toLowerCase();
      // Two users sharing a name: prefer the active account.
      if (key && (!byName.has(key) || (!byName.get(key)!.isActive && u.isActive))) byName.set(key, u);
    }
    return ({ userId, email, name }: UserCardTarget) =>
      (userId && byId.get(userId)) ||
      (email && byEmail.get(email.trim().toLowerCase())) ||
      (name && byName.get(name.trim().toLowerCase())) ||
      null;
  }, [users]);
  const shown = state ? find(state.who) : null;
  const anchorRef = useRef<{ getBoundingClientRect: () => DOMRect } | null>(null);
  // Clicking the same avatar again should close the card, not close-then-reopen it.
  const lastDismiss = useRef<{ el: Element | null; at: number }>({ el: null, at: 0 });

  const open = useCallback<OpenUserCard>((who, anchor) => {
    const { el, at } = lastDismiss.current;
    if (el && anchor.contains(el) && Date.now() - at < 400) return;
    // If the avatar unmounts (e.g. the popover it lived in closes), stay where it last was.
    let lastRect = anchor.getBoundingClientRect();
    anchorRef.current = {
      getBoundingClientRect: () => (anchor.isConnected ? (lastRect = anchor.getBoundingClientRect()) : lastRect),
    };
    setState({ who, anchor, key: `${who.userId ?? ""}|${who.email ?? ""}|${who.name ?? ""}` });
  }, []);

  return (
    <UserCardContext.Provider value={open}>
      {children}
      <PopoverPrimitive.Root open={Boolean(state)} onOpenChange={(o) => !o && setState(null)}>
        <PopoverPrimitive.Anchor virtualRef={anchorRef} />
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            side="bottom"
            align="start"
            sideOffset={6}
            collisionPadding={12}
            onOpenAutoFocus={(e) => e.preventDefault()}
            onInteractOutside={(e) => {
              lastDismiss.current = { el: e.target as Element, at: Date.now() };
            }}
            // Clicks inside the card must not count as "outside" for a popover/drawer it was opened from.
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="z-[100] w-[340px] max-w-[calc(100vw-24px)] rounded-xl border bg-popover p-2 text-popover-foreground shadow-xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          >
            {state && (
              <UserCardBody
                key={state.key}
                data={shown}
                who={state.who}
                canViewProfile={Boolean(shown) && (viewerIsManager || shown!.id === viewerId)}
                onNavigate={() => setState(null)}
              />
            )}
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </UserCardContext.Provider>
  );
}

// ── Card contents ───────────────────────────────────────────────────────────

function UserCardBody({
  data,
  who,
  canViewProfile,
  onNavigate,
}: {
  data: UserCardUser | null;
  who: UserCardTarget;
  canViewProfile: boolean;
  onNavigate: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const displayName = data?.name || who.name || data?.email || who.email || "User";

  const copyEmail = async () => {
    if (!data?.email) return;
    try {
      await navigator.clipboard.writeText(data.email);
    } catch {
      // Older browsers / insecure origins: fall back to a hidden textarea.
      const ta = document.createElement("textarea");
      ta.value = data.email;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  if (!data) {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-muted/60 p-3">
        <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-sm font-bold", getAvatarColor(displayName))}>
          {getInitials(displayName)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{displayName}</p>
          <p className="text-xs text-muted-foreground">No WinOS profile found for this person.</p>
        </div>
      </div>
    );
  }

  const presence = presenceView(data.presence, data.isActive);

  return (
    <div className="space-y-1">
      {/* ── Header: photo + name, email, actions ── */}
      <div className="flex gap-3 rounded-lg bg-muted/60 p-2">
        <div className="relative shrink-0">
          <span
            className={cn(
              "flex h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-lg text-2xl font-bold",
              getAvatarColor(displayName),
            )}
          >
            {getInitials(displayName)}
            {data.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.image}
                alt={displayName}
                className="absolute inset-0 h-full w-full rounded-lg object-cover"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            )}
          </span>
          <span
            className={cn("absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-muted", presence.dot)}
            title={presence.label}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold leading-tight" title={displayName}>
              {displayName}
            </p>
            <div className="mt-1 flex min-w-0 items-center gap-1.5">
              <span className="truncate text-xs font-medium" title={data.email}>
                {data.email}
              </span>
              <button
                type="button"
                onClick={copyEmail}
                className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                title={copied ? "Copied" : "Copy email"}
                aria-label="Copy email"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <div className="mt-2 flex gap-1.5">
            <a
              href={`mailto:${data.email}`}
              onClick={onNavigate}
              className={ACTION_BTN}
              title={`Email ${displayName}`}
              aria-label="Send email"
            >
              <Mail className="h-4 w-4" />
            </a>
            {canViewProfile && (
              <Link
                href={ROUTES.settingsUsersEdit(data.id)}
                onClick={onNavigate}
                className={ACTION_BTN}
                title="View profile"
                aria-label="View profile"
              >
                <Info className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Today's status ── */}
      <div className="flex items-center gap-2.5 px-1.5 pt-1.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Home className="h-4 w-4" />
        </span>
        <span className={cn("text-sm font-semibold", presence.text)}>{presence.label}</span>
      </div>

      {/* ── Department + designation ── */}
      {(data.department || data.title) && (
        <div className="flex items-start gap-2.5 px-1.5 pb-1.5 pt-1">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Building2 className="h-4 w-4" />
          </span>
          <div className="min-w-0 pt-0.5">
            {data.department && <p className="truncate text-sm">{data.department}</p>}
            {data.title && <p className="truncate text-xs font-semibold text-muted-foreground">{data.title}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

const ACTION_BTN =
  "inline-flex h-8 w-11 items-center justify-center rounded-md border border-border/60 bg-background text-foreground transition-colors hover:bg-accent";

function presenceView(p: UserCardPresence, isActive: boolean): { label: string; text: string; dot: string } {
  if (!isActive) return { label: "Inactive", text: "text-muted-foreground", dot: "bg-zinc-400" };
  switch (p.kind) {
    case "LIVE":
      return {
        label: p.workMode === "REMOTE" ? "Remote In" : "In Office",
        text: "text-emerald-600 dark:text-emerald-500",
        dot: "bg-emerald-500",
      };
    case "CHECKED_OUT":
      return {
        label: p.at ? `Checked Out at ${p.at}` : "Checked Out",
        text: "text-muted-foreground",
        dot: "bg-zinc-400",
      };
    case "ON_LEAVE":
      return { label: "On Leave", text: "text-amber-600 dark:text-amber-500", dot: "bg-amber-500" };
    default:
      return { label: "Not Checked In", text: "text-muted-foreground", dot: "bg-zinc-400" };
  }
}
