import clsx from "clsx";
import { prisma } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { fmt, formatDate, pick } from "@/i18n/shared";
import { syncOrders } from "@/lib/tv";
import { ClipModeration, HideButton, OrderModeration } from "@/components/tv/tv-admin-ui";
import { MuteControls } from "@/components/tv/tv-admin-ui2";
import { mutedUsers } from "@/lib/tv-admin";

export default async function AdminTvPage() {
  const { t, locale } = await getI18n();
  const a = t.tv.admin;
  await syncOrders();
  const [review, recent, clips, tickers, messages, muted] = await Promise.all([
    prisma.tvOrder.findMany({ where: { status: { in: ["REVIEW", "GENERATING"] } }, orderBy: { createdAt: "asc" }, include: { user: { select: { name: true } }, channel: true } }),
    prisma.tvOrder.findMany({ where: { status: { notIn: ["REVIEW", "GENERATING"] } }, orderBy: { createdAt: "desc" }, take: 8, include: { user: { select: { name: true } }, channel: true } }),
    prisma.tvClip.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, include: { channel: true, creator: { select: { name: true } } } }),
    prisma.tvTicker.findMany({ orderBy: { createdAt: "desc" }, take: 15, include: { user: { select: { name: true } }, channel: true } }),
    prisma.tvMessage.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { user: { select: { id: true, name: true } }, channel: true } }),
    mutedUsers(),
  ]);
  const m2 = t.tv.adm2;
  const card = "rounded-3xl bg-surface p-5 ring-1 ring-line";
  const lists = [
    { kind: "ticker" as const, title: a.tickers, rows: tickers },
    { kind: "message" as const, title: a.messages, rows: messages },
  ];

  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-3 font-display text-xl font-bold">{a.orders}</h2>
        {!review.length && <p className={clsx(card, "text-center text-muted")}>{a.ordersEmpty}</p>}
        <div className="grid gap-4 md:grid-cols-2">
          {review.map((o) => (
            <article key={o.id} className={card}>
              <div className="flex items-center justify-between gap-2 text-xs text-muted">
                <span>
                  {pick(o.channel, "name", locale)} · {fmt(a.by, { name: o.user.name })}
                </span>
                <span className="rounded-full bg-surface-2 px-2 py-0.5 font-semibold">{t.tv.order.status[o.status as keyof typeof t.tv.order.status]}</span>
              </div>
              <p className="mt-2 font-semibold">{o.idea}</p>
              {o.prompt !== o.idea && (
                <p className="mt-1 text-sm text-muted">
                  {a.prompt}: {o.prompt}
                </p>
              )}
              {o.status === "REVIEW" ? (
                <video src={`/api/tv/order/${o.id}`} controls muted playsInline className="mt-3 aspect-video w-full rounded-2xl bg-black" />
              ) : (
                <p className="mt-3 rounded-2xl bg-surface-2 p-6 text-center text-sm text-muted">{a.noPreview}</p>
              )}
              <OrderModeration orderId={o.id} />
            </article>
          ))}
        </div>
        {!!recent.length && (
          <>
            <h3 className="mb-2 mt-6 text-sm font-semibold text-muted">{a.recent}</h3>
            <ul className="divide-y divide-line rounded-3xl bg-surface ring-1 ring-line">
              {recent.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className="min-w-0 truncate">
                    {o.idea} <span className="text-muted">· {o.user.name}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted">{t.tv.order.status[o.status as keyof typeof t.tv.order.status]}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-bold">{a.clips}</h2>
        {!clips.length && <p className={clsx(card, "text-center text-muted")}>{a.clipsEmpty}</p>}
        <div className="grid gap-4 md:grid-cols-2">
          {clips.map((c) => (
            <article key={c.id} className={card}>
              <div className="text-xs text-muted">
                {pick(c.channel, "name", locale)} · {t.tv.kinds[c.kind as keyof typeof t.tv.kinds]} · {fmt(a.by, { name: c.creator?.name ?? "—" })}
              </div>
              <p className="mt-1 font-semibold">{c.artist ? `${c.artist} — ${c.title}` : c.title}</p>
              <video src={`/api/tv/clip/${c.id}`} controls muted playsInline className="mt-3 aspect-video w-full rounded-2xl bg-black" />
              <ClipModeration clipId={c.id} />
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        {lists.map(({ kind, title, rows }) => (
          <div key={kind}>
            <h2 className="mb-3 font-display text-xl font-bold">{title}</h2>
            <ul className="divide-y divide-line rounded-3xl bg-surface ring-1 ring-line">
              {rows.map((r) => (
                <li key={r.id} className={clsx("flex items-start justify-between gap-3 px-5 py-3 text-sm", r.hidden && "opacity-40")}>
                  <span className="min-w-0 break-words">
                    <span className="font-semibold">{r.user.name}</span>: {r.text}
                    <span className="block text-xs text-muted">
                      {pick(r.channel, "name", locale)} · {formatDate(r.createdAt, locale)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    {kind === "message" && "id" in r.user && <MuteControls userId={r.user.id as string} compact />}
                    {r.hidden ? <span className="text-xs text-muted">{a.hidden}</span> : <HideButton kind={kind} id={r.id} />}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-bold">{m2.muted}</h2>
        {!muted.length ? (
          <p className={clsx(card, "text-center text-muted")}>{m2.mutedEmpty}</p>
        ) : (
          <ul className="divide-y divide-line rounded-3xl bg-surface ring-1 ring-line">
            {muted.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <span>
                  <span className="font-semibold">{u.name}</span> <span className="text-muted">{u.email}</span>
                  <span className="block text-xs text-muted">
                    {u.tvMutedUntil!.getUTCFullYear() > 9000 ? m2.forever : fmt(m2.until, { date: formatDate(u.tvMutedUntil!, locale) })}
                  </span>
                </span>
                <MuteControls userId={u.id} unmute />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
