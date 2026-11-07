import { prisma } from "@/lib/db";
import { renderOgImage } from "@/lib/og-image";
import { ru } from "@/i18n/ru";
import { en } from "@/i18n/en";
import { pick, plural } from "@/i18n/shared";

/**
 * Link-preview image (Open Graph) for a series, or for the whole platform when slug = "mirage".
 * JPEG 1200×630 so Telegram, WhatsApp, Facebook, X and VK all show a large card.
 * 18+ and unpublished series fall back to the neutral platform card (no artwork leaks).
 */
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const locale = new URL(req.url).searchParams.get("l") === "ru" ? "ru" : "en";
  const t = locale === "ru" ? ru : en;
  const s =
    slug === "mirage"
      ? null
      : await prisma.series.findFirst({
          where: { slug, status: "PUBLISHED", isAdult: false },
          include: { _count: { select: { episodes: true } } },
        });
  const img = s
    ? await renderOgImage({
        series: s,
        title: pick(s, "title", locale),
        tagline: pick(s, "tagline", locale) || pick(s, "description", locale),
        meta: `${s._count.episodes} ${plural(s._count.episodes, t.common.episodes, locale)} · ${t.share.ogMeta}`,
        badge: s.orientation === "VERTICAL" ? t.share.ogVertical : t.share.ogHorizontal,
      })
    : await renderOgImage({ series: null, title: t.share.ogPlatformTitle, tagline: t.meta.description, meta: t.share.ogPlatformMeta });
  return new Response(new Uint8Array(img), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
  });
}
