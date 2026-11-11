import { getCurrentUser } from "@/lib/auth";
import { saveInstaller, saveUpload } from "@/lib/files";

const LIMITS = { video: 500 * 1024 * 1024, image: 8 * 1024 * 1024, private: 8 * 1024 * 1024 };

/** Multipart upload for creators. Returns a storage ref to save on Series/Episode. */
export async function POST(req: Request) {
  // CSRF defence in depth (cookies are SameSite=Lax already): only same-origin browser requests.
  if (!sameOrigin(req)) return Response.json({ error: "forbidden" }, { status: 403 });
  const user = await getCurrentUser();
  if (!user || user.kidsMode || (user.role !== "CREATOR" && user.role !== "ADMIN")) return Response.json({ error: "forbidden" }, { status: 403 });
  const form = await req.formData();
  const file = form.get("file");
  const k = form.get("kind");
  // AI app installers: admins only, stored outside the public media folders.
  if (k === "installer") {
    if (user.role !== "ADMIN") return Response.json({ error: "forbidden" }, { status: 403 });
    if (!(file instanceof File)) return Response.json({ error: "no_file" }, { status: 400 });
    try {
      return Response.json({ ref: await saveInstaller(file, 2 * 1024 * 1024 * 1024) });
    } catch (e) {
      const code = e instanceof Error && ["BAD_FILE_TYPE", "FILE_TOO_LARGE"].includes(e.message) ? e.message : "upload_failed";
      return Response.json({ error: code }, { status: 400 });
    }
  }
  const kind = k === "image" ? "image" : k === "private" ? "private" : "video";
  if (!(file instanceof File)) return Response.json({ error: "no_file" }, { status: 400 });
  try {
    const ref = await saveUpload(file, kind, LIMITS[kind]);
    return Response.json({ ref });
  } catch (e) {
    const code = e instanceof Error && ["BAD_FILE_TYPE", "FILE_TOO_LARGE"].includes(e.message) ? e.message : "upload_failed";
    if (code === "upload_failed") console.error("upload", e);
    return Response.json({ error: code }, { status: 400 });
  }
}

/** Origin (or Referer) must match the Host the request was sent to. */
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
