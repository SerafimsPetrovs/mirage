import { getCurrentUser } from "@/lib/auth";
import { resolveMediaPath, serveFile } from "@/lib/files";
import { factoryPreviewRef } from "@/lib/tv-admin";

/** Preview of a filmed factory idea (admins only). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return new Response("Not found", { status: 404 });
  const ref = await factoryPreviewRef(id);
  const full = ref ? resolveMediaPath(ref) : null;
  if (!full) return new Response("Not found", { status: 404 });
  return serveFile(full, req, { "Cache-Control": "private, no-store" });
}
