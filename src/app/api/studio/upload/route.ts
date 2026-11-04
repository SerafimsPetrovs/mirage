import { getCurrentUser } from "@/lib/auth";
import { saveUpload } from "@/lib/files";

const LIMITS = { video: 500 * 1024 * 1024, image: 8 * 1024 * 1024, private: 8 * 1024 * 1024 };

/** Multipart upload for creators. Returns a storage ref to save on Series/Episode. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.kidsMode || (user.role !== "CREATOR" && user.role !== "ADMIN")) return Response.json({ error: "forbidden" }, { status: 403 });
  const form = await req.formData();
  const file = form.get("file");
  const k = form.get("kind");
  const kind = k === "image" ? "image" : k === "private" ? "private" : "video";
  if (!(file instanceof File)) return Response.json({ error: "no_file" }, { status: 400 });
  try {
    const ref = await saveUpload(file, kind, LIMITS[kind]);
    return Response.json({ ref });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "upload_failed" }, { status: 400 });
  }
}
