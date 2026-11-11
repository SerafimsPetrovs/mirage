import { redirect } from "next/navigation";

/**
 * The separate full-screen "theatre" page was removed (owner, 2026-11-12): the channel now opens on the home page,
 * which has its own full-screen button. Old links (/tv/<slug> from the guide, admin, login) keep working.
 */
export default async function TvChannelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/?ch=${encodeURIComponent(slug)}`);
}
