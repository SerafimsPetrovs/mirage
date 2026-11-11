import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { chargeForContent, getBalance } from "./coins";
import { POLL_VOTE_PRICE } from "./access";
import { CHAT_DAILY_LIMIT, CHAT_RATE_PER_MIN, chatMessagePrice, pickSkin, ROULETTE_PRICE, shouldSendPhoto, spicyBlock } from "./spicy";
import { mediaUrl } from "./files";
import { generateReply, type ChatTurn } from "./llm";
import { isUnsafeReply, MINOR_RE } from "./generation";
import { pick, type Locale } from "@/i18n/shared";

const isUnique = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

/** Owners (creator/admin) get every add-on for free. */
function isOwner(user: { id: string; role: string }, creatorId: string) {
  return user.role === "ADMIN" || user.id === creatorId;
}

// ---------- Skins ----------

export async function buySkin(user: { id: string; role: string }, skinId: string) {
  return prisma.$transaction(async (tx) => {
    const skin = await tx.skin.findUniqueOrThrow({
      where: { id: skinId },
      include: { episode: { select: { id: true, seriesId: true, series: { select: { creatorId: true } } } } },
    });
    if (isOwner(user, skin.episode.series.creatorId)) return { charged: 0 };
    try {
      await tx.skinUnlock.create({ data: { userId: user.id, skinId, via: "buy" } });
    } catch (e) {
      if (isUnique(e)) return { charged: 0 };
      throw e;
    }
    await chargeForContent(tx, {
      userId: user.id,
      creatorId: skin.episode.series.creatorId,
      price: skin.price,
      reason: "SKIN",
      source: "SKIN",
      episodeId: skin.episode.id,
      seriesId: skin.episode.seriesId,
      note: skin.nameEn,
    });
    return { charged: skin.price };
  });
}

/** Roulette: pays ROULETTE_PRICE, wins a random (weighted) skin the viewer doesn't own yet. */
export async function spinSkin(user: { id: string; role: string }, episodeId: string, rand = Math.random) {
  return prisma.$transaction(async (tx) => {
    const ep = await tx.episode.findUniqueOrThrow({ where: { id: episodeId }, select: { seriesId: true, series: { select: { creatorId: true } } } });
    const skins = await tx.skin.findMany({ where: { episodeId }, orderBy: { createdAt: "asc" } });
    const owned = new Set(
      (await tx.skinUnlock.findMany({ where: { userId: user.id, skinId: { in: skins.map((s) => s.id) } }, select: { skinId: true } })).map((u) => u.skinId),
    );
    const won = pickSkin(skins.filter((s) => !owned.has(s.id)), rand());
    if (!won) throw new Error("NOTHING_LEFT");
    await tx.skinUnlock.create({ data: { userId: user.id, skinId: won.id, via: "spin" } });
    if (!isOwner(user, ep.series.creatorId)) {
      await chargeForContent(tx, {
        userId: user.id,
        creatorId: ep.series.creatorId,
        price: ROULETTE_PRICE,
        reason: "SKIN",
        source: "LOOT",
        episodeId,
        seriesId: ep.seriesId,
        note: "roulette",
      });
    }
    return won;
  });
}

// ---------- Uncut scenes ----------

export async function buyScene(user: { id: string; role: string }, sceneId: string) {
  return prisma.$transaction(async (tx) => {
    const scene = await tx.bonusScene.findUniqueOrThrow({
      where: { id: sceneId },
      include: { episode: { select: { id: true, seriesId: true, series: { select: { creatorId: true } } } } },
    });
    if (isOwner(user, scene.episode.series.creatorId)) return { charged: 0 };
    try {
      await tx.sceneUnlock.create({ data: { userId: user.id, sceneId } });
    } catch (e) {
      if (isUnique(e)) return { charged: 0 };
      throw e;
    }
    await chargeForContent(tx, {
      userId: user.id,
      creatorId: scene.episode.series.creatorId,
      price: scene.price,
      reason: "SCENE",
      source: "SCENE",
      episodeId: scene.episode.id,
      seriesId: scene.episode.seriesId,
    });
    return { charged: scene.price };
  });
}

// ---------- Poll boosts ----------

export async function boostPoll(user: { id: string; role: string }, pollId: string, optionId: string, votes: number) {
  return prisma.$transaction(async (tx) => {
    const poll = await tx.poll.findUniqueOrThrow({ where: { id: pollId }, include: { options: { select: { id: true } }, series: { select: { id: true, creatorId: true } } } });
    if (!poll.options.some((o) => o.id === optionId)) throw new Error("INVALID");
    if (poll.closesAt < new Date()) throw new Error("CLOSED");
    if (isOwner(user, poll.series.creatorId)) throw new Error("OWNER");
    const price = votes * POLL_VOTE_PRICE;
    await chargeForContent(tx, {
      userId: user.id,
      creatorId: poll.series.creatorId,
      price,
      reason: "POLL_BOOST",
      source: "POLL_BOOST",
      seriesId: poll.series.id,
      note: `+${votes}`,
    });
    await tx.pollBoost.create({ data: { userId: user.id, pollId, optionId, votes, coins: price } });
    return { charged: price };
  });
}

