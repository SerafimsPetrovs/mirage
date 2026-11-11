import { Clapperboard, Image as ImageIcon, MessageSquare, Mic, Music, Wrench } from "lucide-react";

const ICONS = { IMAGE: ImageIcon, VIDEO: Clapperboard, VOICE: Mic, MUSIC: Music, TEXT: MessageSquare, TOOLS: Wrench } as const;

/** App tile icon: a glossy squircle in the app's hue with its category glyph. */
export function AppIcon({ name, hue, category, size = 56 }: { name: string; hue: number; category: string; size?: number }) {
  const Icon = ICONS[category as keyof typeof ICONS] ?? Wrench;
  return (
    <span
      aria-hidden
      title={name}
      className="relative flex shrink-0 items-center justify-center rounded-[28%] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_8px_24px_-10px_rgba(0,0,0,.8)]"
      style={{ width: size, height: size, background: `linear-gradient(145deg, hsl(${hue} 85% 62%), hsl(${(hue + 40) % 360} 80% 42%))` }}
    >
      <Icon size={Math.round(size * 0.46)} strokeWidth={1.9} />
    </span>
  );
}
