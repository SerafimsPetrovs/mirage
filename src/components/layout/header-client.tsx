"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";

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

export function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="hidden items-center gap-1 md:flex">
      {links.map((l) => {
        const base = l.href.split("#")[0];
        const active = base === "/" ? path === "/" : path.startsWith(base);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={clsx(
              "rounded-full px-3.5 py-2 text-[15px] font-medium transition-colors",
              active ? "text-text" : "text-muted hover:text-text",
            )}
          >
            {l.label}
            {active && <span className="mx-auto mt-0.5 block h-0.5 w-4 rounded-full bg-accent" />}
          </Link>
        );
      })}
    </nav>
  );
}
