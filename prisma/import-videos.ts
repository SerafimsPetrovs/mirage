// Imports the user's videos from a folder into MIRAGE TV channels (approved, by the admin).
// Each file is remuxed without re-encoding (MP4, "faststart" so the browser can start and seek instantly)
// into storage/videos. Run: npx tsx prisma/import-videos.ts [folder]   (default D:/video)
import { PrismaClient } from "@prisma/client";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";

const run = promisify(execFile);
const prisma = new PrismaClient();
const SRC = process.argv[2] ?? "D:/video";
const DEST = path.join(process.cwd(), "storage", "videos");

type Item = { file: string; channel: string; kind?: "SHOW" | "AD" | "BUMPER"; title: string; lore: string; tags: string; rating?: string; tools?: string };

const ITEMS: Item[] = [
  // 01 Absurd
  { file: "03ec654ba7bfa40c2de362e22f289812_bd61fac7-cb5c-4158-b1d4-c05331178c0f.mp4", channel: "absurd", title: "Hell's Board Meeting", lore: "The quarterly meeting of the underworld: the CEO in horns, security robots and one intern who came to the wrong office.", tags: "comedy,fantasy", rating: "16+", tools: "AI video" },
  { file: "242757c6bb517684aa164b7d7b2bcdd0_cbd90d1e-ebbe-4979-a41d-2c5e5e89ad66.mp4", channel: "absurd", title: "Cowboy from Hell · Part 1: The Neon Saloon", lore: "A demon cowboy picks up a horned girl in the loudest bar of the inferno. Nobody asked him to.", tags: "comedy,fantasy", rating: "16+", tools: "AI video" },
  { file: "e434b16aac304cffdfff7a7c7a6ad1fc_0216b85a-367a-46ec-bdd0-eb6acd8f2366.mp4", channel: "absurd", title: "Cowboy from Hell · Part 2: Meet the Bodyguards", lore: "The cowboy introduces his date to his skeletal security team. She is not impressed.", tags: "comedy,fantasy", rating: "16+", tools: "AI video" },
  { file: "ed4681dbc3c0014742e5668b99369aac_84a25bb5-3682-4824-b4f6-5dabb3bcef15.mp4", channel: "absurd", title: "Cowboy from Hell · Part 3: Smoke Break", lore: "A cigarette, a smirk and a very worried look. Romance in the ninth circle.", tags: "comedy,fantasy", rating: "16+", tools: "AI video" },
  { file: "FINAL.mp4", channel: "absurd", title: "Pixel Duel: Live on Stage", lore: "Two 8-bit rivals meet under the spotlights. Talk show, fight or concert — even they don't know.", tags: "comedy", rating: "12+", tools: "Pixel animation" },
  { file: "IMG_7678.MP4", channel: "absurd", kind: "AD", title: "Golden Devil Coins — Invest Now!", lore: "A fake ad from dimension C-12: a devil in a leopard coat promises you all the gold. Terms and conditions burn.", tags: "comedy", rating: "12+", tools: "Animation" },
  { file: "DJI_0644.MP4", channel: "absurd", title: "Garage Engineering: The Kart", lore: "Homemade kart, wooden frame, zero safety certificates. Engineering from another dimension.", tags: "comedy", rating: "6+" },
  { file: "картинг.mp4", channel: "absurd", title: "Garage Engineering: Night Test Drive", lore: "The kart goes out at night. The bike goes too. Headlights optional.", tags: "comedy", rating: "6+" },
  { file: "meme.mp4", channel: "absurd", title: "Found Footage: Phone in Panic Mode", lore: "Somebody pressed record at the worst possible moment. We aired it anyway.", tags: "comedy", rating: "12+" },
  { file: "video_2026-11-10_15-36-19.mp4", channel: "absurd", title: "Backseat Talk Show", lore: "The cheapest studio in the multiverse: the back seat of a car. The guests can't leave.", tags: "comedy", rating: "12+" },
  { file: "IMG_6067.MOV", channel: "absurd", title: "Mr. Universe (Literally)", lore: "Earth's strongest specimens pose for the jury of an interdimensional championship.", tags: "comedy", rating: "12+" },
  // 02 XenoGeographic
  { file: "3_1.mp4", channel: "xenogeo", title: "The Robot War of the Grey Mountains", lore: "Armies stand still on a grey plain while one lonely robot climbs the mountain. Nature documentary, alien edition.", tags: "scifi,fantasy", rating: "12+", tools: "2D animation" },
  { file: "Busja.mp4", channel: "xenogeo", title: "Earth Creatures: The Black-and-White Digger", lore: "A rare Earth mammal searches for treasure under a fallen tree. Filmed from a safe distance.", tags: "scifi", rating: "0+" },
  { file: "Mill_final.mp4", channel: "xenogeo", title: "The Abandoned Mill of Planet Earth", lore: "A gate, a river and a mill nobody remembers. The planet is slowly taking it back.", tags: "scifi,mystery", rating: "0+" },
  { file: "IMG_5455.MOV", channel: "xenogeo", title: "Streets of Earth: Morning Parking", lore: "Earthlings store their metal boxes along the streets. Our cameraman walks among them.", tags: "scifi", rating: "0+" },
  // 03 Dark
  { file: "FFinalFilm.mp4", channel: "dark", title: "The Bags (Short Film)", lore: "Night, a parked car and people with bags over their heads. Archive tape — do not rewind.", tags: "horror,thriller,mystery", rating: "16+" },
  { file: "carConcrete.mp4", channel: "dark", title: "Isn't Enough", lore: "A key, a car and concrete. Some things are never enough.", tags: "thriller,mystery", rating: "12+", tools: "2D animation" },
  { file: "1_1.mp4", channel: "dark", title: "The Factory Under the Lamp", lore: "A city on fire, a factory in the smoke and a room where the lamp never goes out.", tags: "mystery,thriller", rating: "12+", tools: "2D animation" },
  // 04 Music / Chill
  { file: "miniM.mp4", channel: "music", title: "Little Mouse in the Big City", lore: "A mouse with a pink bow walks the night street. Chill visuals, no words.", tags: "music", rating: "0+", tools: "2D animation" },
  { file: "video_2026-11-10_15-37-44.mp4", channel: "music", title: "Neon Corridor", lore: "A curious ball rolls down an endless neon corridor. Turn your own music on.", tags: "music", rating: "0+", tools: "3D" },
  // 07 Storytime (family mode)
  { file: "moho.mp4", channel: "storytime", title: "The Caterpillars, the Bird and the Cat", lore: "A kind little story about a picnic, a sad bird and a cat on the roof.", tags: "comedy", rating: "0+", tools: "2D animation" },
];