// ---------- Character photos ----------

export async function unlockPhoto(user: { id: string; role: string }, photoId: string) {
  return prisma.$transaction(async (tx) => {
    const photo = await tx.characterPhoto.findUniqueOrThrow({
      where: { id: photoId },
      include: { character: { select: { seriesId: true, series: { select: { creatorId: true } } } } },
    });
    if (isOwner(user, photo.character.series.creatorId)) return { charged: 0 };
    // Only photos the character actually sent to this viewer can be bought.
    const sent = await tx.chatMessage.findFirst({ where: { photoId, thread: { userId: user.id } }, select: { id: true } });
    if (!sent) throw new Error("NOT_SENT");
    try {
      await tx.photoUnlock.create({ data: { userId: user.id, photoId } });
    } catch (e) {
      if (isUnique(e)) return { charged: 0 };
      throw e;
    }
    await chargeForContent(tx, {
      userId: user.id,
      creatorId: photo.character.series.creatorId,
      price: photo.price,
      reason: "PHOTO",
      source: "PHOTO",
      seriesId: photo.character.seriesId,
    });
    return { charged: photo.price };
  });
}

export async function canSeePhoto(user: { id: string; role: string } | null, photoId: string) {
  if (!user) return false;
  const photo = await prisma.characterPhoto.findUnique({ where: { id: photoId }, select: { character: { select: { series: { select: { creatorId: true } } } } } });
  if (!photo) return false;
  if (isOwner(user, photo.character.series.creatorId)) return true;
  return !!(await prisma.photoUnlock.findUnique({ where: { userId_photoId: { userId: user.id, photoId } } }));
}

// ---------- Character chat ----------

export type ChatMsg = {
  id: string;
  role: "user" | "character";
  body: string;
  createdAt: string;
  photo: { id: string; price: number; unlocked: boolean; caption: string } | null;
};

export async function loadThread(userId: string, characterId: string, locale: Locale, owner: boolean) {
  const thread = await prisma.chatThread.findUnique({
    where: { userId_characterId: { userId, characterId } },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 200, include: { photo: true } } },
  });
  const unlocked = new Set(
    (await prisma.photoUnlock.findMany({ where: { userId, photo: { characterId } }, select: { photoId: true } })).map((p) => p.photoId),
  );
  const messages: ChatMsg[] = (thread?.messages ?? []).map((m) => ({
    id: m.id,
    role: m.role === "user" ? "user" : "character",
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    photo: m.photo
      ? { id: m.photo.id, price: m.photo.price, unlocked: owner || unlocked.has(m.photo.id), caption: pick(m.photo, "caption", locale) }
      : null,
  }));
  return { sent: thread?.userMessages ?? 0, messages };
}

export class ChatError extends Error {}

/**
 * Viewer sends a message: generate the reply first (no charge if the LLM fails), then in one
 * transaction charge the message (after the free ones) and store both messages.
 */
