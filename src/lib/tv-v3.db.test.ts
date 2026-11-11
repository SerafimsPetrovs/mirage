import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./db";
import { grantCoins, getEpisodeAccess, unlockEpisode } from "./coins";
import { createClip, ensureDay, moderateClip, payBounty, TvError } from "./tv";
import { activeAlerts, activePip, addAlert, channelBuffers, channelQueue, forcePlayNow, injectMascot, invalidateBuffers, panicSlot, playNext, reorderQueue, setBountyBoost, uploadZone } from "./tv-control";
import { buyApp, downloadRef, AppError } from "./apps";
import { HubError, myInvites, redeemInvite, setEpisodeRelease, createTask, updateTask, worksRegistry } from "./studio-hub";
import { utcDay } from "./rewards";
import { postSuperchat } from "./tv-live";
import { HIGHLIGHT_PRICE } from "./tv-rules";

const tag = Date.now().toString(36);
const made = { users: [] as string[], channels: [] as string[], series: [] as string[], apps: [] as string[] };

async function user(name: string, role: "VIEWER" | "CREATOR" | "ADMIN" = "VIEWER") {
  const u = await prisma.user.create({ data: { email: `${name}${tag}@t.t`, name, passwordHash: "x", role } });
  made.users.push(u.id);
  return u;
}
const err = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    return e instanceof TvError || e instanceof AppError || e instanceof HubError ? e.code : e instanceof Error ? e.message : String(e);
  }
};

let ch: { id: string };
let clips: { id: string }[];
const T0 = Date.UTC(2031, 0, 5, 10, 0, 0);
const at = (sec: number) => new Date(T0 + sec * 1000);

/** A hand-made schedule: 6 clip slots of 60 s from T0. */
async function grid() {
  await prisma.tvSlot.deleteMany({ where: { channelId: ch.id } });
  for (let i = 0; i < 6; i++)
    await prisma.tvSlot.create({ data: { channelId: ch.id, day: utcDay(at(0)), startsAt: at(i * 60), durationSec: 60, kind: "CLIP", clipId: clips[i % clips.length].id } });
}
const slots = () => prisma.tvSlot.findMany({ where: { channelId: ch.id }, orderBy: { startsAt: "asc" } });
/** No gaps or overlaps between consecutive slots. */
const seamless = (rows: { startsAt: Date; durationSec: number }[]) => rows.every((s, i) => i === 0 || rows[i - 1].startsAt.getTime() + rows[i - 1].durationSec * 1000 === s.startsAt.getTime());

beforeAll(async () => {
  const c = await prisma.tvChannel.create({ data: { slug: `ctl-${tag}`, number: 9000 + Math.floor(Math.random() * 900), nameRu: "Ctl", nameEn: "Ctl", kind: "ABSURD", hostName: "H", bufferTargetMin: 10, quiz: false } });
  made.channels.push(c.id);
  ch = c;
  clips = await Promise.all(
    [0, 1, 2].map((i) => prisma.tvClip.create({ data: { channelId: c.id, kind: "SHOW", title: `C${i}`, videoUrl: "demo:h-desert.mp4", durationSec: 60, status: "APPROVED" } })),
  );
});

afterAll(async () => {
  await prisma.tvChannel.deleteMany({ where: { id: { in: made.channels } } });
  await prisma.aiApp.deleteMany({ where: { id: { in: made.apps } } });
  await prisma.series.deleteMany({ where: { id: { in: made.series } } });
  await prisma.user.deleteMany({ where: { id: { in: made.users } } });
});

