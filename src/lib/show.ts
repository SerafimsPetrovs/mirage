import "server-only";
import { prisma } from "./db";
import { chargeForContent, grantCoins } from "./coins";
import { complete } from "./llm";
import {
  CAMEO_MAX_OPEN,
  CAMEO_PRICE,
  cameoNameProblem,
  normalizeCameoName,
  parseScriptJson,
  scriptToText,
  SHOW_POLL_HOURS,
  type ScriptDraft,
} from "./show-rules";

export class ShowError extends Error {
  constructor(public code: "NOT_SHOW" | "NAME" | "LIMIT" | "STATE") {
    super(code);
  }
}

async function showSeries(seriesId: string) {
  const s = await prisma.series.findUnique({ where: { id: seriesId }, select: { id: true, interactive: true, status: true, creatorId: true, isFamilySafe: true } });
  if (!s || !s.interactive || s.status !== "PUBLISHED") throw new ShowError("NOT_SHOW");
  return s;
}

/** Viewer pays to get their name into an upcoming episode (moderated before it airs). */
export async function buyCameo(userId: string, seriesId: string, rawName: string) {
  const s = await showSeries(seriesId);
  if (cameoNameProblem(rawName)) throw new ShowError("NAME");
  const name = normalizeCameoName(rawName);
  const open = await prisma.cameo.count({ where: { userId, seriesId, status: { in: ["PENDING", "APPROVED"] } } });
  if (open >= CAMEO_MAX_OPEN) throw new ShowError("LIMIT");
  return prisma.$transaction(async (tx) => {
    await chargeForContent(tx, { userId, creatorId: s.creatorId, price: CAMEO_PRICE, reason: "CAMEO", source: "CAMEO", seriesId, note: name });
    return tx.cameo.create({ data: { userId, seriesId, name, kind: "BOUGHT", coins: CAMEO_PRICE } });
  });
}

/** Admin: approve (queue for the next episode) or reject (paid coins come back as bonus coins). */
export async function moderateCameo(cameoId: string, decision: "approve" | "reject") {
  const c = await prisma.cameo.findUnique({ where: { id: cameoId } });
  if (!c || c.status !== "PENDING") throw new ShowError("STATE");
  if (decision === "approve") {
    await prisma.cameo.update({ where: { id: c.id }, data: { status: "APPROVED" } });
    return;
  }
  await prisma.$transaction(async (tx) => {
    const r = await tx.cameo.updateMany({ where: { id: c.id, status: "PENDING" }, data: { status: "REJECTED" } });
    if (r.count === 1 && c.userId && c.coins > 0) await grantCoins(c.userId, c.coins, "REFUND", { note: `cameo: ${c.name}` }, tx);
  });
}

/** Admin: free cameo for a top supporter or anyone (goes straight to the queue). */
export async function giftCameo(seriesId: string, name: string, userId: string | null, kind: "TOP" | "GIFT") {
  await showSeries(seriesId);
  if (cameoNameProblem(name)) throw new ShowError("NAME");
  return prisma.cameo.create({ data: { seriesId, userId, name: normalizeCameoName(name), kind, status: "APPROVED" } });
}

/** Biggest supporters of a series over the last `days`: coins spent on episodes, poll boosts and cameos. */
export async function topSupporters(seriesId: string, days = 30, take = 10) {
  const since = new Date(Date.now() - days * 86400_000);
  const [unlocks, boosts, cameos] = await Promise.all([
    prisma.coinTransaction.groupBy({ by: ["userId"], where: { createdAt: { gte: since }, amount: { lt: 0 }, episode: { seriesId } }, _sum: { amount: true } }),
    prisma.pollBoost.groupBy({ by: ["userId"], where: { createdAt: { gte: since }, poll: { seriesId } }, _sum: { coins: true } }),
    prisma.cameo.groupBy({ by: ["userId"], where: { createdAt: { gte: since }, seriesId, userId: { not: null }, status: { not: "REJECTED" } }, _sum: { coins: true } }),
  ]);
  const total = new Map<string, number>();
  const add = (id: string | null, n: number) => id && total.set(id, (total.get(id) ?? 0) + n);
  unlocks.forEach((u) => add(u.userId, -(u._sum.amount ?? 0)));
  boosts.forEach((b) => add(b.userId, b._sum.coins ?? 0));
  cameos.forEach((c) => add(c.userId, c._sum.coins ?? 0));
  const top = [...total.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, take);
  const users = await prisma.user.findMany({ where: { id: { in: top.map(([id]) => id) } }, select: { id: true, name: true, avatarHue: true } });
  const byId = new Map(users.map((u) => [u.id, u]));
  return top.flatMap(([id, coins]) => (byId.get(id) ? [{ ...byId.get(id)!, coins }] : []));
}

