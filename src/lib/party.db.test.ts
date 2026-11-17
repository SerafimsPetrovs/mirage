/** Watch parties: create/join/kick, remote control, synced playback, ready check, polls, group food order, leaving. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./db";
import { createParty, joinParty, partyAction, PartyError, partyState } from "./party";
import { PARTY_MAX_MEMBERS } from "./party-rules";

const tag = Date.now().toString(36);
type U = Awaited<ReturnType<typeof prisma.user.create>>;
const users: U[] = [];
let channelSlug = "";
let freeEp = "";
let paidEp = "";

const viewer = (u: U, extra: Record<string, unknown> = {}) => ({ ...u, kidsMode: false, subscription: null, ...extra });
const code = (e: unknown) => (e instanceof PartyError ? e.code : String(e));
const fails = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    return code(e);
  }
};

beforeAll(async () => {
  for (let i = 0; i < PARTY_MAX_MEMBERS + 2; i++) users.push(await prisma.user.create({ data: { email: `p${i}-${tag}@p.test`, name: `P${i}`, passwordHash: "x" } }));
  const ch = await prisma.tvChannel.create({ data: { slug: `pty-${tag}`, number: 9400 + Math.floor(Math.random() * 200), nameRu: "К", nameEn: "C", kind: "ABSURD", hostName: "H", hostPersona: "p" } });
  channelSlug = ch.slug;
  const s = await prisma.series.create({
    data: {
      slug: `pty-${tag}`, titleRu: "С", titleEn: "S", descriptionRu: "d", descriptionEn: "d", status: "PUBLISHED", freeEpisodes: 1, creatorId: users[users.length - 1].id,
      episodes: { create: [1, 2].map((n) => ({ number: n, videoUrl: "demo:v-teal.mp4", durationSec: 120 })) },
    },
    include: { episodes: { orderBy: { number: "asc" } } },
  });
  freeEp = s.episodes[0].id;
  paidEp = s.episodes[1].id;
});

afterAll(async () => {
  await prisma.series.deleteMany({ where: { slug: `pty-${tag}` } });
  await prisma.tvChannel.deleteMany({ where: { slug: channelSlug } });
  await prisma.user.deleteMany({ where: { email: { endsWith: `-${tag}@p.test` } } });
});

describe("watch party", () => {
  it("TV room: join by code, chat, reactions, remote, kick, size limit", { timeout: 30_000 }, async () => {
    const [host, a, b] = users;
    expect(await fails(createParty(viewer(host, { kidsMode: true }), { channelSlug }))).toBe("KIDS");
    expect(await fails(createParty(viewer(host), { channelSlug: "nope" }))).toBe("NOT_FOUND");
    const p = await createParty(viewer(host), { channelSlug, title: "Friday" });
    expect(p.mode).toBe("TV");
    await joinParty(viewer(a), p.code);
    await joinParty(viewer(a), p.code); // idempotent
    expect(await fails(partyState(viewer(b), p.code, 0))).toBe("FORBIDDEN"); // must join first
    await partyAction(viewer(a), p.code, { op: "chat", text: "hi all" });
    expect(await fails(partyAction(viewer(a), p.code, { op: "chat", text: "go to http://spam.example" }))).toBe("TEXT");
    await partyAction(viewer(a), p.code, { op: "react", emoji: "🔥" });
    expect(await fails(partyAction(viewer(a), p.code, { op: "react", emoji: "<script>" }))).toBe("INVALID");
    // only the host / remote holder switches channels
    expect(await fails(partyAction(viewer(a), p.code, { op: "channel", slug: channelSlug }))).toBe("FORBIDDEN");
    await partyAction(viewer(host), p.code, { op: "remote", userId: a.id });
    await partyAction(viewer(a), p.code, { op: "channel", slug: channelSlug });
    const st = await partyState(viewer(a), p.code, 0);
    expect(st.me.control).toBe(true);
    expect(st.events.map((e) => e.kind)).toEqual(expect.arrayContaining(["SYSTEM", "CHAT", "REACTION"]));
    expect(st.members.map((m) => m.name)).toEqual(["P0", "P1"]);
    // kick: out for good
    await joinParty(viewer(b), p.code);
    expect(await fails(partyAction(viewer(a), p.code, { op: "kick", userId: b.id }))).toBe("FORBIDDEN");
    await partyAction(viewer(host), p.code, { op: "kick", userId: b.id });
    expect(await fails(joinParty(viewer(b), p.code))).toBe("KICKED");
    // size limit
    for (const u of users.slice(3, PARTY_MAX_MEMBERS + 1)) await joinParty(viewer(u), p.code);
    expect(await fails(joinParty(viewer(users[PARTY_MAX_MEMBERS + 1]), p.code))).toBe("FULL");
  });

  it("episode room: access per viewer, ready check, synced play/pause, food pauses everyone", async () => {
    const [host, a] = users;
    // the host can't put on an episode they can't watch themselves
    expect(await fails(createParty(viewer(host), { episodeId: paidEp }))).toBe("LOCKED");
    const p = await createParty(viewer(host), { episodeId: freeEp });
    await joinParty(viewer(a), p.code);
    let st = await partyState(viewer(a), p.code, 0);
    expect(st.episode?.access.ok).toBe(true);
    await partyAction(viewer(host), p.code, { op: "readyCheck" });
    await partyAction(viewer(a), p.code, { op: "ready" });
    st = await partyState(viewer(host), p.code, 0);
    expect(st.members.find((m) => m.id === a.id)?.ready).toBe(true);
    await partyAction(viewer(host), p.code, { op: "go", positionSec: 0 });
    st = await partyState(viewer(a), p.code, 0);
    expect(st.party.playback.playing).toBe(true);
    expect(st.party.countdownTo).toBeGreaterThan(Date.now());
    expect(await fails(partyAction(viewer(a), p.code, { op: "pause", positionSec: 5 }))).toBe("FORBIDDEN");
    await partyAction(viewer(host), p.code, { op: "seek", positionSec: 42 });
    expect((await partyState(viewer(a), p.code, 0)).party.playback.positionSec).toBe(42);

    // group food order
    await partyAction(viewer(host), p.code, { op: "foodAdd", item: "Pizza", priceCents: 1200 });
    await partyAction(viewer(a), p.code, { op: "foodAdd", item: "Cola", priceCents: 250, qty: 2 });
    await partyAction(viewer(a), p.code, { op: "foodClaim", service: "BOLT" });
    expect(await fails(partyAction(viewer(host), p.code, { op: "foodClaim", service: "EVIL" }))).toBe("INVALID");
    await partyAction(viewer(a), p.code, { op: "foodEta", minutes: 30 });
    st = await partyState(viewer(host), p.code, 0);
    expect(st.split.total).toBe(1700);
    expect(st.split.perUser[a.id]).toBe(500);
    expect(st.party.food.service).toBe("BOLT");
    expect(st.party.food.etaAt).toBeGreaterThan(Date.now() + 29 * 60_000);
    await partyAction(viewer(host), p.code, { op: "play", positionSec: 50 });
    await partyAction(viewer(a), p.code, { op: "foodArrived" });
    st = await partyState(viewer(a), p.code, 0);
    expect(st.party.playback.playing).toBe(false); // doorbell pauses the episode for everyone
    expect(st.party.food.arrivedAt).not.toBeNull();
  });

  it("polls, moments, leaving hands the room over, the host ends it", async () => {
    const [host, a] = users;
    const p = await createParty(viewer(host), { channelSlug });
    await joinParty(viewer(a), p.code);
    expect(await fails(partyAction(viewer(a), p.code, { op: "poll", question: "Next?", options: ["one"] }))).toBe("TEXT");
    await partyAction(viewer(a), p.code, { op: "poll", question: "Next?", options: ["News", "Music"] });
    await partyAction(viewer(host), p.code, { op: "vote", option: 1 });
    await partyAction(viewer(a), p.code, { op: "vote", option: 1 });
    await partyAction(viewer(a), p.code, { op: "vote", option: 1 }); // re-vote, still one vote
    let st = await partyState(viewer(a), p.code, 0);
    expect(st.party.poll?.counts).toEqual([0, 2]);
    expect(st.party.poll?.mine).toBe(1);
    await partyAction(viewer(host), p.code, { op: "closePoll" });
    await partyAction(viewer(a), p.code, { op: "moment", atSec: 12.5, note: "this!" });
    st = await partyState(viewer(a), p.code, 0);
    expect(st.party.poll).toBeNull();
    expect(st.events.some((e) => e.kind === "SYSTEM" && e.body.includes("Music"))).toBe(true);
    expect(st.events.find((e) => e.kind === "MOMENT")?.atSec).toBe(12.5);
    // host leaves → a becomes host
    await partyAction(viewer(host), p.code, { op: "leave" });
    st = await partyState(viewer(a), p.code, 0);
    expect(st.me.host).toBe(true);
    await partyAction(viewer(a), p.code, { op: "end" });
    expect(await fails(partyState(viewer(a), p.code, 0))).toBe("ENDED");
  });
});
