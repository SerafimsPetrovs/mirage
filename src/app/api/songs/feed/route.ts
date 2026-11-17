import { getCurrentUser } from "@/lib/auth";
import { mediaUrl } from "@/lib/files";
import { songFeed } from "@/lib/songs";

/** Next hooks for the feed. `?x=id,id` = already shown in this session. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  const exclude = (new URL(req.url).searchParams.get("x") ?? "").split(",").filter((s) => /^[\w]{1,40}$/.test(s));
  const items = await songFeed(user && !user.kidsMode ? user : null, exclude);
  return Response.json(
    items.map((s) => ({ ...s, cover: mediaUrl(s.coverRef), createdAt: s.createdAt.getTime() })),
    { headers: { "Cache-Control": "no-store" } },
  );
}