describe("control room: panic, queue, inserts", () => {
  it("PANIC on a buffered slot removes it and closes the gap; the clip returns to moderation", async () => {
    await grid();
    const before = await slots();
    const now = at(30); // viewers are in slot 0; slot 1 (starts at 60 s) is in the 120 s buffer
    await panicSlot(before[1].id, now);
    const after = await slots();
    expect(after.find((s) => s.id === before[1].id)).toBeUndefined();
    expect(after[1].id).toBe(before[2].id);
    expect(after[1].startsAt.getTime()).toBe(at(60).getTime());
    expect(seamless(after)).toBe(true);
    // The hole at the end of the chain is filled with a host card.
    expect(after[after.length - 1].kind).toBe("HOST");
    expect((await prisma.tvClip.findUniqueOrThrow({ where: { id: before[1].clipId! } })).status).toBe("PENDING");
    await prisma.tvClip.updateMany({ where: { channelId: ch.id }, data: { status: "APPROVED" } });
  });

  it("PANIC on the slot viewers see cuts it at this second", async () => {
    await grid();
    const before = await slots();
    await panicSlot(before[0].id, at(25));
    const after = await slots();
    expect(after[0].durationSec).toBe(25);
    expect(after[1].startsAt.getTime()).toBe(at(25).getTime());
    expect(seamless(after)).toBe(true);
    expect(await err(panicSlot(before[0].id, at(500)))).toBe("STATE");
    await prisma.tvClip.updateMany({ where: { channelId: ch.id }, data: { status: "APPROVED" } });
  });

  it("reorders upcoming slots inside the same block; never touches what is on air", async () => {
    await grid();
    const s = await slots();
    const ids = [s[3].id, s[1].id, s[2].id];
    await reorderQueue(ch.id, ids, at(10));
    const after = await slots();
    expect(after.map((x) => x.id).slice(0, 5)).toEqual([s[0].id, s[3].id, s[1].id, s[2].id, s[4].id]);
    expect(seamless(after)).toBe(true);
    expect(await err(reorderQueue(ch.id, [s[0].id, s[1].id], at(10)))).toBe("STATE");
  });

  it("play next inserts after the current slot; force now cuts the current one", async () => {
    await grid();
    const s = await slots();
    const n = await playNext(ch.id, { type: "CLIP", id: clips[2].id }, at(20));
    let after = await slots();
    expect(after[1].id).toBe(n.id);
    expect(n.startsAt.getTime()).toBe(at(60).getTime());
    expect(seamless(after)).toBe(true);
    const f = await forcePlayNow(ch.id, { type: "CLIP", id: clips[1].id }, at(70));
    after = await slots();
    expect(f.startsAt.getTime()).toBe(at(70).getTime());
    expect(after.find((x) => x.id === n.id)!.durationSec).toBe(10);
    expect(seamless(after)).toBe(true);
    expect(after.some((x) => x.id === s[1].id)).toBe(true);
    expect(await err(playNext(ch.id, { type: "CLIP", id: "nope" }, at(70)))).toBe("NOT_FOUND");
  });

  it("queue marks what is public, on the master monitor and buffered", async () => {
    await grid();
    const q = await channelQueue(ch.id, at(30), 1);
    expect(q[0].publicNow).toBe(true);
    expect(q.find((x) => x.masterNow)!.startsAt).toBe(at(120).getTime());
    expect(q.filter((x) => x.buffered).length).toBe(2);
  });
});

describe("alerts, teleprompter", () => {
  it("alerts reach this channel and 'all channels', and expire", async () => {
    const now = new Date();
    await addAlert(ch.id, "  Hello   viewers ", 5, now);
    await addAlert(null, "Everyone", 1, now);
    const a = await activeAlerts(ch.id, now);
    expect(a.map((x) => x.text)).toEqual(expect.arrayContaining(["Hello viewers", "Everyone"]));
    expect(await activeAlerts(ch.id, new Date(now.getTime() + 10 * 60_000))).toEqual(expect.not.arrayContaining([expect.objectContaining({ text: "Hello viewers" })]));
    expect(await err(addAlert(ch.id, "   ", 5))).toBe("empty");
  });

  it("PIP is shown while it lasts; BREAKING becomes a NEWS slot after the current programme", async () => {
    const now = new Date();
    await injectMascot({ channelId: ch.id, text: "Срочное включение! Какая-то дичь...", mode: "PIP", tone: "AUTO", locale: "ru" }, now);
    const pip = await activePip(ch.id, new Date(now.getTime() + 500));
    expect(pip?.timeline.map((x) => x.emotion)).toEqual(["HYPE_EXCITED", "IDLE", "SHOCK_SCARED"]);
    expect(await activePip(ch.id, new Date(now.getTime() + 60_000))).toBeNull();

    await prisma.tvSlot.deleteMany({ where: { channelId: ch.id } });
    await prisma.tvSlot.create({ data: { channelId: ch.id, day: utcDay(now), startsAt: new Date(now.getTime() - 5000), durationSec: 60, kind: "CLIP", clipId: clips[0].id } });
    await injectMascot({ channelId: ch.id, text: "ЭТО ПРОСТО КОШМАР!!!", mode: "BREAKING", tone: "AUTO", locale: "ru" }, now);
    const news = await prisma.tvSlot.findFirstOrThrow({ where: { channelId: ch.id, kind: "NEWS" } });
    expect(news.startsAt.getTime()).toBe(now.getTime() - 5000 + 60_000);
    expect(JSON.parse(news.data).timeline[0].emotion).toBe("ANGRY_RAGE");
  });
});

