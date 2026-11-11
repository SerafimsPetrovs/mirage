// Makes the light 720p copies of all TV clips up front (phones otherwise trigger them one by one).
// Run: npm run tv:lite
import { PrismaClient } from "@prisma/client";
import { makeLite } from "../src/lib/video-lite";

const prisma = new PrismaClient();

async function main() {
  const clips = await prisma.tvClip.findMany({ where: { NOT: { videoUrl: { startsWith: "http" } } }, select: { title: true, videoUrl: true }, orderBy: { createdAt: "desc" } });
  const refs = [...new Map(clips.map((c) => [c.videoUrl, c.title])).entries()];
  let i = 0;
  for (const [ref, title] of refs) {
    i++;
    const t0 = Date.now();
    const r = await makeLite(ref).catch((e: unknown) => `error: ${e instanceof Error ? e.message.slice(0, 200) : e}`);
    console.log(`[${i}/${refs.length}] ${r} ${((Date.now() - t0) / 1000).toFixed(0)}s  ${title}`);
  }
}

main().finally(() => prisma.$disconnect());
