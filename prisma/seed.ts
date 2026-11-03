import { PrismaClient, type Orientation } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

type SeedSeries = {
  slug: string;
  titleRu: string;
  titleEn: string;
  taglineRu: string;
  taglineEn: string;
  descriptionRu: string;
  descriptionEn: string;
  orientation: Orientation;
  hue: number;
  genres: string[];
  moods: string[];
  ai: string[];
  notesRu: string;
  notesEn: string;
  episodes: number;
  age?: string;
  featured?: boolean;
  creator: 0 | 1;
  views: number;
};

const SERIES: SeedSeries[] = [
  {
    slug: "bride-of-ashes",
    titleRu: "Невеста из пепла",
    titleEn: "Bride of Ashes",
    taglineRu: "Её сожгли в день свадьбы. Она вернулась за каждым.",
    taglineEn: "They burned her on her wedding day. She came back for every one of them.",
    descriptionRu: "Линь Сяо погибает в пожаре, устроенном собственной сестрой и женихом. Очнувшись за год до трагедии, она начинает тихую и безжалостную игру — с улыбкой на губах и списком имён в сердце.",
    descriptionEn: "Lin Xiao dies in a fire set by her own sister and fiancé. Waking a year before the tragedy, she begins a quiet, merciless game — smiling, with a list of names in her heart.",
    orientation: "VERTICAL",
    hue: 350,
    genres: ["revenge", "romance", "drama"],
    moods: ["revenge", "butterflies"],
    ai: ["Kling 2.5", "Midjourney v7", "ElevenLabs", "Suno v5"],
    notesRu: "Персонажи собраны в Midjourney с фиксированным seed, чтобы лица не «плыли» между сериями. Видео — Kling 2.5 image-to-video, по 5–8 секунд на кадр. Голоса — ElevenLabs, музыка — Suno.",
    notesEn: "Characters were built in Midjourney with a fixed seed so faces stay consistent across episodes. Video is Kling 2.5 image-to-video, 5–8 seconds per shot. Voices by ElevenLabs, score by Suno.",
    episodes: 32,
    featured: true,
    creator: 0,
    views: 1840000,
  },
  {
    slug: "hundred-day-contract",
    titleRu: "Контракт на сто дней",
    titleEn: "The Hundred-Day Contract",
    taglineRu: "Фиктивный брак. Настоящие чувства. Обратный отсчёт.",
    taglineEn: "A fake marriage. Real feelings. A countdown.",
    descriptionRu: "Холодный наследник корпорации предлагает официантке сделку: сто дней изображать его жену. Условие одно — не влюбляться. На тридцатый день правило нарушают оба.",
    descriptionEn: "A cold corporate heir offers a waitress a deal: play his wife for a hundred days. One rule — don't fall in love. By day thirty, both have broken it.",
    orientation: "VERTICAL",
    hue: 330,
    genres: ["ceo", "romance"],
    moods: ["butterflies", "laugh"],
    ai: ["Sora 2", "Hailuo 02", "ElevenLabs"],
    notesRu: "Каждая серия начинается с «крючка» в первые 3 секунды — это правило шорт-дорам. Сцены в офисе — Sora 2, крупные планы эмоций — Hailuo.",
    notesEn: "Every episode opens with a hook in the first 3 seconds — the golden rule of short dramas. Office scenes by Sora 2, emotional close-ups by Hailuo.",
    episodes: 40,
    featured: true,
    creator: 0,
    views: 2310000,
  },
  {
    slug: "empress-second-chances",
    titleRu: "Императрица второго шанса",
    titleEn: "Empress of Second Chances",
    taglineRu: "Во дворце побеждает не сильнейший, а тот, кто помнит будущее.",
    taglineEn: "In the palace, it's not the strongest who wins — it's the one who remembers the future.",
    descriptionRu: "Отравленная наложница перерождается в теле опальной служанки. Ей известно, кто подсыплет яд императору, кто предаст трон и кто на самом деле любил её. Осталось лишь выжить.",
    descriptionEn: "A poisoned consort is reborn as a disgraced maid. She knows who will poison the emperor, who will betray the throne, and who truly loved her. All she has to do is survive.",
    orientation: "VERTICAL",
    hue: 15,
    genres: ["historical", "revenge", "fantasy"],
    moods: ["revenge", "wonder"],
    ai: ["Veo 3", "Midjourney v7", "Suno v5"],
    notesRu: "Костюмы эпохи Тан собраны по референсам музейных коллекций, затем стилизованы. Veo 3 генерирует сцены сразу со звуком окружения.",
    notesEn: "Tang-era costumes were assembled from museum references, then stylised. Veo 3 generates scenes with ambient sound built in.",
    episodes: 36,
    featured: true,
    creator: 1,
    views: 1520000,
  },
  {
    slug: "neon-fox",
    titleRu: "Неоновый лис",
    titleEn: "Neon Fox",
    taglineRu: "В городе без сна воры крадут не деньги, а воспоминания.",
    taglineEn: "In the sleepless city, thieves don't steal money. They steal memories.",
    descriptionRu: "Курьер нелегальных воспоминаний по прозвищу Лис получает заказ — доставить чужое детство. Вскрыв капсулу, он узнаёт в нём своё.",
    descriptionEn: "An illegal memory courier called Fox takes a job: deliver someone's childhood. When he opens the capsule, he recognises it as his own.",
    orientation: "VERTICAL",
    hue: 280,
    genres: ["scifi", "thriller"],
    moods: ["thrill", "wonder"],
    ai: ["Runway Gen-4", "Kling 2.5", "Suno v5"],
    notesRu: "Неоновая палитра задана через стилевые референсы Runway. Погони собраны из коротких 4-секундных клипов с монтажом под бит.",
    notesEn: "The neon palette is driven by Runway style references. Chases are cut from 4-second clips edited to the beat.",
    episodes: 24,
    creator: 1,
    views: 980000,
  },
  {
    slug: "dragon-office-404",
    titleRu: "Дочь дракона из офиса 404",
    titleEn: "The Dragon's Daughter in Office 404",
    taglineRu: "Квартальный отчёт сгорел. Буквально.",
    taglineEn: "The quarterly report burned. Literally.",
    descriptionRu: "Наследница древнего драконьего рода вынуждена год проработать младшим аналитиком, чтобы получить трон. Начальник подозревает, что огнетушители в офисе пустеют не просто так.",
    descriptionEn: "The heir of an ancient dragon clan must work a year as a junior analyst to claim her throne. Her boss suspects the office fire extinguishers aren't emptying by accident.",
    orientation: "VERTICAL",
    hue: 160,
    genres: ["fantasy", "comedy", "romance"],
    moods: ["laugh", "butterflies"],
    ai: ["Hailuo 02", "Midjourney v7", "ElevenLabs"],
    notesRu: "Комедийный тайминг держим монтажом: ИИ генерирует реакцию, а пауза выставляется вручную.",
    notesEn: "Comic timing comes from the edit: AI generates the reaction, the pause is set by hand.",
    episodes: 28,
    creator: 0,
    views: 760000,
  },
  {
    slug: "last-signal",
    titleRu: "Последний сигнал",
    titleEn: "Last Signal",
    taglineRu: "Станция замолчала 40 лет назад. Вчера она ответила.",
    taglineEn: "The station went silent 40 years ago. Yesterday it answered.",
    descriptionRu: "Радиоастроном из заполярного посёлка ловит сигнал с давно погибшей орбитальной станции. В шуме — голос её отца и координаты места, которого нет ни на одной карте.",
    descriptionEn: "A radio astronomer in an Arctic town picks up a signal from a long-dead orbital station. In the static is her father's voice and coordinates to a place that's on no map.",
    orientation: "HORIZONTAL",
    hue: 215,
    genres: ["scifi", "mystery", "drama"],
    moods: ["thrill", "wonder"],
    ai: ["Veo 3", "Sora 2", "Suno v5"],
    notesRu: "Горизонтальный «большой» формат: 8 серий по 20+ минут. Длинные планы собраны из продлённых генераций Veo 3 с ручной цветокоррекцией.",
    notesEn: "Widescreen epic format: 8 episodes of 20+ minutes. Long takes are stitched from extended Veo 3 generations with manual grading.",
    episodes: 8,
    age: "12+",
    featured: true,
    creator: 1,
    views: 640000,
  },
  {
    slug: "hourglass",
    titleRu: "Песочные часы",
    titleEn: "Hourglass",
    taglineRu: "Каждое убийство случается в одну и ту же минуту.",
    taglineEn: "Every murder happens at the same minute.",
    descriptionRu: "Следователь с бессонницей замечает, что жертвы серийного убийцы умирают ровно в 3:17. Часы на месте преступления всегда остановлены. Кроме одних — его собственных.",
    descriptionEn: "An insomniac detective notices a serial killer's victims always die at exactly 3:17. The clocks at every scene are stopped. All except one — his own.",
    orientation: "HORIZONTAL",
    hue: 40,
    genres: ["mystery", "thriller"],
    moods: ["thrill"],
    ai: ["Runway Gen-4", "Midjourney v7", "ElevenLabs"],
    notesRu: "Нуарный свет задаётся одним стилевым кадром на всю серию — так сохраняется единый «вид» сериала.",
    notesEn: "Noir lighting is set by a single style frame per episode — that's how the series keeps one consistent look.",
    episodes: 6,
    age: "18+",
    creator: 0,
    views: 420000,
  },
  {
    slug: "my-husband-is-a-ghost",
    titleRu: "Мой муж — призрак",
    titleEn: "My Husband Is a Ghost",
    taglineRu: "Он умер до свадьбы. Но от брака это его не спасло.",
    taglineEn: "He died before the wedding. That didn't get him out of the marriage.",
    descriptionRu: "Сирота выходит замуж по старинному обряду за погибшего наследника. Ночью в спальне её ждёт очень недовольный и очень красивый призрак.",
    descriptionEn: "An orphan is married off in an old rite to a dead heir. That night, a very annoyed and very handsome ghost is waiting in her bedroom.",
    orientation: "VERTICAL",
    hue: 260,
    genres: ["romance", "comedy", "fantasy"],
    moods: ["butterflies", "laugh"],
    ai: ["Kling 2.5", "ElevenLabs", "Suno v5"],
    notesRu: "Эффект полупрозрачности призрака — две генерации одной сцены, сведённые в монтаже.",
    notesEn: "The ghost's translucency is two generations of the same scene blended in the edit.",
    episodes: 30,
    creator: 0,
    views: 1210000,
  },
  {
    slug: "princess-hundred-faces",
    titleRu: "Сто лиц принцессы",
    titleEn: "The Princess of a Hundred Faces",
    taglineRu: "Её никто не видел. Она — каждая вторая служанка дворца.",
    taglineEn: "No one has seen her face. She's every other maid in the palace.",
    descriptionRu: "Принцесса-мастер маскировки расследует заговор против брата-императора, меняя лица и имена. Единственный, кто узнаёт её под любой маской, — начальник стражи. И он её главный подозреваемый.",
    descriptionEn: "A princess and master of disguise investigates a plot against her emperor brother, changing faces and names. The only one who recognises her under any mask is the captain of the guard — her prime suspect.",
    orientation: "VERTICAL",
    hue: 5,
    genres: ["historical", "mystery", "romance"],
    moods: ["thrill", "butterflies"],
    ai: ["Veo 3", "Midjourney v7"],
    notesRu: "Чтобы зритель узнавал героиню под масками, у неё один постоянный элемент — красная шпилька в каждой сцене.",
    notesEn: "So viewers recognise her under disguises, she keeps one constant — a red hairpin in every scene.",
    episodes: 26,
    creator: 1,
    views: 870000,
  },
  {
    slug: "city-that-dreams",
    titleRu: "Город, который снится",
    titleEn: "The City That Dreams",
    taglineRu: "Каждую ночь город перестраивается под сны своих жителей.",
    taglineEn: "Every night, the city rebuilds itself from its residents' dreams.",
    descriptionRu: "Архитектор, потерявший способность видеть сны, оказывается единственным, кто замечает: город начинает рушиться изнутри. Чьи-то кошмары стали заразными.",
    descriptionEn: "An architect who lost the ability to dream is the only one who notices the city collapsing from within. Someone's nightmares have become contagious.",
    orientation: "HORIZONTAL",
    hue: 190,
    genres: ["scifi", "fantasy", "drama"],
    moods: ["wonder", "thrill"],
    ai: ["Sora 2", "Runway Gen-4", "Suno v5"],
    notesRu: "Морфинг архитектуры — сильная сторона видеомоделей. Мы оставили «ИИ-странности» как часть эстетики сна.",
    notesEn: "Morphing architecture is where video models shine. We kept the 'AI weirdness' as part of the dream aesthetic.",
    episodes: 10,
    featured: true,
    creator: 1,
    views: 530000,
  },
  {
    slug: "heiress-in-disguise",
    titleRu: "Наследница под прикрытием",
    titleEn: "Heiress in Disguise",
    taglineRu: "Они унижали уборщицу. Не зная, что она купила их компанию.",
    taglineEn: "They humiliated the cleaner. Not knowing she'd just bought their company.",
    descriptionRu: "Единственная наследница миллиардной империи устраивается уборщицей в собственный филиал, чтобы найти того, кто разоряет семью. Сотрудники не стесняются в выражениях — пока.",
    descriptionEn: "The sole heiress of a billion-dollar empire goes undercover as a cleaner in her own branch to find who's ruining the family. The staff don't hold back — yet.",
    orientation: "VERTICAL",
    hue: 45,
    genres: ["ceo", "revenge", "drama"],
    moods: ["revenge", "laugh"],
    ai: ["Kling 2.5", "Hailuo 02", "ElevenLabs"],
    notesRu: "Сцены «разоблачения» мы генерируем по 10–15 вариантов и выбираем самый эмоциональный дубль, как на настоящей съёмке.",
    notesEn: "We generate 10–15 variants of every reveal scene and pick the most emotional take, just like a real shoot.",
    episodes: 45,
    creator: 0,
    views: 2650000,
  },
  {
    slug: "teahouse-by-the-sea",
    titleRu: "Чайный дом у моря",
    titleEn: "Teahouse by the Sea",
    taglineRu: "Каждый гость приносит историю. Каждая чашка — прощание.",
    taglineEn: "Every guest brings a story. Every cup is a goodbye.",
    descriptionRu: "Старая хозяйка чайного дома на краю света заваривает чай тем, кто не успел попрощаться. Новая помощница не догадывается, почему все гости приходят только ночью.",
    descriptionEn: "The old keeper of a teahouse at the edge of the world brews tea for those who never got to say goodbye. Her new helper doesn't realise why every guest comes only at night.",
    orientation: "VERTICAL",
    hue: 175,
    genres: ["drama", "fantasy"],
    moods: ["cry", "wonder"],
    ai: ["Veo 3", "Suno v5"],
    notesRu: "Самый «медленный» наш сериал: длинные планы, шум волн и минимум диалогов. Вся музыка — Suno, по одной теме на гостя.",
    notesEn: "Our slowest series: long takes, sound of waves, minimal dialogue. All music by Suno — one theme per guest.",
    episodes: 20,
    age: "12+",
    creator: 1,
    views: 690000,
  },
  {
    slug: "red-thread",
    titleRu: "Красная нить",
    titleEn: "The Red Thread",
    taglineRu: "Она видит нити судьбы. Её собственная — оборвана.",
    taglineEn: "She can see the threads of fate. Her own is cut.",
    descriptionRu: "Девушка-сваха видит красные нити, связывающие суженых. Однажды она находит мужчину, к которому тянутся сразу две нити — и одна из них ведёт к ней.",
    descriptionEn: "A matchmaker can see the red threads binding destined lovers. One day she meets a man with two threads — and one of them leads to her.",
    orientation: "VERTICAL",
    hue: 345,
    genres: ["romance", "fantasy"],
    moods: ["butterflies", "cry"],
    ai: ["Kling 2.5", "Midjourney v7"],
    notesRu: "Красная нить дорисовывается поверх видео — модели пока плохо держат тонкие объекты в движении.",
    notesEn: "The red thread is composited over the video — models still struggle with thin moving objects.",
    episodes: 34,
    creator: 0,
    views: 1430000,
  },
  {
    slug: "mirror-maze",
    titleRu: "Зеркальный лабиринт",
    titleEn: "Mirror Maze",
    taglineRu: "Не смотри на отражение дольше трёх секунд.",
    taglineEn: "Don't look at your reflection for longer than three seconds.",
    descriptionRu: "Пятеро стримеров запираются на ночь в заброшенном зеркальном аттракционе ради хайпа. К утру выходят пятеро. Но вышли не они.",
    descriptionEn: "Five streamers lock themselves in an abandoned mirror attraction overnight for the views. Five walk out by morning. They aren't the same five.",
    orientation: "VERTICAL",
    hue: 120,
    genres: ["horror", "thriller"],
    moods: ["thrill"],
    ai: ["Runway Gen-4", "Sora 2", "ElevenLabs"],
    notesRu: "Отражения, которые «опаздывают», — это две генерации со сдвигом в 6 кадров.",
    notesEn: "Reflections that 'lag behind' are two generations offset by 6 frames.",
    episodes: 18,
    age: "18+",
    creator: 1,
    views: 910000,
  },
  {
    slug: "academy-nine-winds",
    titleRu: "Академия девяти ветров",
    titleEn: "Academy of Nine Winds",
    taglineRu: "Восемь ветров выбирают ученика. Девятый — убивает.",
    taglineEn: "Eight winds choose a student. The ninth one kills.",
    descriptionRu: "Девочка без дара поступает в академию заклинателей ветра по ошибке в документах. Чтобы остаться, ей нужно найти девятый ветер, о котором учителя запрещают даже говорить.",
    descriptionEn: "A girl with no gift is admitted to an academy of wind-casters by a paperwork mistake. To stay, she must find the ninth wind — the one teachers forbid anyone to speak of.",
    orientation: "VERTICAL",
    hue: 200,
    genres: ["anime", "fantasy"],
    moods: ["wonder", "laugh"],
    ai: ["Midjourney v7", "Kling 2.5", "Suno v5"],
    notesRu: "Аниме-стилистика: ключевые кадры рисуются в Midjourney, затем анимируются Kling с низкой «силой движения», чтобы сохранить рисованный вид.",
    notesEn: "Anime style: key frames are drawn in Midjourney, then animated in Kling with low motion strength to keep the hand-drawn look.",
    episodes: 24,
    age: "6+",
    creator: 0,
    views: 580000,
  },
  {
    slug: "desert-mirage",
    titleRu: "Пустынный мираж",
    titleEn: "Desert Mirage",
    taglineRu: "Караван идёт к городу, которого не существует.",
    taglineEn: "The caravan travels toward a city that doesn't exist.",
    descriptionRu: "Картограф присоединяется к каравану, который сорок лет ищет город из миражей. Каждую ночь звёзды над пустыней меняют расположение, а карта рисует себя сама.",
    descriptionEn: "A cartographer joins a caravan that has searched for a city of mirages for forty years. Every night the stars above the desert move, and the map draws itself.",
    orientation: "HORIZONTAL",
    hue: 30,
    genres: ["fantasy", "drama"],
    moods: ["wonder"],
    ai: ["Veo 3", "Sora 2", "Suno v5"],
    notesRu: "Флагманский проект MIRAGE. Пустыня генерировалась панорамами 21:9, затем кадрировалась в 16:9 — отсюда ощущение простора.",
    notesEn: "MIRAGE's flagship project. The desert was generated as 21:9 panoramas, then cropped to 16:9 — hence the sense of scale.",
    episodes: 8,
    age: "12+",
    featured: true,
    creator: 1,
    views: 1120000,
  },
];

