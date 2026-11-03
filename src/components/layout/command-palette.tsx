"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ArrowRight, Clock, Compass, Crown, CornerDownLeft, Loader2, Search, Sparkles, X, Zap } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { fmt, plural } from "@/i18n/shared";

type Hit = { slug: string; title: string; tagline: string; poster: string; orientation: "VERTICAL" | "HORIZONTAL"; episodes: number; aiModels: string[] };
type Row = { key: string; href: string; render: () => React.ReactNode };

export const OPEN_SEARCH_EVENT = "mirage:search";
const RECENT_KEY = "mirage:recent-searches";

function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]").slice(0, 5);
  } catch {
    return [];
  }
}

export function CommandPalette() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [doneFor, setDoneFor] = useState("");
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const show = useCallback(() => {
    setRecent(readRecent());
    setOpen(true);
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setHits([]);
    setActive(0);
  }, []);

  // Global shortcuts: Ctrl/Cmd+K anywhere, "/" outside of text fields.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest("input,textarea,select,[contenteditable=true]");
      if ((e.key === "k" || e.key === "K" || e.key === "л" || e.key === "Л") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (open) close();
        else show();
      } else if (e.key === "/" && !typing && !open) {
        e.preventDefault();
        show();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_SEARCH_EVENT, show);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_SEARCH_EVENT, show);
    };
  }, [open, show, close]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Debounced search
  useEffect(() => {
    const query = q.trim();
    if (!query) return;
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: ctrl.signal });
        setHits(await r.json());
        setDoneFor(query);
        setActive(0);
      } catch {
        /* aborted */
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 160);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [q]);

  const remember = (term: string) => {
    const v = term.trim();
    if (!v) return;
    const next = [v, ...readRecent().filter((x) => x.toLowerCase() !== v.toLowerCase())].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  };

  const query = q.trim();
  const rows: Row[] = [];
  if (query) {
    for (const h of hits)
      rows.push({
        key: h.slug,
        href: `/series/${h.slug}`,
        render: () => (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={h.poster} alt="" className={clsx("shrink-0 rounded-lg object-cover", h.orientation === "VERTICAL" ? "h-14 w-[31px]" : "h-[31px] w-14")} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{h.title}</span>
              <span className="block truncate text-xs text-muted">
                {h.episodes} {plural(h.episodes, t.common.episodes, locale)}
                {h.aiModels.length > 0 && <> · {h.aiModels.join(", ")}</>}
                {h.tagline && <> · {h.tagline}</>}
              </span>
            </span>
          </>
        ),
      });
    rows.push({
      key: "__all",
      href: `/search?q=${encodeURIComponent(query)}`,
      render: () => (
        <>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-3"><Search size={17} /></span>
          <span className="flex-1 truncate">{fmt(t.search.palette.all, { q: query })}</span>
        </>
      ),
    });
  } else {
    for (const r of recent)
      rows.push({
        key: "r:" + r,
        href: `/search?q=${encodeURIComponent(r)}`,
        render: () => (
          <>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-muted"><Clock size={16} /></span>
            <span className="flex-1 truncate">{r}</span>
          </>
        ),
      });
    const quick = [
      { href: "/feed", label: t.nav.feed, icon: Zap, cls: "text-accent" },
      { href: "/browse", label: t.nav.browse, icon: Compass, cls: "text-text" },
      { href: "/vip", label: "VIP", icon: Crown, cls: "text-vip" },
      { href: "/creators", label: t.footer.creators, icon: Sparkles, cls: "text-coin" },
    ];
    for (const l of quick)
      rows.push({
        key: "q:" + l.href,
        href: l.href,
        render: () => (
          <>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-3"><l.icon size={17} className={l.cls} /></span>
            <span className="flex-1 truncate">{l.label}</span>
          </>
        ),
      });
  }

  const go = (row: Row | undefined) => {
    if (!row) return;
    remember(row.key.startsWith("r:") ? row.key.slice(2) : row.key.startsWith("q:") ? "" : query);
    router.push(row.href);
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") close();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % Math.max(1, rows.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + rows.length) % Math.max(1, rows.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(rows[active]);
    }
  };

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;
  const recentCount = query ? 0 : recent.length;

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center p-0 sm:p-4 sm:pt-[12vh]" role="dialog" aria-modal="true" aria-label={t.nav.search} onKeyDown={onKeyDown}>
      <button aria-label={t.search.palette.close} onClick={close} className="absolute inset-0 bg-black/60 backdrop-blur-sm motion-safe:animate-[fade-up_.15s_ease-out_both]" />
      <div className="animate-pop relative flex h-full w-full flex-col overflow-hidden bg-surface shadow-[0_30px_120px_-20px_rgba(124,92,255,.35)] ring-1 ring-line sm:h-auto sm:max-h-[70vh] sm:max-w-xl sm:rounded-3xl">
        <div className="flex items-center gap-3 border-b border-line px-4 pt-[env(safe-area-inset-top)] sm:pt-0">
          {loading ? <Loader2 size={20} className="shrink-0 animate-spin text-muted" /> : <Search size={20} className="shrink-0 text-muted" />}
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              if (!e.target.value.trim()) setHits([]);
              setActive(0);
            }}
            placeholder={t.search.palette.hint}
            aria-label={t.nav.search}
            aria-activedescendant={rows[active] ? `pal-${active}` : undefined}
            className="h-16 min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-muted/70"
            style={{ outline: "none" }}
          />
          <button onClick={close} aria-label={t.search.palette.close} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-white/8 hover:text-text">
            <X size={18} />
          </button>
        </div>

        <div ref={listRef} role="listbox" className="flex-1 overflow-y-auto p-2">
          {!query && recentCount > 0 && (
            <div className="flex items-center justify-between px-3 pb-1 pt-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">{t.search.palette.recent}</p>
              <button
                onClick={() => {
                  localStorage.removeItem(RECENT_KEY);
                  setRecent([]);
                  setActive(0);
                }}
                className="text-xs text-muted hover:text-text"
              >
                {t.search.palette.clear}
              </button>
            </div>
          )}
          {rows.map((row, i) => (
            <div key={row.key}>
              {!query && i === recentCount && <p className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-muted">{t.search.palette.quick}</p>}
              <button
                id={`pal-${i}`}
                data-idx={i}
                role="option"
                aria-selected={i === active}
                onMouseMove={() => setActive(i)}
                onClick={() => go(row)}
                className={clsx("flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-[15px] transition-colors", i === active ? "bg-white/8" : "")}
              >
                {row.render()}
                <ArrowRight size={16} className={clsx("shrink-0 text-muted transition", i === active ? "opacity-100" : "opacity-0")} />
              </button>
            </div>
          ))}
          {query && !loading && doneFor === query && hits.length === 0 && <p className="px-3 py-4 text-sm text-muted">{t.search.none}</p>}
        </div>

        <div className="hidden items-center gap-4 border-t border-line px-4 py-2.5 text-[11px] text-muted sm:flex">
          <span className="inline-flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> {t.search.palette.navigate}</span>
          <span className="inline-flex items-center gap-1"><Kbd><CornerDownLeft size={11} /></Kbd> {t.search.palette.open}</span>
          <span className="inline-flex items-center gap-1"><Kbd>Esc</Kbd> {t.search.palette.close}</span>
        </div>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-surface-3 px-1 font-sans text-[11px] text-text/80 ring-1 ring-line">{children}</kbd>;
}

/** Header search button: opens the palette instead of navigating. */
export function SearchButton({ label }: { label: string }) {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event(OPEN_SEARCH_EVENT))}
      aria-label={label}
      aria-keyshortcuts="Control+K"
      className="inline-flex h-10 items-center gap-2 rounded-full px-2.5 text-muted transition hover:bg-white/8 hover:text-text md:bg-surface/60 md:pl-3 md:pr-2 md:ring-1 md:ring-line"
    >
      <Search size={19} strokeWidth={1.75} />
      <span className="hidden text-sm lg:inline">{label}</span>
      <kbd className="hidden h-6 items-center rounded-md bg-surface-3 px-1.5 font-sans text-[11px] text-muted ring-1 ring-line md:inline-flex">Ctrl K</kbd>
    </button>
  );
}
