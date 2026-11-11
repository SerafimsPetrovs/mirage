import { resolveMediaPath, serveFile } from "@/lib/files";

/** Mascot voice lines produced by the server TTS (public: they are broadcast to every viewer). */
export async function GET(req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  if (!/^[\w-]+\.mp3$/.test(name)) return new Response("Not found", { status: 404 });
  const full = resolveMediaPath(`storage:tts/${name}`);
  if (!full) return new Response("Not found", { status: 404 });
  return serveFile(full, req, { "Cache-Control": "public, max-age=86400" });
}