const EP_TITLES_RU = ["Пробуждение", "Чужое лицо", "Первая ложь", "Ночь у реки", "Письмо без подписи", "Ловушка", "Свидетель", "Маски сброшены", "Цена правды", "Ответный ход", "Кровь и шёлк", "Последний танец", "Тайная комната", "Признание", "Буря", "Возвращение"];
const EP_TITLES_EN = ["Awakening", "A Stranger's Face", "The First Lie", "Night by the River", "An Unsigned Letter", "The Trap", "The Witness", "Masks Off", "The Price of Truth", "Counter Move", "Blood and Silk", "The Last Dance", "The Secret Room", "Confession", "The Storm", "The Return"];

const COMMENTS = [
  "Я не могу остановиться, уже 3 часа ночи 😭",
  "Эта сцена в конце! Мурашки!",
  "Не верится, что это сделано нейросетью",
  "Когда следующая серия??",
  "Главная героиня — королева 👑",
  "I can't believe this is AI. The lighting is insane",
  "Plot twist of the year",
  "Who else is here at 2am?",
  "Музыка просто космос",
  "Он же явно что-то скрывает…",
  "Rewatched this episode 3 times",
  "Голосую за то, чтобы она его не простила!",
];

const VIDEOS_V = ["v-crimson", "v-violet", "v-amber", "v-teal", "v-rose", "v-ice"];
const VIDEOS_H = ["h-dusk", "h-desert", "h-ocean", "h-ember"];

