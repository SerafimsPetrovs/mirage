import Link from "next/link";
import clsx from "clsx";
import { prisma } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { pick } from "@/i18n/shared";
import { syncFactory } from "@/lib/tv-admin";
import { AutoRefresh, FactoryItemActions, IdeaForm, SuggestIdeasButton } from "@/components/tv/tv-admin-ui2";

const TONE: Record<string, string> = {
  DRAFT: "bg-white/10 text-muted",
  GENERATING: "bg-[#7dffb2]/15 text-[#7dffb2]",
  READY: "bg-coin/15 text-coin",
  ADDED: "bg-ok/15 text-ok",
  FAILED: "bg-red-500/15 text-red-300",
};

/** AI clip factory: the showrunner invents ideas for a channel, AI films them, one click puts them on air. */
export default async function AdminTvFactory({ searchParams }: { searchParams: Promise<{ ch?: string }> }) {
  const [{ t, locale }, sp] = await Promise.all([getI18n(), searchParams]);
  const m = t.tv.adm2;
  await syncFactory();
  const channels = await prisma.tvChannel.findMany({ where: { familyOnly: false }, orderBy: { number: "asc" } });
  const ch = channels.find((c) => c.id === sp.ch) ?? channels[0];
  if (!ch) return null;
  const items = await prisma.tvFactoryItem.findMany({ where: { channelId: ch.id }, orderBy: { createdAt: "desc" }, take: 60 });

  return (
    <div className="space-y-6">
      <AutoRefresh active={items.some((i) => i.status === "GENERATING")} />
      <p className="max-w-2xl text-muted">{m.factoryText}</p>
      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
        {channels.map((c) => (
          <Link
            key={c.id}
            href={`/admin/tv/factory?ch=${c.id}`}
            className={clsx("shrink-0 rounded-xl px-3 py-1.5 text-sm font-semibold ring-1", c.id === ch.id ? "bg-white text-black ring-white" : "text-muted ring-line hover:text-text")}
          >
            {String(c.number).padStart(2, "0")} · {pick(c, "name", locale)}
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SuggestIdeasButton channelId={ch.id} />
      </div>
      <IdeaForm channelId={ch.id} />
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((it) => (
          <li key={it.id} className="overflow-hidden rounded-3xl bg-surface ring-1 ring-line">
            {it.status === "READY" || it.status === "ADDED" ? (
              <video src={`/api/tv/factory/${it.id}`} muted playsInline controls preload="metadata" className="aspect-video w-full bg-black" />
            ) : (
              <div className={clsx("flex aspect-video items-center justify-center bg-surface-2 text-sm text-muted", it.status === "GENERATING" && "skeleton")}>{m.fstatus[it.status as keyof typeof m.fstatus]}</div>
            )}
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{it.title}</p>
                <span className={clsx("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", TONE[it.status])}>{m.fstatus[it.status as keyof typeof m.fstatus] ?? it.status}</span>
              </div>
              <p className="mt-1 line-clamp-3 text-xs text-muted">
                {t.tv.kinds[it.kind as keyof typeof t.tv.kinds]} · {it.prompt}
              </p>
              <div className="mt-3">
                <FactoryItemActions item={{ id: it.id, status: it.status }} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
