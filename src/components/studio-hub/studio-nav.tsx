"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useI18n } from "@/i18n/client";

/** Creator cabinet tabs (scrolls horizontally on phones). */
export function StudioNav({ hot }: { hot: number }) {
  const { t } = useI18n();
  const path = usePathname();
  const n = t.v3.studio.nav;
  const items = [
    { href: "/studio", label: n.overview, exact: true },
    { href: "/studio/bounty", label: n.bounty, badge: hot },
    { href: "/studio/tv", label: n.upload },
    { href: "/studio/works", label: n.works },
    { href: "/studio/planner", label: n.planner },
    { href: "/studio/analytics", label: n.analytics },
    { href: "/studio/generate", label: n.generate },
    { href: "/studio/invites", label: n.invites },
    { href: "/studio/payouts", label: n.payouts },
  ];
  return (
    <nav className="no-scrollbar -mx-4 mb-8 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0" aria-label="Studio">
      {items.map((i) => {
        const active = i.exact ? path === i.href : path.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            className={clsx("flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors", active ? "bg-white text-black" : "bg-white/[.06] text-muted ring-1 ring-white/10 hover:text-text")}
          >
            {i.label}
            {!!i.badge && <span className="rounded-full bg-[#ff3b3b] px-1.5 text-[11px] font-black text-white">🔥{i.badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
