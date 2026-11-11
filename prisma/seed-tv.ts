// MIRAGE TV demo data: channels, TV clips (on the demo videos) and some likes for the music chart.
// Safe to run on an existing database: `npm run db:seed-tv` (replaces only TV data).
import { PrismaClient } from "@prisma/client";

type ChannelSeed = {
  slug: string;
  number: number;
  nameRu: string;
  nameEn: string;
  taglineRu: string;
  taglineEn: string;
  kind: string;
  genres: string;
  hue: number;
  hostName: string;
  hostPersona: string;
  familyOnly?: boolean;
  isAdult?: boolean;
  ticker?: boolean;
  /** v3: four base channels (Absurd, XenoGeo, Dark, Music/Chill); the rest is switched off. */
  active?: boolean;
  clips: { kind: "SHOW" | "BUMPER" | "AD" | "MUSIC"; title: string; artist?: string }[];
};

const CHANNELS: ChannelSeed[] = [
  {
    slug: "absurd",
    number: 1,
    nameRu: "Абсурд",
    nameEn: "Absurd",
    taglineRu: "Ток-шоу, скетчи и реклама товаров, которых не бывает",
    taglineEn: "Talk shows, sketches and ads for things that shouldn't exist",
    kind: "ABSURD",
    genres: "comedy",
    hue: 48,
    hostName: "Glorb Fennimore",
    hostPersona: "a three-eyed, wildly over-enthusiastic talk-show host from dimension C-12 who tries to sell you everything, including his own furniture",
    clips: [
      { kind: "SHOW", title: "Late Night with a Sentient Toaster" },
      { kind: "SHOW", title: "Cooking for Seven-Headed Families" },
      { kind: "SHOW", title: "Dimension Dating: Who Will Get the Rose Tentacle?" },
      { kind: "SHOW", title: "Breaking News from Next Tuesday" },
      { kind: "BUMPER", title: "Please Stay Tuned (We Mean It)" },
      { kind: "AD", title: "Galactic Realty: Buy a Black Hole Today!" },
      { kind: "AD", title: "Soup Insurance — Because You Never Know" },
    ],
  },
  {
    slug: "xenogeo",
    number: 2,
    nameRu: "Инопланетный NatGeo",
    nameEn: "XenoGeographic",
    taglineRu: "Дикая природа чужих планет, снятая с безопасного расстояния",
    taglineEn: "Wildlife of alien planets, filmed from a safe distance",
    kind: "DOCS",
    genres: "scifi,fantasy",
    hue: 150,
    hostName: "Professor Ulla Vex",
    hostPersona: "a calm alien naturalist who whispers like a nature-documentary narrator and is deeply in love with every slimy creature",
    clips: [
      { kind: "SHOW", title: "The Silent Herds of the Glass Planet" },
      { kind: "SHOW", title: "Migration of the Sky Whales" },
      { kind: "SHOW", title: "Mushroom Cities of Gliese 581" },
      { kind: "SHOW", title: "Survival Guide: Kepler-22b in 14 Seconds" },
      { kind: "AD", title: "Exoplanet Tours — No Refunds, No Return Tickets" },
    ],
  },
  {
    slug: "dark",
    number: 3,
    nameRu: "Тёмный эфир",
    nameEn: "Dark Air",
    taglineRu: "Рассекреченные архивы, аналоговый хоррор и сигналы ниоткуда",
    taglineEn: "Declassified archives, analog horror and signals from nowhere",
    kind: "DARK",
    genres: "horror,thriller,mystery",
    hue: 0,
    hostName: "The Archivist",
    hostPersona: "a nameless night announcer reading classified files in a dry, ominous voice; sometimes his sentences glitch and repeat",
    clips: [
      { kind: "SHOW", title: "Object 0-17: The Elevator to Floor Minus One" },
      { kind: "SHOW", title: "Signal from Bunker 9" },
      { kind: "SHOW", title: "Archive Tape #44 (Do Not Rewind)" },
      { kind: "SHOW", title: "The Hallway That Got Longer" },
      { kind: "AD", title: "Night-Light — Now With Fewer Eyes" },
    ],
  },
  {
    slug: "music",
    number: 4,
    nameRu: "Music / Chill",
    nameEn: "Music / Chill",
    taglineRu: "ИИ-музыка нон-стоп, клипы, неоновый визуал и хит-парад недели",
    taglineEn: "Non-stop AI music, videos, neon visuals and the weekly chart",
    kind: "MUSIC",
    genres: "",
    hue: 300,
    hostName: "VJ Zippa",
    hostPersona: "a hyper-energetic 2000s music-TV VJ with frosted tips and a flip phone; slang, shout-outs, reads viewers' text messages on air",
    ticker: true,
    clips: [
      { kind: "MUSIC", artist: "Neon Comet", title: "Paper Hearts" },
      { kind: "MUSIC", artist: "Lady Static", title: "2003 Forever" },
      { kind: "MUSIC", artist: "Boys of Saturn", title: "Flip Phone Love" },
      { kind: "MUSIC", artist: "DJ Pixelwave", title: "Club Andromeda" },
      { kind: "MUSIC", artist: "Velvet Moons", title: "Polyphonic Ringtone" },
      { kind: "MUSIC", artist: "Kira Nova", title: "Glitter Rain" },
      { kind: "MUSIC", artist: "The Satellites", title: "Dial-Up Romance" },
      { kind: "MUSIC", artist: "MC Orbit", title: "Hoverboard" },
      { kind: "MUSIC", artist: "Lunar Sisters", title: "Text Me Back" },
      { kind: "MUSIC", artist: "Echo Park 99", title: "Discman" },
      { kind: "MUSIC", artist: "Aurora Byte", title: "Y2K (Bug in My Heart)" },
      { kind: "MUSIC", artist: "Chrome Hearts Club", title: "Low-Rise Galaxy" },
      { kind: "AD", title: "Ringtones for Your Space Phone — Text MOON to 4040" },
      { kind: "SHOW", title: "Aurora over Lake Nowhere" },
      { kind: "SHOW", title: "Rain on a Neon Window" },
      { kind: "SHOW", title: "Slow Ocean" },
    ],
  },
  {
    slug: "chill",
    number: 5,
    nameRu: "Chill",
    nameEn: "Chill",
    taglineRu: "Медленные пейзажи и музыка, под которую хорошо молчится",
    taglineEn: "Slow landscapes and music that's good to be quiet to",
    kind: "CHILL",
    genres: "",
    hue: 200,
    hostName: "Mo",
    hostPersona: "a sleepy, kind voice that barely speaks, like a friend at 3 a.m.",
    active: false,
    clips: [],
  },
  {
    slug: "series",
    number: 6,
    nameRu: "Сериальный",
    nameEn: "Series",
    taglineRu: "Первые серии лучших ИИ-сериалов. Продолжение — в видеотеке",
    taglineEn: "First episodes of the best AI series. The rest is in the Library",
    kind: "SERIES",
    genres: "revenge,romance,drama,ceo,historical,fantasy,scifi,mystery,thriller,comedy,anime",
    hue: 330,
    hostName: "Dee Lumen",
    hostPersona: "a warm, witty host of the series channel who loves cliffhangers and teases what happens next",
    active: false,
    clips: [],
  },
  {
    slug: "storytime",
    number: 7,
    nameRu: "Сказки",
    nameEn: "Storytime",
    taglineRu: "Добрые истории на ночь",
    taglineEn: "Kind bedtime stories",
    kind: "KIDS",
    genres: "fantasy,comedy,drama,romance,anime,scifi,mystery",
    hue: 45,
    hostName: "Grandpa Owl",
    hostPersona: "a gentle old owl storyteller",
    familyOnly: true,
    clips: [],
  },
  {
    slug: "night",
    number: 18,
    nameRu: "Ночной 18+",
    nameEn: "Late Night 18+",
    taglineRu: "Для тех, кто не спит. Только для взрослых",
    taglineEn: "For those who can't sleep. Adults only",
    kind: "NIGHT",
    genres: "romance,drama,revenge,ceo",
    hue: 340,
    hostName: "Velvet",
    hostPersona: "a sultry late-night host, suggestive but never explicit",
    isAdult: true,
    clips: [],
  },
];