export async function sendChatMessage(user: { id: string; role: string }, characterId: string, text: string, locale: Locale) {
  const character = await prisma.character.findUniqueOrThrow({
    where: { id: characterId },
    include: { series: { select: { id: true, creatorId: true, titleRu: true, titleEn: true } }, photos: { orderBy: { order: "asc" } } },
  });
  const owner = isOwner(user, character.series.creatorId);
  // Rate limit: protects the LLM budget from spam and scripts.
  const mine = { role: "user", thread: { userId: user.id } };
  const [lastMinute, lastDay] = await Promise.all([
    prisma.chatMessage.count({ where: { ...mine, createdAt: { gte: new Date(Date.now() - 60_000) } } }),
    prisma.chatMessage.count({ where: { ...mine, createdAt: { gte: new Date(Date.now() - 86_400_000) } } }),
  ]);
  if (lastMinute >= CHAT_RATE_PER_MIN || lastDay >= CHAT_DAILY_LIMIT) throw new ChatError("RATE");
  const thread = await prisma.chatThread.upsert({
    where: { userId_characterId: { userId: user.id, characterId } },
    create: { userId: user.id, characterId },
    update: {},
    include: { messages: { orderBy: { createdAt: "desc" }, take: 30 } },
  });
  const price = owner ? 0 : chatMessagePrice(thread.userMessages);
  if (price > 0 && (await getBalance(user.id)) < price) throw new ChatError("INSUFFICIENT");

  const history: ChatTurn[] = thread.messages
    .slice()
    .reverse()
    .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.body }));
  history.push({ role: "user", content: text });

  const spec = {
    name: pick(character, "name", locale),
    age: character.age,
    persona: character.persona,
    seriesTitle: pick(character.series, "title", locale),
    locale,
  };
  const deflect = locale === "ru" ? "Давай не будем об этом. Поговорим лучше о нас? 🙂" : "Let's not go there. How about we talk about us instead? 🙂";
  const raw = MINOR_RE.test(text)
    ? deflect
    : await generateReply(spec, history).catch((e) => {
        console.error("chat llm", e);
        throw new ChatError("LLM");
      });
  // Output guard: whatever a prompt injection managed, unsafe or leaking replies never reach the viewer.
  const reply = isUnsafeReply(raw) ? deflect : raw;

  // Photo drop: when asked, or every few replies, attach the next photo not sent yet.
  const sentPhotoIds = new Set(
    (await prisma.chatMessage.findMany({ where: { threadId: thread.id, photoId: { not: null } }, select: { photoId: true } })).map((m) => m.photoId),
  );
  const nextPhoto = character.photos.find((p) => !sentPhotoIds.has(p.id)) ?? null;
  const lastPhotoIdx = thread.messages.findIndex((m) => m.photoId);
  const repliesSince = (lastPhotoIdx === -1 ? thread.messages : thread.messages.slice(0, lastPhotoIdx)).filter((m) => m.role === "character").length + 1;
  const attach = shouldSendPhoto(text, repliesSince, !!nextPhoto) ? nextPhoto : null;

  return prisma.$transaction(async (tx) => {
    if (price > 0) {
      await chargeForContent(tx, {
        userId: user.id,
        creatorId: character.series.creatorId,
        price,
        reason: "CHAT",
        source: "CHAT",
        seriesId: character.series.id,
      });
    }
    await tx.chatThread.update({ where: { id: thread.id }, data: { userMessages: { increment: 1 } } });
    const mine = await tx.chatMessage.create({ data: { threadId: thread.id, role: "user", body: text } });
    const theirs = await tx.chatMessage.create({
      data: { threadId: thread.id, role: "character", body: reply, photoId: attach?.id, createdAt: new Date(mine.createdAt.getTime() + 1) },
    });
    return { charged: price, mineId: mine.id, reply: { id: theirs.id, body: reply, photo: attach } };
  });
}

// ---------- Loaders for pages ----------

export async function getSeriesCharacters(seriesId: string, locale: Locale) {
  const chars = await prisma.character.findMany({ where: { seriesId }, orderBy: { createdAt: "asc" } });
  return chars.map((c) => ({
    id: c.id,
    name: pick(c, "name", locale),
    tagline: pick(c, "tagline", locale),
    avatar: mediaUrl(c.avatarUrl),
    hue: c.hue,
  }));
}

/**
 * 18+ add-ons for the player. Null when they must not be shown at all (kids mode, family series).
 * Hidden for everyone who has not switched 18+ content on (no accidental exposure); owners always see them.
 */
export async function getSpicyForEpisode(
  user: { id: string; role: string; kidsMode: boolean; adultConfirmedAt: Date | null; showAdult: boolean } | null,
  episode: { id: string; seriesId: string; creatorId: string },
  series: { isFamilySafe: boolean },
  locale: Locale,
) {
  const block = spicyBlock(user, series);
  const owner = !!user && !user.kidsMode && isOwner(user, episode.creatorId);
  if (block === "kids" || block === "family" || (block && !owner)) return null;
  const [skins, scene, characters] = await Promise.all([
    prisma.skin.findMany({
      where: { episodeId: episode.id },
      orderBy: { createdAt: "asc" },
      include: user ? { unlocks: { where: { userId: user.id }, select: { userId: true } } } : undefined,
    }),
    prisma.bonusScene.findUnique({
      where: { episodeId: episode.id },
      include: user ? { unlocks: { where: { userId: user.id }, select: { userId: true } } } : undefined,
    }),
    getSeriesCharacters(episode.seriesId, locale),
  ]);
  const has = (x: object) => owner || ("unlocks" in x && Array.isArray(x.unlocks) && x.unlocks.length > 0);
  return {
    skins: skins.map((s) => ({ id: s.id, name: pick(s, "name", locale), emoji: s.emoji, rarity: s.rarity, price: s.price, owned: has(s) })),
    scene: scene
      ? { id: scene.id, title: pick(scene, "title", locale), price: scene.price, owned: has(scene), triggerAt: scene.triggerAtSec, durationSec: scene.durationSec }
      : null,
    characters,
  };
}