/** Data for the series page block "Get into the series". */
export async function getShowBlock(seriesId: string, userId: string | null) {
  const [aired, mine, top] = await Promise.all([
    prisma.cameo.findMany({
      where: { seriesId, status: "AIRED" },
      orderBy: { createdAt: "desc" },
      take: 24,
      select: { id: true, name: true, episode: { select: { id: true, number: true } } },
    }),
    userId ? prisma.cameo.findMany({ where: { seriesId, userId, status: { in: ["PENDING", "APPROVED"] } }, select: { id: true, name: true, status: true } }) : [],
    topSupporters(seriesId, 30, 5),
  ]);
  return { aired, mine, top, price: CAMEO_PRICE };
}

// ---------------------------------------------------------------- writers' room

function fallbackDraft(number: number, winner: string | null, names: string[]): ScriptDraft {
  return {
    title: `Серия ${number}`,
    summary: `Голоса выбрали: ${winner ?? "—"}. Вера делает этот шаг — и получает последствия.`,
    scenes: [
      { prompt: "Cinematic vertical shot, young woman barista in a cozy night cafe, warm light, rain on the window, she looks up as if hearing voices", text: `Вера слышит голоса: ${names.join(", ") || "тысяча шёпотов"}. Они решили за неё.` },
      { prompt: "Close-up of a tall man in a dark coat entering the cafe, neon reflections, dramatic tension", text: "Дверь открывается. Тот, кого она меньше всего ждала." },
      { prompt: "Extreme close-up of the woman's eyes widening, shallow depth of field, cliffhanger mood", text: "«Ты не должна была этого знать», — говорит он." },
    ],
    question: "Что сделает Вера?",
    optionA: "Расскажет ему правду",
    optionB: "Солжёт и сбежит",
    caption: "Тысяча голосов решают за неё. Что дальше — выбирайте в комментариях 👇",
  };
}

/**
 * Writes the next episode with the LLM: bible (series description + writer notes), previous episodes,
 * the poll winner and the queued cameo names. Falls back to a template when no LLM is available.
 */
