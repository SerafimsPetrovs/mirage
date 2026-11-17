import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, Check, Clapperboard, Gamepad2, PartyPopper, Smile, UtensilsCrossed } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { myParties } from "@/lib/party";
import { channelDTO, listChannels } from "@/lib/tv";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n/shared";
import { btn } from "@/components/ui/button";
import { PartyHubForm } from "@/components/party/create-party";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.party.hubTitle, description: t.party.hubSub };
}

const ICONS = [Clapperboard, Gamepad2, Smile, Check, BarChart3, UtensilsCrossed];

export default async function PartyHubPage() {
  const [{ t, locale }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  const p = t.party;
  const [channels, rooms] = await Promise.all([listChannels(user), user ? myParties(user.id) : Promise.resolve([])]);
  return (
    <div className="mx-auto max-w-5xl px-4 pb-12 pt-[calc(var(--header-h)+32px)] md:px-10">
      <header className="max-w-2xl">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#7dffb2]">
          <PartyPopper size={18} /> MIRAGE
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold md:text-5xl">{p.hubTitle}</h1>
        <p className="mt-3 text-lg text-muted">{p.hubSub}</p>
      </header>

      <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {p.features.map((f, i) => {
          const Icon = ICONS[i] ?? Check;
          return (
            <li key={f} className="flex items-start gap-3 rounded-2xl bg-white/[.03] p-4 ring-1 ring-line">
              <Icon size={20} className="mt-0.5 shrink-0 text-accent" />
              <span className="text-sm leading-relaxed">{f}</span>
            </li>
          );
        })}
      </ul>

      <section className="mt-10">
        {user && !user.kidsMode ? (
          <PartyHubForm
            channels={channels.map((c) => {
              const d = channelDTO(c, locale);
              return { slug: d.slug, label: `${d.number} · ${d.name}` };
            })}
          />
        ) : (
          <div className="rounded-3xl bg-surface p-6 text-center ring-1 ring-line">
            <p className="text-muted">{user ? p.errors.KIDS : p.errors.AUTH}</p>
            {!user && (
              <Link href="/register?next=/party" className={btn("primary", "md", "mt-4")}>
                {t.nav.register}
              </Link>
            )}
          </div>
        )}
      </section>

      {user && (
        <section className="mt-10">
          <h2 className="mb-3 font-display text-xl font-semibold">{p.myRooms}</h2>
          {rooms.length === 0 ? (
            <p className="rounded-2xl bg-white/[.03] p-5 text-sm text-muted ring-1 ring-line">{p.noRooms}</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {rooms.map((r) => (
                <li key={r.id}>
                  <Link href={`/party/${r.code}`} className="flex items-center gap-4 rounded-2xl bg-surface p-4 ring-1 ring-line transition hover:ring-white/20">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/15 font-mono text-xs font-bold text-accent">{r.code}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{r.title || p.hubTitle}</span>
                      <span className="block text-sm text-muted">{r.host.name} · {fmt(p.members, { n: r._count.members })}</span>
                    </span>
                    <span className={btn("glass", "sm")}>{p.open}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
