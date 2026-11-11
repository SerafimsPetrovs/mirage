// Demo AI apps for the one-click showcase (/apps). Installers are uploaded by an admin in /admin/apps;
// until then an app shows "Soon" (or opens its web version). Run: npx tsx prisma/seed-apps.ts
import { PrismaClient } from "@prisma/client";

const APPS = [
  {
    slug: "clip-maker",
    name: "MIRAGE Clip Maker",
    category: "VIDEO",
    hue: 330,
    priceCoins: 0,
    featured: true,
    webUrl: "https://huggingface.co/spaces/Lightricks/ltx-video-distilled",
    requirements: "Browser",
    taglineRu: "Видео из текста в браузере — без установки",
    taglineEn: "Text-to-video in the browser — nothing to install",
    descriptionRu: "Напишите, что должно происходить в кадре, — через минуту получите короткий ролик. Работает в браузере на бесплатной квоте.",
    descriptionEn: "Describe what happens in the shot and get a short clip in a minute. Runs in the browser on a free quota.",
  },
  {
    slug: "voice-studio",
    name: "Voice Studio One",
    category: "VOICE",
    hue: 200,
    priceCoins: 300,
    featured: true,
    requirements: "Windows 10+ / macOS 13+, 8 GB RAM",
    taglineRu: "Озвучка и клонирование голоса на своём компьютере",
    taglineEn: "Voice-over and voice cloning on your own computer",
    descriptionRu: "Установщик в один клик: модель уже внутри, интернет не нужен. Озвучивайте комиксы и сериалы своим голосом или голосом персонажа.",
    descriptionEn: "One-click installer: the model is bundled, no internet needed. Voice comics and series with your own voice or a character's.",
  },
  {
    slug: "picture-box",
    name: "PictureBox",
    category: "IMAGE",
    hue: 280,
    priceCoins: 0,
    requirements: "Windows 10+, GPU 6 GB",
    taglineRu: "Генерация картинок без Python и консоли",
    taglineEn: "Image generation without Python or a console",
    descriptionRu: "Окно, поле для текста и кнопка «Нарисовать». Всё остальное мы уже настроили за вас.",
    descriptionEn: "A window, a text box and a \"Draw\" button. We've set up everything else for you.",
  },
  {
    slug: "song-forge",
    name: "SongForge",
    category: "MUSIC",
    hue: 30,
    priceCoins: 150,
    requirements: "Windows 10+ / macOS 13+",
    taglineRu: "Песни и биты для своих роликов",
    taglineEn: "Songs and beats for your clips",
    descriptionRu: "Выберите жанр и настроение — получите трек без авторских проблем для эфира MIRAGE.",
    descriptionEn: "Pick a genre and a mood — get a track with no copyright trouble for MIRAGE TV.",
  },
  {
    slug: "script-buddy",
    name: "Script Buddy",
    category: "TEXT",
    hue: 150,
    priceCoins: 0,
    requirements: "Windows 10+ / macOS 13+, 8 GB RAM",
    taglineRu: "Локальный помощник сценариста",
    taglineEn: "A local screenwriting assistant",
    descriptionRu: "Придумывает повороты сюжета, диалоги и раскадровку. Работает офлайн.",
    descriptionEn: "Comes up with plot twists, dialogue and storyboards. Works offline.",
  },
  {
    slug: "upscale-pro",
    name: "Upscale Pro",
    category: "TOOLS",
    hue: 100,
    priceCoins: 200,
    requirements: "Windows 10+, GPU 4 GB",
    taglineRu: "Улучшение видео до 4K одной кнопкой",
    taglineEn: "Upscale video to 4K with one button",
    descriptionRu: "Перетащите ролик в окно — получите чёткую картинку для большого экрана.",
    descriptionEn: "Drag a clip into the window — get a crisp picture for the big screen.",
  },
];

export async function seedApps(prisma: PrismaClient) {
  for (const a of APPS) await prisma.aiApp.upsert({ where: { slug: a.slug }, update: a, create: a });
  console.log(`Apps: ${APPS.length}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("prisma/seed-apps.ts")) {
  const prisma = new PrismaClient();
  seedApps(prisma)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
