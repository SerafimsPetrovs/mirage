// Clears the MIRAGE TV broadcast content: every TV clip, the schedule, viewer orders (open ones are refunded),
// the AI factory, polls and the music likes. Channels stay, but stop filling gaps with catalog episodes
// (genres are emptied) — the catalog itself is not touched. Uploaded files in storage/ are kept on disk.
//   npx tsx prisma/clear-tv.ts           — show what would be deleted
//   npx tsx prisma/clear-tv.ts --yes     — delete
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const yes = process.argv.includes("--yes");
  const open = await prisma.tvOrder.findMany({ where: { status: { in: ["GENERATING", "REVIEW", "APPROVED"] } }, select: { id: true, userId: true, coins: true } });
  const counts = {
    clips: await prisma.tvClip.count(),
    slots: await prisma.tvSlot.count(),
    orders: await prisma.tvOrder.count(),
    openOrdersToRefund: open.length,
    factory: await prisma.tvFactoryItem.count(),
    polls: await prisma.tvPoll.count(),
    channelsWithGenres: await prisma.tvChannel.count({ where: { genres: { not: "" } } }),
  };
  console.log(yes ? "Deleting:" : "Would delete (run with --yes):", counts);
  if (!yes) return;

  await prisma.$transaction(async (tx) => {
    // Viewers paid for orders that will never air now: refund them (bonus coins, like a rejected order).
    for (const o of open) {
      await tx.user.update({ where: { id: o.userId }, data: { bonusCoins: { increment: o.coins } } });
      await tx.coinTransaction.create({ data: { userId: o.userId, amount: o.coins, paid: 0, bonus: o.coins, reason: "REFUND", note: "tv cleared" } });
    }
    await tx.tvOrder.deleteMany();
    await tx.tvSlot.deleteMany();
    await tx.tvPoll.deleteMany();
    await tx.tvFactoryItem.deleteMany();
    await tx.tvClip.deleteMany(); // likes cascade
    await tx.tvChannel.updateMany({ data: { genres: "" } });
  });
  console.log("Done. Upload your clips in /studio/tv (admin uploads go on air immediately).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
