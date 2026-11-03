"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Home, PlaySquare, Search, User } from "lucide-react";
import clsx from "clsx";
import { useI18n } from "@/i18n/client";

export function MobileTabBar({ overlay = false }: { overlay?: boolean }) {
  const { t } = useI18n();
  const path = usePathname();
  const tabs = [
    { href: "/", label: t.nav.home, icon: Home },
    { href: "/feed", label: t.nav.feed, icon: PlaySquare },
    { href: "/browse", label: t.nav.browse, icon: Compass },
    { href: "/search", label: t.nav.search, icon: Search },
    { href: "/me", label: t.nav.profile, icon: User },
  ];
  return (
    <nav
      className={clsx(
        "fixed inset-x-0 bottom-0 z-50 flex h-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] items-start justify-around border-t pb-[env(safe-area-inset-bottom)] md:hidden",
        overlay ? "border-white/5 bg-black/60 backdrop-blur-xl" : "border-line bg-bg/90 backdrop-blur-xl",
      )}
    >
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={clsx("flex h-[var(--tabbar-h)] flex-1 flex-col items-center justify-center gap-1 text-[10.5px] font-medium", active ? "text-text" : "text-muted")}
          >
            <Icon size={22} strokeWidth={active ? 2.2 : 1.75} className={active ? "text-accent" : ""} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
