import fs from "fs";
import sharp from "sharp";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveMediaPath } from "@/lib/files";
import { canSeePhoto } from "@/lib/extras";
import { spicyBlock } from "@/lib/spicy";

/**
 * Character photo. Bought (or own) → full image. Otherwise a heavily blurred preview is rendered
 * on the server, so the original never reaches a viewer who hasn't paid.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ photoId: string }> }) {
  const { photoId } = await ctx.params;
  const user = await getCurrentUser();
  const photo = await prisma.characterPhoto.findUnique({
    where: { id: photoId },
    select: { imageUrl: true, character: { select: { series: { select: { isFamilySafe: true, creatorId: true } } } } },
  });
  if (!photo) return new Response("Not found", { status: 404 });
  const owner = !!user && (user.role === "ADMIN" || user.id === photo.character.series.creatorId);
  if (!owner && spicyBlock(user, photo.character.series)) return new Response("Forbidden", { status: 403 });
  const full = resolveMediaPath(photo.imageUrl);
  if (!full) return new Response("Missing media", { status: 404 });
  const input = await fs.promises.readFile(/*turbopackIgnore: true*/ full);
  const open = await canSeePhoto(user, photoId);
  const out = open
    ? await sharp(input).resize({ width: 1080, withoutEnlargement: true }).webp({ quality: 86 }).toBuffer()
    : await sharp(input).resize({ width: 48 }).blur(6).resize({ width: 480 }).webp({ quality: 60 }).toBuffer();
  return new Response(new Uint8Array(out), {
    headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
