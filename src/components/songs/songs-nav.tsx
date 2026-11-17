import Link from "next/link";
import clsx from "clsx";
import { BarChart3, Library, Plus, Rows3 } from "lucide-react";
import { getI18n } from "@/i18n/server";

/** Tabs of the music section (feed is full-screen, the rest live in the site layout). */
export async function SongsNav({ active }: { active: "library" | "chart" | "new" | "song" }) {
  const { t } = await getI18n();
  const s = t.songs;
  const items = [
    { href: "/songs", label: s.feed, icon: <Rows3 size={16} />, id: "feed" },
    { href: "/songs/library", label: s.library, icon: <Library size={16} />, id: "library" },
    { href: "/songs/chart", label: s.chart, icon: <BarChart3 size={16} />, id: "chart" },
    { href: "/songs/new", label: s.upload, icon: <Plus size={16} />, id: "new" },
  ];
  return (
    <nav className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
      {items.map((i) => (
        <Link
          key={i.id}
          href={i.href}
          className={clsx("flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ring-1 transition", i.id === active ? "bg-white text-black ring-white" : "text-muted ring-line hover:text-text")}
        >
          {i.icon} {i.label}
        </Link>
      ))}
    </nav>
  );
}