describe("bounties", () => {
  it("zone at upload decides the reward, paid once on approval; admin uploads earn nothing", async () => {
    invalidateBuffers();
    await prisma.tvClip.updateMany({ where: { channelId: ch.id }, data: { status: "REJECTED" } });
    invalidateBuffers();
    const buf = (await channelBuffers()).find((b) => b.channelId === ch.id)!;
    expect(buf.zone).toBe("RED");
    const zone = await uploadZone(ch.id);
    const creator = await user("bty", "CREATOR");
    await prisma.tvClip.create({ data: { channelId: ch.id, kind: "SHOW", title: "Bounty", videoUrl: "demo:h-dusk.mp4", status: "PENDING", creatorId: creator.id, bountyZone: zone } });
    const clip = await prisma.tvClip.findFirstOrThrow({ where: { creatorId: creator.id } });
    await moderateClip(clip.id, "approve");
    expect(await payBounty(clip.id)).toBeNull(); // only once
    const u = await prisma.user.findUniqueOrThrow({ where: { id: creator.id } });
    expect(u.genCredits).toBe(100 + 40);
    expect(u.bonusCoins).toBe(30);
    expect(u.paidCoins).toBe(0);
    expect(await prisma.coinTransaction.count({ where: { userId: creator.id, reason: "BOUNTY" } })).toBe(1);
    await prisma.tvClip.updateMany({ where: { channelId: ch.id }, data: { status: "APPROVED" } });
  });

  it("manual x2 boost turns a channel hot", async () => {
    await setBountyBoost(ch.id, 6);
    expect((await channelBuffers()).find((b) => b.channelId === ch.id)!.boosted).toBe(true);
    expect(await uploadZone(ch.id)).toBe("BOOST");
    await setBountyBoost(ch.id, null);
    expect(await uploadZone(ch.id)).not.toBe("BOOST");
  });

  it("creators may tag only their own series", async () => {
    const a = await user("own", "CREATOR");
    const b = await user("oth", "CREATOR");
    const s = await prisma.series.create({ data: { slug: `s-${tag}`, titleRu: "S", titleEn: "S", descriptionRu: "", descriptionEn: "", creatorId: a.id } });
    made.series.push(s.id);
    expect(await err(createClip({ id: b.id, role: "CREATOR", kidsMode: false }, { channelId: ch.id, kind: "SHOW", title: "Teaser", artist: "", videoRef: "storage:videos/x.mp4", orientation: "HORIZONTAL", seriesId: s.id }))).toBe("NOT_FOUND");
  });
});

describe("empty channel", () => {
  it("an approved clip airs right away instead of after the hour-long no-signal card", async () => {
    const c = await prisma.tvChannel.create({ data: { slug: `empty-${tag}`, number: 8000 + Math.floor(Math.random() * 900), nameRu: "E", nameEn: "E", kind: "ABSURD", hostName: "H", quiz: false, familyOnly: true } });
    made.channels.push(c.id);
    const now = new Date();
    await ensureDay(c, utcDay(now));
    const before = await prisma.tvSlot.findFirstOrThrow({ where: { channelId: c.id, startsAt: { lte: now } }, orderBy: { startsAt: "desc" } });
    expect(before.kind).toBe("HOST");
    const clip = await prisma.tvClip.create({ data: { channelId: c.id, kind: "SHOW", title: "Mine", videoUrl: "demo:h-desert.mp4", durationSec: 14, status: "PENDING" } });
    await moderateClip(clip.id, "approve");
    // The new schedule starts now (a short host intro may come first) and the clip airs within seconds.
    const first = await prisma.tvSlot.findFirstOrThrow({ where: { channelId: c.id, clipId: clip.id }, orderBy: { startsAt: "asc" } });
    expect(first.startsAt.getTime() - Date.now()).toBeLessThan(30_000);
  });
});

describe("chat highlight", () => {
  it("a highlighted message costs HIGHLIGHT_PRICE, is coloured but not pinned", async () => {
    const u = await user("hl");
    await grantCoins(u.id, 20, "BONUS");
    const viewer = { id: u.id, name: u.name, role: "VIEWER", kidsMode: false, showAdult: false, adultConfirmedAt: null };
    const balance = await postSuperchat(viewer, ch as never, "Привет, эфир!", HIGHLIGHT_PRICE);
    expect(balance).toBe(20 - HIGHLIGHT_PRICE);
    const msg = await prisma.tvMessage.findFirstOrThrow({ where: { userId: u.id } });
    expect(msg.paid).toBe(HIGHLIGHT_PRICE);
    expect(await err(postSuperchat(viewer, ch as never, "ещё", 7))).toBe("STATE");
  });
});

