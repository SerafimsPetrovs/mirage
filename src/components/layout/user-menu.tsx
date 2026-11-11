"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import clsx from "clsx";
import {
  BarChart3,
  Bookmark,
  CalendarClock,
  Clapperboard,
  Crown,
  Flame,
  Gem,
  Gift,
  KeyRound,
  Languages,
  LibraryBig,
  LogOut,
  MessageCircleHeart,
  Plus,
  Smile,
  Radio,
  ShieldCheck,
  Sparkles,
  Upload,
  User,
  Wallet,
  Wrench,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { btn } from "@/components/ui/button";
import { Avatar, CoinAmount, VipBadge } from "@/components/ui/misc";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/shared";
import { logoutAction, setLocaleAction } from "@/app/actions/auth";
import { setAdultContentAction } from "@/app/actions/extras";
import { InstallAppItem } from "@/components/pwa/pwa";

type Props = { user: { name: string; email: string; hue: number; role: string; vip: boolean; adult: boolean; coins: number; gold: number }; hot?: number };

/**
 * The main menu, TV first: the broadcast (guide, full screen, order a show, gold quests), then the account,
 * the TV studio for creators and the control room for admins. The series catalog is one small section.
 */
export function UserMenu({ user, hot = 0 }: Props) {
  const { t, locale } = useI18n();
  const m = t.v3.menu;
  const n = t.v3.nav;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [, start] = useTransition();
  const router = useRouter();
  const [ask18, setAsk18] = useState(false);
  const creator = user.role === "CREATOR" || user.role === "ADMIN";
  const admin = user.role === "ADMIN";
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

  const close = () => setOpen(false);
  const L = MenuLink;
  const Section = MenuSection;

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label={t.nav.profile} aria-expanded={open} className="relative rounded-full ring-2 ring-transparent transition hover:ring-white/20">
        <Avatar name={user.name} hue={user.hue} size={36} />
        {creator && hot > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff3b3b] px-1 text-[10px] font-black text-white ring-2 ring-bg">{hot}</span>}
      </button>
      {open && (
        <div className="popover animate-pop absolute right-0 mt-2 max-h-[calc(100dvh-var(--header-h)-16px)] w-[300px] origin-top-right overflow-y-auto rounded-2xl p-2">
          <div className="flex items-center gap-3 px-3 py-2.5">
            <Avatar name={user.name} hue={user.hue} size={40} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 truncate font-semibold">
                {user.name} {user.vip && <VipBadge />}
              </div>
              <div className="truncate text-xs text-muted">{user.email}</div>
            </div>
          </div>
          <Link href="/me/wallet" onClick={close} className="mx-1 mb-1 flex items-center justify-between gap-2 rounded-xl bg-white/[.05] px-3 py-2.5 ring-1 ring-white/10 hover:bg-white/[.08]">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">{m.balance}</span>
            <span className="flex items-center gap-3 text-sm">
              <CoinAmount value={user.coins} size={14} />
              <span className="flex items-center gap-1 font-semibold tabular-nums text-amber-300">
                <Gem size={13} /> {user.gold}
              </span>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-coin text-black">
                <Plus size={14} strokeWidth={2.6} />
              </span>
            </span>
          </Link>

          <Section title={m.tv}>
            <L onClick={close} href="/tv/guide" icon={<CalendarClock size={18} className="text-[#7dffb2]" />}>{m.guide}</L>
            <L onClick={close} href="/?order=1" icon={<Sparkles size={18} className="text-coin" />}>{m.order}</L>
            <L onClick={close} href="/me/buddy" icon={<Smile size={18} className="text-[#3ee6c8]" />}>{t.buddy.menu}</L>
            <L onClick={close} href="/me/wallet" icon={<Gem size={18} className="text-amber-300" />}>{m.gold}</L>
          </Section>

          <div className="h-px bg-line" />
          <Section title={m.account}>
            <L onClick={close} href="/me" icon={<User size={18} />}>{n.profile}</L>
            <L onClick={close} href="/me/wallet" icon={<Wallet size={18} />}>{n.wallet}</L>
            <L onClick={close} href="/me#family" icon={<KeyRound size={18} className="text-sky-300" />}>{n.pin}</L>
            <L onClick={close} href="/me/invite" icon={<Gift size={18} className="text-accent" />}>{t.invite.nav}</L>
            {!user.vip && <L onClick={close} href="/vip" icon={<Crown size={18} className="text-vip" />}>{t.nav.vip}</L>}
          </Section>

          <div className="h-px bg-line" />
          <Section title={m.catalog}>
            <L onClick={close} href="/library" icon={<LibraryBig size={18} />}>{m.catalogLink}</L>
            <L onClick={close} href="/me#list" icon={<Bookmark size={18} />}>{n.shelf}</L>
            {user.adult && <L onClick={close} href="/me/chats" icon={<MessageCircleHeart size={18} />}>{t.me.myChats}</L>}
          </Section>

          <div className="h-px bg-line" />
          {creator ? (
            <Section title={m.studio} tone="text-accent">
              <L onClick={close} href="/studio/bounty" icon={<BarChart3 size={18} className="text-[#7dffb2]" />}>
                <span className="flex items-center gap-2">
                  {n.bountyHub}
                  {hot > 0 && <span className="shrink-0 animate-pulse whitespace-nowrap rounded-full bg-[#ff3b3b] px-1.5 py-0.5 text-[10px] font-black uppercase text-white">🔥 {fmt(n.hotBounties, { n: hot })}</span>}
                </span>
              </L>
              <L onClick={close} href="/studio/tv" icon={<Upload size={18} className="text-coin" />}>{m.upload}</L>
              <L onClick={close} href="/studio/works" icon={<Clapperboard size={18} />}>{n.myWorks}</L>
              <L onClick={close} href="/studio/payouts" icon={<Wallet size={18} />}>{n.finance}</L>
            </Section>
          ) : (
            <Section title={m.studio}>
              <L onClick={close} href="/creators" icon={<Clapperboard size={18} />}>{t.me.becomeCreator}</L>
            </Section>
          )}

          {admin && (
            <>
              <div className="h-px bg-line" />
              <Section title={n.secAdmin} tone="text-[#ff6b6b]">
                <L onClick={close} href="/admin/live-control" icon={<Radio size={18} className="text-[#ff3b3b]" />}>{n.liveControl}</L>
                <L onClick={close} href="/admin/tv/moderation" icon={<ShieldCheck size={18} />}>{n.moderation}</L>
                <L onClick={close} href="/admin" icon={<Wrench size={18} />}>{n.adminPanel}</L>
              </Section>
            </>
          )}

          <div className="h-px bg-line" />
          <div className="py-1">
            <button className={ITEM} onClick={() => start(() => setLocaleAction(locale === "ru" ? "en" : "ru"))}>
              <Languages size={18} /> {locale === "ru" ? "English" : "Русский"}
            </button>
            <button
              className={ITEM}
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
            <InstallAppItem className={ITEM} onDone={() => setOpen(false)} />
            <form action={logoutAction}>
              <button className={ITEM}>
                <LogOut size={18} /> {t.nav.logout}
              </button>
            </form>
          </div>
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

const ITEM = "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-text/90 hover:bg-white/6";

function MenuLink({ href, icon, children, onClick }: { href: string; icon: React.ReactNode; children: React.ReactNode; onClick: () => void }) {
  return (
    <Link href={href} className={ITEM} onClick={onClick}>
      {icon}
      <span className="min-w-0 flex-1">{children}</span>
    </Link>
  );
}

function MenuSection({ title, tone, children }: { title: string; tone?: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <div className={clsx("px-3 pb-1 pt-1.5 text-[11px] font-bold uppercase tracking-[.14em]", tone ?? "text-muted")}>{title}</div>
      {children}
    </div>
  );
}
