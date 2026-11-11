"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

/** Pill tabs inside /admin/tv. */
export function TvSubnav({ items }: { items: { href: string; label: string; badge?: number }[] }) {
  const path = usePathname();
  return (
    <nav className="no-scrollbar -mx-4 mb-6 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
      {items.map((i) => {
        const active = i.href === "/admin/tv" ? path === "/admin/tv" : path.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            className={clsx("shrink-0 rounded-full px-4 py-2 text-sm font-semibold ring-1 transition", active ? "bg-[#7dffb2] text-black ring-[#7dffb2]" : "text-muted ring-line hover:text-text")}
          >
            {i.label}
            {!!i.badge && <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white">{i.badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
