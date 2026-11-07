import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { pick, type Locale } from "@/i18n/shared";
import { spendGold, creditGold } from "./gold";
import {
  checkBet, CUSTOM_MULTIPLIER, payoutFor, poolMultiplier, predictionOpen, PREDICTION_OPTIONS_MAX, PREDICTION_OPTIONS_MIN,
  type BetInput,
} from "./gold-rules";

export class PredictionError extends Error {
  constructor(public code: "not_found" | "closed" | "already" | "stake" | "choice" | "custom_off" | "custom_text" | "own" | "forbidden" | "invalid" | "not_yet") {
    super(code);
  }
}

async function latestEpisodeNumber(seriesId: string, tx: Prisma.TransactionClient = prisma) {
  const last = await tx.episode.findFirst({ where: { seriesId }, orderBy: { number: "desc" }, select: { number: true } });
  return last?.number ?? 0;
}

/** Creator: a new question after one of their episodes. */
export async function createPrediction(
  user: { id: string; role: string },
  input: { episodeId: string; questionRu: string; questionEn: string; options: { ru: string; en: string }[]; allowCustom: boolean },
) {
  const ep = await prisma.episode.findUnique({ where: { id: input.episodeId }, include: { series: { select: { id: true, creatorId: true, isFamilySafe: true } } } });
  if (!ep) throw new PredictionError("not_found");
  if (ep.series.creatorId !== user.id && user.role !== "ADMIN") throw new PredictionError("forbidden");
  const options = input.options.map((o) => ({ ru: o.ru.trim(), en: o.en.trim() })).filter((o) => o.en || o.ru);
  const qEn = input.questionEn.trim();
  const qRu = input.questionRu.trim();
  if (!(qEn || qRu) || options.length < PREDICTION_OPTIONS_MIN || options.length > PREDICTION_OPTIONS_MAX) throw new PredictionError("invalid");
  return prisma.prediction.create({
    data: {
      seriesId: ep.series.id,
      episodeId: ep.id,
      questionRu: qRu || qEn,
      questionEn: qEn || qRu,
      allowCustom: input.allowCustom,
      options: { create: options.map((o) => ({ labelRu: o.ru || o.en, labelEn: o.en || o.ru })) },
    },
  });
}

