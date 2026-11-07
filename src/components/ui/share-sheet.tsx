"use client";
import { useState, useSyncExternalStore } from "react";
import { Check, Link2, Mail, MessageCircle, Share2 } from "lucide-react";
import { Modal } from "./modal";
import { useToast } from "./toast";
import { useI18n } from "@/i18n/client";

type Target = { id: string; label: string; bg: string; href: (u: string, text: string) => string; icon: React.ReactNode };

const svg = (d: string) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden>
    <path d={d} />
  </svg>
);

const TARGETS: Target[] = [
  {
    id: "telegram",
    label: "Telegram",
    bg: "#229ED9",
    href: (u, text) => `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(text)}`,
    icon: svg("M21.9 4.3 18.6 19.8c-.2 1.1-.9 1.4-1.8.9l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1 9.3-8.4c.4-.4-.1-.6-.6-.2L6 13.4l-4.9-1.5c-1.1-.3-1.1-1.1.2-1.6L20.5 2.9c.9-.3 1.7.2 1.4 1.4z"),
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    bg: "#25D366",
    href: (u, text) => `https://wa.me/?text=${encodeURIComponent(`${text} ${u}`)}`,
    icon: <MessageCircle size={22} strokeWidth={2.2} />,
  },
  {
    id: "facebook",
    label: "Facebook",
    bg: "#1877F2",
    href: (u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}`,
    icon: svg("M14 8h3V4h-3c-2.8 0-4.5 1.8-4.5 4.6V10H7v4h2.5v8h4v-8H17l.6-4h-4.1V8.8c0-.5.3-.8.5-.8z"),
  },
  {
    id: "x",
    label: "X",
    bg: "#000000",
    href: (u, text) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(u)}&text=${encodeURIComponent(text)}`,
    icon: svg("M18.2 2.3h3.4l-7.4 8.4 8.7 11.5h-6.8l-5.3-7-6.1 7H1.3l7.9-9L.9 2.3h7l4.8 6.4zm-1.2 17.9h1.9L7.1 4.2H5.1z"),
  },
  {
    id: "vk",
    label: "VK",
    bg: "#0077FF",
    href: (u, text) => `https://vk.com/share.php?url=${encodeURIComponent(u)}&title=${encodeURIComponent(text)}`,
    icon: <span className="font-display text-[15px] font-black tracking-tight">VK</span>,
  },
  {
    id: "email",
    label: "Email",
    bg: "#3a3a4a",
    href: (u, text) => `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(`${text}\n${u}`)}`,
    icon: <Mail size={22} />,
  },
];

const noop = () => () => {};

/**
 * Share dialog: messengers and social networks, copy link, and the system share sheet where available.
 * Shows the link-preview card (the same image the messengers will show).
 */
export function ShareSheet({ open, onClose, url, text, image, title }: { open: boolean; onClose: () => void; url: string; text: string; image?: string; title?: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const canNative = useSyncExternalStore(noop, () => typeof navigator !== "undefined" && !!navigator.share, () => false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast(t.series.copied);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast(t.common.error, "error");
    }
  };

  return (
    <Modal open={open} onClose={onClose} label={t.share.title} className="max-w-md">
      <h2 className="font-display text-lg font-semibold">{t.share.title}</h2>
      <p className="mt-1 text-sm text-muted">{t.share.sub}</p>

      {image && (
        <div className="mt-4 overflow-hidden rounded-2xl bg-surface-2 ring-1 ring-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" className="aspect-[1200/630] w-full object-cover" />
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold">{title ?? text}</p>
            <p className="truncate text-xs text-muted">{url.replace(/^https?:\/\//, "")}</p>
          </div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-4 gap-3 sm:grid-cols-4">
        {TARGETS.map((x) => (
          <a
            key={x.id}
            href={x.href(url, text)}
            target={x.id === "email" ? undefined : "_blank"}
            rel="noopener noreferrer"
            className="group flex flex-col items-center gap-1.5 rounded-2xl p-1 text-center text-[11px] text-muted outline-none transition hover:text-text focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition group-hover:scale-105" style={{ background: x.bg }}>
              {x.icon}
            </span>
            {x.label}
          </a>
        ))}
        {canNative && (
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.share({ title: title ?? text, text, url });
                onClose();
              } catch {
                /* cancelled */
              }
            }}
            className="group flex flex-col items-center gap-1.5 rounded-2xl p-1 text-[11px] text-muted transition hover:text-text"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-3 text-white ring-1 ring-line transition group-hover:scale-105">
              <Share2 size={20} />
            </span>
            {t.share.more}
          </button>
        )}
      </div>

      <div className="mt-5 flex items-center gap-2 rounded-2xl bg-surface-2 p-1.5 pl-4 ring-1 ring-line">
        <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-muted">{url.replace(/^https?:\/\//, "")}</span>
        <button type="button" onClick={copy} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-sm font-semibold text-white">
          {copied ? <Check size={16} /> : <Link2 size={16} />} {copied ? t.share.copied : t.share.copy}
        </button>
      </div>
      {url.includes("/r/") && <p className="mt-3 text-xs text-muted">{t.share.refNote}</p>}
    </Modal>
  );
}

/** Builds the link a viewer shares: with their invite code when signed in (credits them for new sign-ups). */
export function shareUrl(path: string, refCode?: string | null) {
  return refCode ? `${location.origin}/r/${refCode}?to=${encodeURIComponent(path)}` : `${location.origin}${path}`;
}
