/** Publishing a show episode from several generated clips (joined with ffmpeg) through the real server action. */
import fs from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ user: null as null | Record<string, unknown> }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => {} }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }) }));
vi.mock("@/lib/auth", async (orig) => {
  const real = await orig<typeof import("@/lib/auth")>();
  return { ...real, getCurrentUser: async () => state.user };
});

import { prisma } from "@/lib/db";
import { resolveMediaPath } from "@/lib/files";
import { publishScriptAction } from "@/app/actions/show";

const tag = Date.now().toString(36);
type U = Awaited<ReturnType<typeof prisma.user.create>>;
let admin: U, admin2: U, creator: U;
let seriesId: string;
const as = (u: U | null) => {
  state.user = u ? { ...u, coins: 0, kidsMode: false, sessionId: "s", subscription: null } : null;
};
const script = (content: string) =>
  prisma.showScript.create({ data: { seriesId, number: 1, title: "Ep", content, pollQuestion: "Q?", optionA: "A", optionB: "B" } });
const job = (u: U, prompt: string, resultUrl: string, durationSec = 5) =>
  prisma.generationJob.create({ data: { userId: u.id, prompt, seed: 1, cost: 0, status: "DONE", resultUrl, durationSec } });

beforeAll(async () => {
  const mk = (n: string, role: "CREATOR" | "ADMIN") => prisma.user.create({ data: { email: `${n}${tag}@show-test.dev`, name: n, role, passwordHash: "x" } });
  [admin, admin2, creator] = await Promise.all([mk("a", "ADMIN"), mk("a2", "ADMIN"), mk("c", "CREATOR")]);
  seriesId = (
    await prisma.series.create({
      data: { slug: `sp-${tag}`, titleRu: "S", titleEn: "S", descriptionRu: "d", descriptionEn: "d", status: "PUBLISHED", interactive: true, creatorId: creator.id },
    })
  ).id;
});

afterAll(async () => {
  const eps = await prisma.episode.findMany({ where: { seriesId }, select: { videoUrl: true } });
  for (const e of eps) if (e.videoUrl.startsWith("storage:videos/show/")) fs.rmSync(resolveMediaPath(e.videoUrl) ?? "", { force: true });
  await prisma.series.deleteMany({ where: { id: seriesId } });
  await prisma.user.deleteMany({ where: { id: { in: [admin.id, admin2.id, creator.id] } } });
});

describe("publish a show episode from several clips", () => {
  it("joins the clips in script order into one episode; duration is the sum", async () => {
    const sc = await script("Scene one.\nPROMPT: first shot\nScene two.\nPROMPT: second shot");
    // created in reverse order on purpose: the script order must win
    const j2 = await job(admin, "second shot", "demo:v-rose.mp4", 4);
    const j1 = await job(admin, "first shot", "demo:v-teal.mp4", 5);
    as(admin);
    const r = await publishScriptAction(sc.id, [j2.id, j1.id]);
    expect(r.ok).toBe(true);
    const ep = await prisma.episode.findUniqueOrThrow({ where: { id: (r as { episodeId: string }).episodeId } });
    expect(ep.videoUrl).toMatch(/^storage:videos\/show\/ep-/);
    expect(resolveMediaPath(ep.videoUrl)).not.toBeNull();
    expect(ep.durationSec).toBe(9);
    // the script is consumed: publishing it again fails
    expect(await publishScriptAction(sc.id, [j1.id])).toEqual({ ok: false, error: "invalid" });
  }, 120_000);

  it("one clip is used as is (no re-encoding)", async () => {
    const sc = await script("PROMPT: only shot");
    const j = await job(admin, "only shot", "demo:v-ice.mp4");
    as(admin);
    const r = await publishScriptAction(sc.id, j.id);
    const ep = await prisma.episode.findUniqueOrThrow({ where: { id: (r as { episodeId: string }).episodeId } });
    expect(ep.videoUrl).toBe("demo:v-ice.mp4");
  });

  it("rejects non-admins, other admins' clips, unfinished clips and too many clips", async () => {
    const sc = await script("PROMPT: x");
    const mine = await job(admin, "x", "demo:v-teal.mp4");
    const theirs = await job(admin2, "x", "demo:v-teal.mp4");
    const running = await prisma.generationJob.create({ data: { userId: admin.id, prompt: "x", seed: 1, cost: 0, status: "RUNNING" } });
    as(creator);
    expect(await publishScriptAction(sc.id, [mine.id])).toEqual({ ok: false, error: "forbidden" });
    as(admin);
    expect(await publishScriptAction(sc.id, [mine.id, theirs.id])).toEqual({ ok: false, error: "invalid" });
    expect(await publishScriptAction(sc.id, [mine.id, running.id])).toEqual({ ok: false, error: "invalid" });
    expect(await publishScriptAction(sc.id, Array.from({ length: 13 }, (_, i) => `id${i}`))).toEqual({ ok: false, error: "invalid" });
    expect(await publishScriptAction(sc.id, [])).toEqual({ ok: false, error: "invalid" });
  });
});
