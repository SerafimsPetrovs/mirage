import { PrismaClient, type Orientation } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import sharp from "sharp";

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
  familySafe?: boolean;
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
    familySafe: true,
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
  {
    slug: "fox-and-star-lantern",
    titleRu: "Лисёнок и звёздный фонарь",
    titleEn: "The Little Fox and the Star Lantern",
    taglineRu: "Каждую ночь одна звезда падает в лес. Кто-то должен вернуть её на небо.",
    taglineEn: "Every night one star falls into the forest. Someone has to bring it back to the sky.",
    descriptionRu: "Рыжий лисёнок Тимка находит упавшую звезду и обещает вернуть её домой. По пути он знакомится с совой-библиотекарем, ворчливым ежом и светлячками, которые боятся темноты.",
    descriptionEn: "Timka the little fox finds a fallen star and promises to take it home. On the way he meets a librarian owl, a grumpy hedgehog and fireflies who are afraid of the dark.",
    orientation: "VERTICAL",
    hue: 28,
    genres: ["fantasy", "comedy"],
    moods: ["wonder", "laugh"],
    ai: ["Midjourney v7", "Kling 2.5", "ElevenLabs"],
    notesRu: "Мягкий акварельный стиль задан референсами детских книг. Голоса — ElevenLabs, колыбельная в финале каждой серии — Suno.",
    notesEn: "The soft watercolour look comes from picture-book references. Voices by ElevenLabs; the lullaby at the end of every episode is by Suno.",
    episodes: 12,
    age: "0+",
    familySafe: true,
    creator: 0,
    views: 410000,
  },
  {
    slug: "cloud-post",
    titleRu: "Облачная почта",
    titleEn: "Cloud Post",
    taglineRu: "Письма, которые разносят облака. Иногда — не по адресу.",
    taglineEn: "Letters delivered by clouds. Sometimes to the wrong address.",
    descriptionRu: "Маленькое облако Пуф работает почтальоном в небесном городе. Однажды ветер уносит мешок писем, и Пуф отправляется в путешествие над морями и горами, чтобы каждое письмо нашло адресата.",
    descriptionEn: "Puff the little cloud works as a postman in the sky city. When the wind blows away a sack of letters, Puff travels over seas and mountains so every letter finds its way home.",
    orientation: "HORIZONTAL",
    hue: 200,
    genres: ["fantasy", "comedy"],
    moods: ["wonder", "laugh"],
    ai: ["Veo 3", "Suno v5"],
    notesRu: "Серии по 10 минут — удобно перед сном. Облака анимированы в Veo 3, музыка написана Suno в стиле музыкальной шкатулки.",
    notesEn: "Ten-minute episodes, perfect before bedtime. Clouds animated in Veo 3; music-box score by Suno.",
    episodes: 6,
    age: "0+",
    familySafe: true,
    creator: 1,
    views: 260000,
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
    prisma.promoCode.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const passwordHash = await bcrypt.hash("mirage123", 10);

  const admin = await prisma.user.create({
    data: { email: "admin@mirage.tv", name: "Admin", role: "ADMIN", passwordHash, avatarHue: 0 },
  });
  const creatorA = await prisma.user.create({
    data: { email: "creator@mirage.tv", name: "Studio Lumen", role: "CREATOR", passwordHash, avatarHue: 330, bio: "Короткие ИИ-дорамы с длинным послевкусием." },
  });
  const creatorB = await prisma.user.create({
    data: { email: "lotus@mirage.tv", name: "Neon Lotus", role: "CREATOR", passwordHash, avatarHue: 260, bio: "AI cinema, sci-fi & palace intrigue." },
  });
  const viewer = await prisma.user.create({
    data: { email: "viewer@mirage.tv", name: "Алиса", role: "VIEWER", passwordHash, avatarHue: 200, bonusCoins: 120, paidCoins: 330 },
  });
  await prisma.coinTransaction.createMany({
    data: [
      { userId: viewer.id, amount: 50, bonus: 50, reason: "BONUS", note: "welcome" },
      { userId: viewer.id, amount: 70, bonus: 70, reason: "CHECKIN", note: "history" },
      { userId: viewer.id, amount: 330, paid: 330, reason: "PURCHASE", note: "coins_300" },
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
        ageRating: s.slug === "my-husband-is-a-ghost" ? "18+" : s.age ?? "16+",
        status: "PUBLISHED",
        featured: !!s.featured,
        isFamilySafe: !!s.familySafe,
        isAdult: s.slug === "my-husband-is-a-ghost",
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
      await prisma.coinTransaction.create({ data: { userId: fan.id, amount: -series.defaultCoinPrice, paid: -series.defaultCoinPrice, reason: "UNLOCK", episodeId: ep.id } });
      await prisma.creatorEarning.create({
        data: { creatorId: series.creatorId, episodeId: ep.id, seriesId: series.id, coins: Math.floor(series.defaultCoinPrice / 2), createdAt: new Date(Date.now() - k * 86400_000 / 2) },
      });
    }
  }

  // Older payouts history: Studio Lumen earned more earlier and already withdrew once; Neon Lotus has one request in review.
  const old = (d: number) => new Date(Date.now() - d * 86400_000);
  await prisma.creatorEarning.create({ data: { creatorId: creatorA.id, source: "UNLOCK", coins: 3200, createdAt: old(45) } });
  await prisma.payout.create({
    data: { userId: creatorA.id, coins: 1500, amountCents: 900, method: "IBAN", details: "DE89370400440532013000", holderName: "Studio Lumen GmbH", status: "PAID", createdAt: old(30), processedAt: old(28) },
  });
  await prisma.creatorEarning.create({ data: { creatorId: creatorB.id, source: "UNLOCK", coins: 1900, createdAt: old(20) } });
  await prisma.payout.create({
    data: { userId: creatorB.id, coins: 1600, amountCents: 960, method: "PAYPAL", details: "lotus.studio@example.com", holderName: "Mei Lin", status: "PENDING", createdAt: old(1) },
  });
  // payoutCoins cache = all earned coins − coins in open or paid payouts
  for (const c of [creatorA, creatorB]) {
    const [earned, out] = await Promise.all([
      prisma.creatorEarning.aggregate({ where: { creatorId: c.id }, _sum: { coins: true } }),
      prisma.payout.aggregate({ where: { userId: c.id, status: { in: ["PENDING", "APPROVED", "PAID"] } }, _sum: { coins: true } }),
    ]);
    await prisma.user.update({ where: { id: c.id }, data: { payoutCoins: (earned._sum.coins ?? 0) - (out._sum.coins ?? 0) } });
  }

  // Promo codes for demos
  await prisma.promoCode.createMany({
    data: [
      { code: "WELCOME100", kind: "COINS", value: 100, note: "Демо: 100 бонусных монет" },
      { code: "VIPWEEK", kind: "VIP_DAYS", value: 7, maxUses: 500, expiresAt: new Date(Date.now() + 30 * 86400_000), note: "Демо: неделя VIP" },
      { code: "BLOGGER-ANNA", kind: "COINS", value: 50, maxUses: 1000, usesCount: 312, note: "Интеграция у блогера" },
    ],
  });

  await seedFanService(created);

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

// ───────── Fan service 18+: skins, deleted scenes, chat characters ─────────

/** Stylised "set photo" art (no real people): gradient, bokeh and a silhouette. */
function portraitSvg(hue: number, variant: number, w = 600, h = 800) {
  const bokeh = Array.from({ length: 9 }, (_, i) => {
    const x = (i * 137 + variant * 61) % w;
    const y = (i * 89 + variant * 37) % (h * 0.6);
    const r = 14 + ((i * 23 + variant * 7) % 46);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="hsl(${(hue + i * 18) % 360} 90% 75%)" opacity="${0.12 + (i % 3) * 0.08}"/>`;
  }).join("");
  const tilt = (variant % 3) * 6 - 6;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 70% 32%)"/><stop offset="1" stop-color="hsl(${(hue + 50) % 360} 75% 14%)"/></linearGradient>
    <radialGradient id="rim" cx="0.7" cy="0.25" r="0.8"><stop offset="0" stop-color="hsl(${(hue + 20) % 360} 100% 80%)" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <linearGradient id="sil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue} 40% 12%)"/><stop offset="1" stop-color="#05040a"/></linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  ${bokeh}
  <rect width="100%" height="100%" fill="url(#rim)"/>
  <g transform="rotate(${tilt} ${w / 2} ${h})" fill="url(#sil)">
    <ellipse cx="${w / 2}" cy="${h * 0.42}" rx="${w * 0.15}" ry="${h * 0.13}"/>
    <path d="M${w * 0.42} ${h * 0.52} Q${w / 2} ${h * 0.6} ${w * 0.58} ${h * 0.52} L${w * 0.6} ${h * 0.6} Q${w * 0.92} ${h * 0.66} ${w * 0.98} ${h} L${w * 0.02} ${h} Q${w * 0.08} ${h * 0.66} ${w * 0.4} ${h * 0.6} Z"/>
    <path d="M${w * 0.33} ${h * 0.4} Q${w * 0.34} ${h * 0.24} ${w / 2} ${h * 0.25} Q${w * 0.68} ${h * 0.25} ${w * 0.68} ${h * 0.44} Q${w * 0.74} ${h * 0.6} ${w * 0.7} ${h * 0.68} L${w * 0.62} ${h * 0.5} Q${w * 0.64} ${h * 0.36} ${w / 2} ${h * 0.33} Q${w * 0.37} ${h * 0.36} ${w * 0.38} ${h * 0.5} L${w * 0.3} ${h * 0.68} Q${w * 0.26} ${h * 0.58} ${w * 0.33} ${h * 0.4} Z"/>
  </g>
  <rect width="100%" height="100%" fill="hsl(${hue} 80% 50%)" opacity=".06"/>
</svg>`;
}

async function writeArt(folder: "images" | "private", name: string, svg: string, width: number) {
  const dir = path.join(process.cwd(), "storage", folder);
  fs.mkdirSync(dir, { recursive: true });
  await sharp(Buffer.from(svg)).resize({ width }).webp({ quality: 88 }).toFile(path.join(dir, name));
  return `storage:${folder}/${name}`;
}

async function seedFanService(created: { id: string; slug: string }[]) {
  const bySlug = (slug: string) => created.find((s) => s.slug === slug)!;
  const epOf = (seriesId: string, number: number) => prisma.episode.findFirstOrThrow({ where: { seriesId, number } });

  // Skins + deleted scenes (on free episodes so anyone can try them)
  const skinSets = [
    { slug: "hundred-day-contract", eps: [1, 2] },
    { slug: "bride-of-ashes", eps: [1] },
    { slug: "my-husband-is-a-ghost", eps: [1] },
  ];
  const SKINS = [
    { nameRu: "Купальник", nameEn: "Swimsuit", emoji: "👙", rarity: "rare", video: "v-rose", price: 40 },
    { nameRu: "Латекс", nameEn: "Latex", emoji: "🖤", rarity: "epic", video: "v-violet", price: 60 },
    { nameRu: "Горничная", nameEn: "Maid", emoji: "🎀", rarity: "common", video: "v-amber", price: 30 },
    { nameRu: "Вечернее платье", nameEn: "Evening gown", emoji: "👗", rarity: "common", video: "v-crimson", price: 30 },
  ];
  for (const set of skinSets) {
    const series = bySlug(set.slug);
    for (const n of set.eps) {
      const ep = await epOf(series.id, n);
      await prisma.skin.createMany({
        data: SKINS.map((k) => ({ episodeId: ep.id, nameRu: k.nameRu, nameEn: k.nameEn, emoji: k.emoji, rarity: k.rarity, videoUrl: `demo:${k.video}.mp4`, price: k.price })),
      });
      await prisma.bonusScene.create({
        data: {
          episodeId: ep.id,
          titleRu: n === 1 ? "Ночь у бассейна" : "То, что осталось за дверью",
          titleEn: n === 1 ? "A night by the pool" : "What happened behind the door",
          videoUrl: "demo:v-crimson.mp4",
          durationSec: 40,
          price: 30,
          triggerAtSec: n === 1 ? 6 : null,
        },
      });
    }
  }

  // Chat characters with "exclusive set photos" (all adults)
  const CHARS = [
    {
      slug: "hundred-day-contract", nameRu: "Аня", nameEn: "Anya", age: 24, hue: 330,
      taglineRu: "Официантка с контрактом на сто дней", taglineEn: "The waitress with a hundred-day contract",
      greetingRu: "Ой, привет! Только смену закончила. Ты же не скажешь ему, что я тебе пишу? 😉",
      greetingEn: "Oh, hi! Just finished my shift. You won’t tell him I’m texting you, right? 😉",
      persona: "Аня, 24 года. Работает официанткой, мечтает открыть свою кофейню. Подписала фиктивный брачный контракт с холодным наследником корпорации Марком и делает вид, что ей всё равно, но тайно влюблена. Остроумная, дерзкая, любит подкалывать собеседника, флиртует легко и игриво. Иногда проговаривается о том, что будет в следующих сериях, но тут же делает вид, что это шутка.",
    },
    {
      slug: "hundred-day-contract", nameRu: "Марк", nameEn: "Mark", age: 29, hue: 220,
      taglineRu: "Холодный наследник. Только снаружи.", taglineEn: "The cold heir. Only on the outside.",
      greetingRu: "У меня пять минут между советом директоров и ужином. Удиви меня.",
      greetingEn: "I have five minutes between the board meeting and dinner. Surprise me.",
      persona: "Марк, 29 лет. Наследник корпорации, привык всё контролировать. Говорит коротко и уверенно, с ленивой иронией. За маской холода — заботливый и ревнивый. Флиртует сдержанно, но очень прямо. Ненавидит, когда ему врут, и обожает, когда с ним спорят.",
    },
    {
      slug: "bride-of-ashes", nameRu: "Линь Сяо", nameEn: "Lin Xiao", age: 26, hue: 350,
      taglineRu: "Вернулась из пепла. Помнит всех.", taglineEn: "Back from the ashes. Remembers everyone.",
      greetingRu: "Пришёл посмотреть, как горит мой список врагов? Садись ближе.",
      greetingEn: "Came to watch my list of enemies burn? Sit closer.",
      persona: "Линь Сяо, 26 лет. Погибла в пожаре в день свадьбы и очнулась за год до трагедии. Внешне мягкая и улыбчивая, внутри — холодный расчёт и жажда мести. Говорит загадками, с опасным обаянием. Флиртует как игрок: проверяет собеседника на верность и смелость.",
    },
  ];
  const captions = [
    ["Между дублями 📸", "Between takes 📸"],
    ["Только для тебя", "Just for you"],
    ["Гримёрка, 2 часа ночи", "Dressing room, 2 a.m."],
    ["Сцену вырезали. Фото осталось 😏", "They cut the scene. The photo stayed 😏"],
  ];
  for (const [i, c] of CHARS.entries()) {
    const series = bySlug(c.slug);
    const avatarUrl = await writeArt("images", `seed-char-${i}.webp`, portraitSvg(c.hue, i, 600, 600), 256);
    const ch = await prisma.character.create({
      data: {
        seriesId: series.id, nameRu: c.nameRu, nameEn: c.nameEn, age: c.age, hue: c.hue, persona: c.persona,
        taglineRu: c.taglineRu, taglineEn: c.taglineEn, greetingRu: c.greetingRu, greetingEn: c.greetingEn, avatarUrl,
      },
    });
    for (const [k, [ru, en]] of captions.entries()) {
      const imageUrl = await writeArt("private", `seed-photo-${i}-${k}.webp`, portraitSvg((c.hue + k * 25) % 360, i * 4 + k + 1), 720);
      await prisma.characterPhoto.create({ data: { characterId: ch.id, imageUrl, captionRu: ru, captionEn: en, price: k === 3 ? 40 : 25, order: k } });
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
