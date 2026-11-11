import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/i18n/server";
import { listChannels, nowOnAll } from "@/lib/tv";

/** TV guide: what is on every channel this viewer may watch. */
export async function GET() {
  const [user, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  const channels = await listChannels(user);
  return Response.json({ serverNow: Date.now(), items: await nowOnAll(channels, locale) }, { headers: { "Cache-Control": "no-store" } });
}
