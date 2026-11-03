import Link from "next/link";
import clsx from "clsx";
import { prisma } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { pick } from "@/i18n/shared";
import { Avatar } from "@/components/ui/misc";
import { CommentToggle } from "@/components/admin/admin-actions";

export default async function AdminCommentsPage() {
  const { t, locale } = await getI18n();
  const comments = await prisma.comment.findMany({
    orderBy: { createdAt: "desc" },
    take: 80,
    include: {
      user: { select: { name: true, avatarHue: true } },
      episode: { select: { id: true, number: true, series: { select: { titleRu: true, titleEn: true } } } },
    },
  });
  return (
    <div className="divide-y divide-line overflow-hidden rounded-3xl bg-surface ring-1 ring-line">
      {comments.map((c) => (
        <div key={c.id} className={clsx("flex items-start gap-3 p-4", c.hidden && "opacity-50")}>
          <Avatar name={c.user.name} hue={c.user.avatarHue} size={32} />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">
              <span className="font-semibold text-text">{c.user.name}</span> ·{" "}
              <Link href={`/watch/${c.episode.id}`} className="hover:text-text">
                {pick(c.episode.series, "title", locale)}, {t.common.episode} {c.episode.number}
              </Link>
            </p>
            <p className="mt-1 break-words text-sm">{c.body}</p>
          </div>
          <CommentToggle commentId={c.id} hidden={c.hidden} />
        </div>
      ))}
    </div>
  );
}
