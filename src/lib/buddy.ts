import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { InsufficientCoinsError, spendCoins } from "./coins";
import { creditGold, InsufficientGoldError, spendGold } from "./gold";
import { achievementDef, achievementStates, claimMarker, type Metric } from "./achievements";
import { buddyDef, itemDef, parseOutfit, sanitizeLook, type Outfit } from "./buddy-catalog";

export type BuddyLook = { buddy: string; outfit: Outfit };

/** The viewer's buddy, outfit and owned items. The stored look is re-checked so a removed item never shows. */
export async function getBuddyState(userId: string) {
  const [u, items] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { buddyId: true, buddyOutfit: true, gold: true, paidCoins: true, bonusCoins: true } }),
    prisma.buddyItem.findMany({ where: { userId }, select: { itemId: true } }),
  ]);
  const owned = new Set(items.map((i) => i.itemId));
  const look = sanitizeLook(owned, u.buddyId, parseOutfit(u.buddyOutfit)) ?? { buddy: buddyDef("").id, outfit: {} };
  return { look, owned: [...owned], gold: u.gold, coins: u.paidCoins + u.bonusCoins };
}

/** Just the look, for the TV screen (cheap; null-safe for guests). */
export function lookOf(user: { buddyId: string; buddyOutfit: string } | null): BuddyLook | null {
  if (!user) return null;
  return { buddy: buddyDef(user.buddyId).id, outfit: parseOutfit(user.buddyOutfit) };
}

export type BuyResult = { ok: true; charged: number } | { ok: false; error: "unknown" | "free" | "funds" | "reward" };

/**
 * Buys a buddy or outfit piece. The ownership row is created first (already owned → P2002 → nothing charged),
 * then gold or coins are taken in the same transaction. Prices come from the catalog, never from the client.
 */
export async function buyBuddyItem(userId: string, itemId: string): Promise<BuyResult> {
  const item = itemDef(itemId);
  if (!item) return { ok: false, error: "unknown" };
  if (item.cur === "free") return { ok: false, error: "free" };
  if (item.cur === "reward") return { ok: false, error: "reward" };
  try {
    await prisma.$transaction(async (tx) => {
      await tx.buddyItem.create({ data: { userId, itemId } });
      if (item.cur === "gold") await spendGold(tx, userId, item.price, "BUDDY", itemId);
      else await spendCoins(tx, userId, item.price, "BUDDY", { note: `buddy:${itemId}` });
    });
    return { ok: true, charged: item.price };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: true, charged: 0 };
    if (e instanceof InsufficientCoinsError || e instanceof InsufficientGoldError) return { ok: false, error: "funds" };
    throw e;
  }
}

/** Saves the chosen buddy and outfit. Anything not owned is refused. */
export async function saveBuddyLook(userId: string, look: BuddyLook) {
  const items = await prisma.buddyItem.findMany({ where: { userId }, select: { itemId: true } });
  const clean = sanitizeLook(new Set(items.map((i) => i.itemId)), look.buddy, look.outfit);
  if (!clean) return null;
  await prisma.user.update({ where: { id: userId }, data: { buddyId: clean.buddy, buddyOutfit: JSON.stringify(clean.outfit) } });
  return clean;
}

// ───────────── achievements ─────────────

/** Progress numbers, all from data the site already records (gold ledger, chat, check-ins, watch progress). */
async function metricsOf(userId: string): Promise<Record<Metric, number>> {
  const goldCount = (reason: string) => prisma.goldTransaction.count({ where: { userId, reason } });
  const [tvWatch, tvVotes, quiz, chat, streak, episodes, items] = await Promise.all([
    goldCount("TV_WATCH"),
    goldCount("TV_VOTE"),
    goldCount("TV_QUIZ"),
    prisma.tvMessage.count({ where: { userId } }),
    prisma.checkIn.aggregate({ where: { userId }, _max: { streak: true } }),
    prisma.watchProgress.count({ where: { userId, completed: true } }),
    prisma.buddyItem.findMany({ where: { userId }, select: { itemId: true } }),
  ]);
  const buddyBuys = items.filter((i) => {
    const d = itemDef(i.itemId);
    return d?.cur === "gold" || d?.cur === "coins";
  }).length;
  return { tvWatch, tvVotes, quiz, chat, streak: streak._max.streak ?? 0, episodes, buddyBuys };
}

export async function getAchievements(userId: string) {
  const [metrics, claimed] = await Promise.all([
    metricsOf(userId),
    prisma.buddyItem.findMany({ where: { userId, itemId: { startsWith: "ach:" } }, select: { itemId: true } }),
  ]);
  return achievementStates(metrics, new Set(claimed.map((c) => c.itemId)));
}

export type ClaimResult = { ok: true; item?: string; gold?: number } | { ok: false; error: "unknown" | "notYet" | "claimed" };

/**
 * Takes an achievement's reward once: the claim marker row is created first (a second claim → P2002 → nothing),
 * then the reward item row or the gold, in one transaction. Progress is re-checked on the server.
 */
export async function claimAchievement(userId: string, id: string): Promise<ClaimResult> {
  const def = achievementDef(id);
  if (!def) return { ok: false, error: "unknown" };
  const metrics = await metricsOf(userId);
  if ((metrics[def.metric] ?? 0) < def.goal) return { ok: false, error: "notYet" };
  try {
    await prisma.$transaction(async (tx) => {
      await tx.buddyItem.create({ data: { userId, itemId: claimMarker(id) } });
      if ("item" in def.reward) await tx.buddyItem.upsert({ where: { userId_itemId: { userId, itemId: def.reward.item } }, create: { userId, itemId: def.reward.item }, update: {} });
      else await creditGold(tx, userId, def.reward.gold, "ACHIEVEMENT", id);
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, error: "claimed" };
    throw e;
  }
  return "item" in def.reward ? { ok: true, item: def.reward.item } : { ok: true, gold: def.reward.gold };
}
