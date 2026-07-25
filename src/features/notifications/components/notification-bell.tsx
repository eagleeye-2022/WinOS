"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Bell, Check, CheckCheck, Clock3 } from "lucide-react";
import { useRouter } from "next/navigation";
import { markNotificationRead, markAllNotificationsRead, type MarkReadState } from "../actions/mark-read";
import type { NotificationItem } from "../queries";

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(date: Date): string {
  const ms = Date.now() - new Date(date).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Single notification row ───────────────────────────────────────────────────

function NotifRow({
  notif,
  onRead,
}: {
  notif: NotificationItem;
  onRead: () => void;
}) {
  const [state, action, pending] = useActionState<MarkReadState, FormData>(
    markNotificationRead,
    {}
  );

  useEffect(() => {
    if (state.message === "marked") onRead();
  }, [state.message, onRead]);

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-accent/50 ${
        !notif.readAt ? "bg-primary/5" : ""
      }`}
    >
      {/* Icon */}
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100">
        <Clock3 size={13} className="text-amber-600" />
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${!notif.readAt ? "font-semibold" : "font-medium"}`}>
          {notif.title}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {notif.message}
        </p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          {timeAgo(notif.createdAt)} · from {notif.createdBy.name?.split(" ")[0] ?? "Manager"}
        </p>
      </div>

      {/* Mark read button */}
      {!notif.readAt && (
        <form action={action} className="shrink-0">
          <input type="hidden" name="notificationId" value={notif.id} />
          <button
            type="submit"
            disabled={pending}
            title="Mark as read"
            className="rounded-full p-1 text-muted-foreground/40 transition-colors hover:bg-accent hover:text-primary"
          >
            <Check size={13} />
          </button>
        </form>
      )}

      {notif.readAt && (
        <span className="shrink-0 mt-0.5 text-muted-foreground/30">
          <CheckCheck size={13} />
        </span>
      )}
    </div>
  );
}

// ── Mark-all action wrapper ───────────────────────────────────────────────────

function MarkAllButton({ onDone }: { onDone: () => void }) {
  const [state, action, pending] = useActionState<MarkReadState, FormData>(
    markAllNotificationsRead,
    {}
  );

  useEffect(() => {
    if (state.message === "all_marked") onDone();
  }, [state.message, onDone]);

  return (
    <form action={action}>
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-primary hover:underline disabled:opacity-50"
      >
        {pending ? "Marking…" : "Mark all read"}
      </button>
    </form>
  );
}

// ── Main bell component ───────────────────────────────────────────────────────

type Props = {
  initialUnread: number;
  initialNotifications: NotificationItem[];
};

export function NotificationBell({ initialUnread, initialNotifications }: Props) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [notifications, setNotifications] = useState(initialNotifications);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date() } : n))
    );
    setUnread((c) => Math.max(0, c - 1));
    router.refresh();
  }

  function handleAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date() })));
    setUnread(0);
    router.refresh();
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent"
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border bg-card shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Notifications</span>
              {unread > 0 && (
                <span className="rounded-full bg-destructive px-1.5 py-0.5 text-xs font-bold text-destructive-foreground">
                  {unread}
                </span>
              )}
            </div>
            {unread > 0 && <MarkAllButton onDone={handleAllRead} />}
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto divide-y">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-sm text-muted-foreground">
                <Bell size={24} className="mb-2 opacity-30" />
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <NotifRow
                  key={n.id}
                  notif={n}
                  onRead={() => handleRead(n.id)}
                />
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t px-4 py-2.5 text-center">
              <span className="text-xs text-muted-foreground">
                Showing {notifications.length} notification{notifications.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
