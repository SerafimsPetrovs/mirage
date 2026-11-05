"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import clsx from "clsx";
import { Clapperboard, Crown, Flame, Gift, Languages, LogOut, MessageCircleHeart, Shield, User, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { btn } from "@/components/ui/button";
import { Avatar, VipBadge } from "@/components/ui/misc";
import { useI18n } from "@/i18n/client";
import { logoutAction, setLocaleAction } from "@/app/actions/auth";
import { setAdultContentAction } from "@/app/actions/extras";

type Props = { user: { name: string; email: string; hue: number; role: string; vip: boolean; adult: boolean } };

export function UserMenu({ user }: Props) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [, start] = useTransition();
  const router = useRouter();
  const [ask18, setAsk18] = useState(false);
  const setAdult = (on: boolean) =>
    start(async () => {
      if ((await setAdultContentAction(on)).ok) router.refresh();
    });

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
        <div className="popover animate-pop absolute right-0 mt-2 w-64 origin-top-right rounded-2xl p-2">
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
          <Link href="/me/invite" className={item} onClick={() => setOpen(false)}>
            <Gift size={18} className="text-accent" /> {t.invite.nav}
          </Link>
          {user.adult && (
            <Link href="/me/chats" className={item} onClick={() => setOpen(false)}>
              <MessageCircleHeart size={18} /> {t.me.myChats}
            </Link>
          )}
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
          <button
            className={item}
            role="switch"
            aria-checked={user.adult}
            title={t.adult.toggleHint}
            onClick={() => {
              if (user.adult) setAdult(false);
              else {
                setOpen(false);
                setAsk18(true);
              }
            }}
          >
            <Flame size={18} className={user.adult ? "text-accent" : "text-muted"} />
            <span className="flex-1 text-left">{t.adult.toggle}</span>
            <span className={clsx("relative h-5 w-9 rounded-full transition", user.adult ? "bg-accent" : "bg-white/15")} aria-hidden>
              <span className={clsx("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all", user.adult ? "left-[18px]" : "left-0.5")} />
            </span>
          </button>
          <div className="my-1 h-px bg-line" />
          <form action={logoutAction}>
            <button className={item}>
              <LogOut size={18} /> {t.nav.logout}
            </button>
          </form>
        </div>
      )}
      <Modal open={ask18} onClose={() => setAsk18(false)} label={t.spicy.ageTitle} className="max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 font-display text-lg font-bold text-accent ring-1 ring-accent/40">18+</div>
        <h2 className="font-display text-xl font-bold">{t.spicy.ageTitle}</h2>
        <p className="mt-2 text-sm text-muted">{t.adult.wallText}</p>
        <p className="mt-2 text-xs text-muted">{t.adult.declaration}</p>
        <button
          className={btn("primary", "lg", "mt-5 w-full")}
          onClick={() => {
            setAsk18(false);
            setAdult(true);
          }}
        >
          {t.adult.confirm}
        </button>
        <button className={btn("ghost", "md", "mt-2 w-full")} onClick={() => setAsk18(false)}>
          {t.common.cancel}
        </button>
      </Modal>
    </div>
  );
}
