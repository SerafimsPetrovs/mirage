import { APPS_ENABLED } from "@/lib/features";
import { getCurrentUser } from "@/lib/auth";
import { AppError, downloadRef } from "@/lib/apps";
import { resolveMediaPath, serveFile } from "@/lib/files";
import path from "path";

/** Installer download: free apps for anyone, paid ones for owners; never in family mode. */
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  if (!APPS_ENABLED) return new Response("Not found", { status: 404 });
  const { slug } = await ctx.params;
  const os = new URL(req.url).searchParams.get("os") === "mac" ? "mac" : "win";
  const user = await getCurrentUser();
  try {
    const { ref, name } = await downloadRef(user, slug, os);
    if (/^https:\/\//.test(ref)) return Response.redirect(ref, 302);
    const full = resolveMediaPath(ref);
    if (!full) return new Response("Not found", { status: 404 });
    return serveFile(full, req, {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${name.replace(/[^\w .-]/g, "_")}${path.extname(full)}"`,
    });
  } catch (e) {
    if (e instanceof AppError && e.code === "AUTH") return Response.redirect(new URL(`/login?next=/apps/${encodeURIComponent(slug)}`, req.url), 302);
    return new Response("Not found", { status: 404 });
  }
}
