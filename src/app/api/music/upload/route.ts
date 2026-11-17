import { getCurrentUser } from "@/lib/auth";
import { saveUpload } from "@/lib/files";
import { rateLimit } from "@/lib/rate-limit";
import { MUSIC_AUDIO_MAX_BYTES } from "@/lib/music-rules";

/**
 * Song files and pictures for the music channel. Unlike /api/studio/upload this is open to every signed-in
 * adult account (viewers order their own music videos), with a per-user rate limit.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "forbidden" }, { status: 403 });
  const user = await getCurrentUser();
  if (!user || user.kidsMode) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!rateLimit(`music-upload:${user.id}`, 40, 60 * 60_000).allowed) return Response.json({ error: "too_many" }, { status: 429 });
  const form = await req.formData();
  const file = form.get("file");
  const kind = form.get("kind") === "image" ? "image" : "audio";
  if (!(file instanceof File)) return Response.json({ error: "no_file" }, { status: 400 });
  try {
    return Response.json({ ref: await saveUpload(file, kind, kind === "audio" ? MUSIC_AUDIO_MAX_BYTES : 8 * 1024 * 1024) });
  } catch (e) {
    const code = e instanceof Error && ["BAD_FILE_TYPE", "FILE_TOO_LARGE"].includes(e.message) ? e.message : "upload_failed";
    if (code === "upload_failed") console.error("music upload", e);
    return Response.json({ error: code }, { status: 400 });
  }
}

function sameOrigin(req: Request) {
  const host = req.headers.get("host");
  const from = req.headers.get("origin") ?? req.headers.get("referer");
  if (!host || !from) return false;
  try {
    return new URL(from).host === host;
  } catch {
    return false;
  }
}
