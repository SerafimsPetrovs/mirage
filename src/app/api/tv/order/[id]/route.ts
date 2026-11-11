import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveMediaPath, serveFile } from "@/lib/files";

/** Moderation preview of a generated order clip (admins only — it's not approved yet). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return new Response("Not found", { status: 404 });
  const order = await prisma.tvOrder.findUnique({ where: { id } });
  const job = order?.jobId ? await prisma.generationJob.findUnique({ where: { id: order.jobId } }) : null;
  const full = job?.resultUrl ? resolveMediaPath(job.resultUrl) : null;
  if (!full) return new Response("Not found", { status: 404 });
  return serveFile(full, req, { "Cache-Control": "private, no-store" });
}
