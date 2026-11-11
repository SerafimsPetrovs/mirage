// Question bank for on-air quizzes (bilingual, per channel kind + general). Pure data, no server-only.
import type { ChannelKind } from "./tv-rules";

export type QuizQ = { ru: string; en: string; options: { ru: string; en: string }[]; correct: number };

const q = (ru: string, en: string, options: [string, string][], correct: number): QuizQ => ({ ru, en, options: options.map(([r, e]) => ({ ru: r, en: e })), correct });

const GENERAL: QuizQ[] = [
  q("Сколько планет в Солнечной системе?", "How many planets are in the Solar System?", [["7", "7"], ["8", "8"], ["9", "9"], ["12", "12"]], 1),
  q("Какая планета самая большая?", "Which planet is the largest?", [["Сатурн", "Saturn"], ["Земля", "Earth"], ["Юпитер", "Jupiter"], ["Нептун", "Neptune"]], 2),
  q("Сколько секунд в одном часе?", "How many seconds are in an hour?", [["360", "360"], ["3600", "3600"], ["6000", "6000"], ["60", "60"]], 1),
  q("Что быстрее всего во Вселенной?", "What is the fastest thing in the Universe?", [["Звук", "Sound"], ["Свет", "Light"], ["Ракета", "A rocket"], ["Слухи", "Gossip"]], 1),
  q("Какой газ мы выдыхаем больше, чем вдыхаем?", "Which gas do we breathe out more than we breathe in?", [["Кислород", "Oxygen"], ["Азот", "Nitrogen"], ["Углекислый газ", "Carbon dioxide"], ["Гелий", "Helium"]], 2),
  q("Сколько ног у паука?", "How many legs does a spider have?", [["6", "6"], ["8", "8"], ["10", "10"], ["12", "12"]], 1),
  q("Какой океан самый большой?", "Which ocean is the largest?", [["Атлантический", "Atlantic"], ["Индийский", "Indian"], ["Северный Ледовитый", "Arctic"], ["Тихий", "Pacific"]], 3),
  q("Из чего в основном состоит Солнце?", "What is the Sun mostly made of?", [["Водород", "Hydrogen"], ["Железо", "Iron"], ["Кислород", "Oxygen"], ["Углерод", "Carbon"]], 0),
];

const BANK: Partial<Record<ChannelKind, QuizQ[]>> = {
  ABSURD: [
    q("Ведущий Глорб продаёт свою мебель. Что он продал вчера?", "Host Glorb sells his own furniture. What did he sell yesterday?", [["Диван", "The couch"], ["Пол", "The floor"], ["Третий глаз", "His third eye"], ["Совесть", "His conscience"]], 1),
    q("Сколько голов у семьи из «Готовим для семиглавых»?", "How many heads does the family in “Cooking for Seven-Headed Families” have?", [["7", "7"], ["49", "49"], ["Смотря на сколько поссорились", "Depends on the argument"], ["Одна, но очень большая", "One, but very big"]], 1),
    q("Что защищает «Страхование супа»?", "What does “Soup Insurance” protect?", [["Суп от остывания", "Soup from going cold"], ["Вас от супа", "You from the soup"], ["Суп от вас", "The soup from you"], ["Всё перечисленное", "All of the above"]], 3),
  ],
  DOCS: [
    q("Как размножаются небесные киты?", "How do sky whales reproduce?", [["Облаками", "Through clouds"], ["Грозами", "Through thunderstorms"], ["Наука не знает", "Science doesn't know"], ["Очень стеснительно", "Very shyly"]], 2),
    q("Ближайшая к Солнцу звезда — это…", "The nearest star to the Sun is…", [["Сириус", "Sirius"], ["Проксима Центавра", "Proxima Centauri"], ["Вега", "Vega"], ["Полярная", "Polaris"]], 1),
    q("Как называется планета вне Солнечной системы?", "What is a planet outside the Solar System called?", [["Астероид", "An asteroid"], ["Экзопланета", "An exoplanet"], ["Квазар", "A quasar"], ["Пульсар", "A pulsar"]], 1),
  ],
  DARK: [
    q("Что нельзя делать с кассетой №44?", "What must you never do with tape #44?", [["Смотреть", "Watch it"], ["Перематывать", "Rewind it"], ["Выбрасывать", "Throw it away"], ["Называть по имени", "Call it by its name"]], 1),
    q("Сколько этажей в лифте объекта 0-17?", "How many floors does the elevator of object 0-17 have?", [["0", "0"], ["17", "17"], ["Минус один", "Minus one"], ["Столько, сколько вы боитесь", "As many as you fear"]], 2),
    q("Как зовут ночного ведущего «Тёмного эфира»?", "What is the night host of Dark Air called?", [["Архивариус", "The Archivist"], ["Сторож", "The Keeper"], ["Голос", "The Voice"], ["Он не представился", "He never said"]], 0),
  ],
  MUSIC: [
    q("Какой носитель музыки появился раньше?", "Which music format came first?", [["CD", "CD"], ["MP3", "MP3"], ["Кассета", "Cassette"], ["Стриминг", "Streaming"]], 2),
    q("Как в 2000-х называли короткую мелодию на телефоне?", "What was a short melody on a 2000s phone called?", [["Сэмпл", "A sample"], ["Рингтон", "A ringtone"], ["Джингл", "A jingle"], ["Бит", "A beat"]], 1),
    q("Сколько мест в хит-параде MIRAGE MUSIC?", "How many places are in the MIRAGE MUSIC chart?", [["5", "5"], ["10", "10"], ["20", "20"], ["40", "40"]], 1),
  ],
  KIDS: [
    q("Кто живёт в улье?", "Who lives in a beehive?", [["Муравьи", "Ants"], ["Пчёлы", "Bees"], ["Бабочки", "Butterflies"], ["Совы", "Owls"]], 1),
    q("Какого цвета небо днём?", "What colour is the sky in the daytime?", [["Зелёного", "Green"], ["Голубого", "Blue"], ["Красного", "Red"], ["Фиолетового", "Purple"]], 1),
    q("Кто говорит «мяу»?", "Who says “meow”?", [["Собака", "A dog"], ["Корова", "A cow"], ["Кошка", "A cat"], ["Утка", "A duck"]], 2),
  ],
};

/** Questions for a channel: its own bank first, then general knowledge. */
export function quizBank(kind: string): QuizQ[] {
  const own = BANK[kind as ChannelKind] ?? [];
  return kind === "KIDS" ? own : [...own, ...GENERAL];
}
