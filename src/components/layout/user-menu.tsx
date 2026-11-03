"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Clapperboard, Crown, Languages, LogOut, Shield, User, Wallet } from "lucide-react";
import { Avatar, VipBadge } from "@/components/ui/misc";
import { useI18n } from "@/i18n/client";
import { logoutAction, setLocaleAction } from "@/app/actions/auth";

type Props = { user: { name: string; email: string; hue: number; role: string; vip: boolean } };

export function UserMenu({ user }: Props) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const item = "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-text/90 hover:bg-white/6";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t.nav.profile}
        aria-expanded={open}
        className="rounded-full ring-2 ring-transparent transition hover:ring-white/20"
      >
        <Avatar name={user.name} hue={user.hue} size={36} />
      </button>
      {open && (
        <div className="glass animate-pop absolute right-0 mt-2 w-64 origin-top-right rounded-2xl p-2 shadow-2xl">
          <div className="flex items-center gap-3 px-3 py-2.5">
            <Avatar name={user.name} hue={user.hue} size={40} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 truncate font-semibold">
                {user.name} {user.vip && <VipBadge />}
              </div>
              <div className="truncate text-xs text-muted">{user.email}</div>
            </div>
          </div>
          <div className="my-1 h-px bg-line" />
          <Link href="/me" className={item} onClick={() => setOpen(false)}>
            <User size={18} /> {t.nav.profile}
          </Link>
          <Link href="/me/wallet" className={item} onClick={() => setOpen(false)}>
            <Wallet size={18} /> {t.nav.wallet}
          </Link>
          <Link href="/vip" className={item} onClick={() => setOpen(false)}>
            <Crown size={18} className="text-vip" /> {t.nav.vip}
          </Link>
          {(user.role === "CREATOR" || user.role === "ADMIN") && (
            <Link href="/studio" className={item} onClick={() => setOpen(false)}>
              <Clapperboard size={18} /> {t.nav.studio}
            </Link>
          )}
          {user.role === "ADMIN" && (
            <Link href="/admin" className={item} onClick={() => setOpen(false)}>
              <Shield size={18} /> {t.nav.admin}
            </Link>
          )}
          <button className={item} onClick={() => start(() => setLocaleAction(locale === "ru" ? "en" : "ru"))}>
            <Languages size={18} /> {locale === "ru" ? "English" : "Русский"}
          </button>
          <div className="my-1 h-px bg-line" />
          <form action={logoutAction}>
            <button className={item}>
              <LogOut size={18} /> {t.nav.logout}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
