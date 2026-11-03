import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveMediaPath, serveFile } from "@/lib/files";

/** Preview of a finished generation — only for its owner. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("Not found", { status: 404 });
  const job = await prisma.generationJob.findFirst({ where: { id, userId: user.id, status: "DONE" } });
  const full = job?.resultUrl ? resolveMediaPath(job.resultUrl) : null;
  if (!full) return new Response("Not found", { status: 404 });
  return serveFile(full, req, { "Cache-Control": "private, max-age=3600" });
}
