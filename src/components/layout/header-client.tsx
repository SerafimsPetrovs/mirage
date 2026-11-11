"use client";
import Link from "next/link";
import { APPS_ENABLED } from "@/lib/features";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Boxes, LibraryBig, Radio } from "lucide-react";

export function HeaderShell({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header
      className={clsx(
        "fixed inset-x-0 top-0 z-50 h-[var(--header-h)] pt-[env(safe-area-inset-top)] transition-colors duration-300",
        scrolled ? "border-b border-line bg-bg/80 backdrop-blur-xl" : "bg-gradient-to-b from-bg/90 via-bg/40 to-transparent",
      )}
    >
      {children}
    </header>
  );
}

/** Live TV / Catalog / AI apps — one click between the three worlds of MIRAGE. */
export function SectionSwitch({ labels }: { labels: { live: string; catalog: string; apps: string } }) {
  const path = usePathname();
  const items = [
    { href: "/", label: labels.live, icon: Radio, active: path === "/" || path.startsWith("/tv") },
    {
      href: "/library",
      label: labels.catalog,
      icon: LibraryBig,
      active: ["/library", "/browse", "/series", "/feed", "/search", "/watch"].some((p) => path.startsWith(p)),
    },
    ...(APPS_ENABLED ? [{ href: "/apps", label: labels.apps, icon: Boxes, active: path.startsWith("/apps") }] : []),
  ];
  return (
    <nav className="hidden items-center gap-1 rounded-full bg-white/[.06] p-1 ring-1 ring-white/10 backdrop-blur md:flex" aria-label="MIRAGE">
      {items.map(({ href, label, icon: Icon, active }) => (
        <Link
          key={href}
          href={href}
          aria-current={active ? "page" : undefined}
          className={clsx(
            "flex h-9 items-center gap-2 rounded-full px-3.5 text-[14px] font-semibold transition-colors lg:px-4",
            active ? "bg-white text-black" : "text-muted hover:text-text",
          )}
        >
          <Icon size={16} className={clsx(active && href === "/" && "text-accent")} />
          {label}
          {href === "/" && <span className={clsx("h-1.5 w-1.5 rounded-full bg-accent", !active && "animate-pulse")} />}
        </Link>
      ))}
    </nav>
  );
}
