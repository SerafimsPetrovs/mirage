import Link from "next/link";
import { Droplets, Ghost, Heart, Laugh, Sparkles, Swords } from "lucide-react";
import type { Dict } from "@/i18n/ru";

export const MOODS = [
  { key: "revenge", icon: Swords, hue: 350 },
  { key: "butterflies", icon: Heart, hue: 320 },
  { key: "cry", icon: Droplets, hue: 210 },
  { key: "thrill", icon: Ghost, hue: 130 },
  { key: "laugh", icon: Laugh, hue: 45 },
  { key: "wonder", icon: Sparkles, hue: 265 },
] as const;

export function MoodPicker({ t }: { t: Dict }) {
  return (
    <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1 md:grid md:grid-cols-6 md:px-10">
      {MOODS.map(({ key, icon: Icon, hue }) => (
        <Link
          key={key}
          href={`/browse?mood=${key}`}
          className="group relative flex h-24 w-36 shrink-0 flex-col justify-between overflow-hidden rounded-2xl p-3.5 ring-1 ring-line transition hover:ring-white/25 md:h-28 md:w-auto"
          style={{ background: `radial-gradient(120% 120% at 100% 0%, hsl(${hue} 85% 45% / .55), transparent 60%), var(--surface)` }}
        >
          <Icon size={22} strokeWidth={1.75} className="text-white/90 transition group-hover:scale-110" />
          <span className="text-sm font-semibold leading-tight">{t.moods[key]}</span>
        </Link>
      ))}
    </div>
  );
}
