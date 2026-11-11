import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { myInvites } from "@/lib/studio-hub";
import { InviteList } from "@/components/studio-hub/invites";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.v3.studio.invites.title };
}

/** Closed club: every active creator has 5 invites for creator friends. */
export default async function InvitesPage() {
  const [{ t }, user] = await Promise.all([getI18n(), requireUser("/studio/invites")]);
  const invites = await myInvites(user);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">{t.v3.club.invitesTitle}</h1>
        <p className="mt-2 max-w-3xl text-muted">{t.v3.club.invitesText}</p>
      </header>
      <InviteList invites={invites.map((i) => ({ code: i.code, usedBy: i.usedBy?.name ?? null }))} />
      <div className="grid gap-3 md:grid-cols-3">
        {t.v3.club.sections.slice(0, 3).map((s) => (
          <section key={s.t} className="rounded-2xl bg-white/[.03] p-4 ring-1 ring-line">
            <h2 className="font-semibold">{s.t}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.d}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