export async function writeNextScript(seriesId: string) {
  const s = await prisma.series.findUniqueOrThrow({
    where: { id: seriesId },
    select: { titleRu: true, descriptionRu: true, promptNotesRu: true, episodes: { orderBy: { number: "desc" }, take: 1, select: { number: true } } },
  });
  const [prev, poll, queued] = await Promise.all([
    prisma.showScript.findMany({ where: { seriesId, episodeId: { not: null } }, orderBy: { number: "desc" }, take: 3 }),
    prisma.poll.findFirst({ where: { seriesId }, orderBy: { createdAt: "desc" }, include: { options: { include: { _count: { select: { votes: true } } } } } }),
    prisma.cameo.findMany({ where: { seriesId, status: "APPROVED" }, orderBy: { createdAt: "asc" }, take: 12, select: { name: true } }),
  ]);
  const number = Math.max(s.episodes[0]?.number ?? 0, prev[0]?.number ?? 0) + 1;
  let winner: string | null = null;
  if (poll) {
    const boosts = await prisma.pollBoost.groupBy({ by: ["optionId"], where: { pollId: poll.id }, _sum: { votes: true } });
    const b = new Map(boosts.map((x) => [x.optionId, x._sum.votes ?? 0]));
    winner = [...poll.options].sort((x, y) => y._count.votes + (b.get(y.id) ?? 0) - (x._count.votes + (b.get(x.id) ?? 0)))[0]?.labelRu ?? null;
  }
  const names = queued.map((c) => c.name);
  const story = prev
    .slice()
    .reverse()
    .map((p) => `Серия ${p.number} «${p.title}»: ${p.content.split("\n")[0]}`)
    .join("\n");

  const raw = await complete(
    [
      {
        role: "system",
        content: [
          "Ты — главный сценарист вертикального ИИ-сериала (серии по 60–90 секунд), который пишут зрители: каждую серию заканчивает развилка, зрители голосуют.",
          "Пиши по-русски, коротко, с крючком в начале и клиффхэнгером в конце. Все персонажи взрослые. Без откровенных сцен.",
          "Ответь ТОЛЬКО JSON без пояснений: {\"title\": string, \"summary\": string (1–2 предложения), \"scenes\": [{\"prompt\": string (английский промпт для видеомодели: кадр, свет, камера, без имён), \"text\": string (что происходит и реплики)}] (3–5 сцен), \"question\": string (развилка), \"optionA\": string, \"optionB\": string, \"caption\": string (подпись для TikTok с призывом голосовать)}",
          "Имена зрителей из списка «камео» обязательно впиши в сцены как голоса, которые слышит героиня, или как имена на вывесках/в телефоне/у гостей.",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          `Сериал: «${s.titleRu}». ${s.descriptionRu}`,
          s.promptNotesRu ? `Библия сериала:\n${s.promptNotesRu}` : "",
          story ? `Предыдущие серии:\n${story}` : "Это первая серия.",
          `Зрители проголосовали: ${winner ?? "голосования ещё не было"}.`,
          `Камео (вписать): ${names.join(", ") || "нет"}.`,
          `Напиши серию ${number}.`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
    3000,
  );
  const draft = (raw && parseScriptJson(raw)) || fallbackDraft(number, winner, names);
  // One draft at a time: "rewrite" replaces the unpublished one.
  await prisma.showScript.deleteMany({ where: { seriesId, episodeId: null } });
  return prisma.showScript.create({
    data: {
      seriesId,
      number,
      title: draft.title,
      content: scriptToText(draft),
      pollQuestion: draft.question,
      optionA: draft.optionA,
      optionB: draft.optionB,
      caption: draft.caption,
    },
  });
}

/**
 * Publishes a script as the next episode: creates the episode with the given video,
 * airs the queued cameos in it and opens the next poll.
 */
export async function publishScript(scriptId: string, videoUrl: string, durationSec: number) {
  return prisma.$transaction(async (tx) => {
    const sc = await tx.showScript.findUnique({ where: { id: scriptId } });
    if (!sc || sc.episodeId) throw new ShowError("STATE");
    const last = await tx.episode.findFirst({ where: { seriesId: sc.seriesId }, orderBy: { number: "desc" }, select: { number: true } });
    const ep = await tx.episode.create({
      data: { seriesId: sc.seriesId, number: (last?.number ?? 0) + 1, titleRu: sc.title, titleEn: sc.title, videoUrl, durationSec },
    });
    await tx.cameo.updateMany({ where: { seriesId: sc.seriesId, status: "APPROVED" }, data: { status: "AIRED", episodeId: ep.id } });
    await tx.poll.updateMany({ where: { seriesId: sc.seriesId, closesAt: { gt: new Date() } }, data: { closesAt: new Date() } });
    await tx.poll.create({
      data: {
        seriesId: sc.seriesId,
        questionRu: sc.pollQuestion,
        questionEn: sc.pollQuestion,
        closesAt: new Date(Date.now() + SHOW_POLL_HOURS * 3600_000),
        options: { create: [{ labelRu: sc.optionA, labelEn: sc.optionA }, { labelRu: sc.optionB, labelEn: sc.optionB }] },
      },
    });
    await tx.showScript.update({ where: { id: sc.id }, data: { episodeId: ep.id } });
    await tx.series.update({ where: { id: sc.seriesId }, data: { updatedAt: new Date() } });
    return ep;
  });
}
