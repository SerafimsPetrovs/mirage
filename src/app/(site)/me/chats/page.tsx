import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircleHeart } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { mediaUrl } from "@/lib/files";
import { isAdultMode } from "@/lib/spicy";
import { getI18n } from "@/i18n/server";
import { pick } from "@/i18n/shared";
import { EmptyState } from "@/components/ui/misc";
import { CharacterAvatar } from "@/components/player/spicy";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.me.myChats };
}

export default async function MyChatsPage() {
  const user = await requireUser("/me/chats");
  const { t, locale } = await getI18n();
  const adult = isAdultMode(user);
  const threads = adult
    ? await prisma.chatThread.findMany({
        where: { userId: user.id, messages: { some: {} }, character: { series: { status: "PUBLISHED", isFamilySafe: false } } },
        orderBy: { updatedAt: "desc" },
        take: 50,
        include: {
          character: { include: { series: { select: { titleRu: true, titleEn: true } } } },
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      })
    : [];
  const time = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mx-auto max-w-3xl px-4 pb-10 pt-[calc(var(--header-h)+24px)] md:px-10">
      <h1 className="font-display text-3xl font-bold">{t.me.myChats}</h1>
      <p className="mt-1 text-muted">{t.me.myChatsSub}</p>

      <div className="mt-6">
        {!adult ? (
          <EmptyState icon={<MessageCircleHeart size={24} />} title={t.me.chatsHidden} />
        ) : threads.length === 0 ? (
          <EmptyState icon={<MessageCircleHeart size={24} />} title={t.me.noChats} />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-3xl bg-surface ring-1 ring-line">
            {threads.map((th) => {
              const c = th.character;
              const last = th.messages[0];
              const preview = last ? (last.photoId && !last.body ? t.me.photo : `${last.role === "user" ? t.me.you : ""}${last.body}`) : "";
              return (
                <li key={th.id}>
                  <Link href={`/chat/${c.id}`} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-white/5 md:px-5">
                    <CharacterAvatar c={{ name: pick(c, "name", locale), avatar: mediaUrl(c.avatarUrl), hue: c.hue }} size={52} online />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="truncate font-semibold">{pick(c, "name", locale)}</p>
                        <span className="shrink-0 text-xs text-muted">{time.format(th.updatedAt)}</span>
                      </div>
                      <p className="truncate text-xs text-muted">{pick(c.series, "title", locale)}</p>
                      <p className="mt-0.5 truncate text-sm text-white/75">{preview}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