// "Info" popover data per channel kind (demo): lore, AI tools, genre tags, rating.
const META: Record<string, { lore: string; tools: string; tags: string; rating: string }> = {
  ABSURD: { lore: "Cable from dimension C-12: talk shows, sketches and ads for products that should never exist. Nobody knows who pays for it.", tools: "Kling 2.1, ElevenLabs, Suno", tags: "comedy", rating: "12+" },
  DOCS: { lore: "Wildlife of alien planets narrated in a whisper. Filmed from a safe distance (the crew says so).", tools: "Veo 3, Midjourney, ElevenLabs", tags: "scifi,fantasy", rating: "6+" },
  DARK: { lore: "Declassified tapes from Bunker 9, analog horror and signals from nowhere. Do not rewind.", tools: "Runway Gen-4, Udio, ElevenLabs", tags: "horror,mystery", rating: "16+" },
  MUSIC: { lore: "Non-stop AI music and neon visuals, the weekly chart and your shout-outs.", tools: "Suno v5, Kling 2.1", tags: "music", rating: "0+" },
};

/** Demo subtitles while the broadcast is muted (two cues from the title). */
function demoCaptions(title: string, kind: string) {
  if (kind === "MUSIC") return "";
  return `WEBVTT\n\n00:00.300 --> 00:04.500\n${title}\n\n00:04.800 --> 00:09.500\n[narrator] Stay with us — it gets stranger.\n\n00:09.800 --> 00:13.800\n[music swells]`;
}