async function probe(file: string) {
  let info = "";
  try {
    await run(ffmpegPath!, ["-hide_banner", "-i", file], { windowsHide: true });
  } catch (e) {
    info = String((e as { stderr?: string }).stderr ?? "");
  }
  const d = info.match(/Duration: (\d+):(\d+):([\d.]+)/);
  const v = info.match(/Video: [^\n]*?, (\d{2,5})x(\d{2,5})/);
  return { duration: d ? +d[1] * 3600 + +d[2] * 60 + +d[3] : 0, w: +(v?.[1] ?? 16), h: +(v?.[2] ?? 9) };
}

async function main() {
  fs.mkdirSync(DEST, { recursive: true });
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } });
  const channels = new Map((await prisma.tvChannel.findMany()).map((c) => [c.slug, c]));
  const touched = new Set<string>();
  const onDisk = new Set(fs.readdirSync(SRC));
  for (const it of ITEMS) {
    if (!onDisk.has(it.file)) {
      console.warn("skip (no file):", it.file);
      continue;
    }
    const ch = channels.get(it.channel);
    if (!ch) throw new Error("no channel " + it.channel);
    const src = path.join(SRC, it.file);
    const name = `tv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.mp4`;
    const out = path.join(DEST, name);
    process.stdout.write(`→ ${it.channel.padEnd(9)} ${it.title} … `);
    // Remux only (no re-encoding): MOV → MP4, moov atom first for instant start/seek.
    await run(ffmpegPath!, ["-y", "-i", src, "-map", "0:v:0", "-map", "0:a:0?", "-c", "copy", "-movflags", "+faststart", out], { windowsHide: true, maxBuffer: 1 << 26 });
    const p = await probe(out);
    await prisma.tvClip.create({
      data: {
        channelId: ch.id,
        kind: it.kind ?? "SHOW",
        title: it.title,
        videoUrl: `storage:videos/${name}`,
        durationSec: Math.max(1, Math.ceil(p.duration)),
        orientation: p.h > p.w ? "VERTICAL" : "HORIZONTAL",
        status: "APPROVED",
        creatorId: admin?.id ?? null,
        lore: it.lore,
        tags: it.tags,
        ageRating: it.rating ?? "12+",
        aiTools: it.tools ?? "",
      },
    });
    touched.add(ch.id);
    console.log(`${Math.round(p.duration)} s, ${p.w}x${p.h}`);
  }
  // The channels' schedules are rebuilt from scratch on the next visit (they only had "no signal" cards).
  await prisma.tvSlot.deleteMany({ where: { channelId: { in: [...touched] } } });
  console.log(`Imported ${ITEMS.filter((i) => onDisk.has(i.file)).length} videos into ${touched.size} channels.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
