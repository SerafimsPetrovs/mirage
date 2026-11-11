import type { Metadata } from "next";
import Link from "next/link";
import { Coins, DoorOpen, FileText, KeyRound, ShieldCheck, Tv } from "lucide-react";
import { forbidInKidsMode, getCurrentUser } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { btn } from "@/components/ui/button";
import { RedeemInvite } from "@/components/studio-hub/invites";
import { MascotCameo } from "@/components/mascot/mascot-cameo";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.v3.club.title };
}

const ICONS = [DoorOpen, KeyRound, FileText, Tv, Coins, ShieldCheck];

/** For creators: what the closed club of MIRAGE TV is, how invites and applications work, how you earn. */
export default async function CreatorsPage({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  await forbidInKidsMode();
  const [{ t }, user, sp] = await Promise.all([getI18n(), getCurrentUser(), searchParams]);
  const c = t.v3.club;
  const isCreator = user && (user.role === "CREATOR" || user.role === "ADMIN");
  return (
    <div className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[520px]" style={{ background: "radial-gradient(50% 60% at 15% 0%, rgba(145,71,255,.32), transparent 70%), radial-gradient(40% 50% at 90% 10%, rgba(255,46,99,.22), transparent 70%)" }} />
      <div className="relative mx-auto max-w-5xl px-4 pb-12 pt-[calc(var(--header-h)+40px)] md:px-10">
        <div className="grid items-center gap-8 md:grid-cols-[1fr_320px] lg:grid-cols-[1fr_360px]">
          <div className="min-w-0">
            <div className="text-sm font-bold uppercase tracking-[.16em] text-[#b794ff]">{c.kicker}</div>
            <h1 className="mt-2 font-display text-4xl font-bold leading-tight md:text-5xl">{c.title}</h1>
            <p className="mt-4 max-w-3xl text-lg text-white/80">{c.lead}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {isCreator ? (
                <Link href="/studio" className={btn("primary", "lg")}>
                  {c.ctaStudio}
                </Link>
              ) : (
                <Link href={user ? "/me#creator" : "/register?next=/me%23creator"} className={btn("primary", "lg")}>
                  {c.cta}
                </Link>
              )}
            </div>

            {!isCreator && (
              <div className="mt-8 max-w-xl">
                <RedeemInvite initial={(sp.invite ?? "").slice(0, 12)} />
              </div>
            )}
          </div>

          {/* recruiting poster: Mr. Static points at the viewer */}
          <figure
            className="relative mx-auto w-full max-w-[360px] overflow-hidden rounded-3xl ring-1 ring-line"
            style={{ background: "radial-gradient(70% 55% at 62% 30%, rgba(255,173,66,.18), transparent 70%), radial-gradient(90% 70% at 50% 100%, rgba(145,71,255,.22), transparent 70%), var(--surface)" }}
          >
            <MascotCameo kind="want-you" className="-mb-2 block aspect-[480/470] w-full" />
            <figcaption className="px-5 pb-5 text-center">
              <p className="font-display text-2xl font-bold uppercase leading-tight tracking-tight">{c.wantYou}</p>
              <p className="mt-1.5 text-sm text-muted">{c.wantYouSub}</p>
            </figcaption>
          </figure>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {c.sections.map((s, i) => {
            const Icon = ICONS[i] ?? Tv;
            return (
              <section key={s.t} className="rounded-3xl bg-surface p-5 ring-1 ring-line md:p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#9147ff]/15 text-[#b794ff]">
                    <Icon size={20} />
                  </span>
                  <h2 className="font-display text-lg font-bold">{s.t}</h2>
                </div>
                <p className="mt-3 text-[15px] leading-relaxed text-text/85">{s.d}</p>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
