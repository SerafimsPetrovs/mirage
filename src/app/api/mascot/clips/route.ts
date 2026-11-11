import { prisma } from "@/lib/db";
import { EMOTIONS, type Emotion, type MascotClipDTO } from "@/lib/mascot";

/** The mascot's clip bank (public: these are brand loops). Empty bank → the player draws the built-in mascot. */
export async function GET() {
  const rows = await prisma.mascotClip.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } });
  const clips: MascotClipDTO[] = rows
    .filter((r) => (EMOTIONS as readonly string[]).includes(r.emotion))
    .map((r) => ({ id: r.id, emotion: r.emotion as Emotion, url: /^https?:/.test(r.url) || r.url.startsWith("/") ? r.url : `/api/mascot/file/${r.id}`, durationMs: r.durationMs }));
  return Response.json({ clips }, { headers: { "Cache-Control": "public, max-age=60" } });
}