describe("AI apps", () => {
  it("buys once (bonus first), downloads only after purchase, refuses family mode", async () => {
    const app = await prisma.aiApp.create({ data: { slug: `app-${tag}`, name: "App", priceCoins: 50, winFile: "storage:files/x.exe" } });
    made.apps.push(app.id);
    const u = await user("app");
    expect(await err(downloadRef(u.id ? { id: u.id, kidsMode: false } : null, app.slug, "win"))).toBe("NOT_FOUND");
    expect(await err(buyApp({ id: u.id, kidsMode: false }, app.slug))).toBe("INSUFFICIENT");
    await grantCoins(u.id, 30, "PURCHASE");
    await grantCoins(u.id, 30, "BONUS");
    expect(await buyApp({ id: u.id, kidsMode: false }, app.slug)).toEqual({ charged: 50 });
    expect(await buyApp({ id: u.id, kidsMode: false }, app.slug)).toEqual({ charged: 0 });
    const after = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect([after.bonusCoins, after.paidCoins]).toEqual([0, 10]);
    expect((await downloadRef({ id: u.id, kidsMode: false }, app.slug, "win")).ref).toBe("storage:files/x.exe");
    expect(await err(downloadRef({ id: u.id, kidsMode: false }, app.slug, "mac"))).toBe("NO_FILE");
    expect(await err(buyApp({ id: u.id, kidsMode: true }, app.slug))).toBe("KIDS");
  });
});

describe("creator hub", () => {
  it("5 invites per creator; a code makes one viewer a creator, once", async () => {
    const c = await user("inv", "CREATOR");
    const inv = await myInvites(c);
    expect(inv).toHaveLength(5);
    expect(await myInvites(c)).toHaveLength(5);
    const v1 = await user("v1");
    const v2 = await user("v2");
    expect(await err(redeemInvite(v1, "nope"))).toBe("NOT_FOUND");
    await redeemInvite(v1, inv[0].code.toLowerCase());
    expect((await prisma.user.findUniqueOrThrow({ where: { id: v1.id } })).role).toBe("CREATOR");
    expect(await err(redeemInvite(v2, inv[0].code))).toBe("USED");
  });

  it("scheduled episodes are hidden from viewers until release, visible to the creator", async () => {
    const c = await user("rel", "CREATOR");
    const v = await user("relv");
    const s = await prisma.series.create({ data: { slug: `r-${tag}`, titleRu: "R", titleEn: "R", descriptionRu: "", descriptionEn: "", creatorId: c.id, status: "PUBLISHED", freeEpisodes: 5 } });
    made.series.push(s.id);
    const ep = await prisma.episode.create({ data: { seriesId: s.id, number: 1, videoUrl: "demo:h-desert.mp4" } });
    const now = new Date();
    expect(await err(setEpisodeRelease(v, ep.id, new Date(now.getTime() + 3600_000)))).toBe("NOT_FOUND");
    expect(await err(setEpisodeRelease(c, ep.id, new Date(now.getTime() - 1000)))).toBe("PAST");
    await setEpisodeRelease(c, ep.id, new Date(now.getTime() + 3600_000));
    const asViewer = { id: v.id, role: "VIEWER" as const, subscription: null };
    expect(await getEpisodeAccess(asViewer, ep.id)).toBeNull();
    expect(await getEpisodeAccess({ id: c.id, role: "CREATOR", subscription: null }, ep.id)).not.toBeNull();
    expect(await err(unlockEpisode(v.id, ep.id))).toBe("NOT_RELEASED");
    await setEpisodeRelease(c, ep.id, null);
    expect(await getEpisodeAccess(asViewer, ep.id)).not.toBeNull();
    const reg = await worksRegistry(c, "en");
    expect(reg.find((r) => r.id === s.id)?.status.kind).toBe("PUBLISHED");
  });

  it("tasks: create with checklist, update status, only own", async () => {
    const c = await user("tsk", "CREATOR");
    const o = await user("tsko", "CREATOR");
    const t = await createTask(c, { title: "Ep 4", checklist: ["Script", "Edit"] });
    await updateTask(c, t.id, { status: "DOING", checklist: [{ t: "Script", done: true }] });
    const row = await prisma.creatorTask.findUniqueOrThrow({ where: { id: t.id } });
    expect(row.status).toBe("DOING");
    expect(JSON.parse(row.checklist)).toEqual([{ t: "Script", done: true }]);
    expect(await err(updateTask(o, t.id, { status: "DONE" }))).toBe("NOT_FOUND");
    expect(await err(createTask(c, { title: " " }))).toBe("INVALID");
  });
});
