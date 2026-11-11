import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listChannels } from "@/lib/tv";

/** /tv opens the last watched channel (or the first one this viewer may see) on the home page — there is no separate theatre page any more. */
export default async function TvIndex() {
  const [user, jar] = await Promise.all([getCurrentUser(), cookies()]);
  const channels = await listChannels(user);
  if (!channels.length) redirect("/library");
  const last = jar.get("mirage_tv_ch")?.value;
  redirect(`/?ch=${channels.find((c) => c.slug === last)?.slug ?? channels[0].slug}`);
}
