import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { mediaUrl } from "@/lib/files";
import { loadThread } from "@/lib/extras";
import { spicyBlock } from "@/lib/spicy";
import { getI18n } from "@/i18n/server";
import { pick } from "@/i18n/shared";
import { CharacterChat } from "@/components/chat/character-chat";

type Props = { params: Promise<{ characterId: string }> };

async function load(id: string) {
  return prisma.character.findUnique({
    where: { id },
    include: { series: { select: { slug: true, titleRu: true, titleEn: true, isFamilySafe: true, status: true, creatorId: true } } },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { characterId } = await params;
  const [{ locale }, c] = await Promise.all([getI18n(), load(characterId)]);
  return c ? { title: pick(c, "name", locale), robots: { index: false } } : {};
}

export default async function ChatPage({ params }: Props) {
  const { characterId } = await params;
  const [{ locale }, user, c] = await Promise.all([getI18n(), getCurrentUser(), load(characterId)]);
  if (!c || c.series.status !== "PUBLISHED") notFound();
  const block = spicyBlock(user, c.series);
  if (block === "kids") redirect("/library?family=locked");
  if (block === "family") notFound();
  if (block === "auth") redirect(`/login?next=${encodeURIComponent(`/chat/${characterId}`)}`);

  const owner = user!.role === "ADMIN" || user!.id === c.series.creatorId;
  const thread = await loadThread(user!.id, c.id, locale, owner);

  return (
    <CharacterChat
      character={{
        id: c.id,
        name: pick(c, "name", locale),
        tagline: pick(c, "tagline", locale),
        greeting: pick(c, "greeting", locale),
        avatar: mediaUrl(c.avatarUrl),
        hue: c.hue,
      }}
      series={{ slug: c.series.slug, title: pick(c.series, "title", locale) }}
      initial={thread.messages}
      sent={owner ? 0 : thread.sent}
      balance={user!.coins}
      needsAge={block === "age"}
    />
  );
}
