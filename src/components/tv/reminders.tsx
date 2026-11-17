"use client";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, BellRing, X } from "lucide-react";
import clsx from "clsx";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/shared";

/**
 * "Remind me": programme reminders kept on this device (localStorage). A watcher mounted in the root layout
 * shows a banner (and a system notification when allowed) 2 minutes before the programme starts.
 * Works while MIRAGE is open in a tab or as the installed app; server push would need VAPID keys.
 */
export type Reminder = { id: string; slug: string; channel: string; title: string; at: number };

const KEY = "mirage_reminders";
const LEAD_MS = 2 * 60_000;
const EVENT = "mirage-reminders";

function read(): Reminder[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]") as Reminder[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
function write(list: Reminder[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-30)));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

let cache = "[]";
const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};
const snapshot = () => {
  try {
    cache = localStorage.getItem(KEY) ?? "[]";
  } catch {}
  return cache;
};

export function useReminders() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "[]");
  const list = (() => {
    try {
      return JSON.parse(raw) as Reminder[];
    } catch {
      return [];
    }
  })();
  const has = useCallback((id: string) => list.some((r) => r.id === id), [list]);
  const toggle = useCallback((r: Reminder) => {
    const cur = read();
    if (cur.some((x) => x.id === r.id)) write(cur.filter((x) => x.id !== r.id));
    else {
      write([...cur, r]);
      if (typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission().catch(() => {});
    }
  }, []);
  return { list, has, toggle };
}

export function ReminderBell({ reminder }: { reminder: Reminder }) {
  const { t } = useI18n();
  const { has, toggle } = useReminders();
  const on = has(reminder.id);
  return (
    <button
      type="button"
      onClick={() => toggle(reminder)}
      aria-pressed={on}
      aria-label={on ? t.reminders.off : t.reminders.on}
      title={on ? t.reminders.off : t.reminders.on}
      className={clsx("flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition", on ? "bg-coin/20 text-coin" : "text-white/50 hover:bg-white/10 hover:text-white")}
    >
      {on ? <BellRing size={16} /> : <Bell size={16} />}
    </button>
  );
}

/** Mounted once in the root layout: fires due reminders. */
export function ReminderWatcher() {
  const { t } = useI18n();
  const router = useRouter();
  const [due, setDue] = useState<Reminder | null>(null);
  useEffect(() => {
    const check = () => {
      const now = Date.now();
      const list = read();
      const ready = list.find((r) => r.at - now <= LEAD_MS && r.at - now > -5 * 60_000);
      // forget fired and long-past reminders
      const rest = list.filter((r) => r !== ready && r.at > now - 5 * 60_000);
      if (rest.length !== list.length) write(rest);
      if (!ready) return;
      setDue(ready);
      const mins = Math.max(0, Math.round((ready.at - now) / 60_000));
      const body = fmt(t.reminders.soon, { title: ready.title, channel: ready.channel, n: mins });
      try {
        if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState !== "visible") {
          const n = new Notification("MIRAGE", { body, icon: "/icons/icon-192.png", tag: ready.id });
          n.onclick = () => {
            window.focus();
            router.push(`/?ch=${encodeURIComponent(ready.slug)}`);
          };
        }
      } catch {}
    };
    check();
    const id = window.setInterval(check, 15_000);
    return () => clearInterval(id);
  }, [t, router]);
  if (!due) return null;
  return (
    <div role="status" className="fixed inset-x-3 top-[calc(var(--header-h)+10px)] z-[70] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-coin/30 bg-surface/95 p-3 shadow-2xl backdrop-blur-xl">
      <BellRing size={20} className="shrink-0 text-coin" />
      <p className="min-w-0 flex-1 text-sm">
        <span className="block truncate font-semibold">{due.title}</span>
        <span className="text-muted">{due.channel}</span>
      </p>
      <Link href={`/?ch=${encodeURIComponent(due.slug)}`} onClick={() => setDue(null)} className="shrink-0 rounded-full bg-coin px-3 py-1.5 text-sm font-bold text-black">
        {t.reminders.watch}
      </Link>
      <button type="button" onClick={() => setDue(null)} aria-label={t.common.close} className="rounded-full p-1 text-muted hover:text-text">
        <X size={16} />
      </button>
    </div>
  );
}