function pickOne<T>(arr: T[], i: number) {
  return arr[i % arr.length];
}

async function main() {
  console.log("Clearing database…");
  await prisma.$transaction([
    prisma.pollVote.deleteMany(),
    prisma.pollOption.deleteMany(),
    prisma.poll.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.like.deleteMany(),
    prisma.rating.deleteMany(),
    prisma.listItem.deleteMany(),
    prisma.watchProgress.deleteMany(),
    prisma.creatorEarning.deleteMany(),
    prisma.coinTransaction.deleteMany(),
    prisma.unlock.deleteMany(),
    prisma.order.deleteMany(),
    prisma.checkIn.deleteMany(),
    prisma.episode.deleteMany(),
    prisma.series.deleteMany(),
    prisma.creatorApplication.deleteMany(),
    prisma.subscription.deleteMany(),
    prisma.session.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const passwordHash = await bcrypt.hash("mirage123", 10);

  const admin = await prisma.user.create({
    data: { email: "admin@mirage.tv", name: "Admin", role: "ADMIN", passwordHash, avatarHue: 0, coins: 0 },
  });
  const creatorA = await prisma.user.create({
    data: { email: "creator@mirage.tv", name: "Studio Lumen", role: "CREATOR", passwordHash, avatarHue: 330, bio: "Короткие ИИ-дорамы с длинным послевкусием." },
  });
  const creatorB = await prisma.user.create({
    data: { email: "lotus@mirage.tv", name: "Neon Lotus", role: "CREATOR", passwordHash, avatarHue: 260, bio: "AI cinema, sci-fi & palace intrigue." },
  });
  const viewer = await prisma.user.create({
    data: { email: "viewer@mirage.tv", name: "Алиса", role: "VIEWER", passwordHash, avatarHue: 200, coins: 120 },
  });
  await prisma.coinTransaction.createMany({
    data: [
      { userId: viewer.id, amount: 50, reason: "BONUS", note: "welcome" },
      { userId: viewer.id, amount: 70, reason: "CHECKIN", note: "history" },
    ],
  });
  const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
  await prisma.checkIn.create({ data: { userId: viewer.id, day: yesterday, streak: 2, reward: 5 } });

  const fans = await Promise.all(
    Array.from({ length: 24 }, (_, i) =>
      prisma.user.create({
        data: { email: `fan${i}@mirage.tv`, name: ["Мира", "Kai", "Лена", "Jun", "Дина", "Noah", "Ира", "Mei"][i % 8] + ` ${i + 1}`, passwordHash, avatarHue: (i * 47) % 360 },
      }),
    ),
  );
  void admin;

  const creators = [creatorA, creatorB];
  const created = [];
  for (const [idx, s] of SERIES.entries()) {
    const vertical = s.orientation === "VERTICAL";
    const series = await prisma.series.create({
      data: {
        slug: s.slug,
        titleRu: s.titleRu,
        titleEn: s.titleEn,
        taglineRu: s.taglineRu,
        taglineEn: s.taglineEn,
        descriptionRu: s.descriptionRu,
        descriptionEn: s.descriptionEn,
        orientation: s.orientation,
        hue: s.hue,
        genres: s.genres.join(","),
        moods: s.moods.join(","),
        aiModels: s.ai.join(","),
        promptNotesRu: s.notesRu,
        promptNotesEn: s.notesEn,
        ageRating: s.age ?? "16+",
        status: "PUBLISHED",
        featured: !!s.featured,
        freeEpisodes: vertical ? 6 : 2,
        defaultCoinPrice: vertical ? 30 : 60,
        views: s.views,
        creatorId: creators[s.creator].id,
        publishedAt: new Date(Date.now() - idx * 3 * 86400_000),
        createdAt: new Date(Date.now() - idx * 3 * 86400_000),
      },
    });
    await prisma.episode.createMany({
      data: Array.from({ length: s.episodes }, (_, i) => ({
        seriesId: series.id,
        number: i + 1,
        titleRu: pickOne(EP_TITLES_RU, i + idx),
        titleEn: pickOne(EP_TITLES_EN, i + idx),
        durationSec: vertical ? 70 + ((i * 37 + idx * 11) % 80) : 1260 + ((i * 173 + idx) % 900),
        videoUrl: `demo:${vertical ? pickOne(VIDEOS_V, i + idx) : pickOne(VIDEOS_H, i + idx)}.mp4`,
        views: Math.max(1000, Math.floor(s.views / (1 + i * 0.35))),
        createdAt: new Date(Date.now() - (s.episodes - i) * 3600_000 - idx * 86400_000),
      })),
    });
    created.push(series);
  }

  // Ratings, list items, likes and comments from fans
  for (const [si, series] of created.entries()) {
    const eps = await prisma.episode.findMany({ where: { seriesId: series.id }, orderBy: { number: "asc" }, take: 6 });
    for (const [fi, fan] of fans.entries()) {
      if ((fi + si) % 3 !== 0) {
        await prisma.rating.create({ data: { userId: fan.id, seriesId: series.id, value: 3 + ((fi * 7 + si) % 3) } });
      }
      if ((fi + si) % 4 === 0) await prisma.listItem.create({ data: { userId: fan.id, seriesId: series.id } });
      for (const [ei, ep] of eps.entries()) {
        if ((fi + ei + si) % 3 === 0) await prisma.like.create({ data: { userId: fan.id, episodeId: ep.id } });
        if ((fi * 3 + ei + si) % 11 === 0) {
          await prisma.comment.create({
            data: {
              userId: fan.id,
              episodeId: ep.id,
              body: pickOne(COMMENTS, fi + ei + si),
              createdAt: new Date(Date.now() - (fi + ei) * 3600_000),
            },
          });
        }
      }
    }
  }

  // Polls
  const polls = [
    {
      slug: "bride-of-ashes",
      qRu: "Простит ли Линь Сяо сестру?",
      qEn: "Will Lin Xiao forgive her sister?",
      opts: [["Никогда", "Never"], ["Только после признания", "Only after a confession"], ["Отомстит её же методами", "She'll use her sister's own tricks"]],
    },
    {
      slug: "hundred-day-contract",
      qRu: "Кто первым признается в чувствах?",
      qEn: "Who will confess first?",
      opts: [["Он", "Him"], ["Она", "Her"], ["Их выдаст бабушка", "Grandma will expose them"]],
    },
    {
      slug: "neon-fox",
      qRu: "Чьё детство в капсуле?",
      qEn: "Whose childhood is in the capsule?",
      opts: [["Самого Лиса", "Fox's own"], ["Его брата-близнеца", "His twin brother's"], ["Это подделка", "It's a forgery"]],
    },
  ];
  for (const p of polls) {
    const series = created.find((s) => s.slug === p.slug)!;
    const poll = await prisma.poll.create({
      data: {
        seriesId: series.id,
        questionRu: p.qRu,
        questionEn: p.qEn,
        closesAt: new Date(Date.now() + 4 * 86400_000),
        options: { create: p.opts.map(([labelRu, labelEn]) => ({ labelRu, labelEn })) },
      },
      include: { options: true },
    });
    for (const [fi, fan] of fans.entries()) {
      const opt = poll.options[(fi * fi + 1) % poll.options.length];
      await prisma.pollVote.create({ data: { userId: fan.id, pollId: poll.id, optionId: opt.id } });
    }
  }

  // Viewer: continue watching + list
  const viewerSeries = ["bride-of-ashes", "last-signal", "red-thread"];
  for (const [i, slug] of viewerSeries.entries()) {
    const series = created.find((s) => s.slug === slug)!;
    const ep = await prisma.episode.findFirstOrThrow({ where: { seriesId: series.id, number: 2 + i } });
    await prisma.watchProgress.create({
      data: { userId: viewer.id, episodeId: ep.id, seriesId: series.id, positionSec: 5 + i * 2 },
    });
  }
  for (const slug of ["empress-second-chances", "desert-mirage"]) {
    const series = created.find((s) => s.slug === slug)!;
    await prisma.listItem.create({ data: { userId: viewer.id, seriesId: series.id } });
  }

  // Earnings so studio dashboards aren't empty
  for (const [si, series] of created.entries()) {
    const ep = await prisma.episode.findFirstOrThrow({ where: { seriesId: series.id, number: series.freeEpisodes + 1 } });
    for (let k = 0; k < 6 + (si % 5) * 3; k++) {
      const fan = fans[(k + si) % fans.length];
      const exists = await prisma.unlock.findUnique({ where: { userId_episodeId: { userId: fan.id, episodeId: ep.id } } });
      if (exists) continue;
      await prisma.unlock.create({ data: { userId: fan.id, episodeId: ep.id, createdAt: new Date(Date.now() - k * 86400_000 / 2) } });
      await prisma.coinTransaction.create({ data: { userId: fan.id, amount: -series.defaultCoinPrice, reason: "UNLOCK", episodeId: ep.id } });
      await prisma.creatorEarning.create({
        data: { creatorId: series.creatorId, episodeId: ep.id, coins: Math.floor(series.defaultCoinPrice / 2), createdAt: new Date(Date.now() - k * 86400_000 / 2) },
      });
    }
  }

  // A pending series + creator application for the admin queues
  await prisma.series.create({
    data: {
      slug: "glass-orchard",
      titleRu: "Стеклянный сад",
      titleEn: "The Glass Orchard",
      taglineRu: "Деревья, которые растут из чужих секретов.",
      taglineEn: "Trees that grow from other people's secrets.",
      descriptionRu: "Садовница выращивает стеклянные деревья, в каждом из которых заперт чей-то секрет. Однажды в саду прорастает её собственный.",
      descriptionEn: "A gardener grows glass trees, each holding someone's secret. One day her own begins to sprout.",
      orientation: "VERTICAL",
      hue: 150,
      genres: "fantasy,drama",
      moods: "wonder,cry",
      aiModels: "Kling 2.5,Suno v5",
      status: "PENDING",
      creatorId: creatorA.id,
      episodes: { create: [1, 2, 3].map((n) => ({ number: n, titleRu: `Серия ${n}`, titleEn: `Episode ${n}`, videoUrl: "demo:v-teal.mp4", durationSec: 90 })) },
    },
  });
  await prisma.creatorApplication.create({
    data: { userId: fans[0].id, message: "Делаю ИИ-клипы два года, хочу запустить мини-сериал про космических курьеров.", portfolio: "https://example.com/portfolio" },
  });

  const counts = await Promise.all([prisma.series.count(), prisma.episode.count(), prisma.user.count(), prisma.comment.count()]);
  console.log(`Seeded: ${counts[0]} series, ${counts[1]} episodes, ${counts[2]} users, ${counts[3]} comments`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
