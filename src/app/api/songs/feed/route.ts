import { getCurrentUser } from "@/lib/auth";
import { mediaUrl } from "@/lib/files";
import { songFeed } from "@/lib/songs";
import { firstUses } from "@/lib/song-links";
import { getLocale } from "@/i18n/server";

/** Next hooks for the feed. `?x=id,id` = already shown in this session. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  const exclude = (new URL(req.url).searchParams.get("x") ?? "").split(",").filter((s) => /^[\w]{1,40}$/.test(s));
  const [items, locale] = await Promise.all([songFeed(user && !user.kidsMode ? user : null, exclude), getLocale()]);
  const uses = await firstUses(items.map((s) => s.id), user, locale);
  return Response.json(
    items.map((s) => ({ ...s, cover: mediaUrl(s.coverRef), createdAt: s.createdAt.getTime(), usedIn: uses.get(s.id) ?? null })),
    { headers: { "Cache-Control": "no-store" } },
  );
}
