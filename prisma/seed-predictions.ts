import type { PrismaClient } from "@prisma/client";

/** Demo "guess what happens next" questions after the latest episode, with a few fans' bets (gold). */
const QUESTIONS = [
  {
    slug: "empress-second-chances",
    qRu: "Кто на самом деле подменил императорскую печать?",
    qEn: "Who really swapped the imperial seal?",
    opts: [["Старшая наложница", "The senior consort"], ["Евнух Ли", "Eunuch Li"], ["Сама императрица", "The Empress herself"]],
  },
  {
    slug: "hundred-day-contract",
    qRu: "Подпишет ли Мин-джун продление контракта?",
    qEn: "Will Min-jun sign the contract extension?",
    opts: [["Да, но с новым условием", "Yes, with a new clause"], ["Нет, он уйдёт", "No, he walks away"], ["Контракт сожгут", "The contract gets burned"]],
  },
];

export async function seedPredictions(prisma: PrismaClient, fanIds: string[], viewerId: string) {
  const day = new Date().toISOString().slice(0, 10);
  for (const id of [...fanIds, viewerId]) {
    await prisma.user.update({ where: { id }, data: { gold: 80 } });
    await prisma.goldTransaction.create({ data: { userId: id, amount: 20, reason: "WELCOME", day } });
    await prisma.goldTransaction.create({ data: { userId: id, amount: 60, reason: "ADMIN", day } });
  }
  for (const q of QUESTIONS) {
    const series = await prisma.series.findUnique({ where: { slug: q.slug }, include: { episodes: { orderBy: { number: "desc" }, take: 1 } } });
    const last = series?.episodes[0];
    if (!series || !last) continue;
    const p = await prisma.prediction.create({
      data: {
        seriesId: series.id,
        episodeId: last.id,
        questionRu: q.qRu,
        questionEn: q.qEn,
        options: { create: q.opts.map(([labelRu, labelEn]) => ({ labelRu, labelEn })) },
      },
      include: { options: true },
    });
    for (const [i, fan] of fanIds.entries()) {
      const stake = [10, 25, 50][i % 3];
      await prisma.predictionBet.create({ data: { predictionId: p.id, userId: fan, optionId: p.options[(i * 2 + 1) % p.options.length].id, stake } });
      await prisma.user.update({ where: { id: fan }, data: { gold: { decrement: stake } } });
      await prisma.goldTransaction.create({ data: { userId: fan, amount: -stake, reason: "BET", day } });
    }
  }
}