const H = ["h-desert", "h-dusk", "h-ember", "h-ocean"];
const V = ["v-crimson", "v-violet", "v-amber", "v-teal", "v-rose", "v-ice"];

export async function seedTv(prisma: PrismaClient) {
  await prisma.$transaction([prisma.tvSlot.deleteMany(), prisma.tvOrder.deleteMany(), prisma.tvClipLike.deleteMany(), prisma.tvClip.deleteMany()]);
  const users = await prisma.user.findMany({ select: { id: true }, take: 12 });
  const creator = await prisma.user.findFirst({ where: { role: "CREATOR" }, select: { id: true } });
  let n = 0;
  for (const c of CHANNELS) {
    const { clips, ...rest } = c;
    // Demo bounty zones (demo clips are 14 s each): Absurd/Music green, XenoGeo yellow, Dark red.
    const bufferTargetMin = { absurd: 1, xenogeo: 2, dark: 30, music: 4 }[c.slug] ?? 120;
    const data = { ...rest, active: rest.active ?? true, bufferTargetMin };
    const ch = await prisma.tvChannel.upsert({ where: { slug: c.slug }, update: data, create: data });
    const meta = META[c.kind];
    // Funnel demo: the first show of a channel is the teaser of a catalog series of its genre.
    const genres = c.genres.split(",").filter(Boolean);
    const teaser = genres.length
      ? await prisma.series.findFirst({ where: { status: "PUBLISHED", isAdult: false, isFamilySafe: false, OR: genres.map((g) => ({ genres: { contains: g } })) }, orderBy: { views: "desc" }, select: { id: true } })
      : null;
    for (const [i, clip] of clips.entries()) {
      // Music videos are vertical like phone clips of the era; the rest is horizontal TV.
      const vertical = clip.kind === "MUSIC" && i % 2 === 1;
      const file = vertical ? V[n % V.length] : H[n % H.length];
      n++;
      const row = await prisma.tvClip.create({
        data: {
          channelId: ch.id,
          kind: clip.kind,
          title: clip.title,
          artist: clip.artist ?? "",
          videoUrl: `demo:${file}.mp4`,
          durationSec: 14,
          orientation: vertical ? "VERTICAL" : "HORIZONTAL",
          status: "APPROVED",
          lore: meta?.lore ?? "",
          aiTools: meta?.tools ?? "",
          tags: meta?.tags ?? "",
          ageRating: meta?.rating ?? "12+",
          captions: demoCaptions(clip.title, clip.kind),
          creatorId: clip.kind === "SHOW" && i % 2 === 0 ? creator?.id ?? null : null,
          seriesId: teaser && i === 0 ? teaser.id : null,
        },
      });
      if (clip.kind === "MUSIC") {
        // A believable chart: earlier songs get more likes.
        const likers = users.slice(0, Math.max(0, users.length - i));
        if (likers.length) await prisma.tvClipLike.createMany({ data: likers.map((u) => ({ userId: u.id, clipId: row.id })) });
      }
    }
  }
  console.log(`TV: ${CHANNELS.length} channels, ${n} clips`);
}

// Run directly: npx tsx prisma/seed-tv.ts
if (process.argv[1]?.replace(/\\/g, "/").endsWith("prisma/seed-tv.ts")) {
  const prisma = new PrismaClient();
  seedTv(prisma)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
