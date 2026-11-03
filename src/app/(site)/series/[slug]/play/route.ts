import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSeriesPage } from "@/lib/series";
import { getLocale } from "@/i18n/server";

/** /series/:slug/play → resume where the user left off (or episode 1). */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const [user, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  const s = await getSeriesPage(slug, user, locale);
  if (!s || !s.resume) redirect("/");
  redirect(`/watch/${s.resume.id}`);
}