/** Viewer: one bet per question, in gold. */
export async function placeBet(userId: string, predictionId: string, bet: BetInput) {
  return prisma.$transaction(async (tx) => {
    const p = await tx.prediction.findUnique({ where: { id: predictionId }, include: { episode: { select: { number: true } }, series: { select: { creatorId: true } }, options: { select: { id: true } } } });
    if (!p) throw new PredictionError("not_found");
    if (p.series.creatorId === userId) throw new PredictionError("own");
    if (!predictionOpen(p.status, p.episode.number, await latestEpisodeNumber(p.seriesId, tx))) throw new PredictionError("closed");
    const check = checkBet(bet, p.allowCustom);
    if (!check.ok) throw new PredictionError(check.reason);
    if (bet.optionId && !p.options.some((o) => o.id === bet.optionId)) throw new PredictionError("choice");
    let row;
    try {
      row = await tx.predictionBet.create({
        data: { predictionId, userId, optionId: bet.optionId || null, customText: bet.customText?.trim() || null, stake: bet.stake },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new PredictionError("already");
      throw e;
    }
    const gold = await spendGold(tx, userId, bet.stake, "BET", row.id);
    return { gold, betId: row.id };
  });
}

/**
 * Creator: reveals the answer once the next episode is out. Ready options are paid from the pool
 * (×1.5…×10), accepted own guesses ×3. Runs once (status guard), all in one transaction.
 */
export async function resolvePrediction(user: { id: string; role: string }, predictionId: string, correctOptionIds: string[], correctCustomBetIds: string[]) {
  return prisma.$transaction(async (tx) => {
    const p = await tx.prediction.findUnique({ where: { id: predictionId }, include: { series: { select: { creatorId: true } }, episode: { select: { number: true } }, bets: true, options: true } });
    if (!p) throw new PredictionError("not_found");
    if (p.series.creatorId !== user.id && user.role !== "ADMIN") throw new PredictionError("forbidden");
    if (p.status !== "OPEN") throw new PredictionError("closed");
    if ((await latestEpisodeNumber(p.seriesId, tx)) <= p.episode.number) throw new PredictionError("not_yet");
    const ok = new Set(correctOptionIds.filter((id) => p.options.some((o) => o.id === id)));
    const okCustom = new Set(correctCustomBetIds);
    const claimed = await tx.prediction.updateMany({ where: { id: p.id, status: "OPEN" }, data: { status: "RESOLVED", resolvedAt: new Date() } });
    if (claimed.count === 0) throw new PredictionError("closed");
    if (ok.size) await tx.predictionOption.updateMany({ where: { id: { in: [...ok] } }, data: { correct: true } });

    const pool = p.bets.reduce((a, b) => a + b.stake, 0);
    const winningStake = p.bets.filter((b) => b.optionId && ok.has(b.optionId)).reduce((a, b) => a + b.stake, 0);
    const mult = poolMultiplier(pool, winningStake);
    let winners = 0;
    for (const b of p.bets) {
      const custom = !b.optionId;
      const won = custom ? okCustom.has(b.id) : ok.has(b.optionId!);
      const payout = won ? payoutFor(b.stake, custom ? CUSTOM_MULTIPLIER : mult) : 0;
      await tx.predictionBet.update({ where: { id: b.id }, data: { status: won ? "WON" : "LOST", payout, customOk: custom && won } });
      if (won) {
        winners++;
        await creditGold(tx, b.userId, payout, "WIN", b.id);
      }
    }
    return { bets: p.bets.length, winners, multiplier: mult };
  });
}

/** Creator: cancels a question (e.g. the story went another way) — every stake comes back. */
export async function cancelPrediction(user: { id: string; role: string }, predictionId: string) {
  return prisma.$transaction(async (tx) => {
    const p = await tx.prediction.findUnique({ where: { id: predictionId }, include: { series: { select: { creatorId: true } }, bets: true } });
    if (!p) throw new PredictionError("not_found");
    if (p.series.creatorId !== user.id && user.role !== "ADMIN") throw new PredictionError("forbidden");
    const claimed = await tx.prediction.updateMany({ where: { id: p.id, status: "OPEN" }, data: { status: "CANCELED", resolvedAt: new Date() } });
    if (claimed.count === 0) throw new PredictionError("closed");
    for (const b of p.bets) {
      await tx.predictionBet.update({ where: { id: b.id }, data: { status: "REFUNDED", payout: b.stake } });
      await creditGold(tx, b.userId, b.stake, "REFUND", b.id);
    }
  });
}

export type PredictionView = {
  id: string;
  question: string;
  episodeNumber: number;
  open: boolean;
  status: "OPEN" | "RESOLVED" | "CANCELED";
  /** Bets closed (next episode is out) and the creator hasn't revealed the answer yet. */
  awaiting: boolean;
  allowCustom: boolean;
  /** Vote split is revealed only after the answer (so nobody follows the crowd). */
  options: { id: string; label: string; correct: boolean; share: number | null }[];
  players: number | null;
  multiplier: number | null;
  mine: { optionId: string | null; customText: string | null; stake: number; status: string; payout: number } | null;
};

function viewOf(
  p: Prisma.PredictionGetPayload<{ include: { options: true; bets: true; episode: { select: { number: true } } } }>,
  latest: number,
  userId: string | null,
  locale: Locale,
): PredictionView {
  const resolved = p.status === "RESOLVED";
  const pool = p.bets.reduce((a, b) => a + b.stake, 0);
  const correct = new Set(p.options.filter((o) => o.correct).map((o) => o.id));
  const winningStake = p.bets.filter((b) => b.optionId && correct.has(b.optionId)).reduce((a, b) => a + b.stake, 0);
  const mine = userId ? p.bets.find((b) => b.userId === userId) : undefined;
  const open = predictionOpen(p.status, p.episode.number, latest);
  return {
    id: p.id,
    question: pick(p, "question", locale),
    episodeNumber: p.episode.number,
    open,
    status: p.status as PredictionView["status"],
    awaiting: p.status === "OPEN" && !open,
    allowCustom: p.allowCustom,
    options: p.options.map((o) => ({
      id: o.id,
      label: pick(o, "label", locale),
      correct: o.correct,
      share: resolved && p.bets.length ? Math.round((p.bets.filter((b) => b.optionId === o.id).length / p.bets.length) * 100) : null,
    })),
    players: resolved ? p.bets.length : null,
    multiplier: resolved && winningStake ? Math.round(poolMultiplier(pool, winningStake) * 10) / 10 : null,
    mine: mine ? { optionId: mine.optionId, customText: mine.customText, stake: mine.stake, status: mine.status, payout: mine.payout } : null,
  };
}

const viewInclude = { options: true, bets: true, episode: { select: { number: true } } } as const;

/** The question shown after a given episode (newest first). */
export async function getEpisodePrediction(episodeId: string, seriesId: string, userId: string | null, locale: Locale) {
  const p = await prisma.prediction.findFirst({ where: { episodeId, status: { not: "CANCELED" } }, orderBy: { createdAt: "desc" }, include: viewInclude });
  if (!p) return null;
  return viewOf(p, await latestEpisodeNumber(seriesId), userId, locale);
}

/** Series page: the newest question that is open, waiting for the answer, or answered in the last 7 days. */
export async function getSeriesPrediction(seriesId: string, userId: string | null, locale: Locale) {
  const week = new Date(Date.now() - 7 * 86400_000);
  const p = await prisma.prediction.findFirst({
    where: { seriesId, OR: [{ status: "OPEN" }, { status: "RESOLVED", resolvedAt: { gte: week } }] },
    orderBy: { createdAt: "desc" },
    include: viewInclude,
  });
  if (!p) return null;
  return viewOf(p, await latestEpisodeNumber(seriesId), userId, locale);
}

/** Creator studio: every question of a series with bets for resolving. */
export async function getStudioPredictions(seriesId: string, locale: Locale) {
  const [rows, latest] = await Promise.all([
    prisma.prediction.findMany({ where: { seriesId }, orderBy: { createdAt: "desc" }, include: { ...viewInclude, bets: { include: { user: { select: { name: true } } } } } }),
    latestEpisodeNumber(seriesId),
  ]);
  return rows.map((p) => ({
    id: p.id,
    question: pick(p, "question", locale),
    episodeNumber: p.episode.number,
    status: p.status,
    canResolve: p.status === "OPEN" && latest > p.episode.number,
    pool: p.bets.reduce((a, b) => a + b.stake, 0),
    options: p.options.map((o) => ({ id: o.id, label: pick(o, "label", locale), correct: o.correct, bets: p.bets.filter((b) => b.optionId === o.id).length })),
    custom: p.bets.filter((b) => !b.optionId).map((b) => ({ id: b.id, text: b.customText ?? "", name: b.user.name, ok: b.customOk })),
  }));
}
