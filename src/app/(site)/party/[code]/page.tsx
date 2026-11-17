import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { joinParty, PartyError, partyState } from "@/lib/party";
import { channelDTO, listChannels } from "@/lib/tv";
import { getI18n } from "@/i18n/server";
import { btn } from "@/components/ui/button";
import { PartyRoom } from "@/components/party/party-room";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.party.hubTitle, robots: { index: false } };
}

/** Opening the invite link = joining the room (guests sign in first and come back here). */
export default async function PartyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = raw.toUpperCase();
  const [{ t, locale }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  if (!user) redirect(`/register?next=${encodeURIComponent(`/party/${code}`)}`);
  let loaded: { state: Awaited<ReturnType<typeof partyState>>; channels: Awaited<ReturnType<typeof listChannels>> } | null = null;
  let err = "NOT_FOUND";
  try {
    await joinParty(user, code);
    const [state, channels] = await Promise.all([partyState(user, code, 0), listChannels(user)]);
    loaded = { state, channels };
  } catch (e) {
    if (e instanceof PartyError) err = e.code;
    else console.error("[party page]", e);
  }
  if (loaded) {
    return (
      <PartyRoom
        code={code}
        initial={loaded.state}
        channels={loaded.channels.map((c) => {
          const d = channelDTO(c, locale);
          return { slug: d.slug, number: d.number, name: d.name, hue: d.hue };
        })}
      />
    );
  }
  {
    return (
      <div className="flex min-h-[80dvh] flex-col items-center justify-center gap-4 px-4 pt-[var(--header-h)] text-center">
        <p className="font-display text-2xl font-bold">{(t.party.errors as Record<string, string>)[err] ?? t.party.errors.NOT_FOUND}</p>
        <Link href="/party" className={btn("primary", "md")}>
          {t.party.hubTitle}
        </Link>
      </div>
    );
  }
}
