import { posterSvg } from "@/lib/poster";

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const url = new URL(req.url);
  const hue = Math.max(0, Math.min(360, parseInt(url.searchParams.get("h") ?? "330", 10) || 330));
  const o = url.searchParams.get("o") === "h" ? "h" : "v";
  return new Response(posterSvg(slug, hue, o), {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
  });
}
