/** Compliance checklist: account deletion (GDPR erasure), age/terms confirmation at sign-up, 18+ switch, operator details. */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ user: null as null | Record<string, unknown> }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "localhost:3000" }),
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}));
vi.mock("@/lib/auth", async (orig) => {
  const real = await orig<typeof import("@/lib/auth")>();
  return { ...real, getCurrentUser: async () => state.user, getKidsMode: async () => false, createSession: async () => {} };
});

import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { deleteAccountAction } from "@/app/actions/profile";
import { registerAction } from "@/app/actions/auth";
import { setAdultContentAction } from "@/app/actions/extras";
import { botCommentAction } from "@/app/actions/admin-tools";
import { adultEnabled, isAdultMode } from "@/lib/spicy";
import { fillCompany, getCompany } from "@/lib/company";
import { getLegalDoc, LEGAL_SLUGS } from "@/content/legal";

const tag = Date.now().toString(36);
const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const mk = async (role: "VIEWER" | "CREATOR" | "ADMIN", n: string) =>
  prisma.user.create({ data: { email: `${n}-${tag}@c.test`, name: n, role, passwordHash: await hashPassword("secret123") } });
const as = (u: { id: string } & Record<string, unknown>) => {
  state.user = { ...u, kidsMode: false, coins: 0, sessionId: "s", subscription: null };
};

beforeEach(() => {
  state.user = null;
});
afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `-${tag}@c.test` } } });
});

describe("account deletion", () => {
  it("needs the right password, then erases the user and their personal records", async () => {
    const u = await mk("VIEWER", "leaver");
    await prisma.session.create({ data: { id: `sess-${tag}`, userId: u.id, expiresAt: new Date(Date.now() + 86400_000) } });
    as(u);
    expect((await deleteAccountAction(undefined, form({ password: "nope" })))?.error).toBeTruthy();
    expect(await prisma.user.findUnique({ where: { id: u.id } })).not.toBeNull();
    await expect(deleteAccountAction(undefined, form({ password: "secret123" }))).rejects.toThrow("REDIRECT:/");
    expect(await prisma.user.findUnique({ where: { id: u.id } })).toBeNull();
    expect(await prisma.session.count({ where: { userId: u.id } })).toBe(0);
  });

  it("refuses admins and creators who still own series", async () => {
    const a = await mk("ADMIN", "boss");
    as(a);
    expect((await deleteAccountAction(undefined, form({ password: "secret123" })))?.error).toBeTruthy();
    const c = await mk("CREATOR", "maker");
    await prisma.series.create({
      data: { slug: `del-${tag}`, titleRu: "x", titleEn: "x", descriptionRu: "x", descriptionEn: "x", creatorId: c.id, status: "PUBLISHED" },
    });
    as(c);
    expect((await deleteAccountAction(undefined, form({ password: "secret123" })))?.error).toBeTruthy();
    expect(await prisma.user.count({ where: { id: { in: [a.id, c.id] } } })).toBe(2);
    await prisma.series.deleteMany({ where: { slug: `del-${tag}` } });
  });

  it("is not available to guests", async () => {
    expect((await deleteAccountAction(undefined, form({ password: "x" })))?.error).toBe("auth");
  });
});

describe("sign-up consent", () => {
  it("rejects registration without the 16+ / terms checkbox", async () => {
    const email = `noconsent-${tag}@c.test`;
    const r = await registerAction(undefined, form({ name: "Kid", email, password: "secret123" }));
    expect(r?.error).toBeTruthy();
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
  });
});

describe("18+ platform switch", () => {
  const adult = { kidsMode: false, showAdult: true, adultConfirmedAt: new Date() };
  it("hides all 18+ content and refuses the toggle when NEXT_PUBLIC_ADULT_CONTENT is not 'on'", async () => {
    const prev = process.env.NEXT_PUBLIC_ADULT_CONTENT;
    try {
      process.env.NEXT_PUBLIC_ADULT_CONTENT = "";
      expect(adultEnabled()).toBe(false);
      expect(isAdultMode(adult)).toBe(false);
      const u = await mk("VIEWER", "grown");
      as(u);
      expect((await setAdultContentAction(true)).ok).toBe(false);
      expect((await setAdultContentAction(false)).ok).toBe(true);
      process.env.NEXT_PUBLIC_ADULT_CONTENT = "on";
      expect(isAdultMode(adult)).toBe(true);
    } finally {
      process.env.NEXT_PUBLIC_ADULT_CONTENT = prev;
    }
  });
});

describe("operator details and legal pages", () => {
  it("fills placeholders only with details that are set", () => {
    const c = getCompany({ COMPANY_NAME: "Mirage OÜ", COMPANY_ADDRESS: "Tallinn", COMPANY_REG_NO: "123", SUPPORT_EMAIL: "help@x.io" });
    expect(fillCompany("Operated by [Company name, address, registration number]. Contact: [support email]. Law: [country].", c)).toBe(
      "Operated by Mirage OÜ, Tallinn, reg. no. 123. Contact: help@x.io. Law: [country].",
    );
    expect(fillCompany("Пишите на [email по вопросам данных]", c)).toBe("Пишите на help@x.io");
    expect(fillCompany("[support email]", getCompany({}))).toBe("[support email]");
  });

  it("has refund and cookie policies in both languages", () => {
    for (const slug of ["refunds", "cookies"] as const) {
      expect(LEGAL_SLUGS).toContain(slug);
      expect(getLegalDoc(slug, "en").sections.length).toBeGreaterThan(2);
      expect(getLegalDoc(slug, "ru").sections.length).toBe(getLegalDoc(slug, "en").sections.length);
    }
  });
});

describe("bot comments (admin)", () => {
  it("admin posts a comment as a named bot that cannot sign in; others are refused", async () => {
    const a = await mk("ADMIN", "mod");
    const c = await mk("CREATOR", "author");
    const s = await prisma.series.create({
      data: { slug: `bot-${tag}`, titleRu: "x", titleEn: "x", descriptionRu: "x", descriptionEn: "x", creatorId: c.id, status: "PUBLISHED" },
    });
    const ep = await prisma.episode.create({ data: { seriesId: s.id, number: 1, titleRu: "1", titleEn: "1", videoUrl: "x.mp4", durationSec: 60 } });
    as(c);
    expect((await botCommentAction(ep.id, "Anna", "wow")).ok).toBe(false);
    as(a);
    expect((await botCommentAction(ep.id, "Anna", "wow")).ok).toBe(true);
    expect((await botCommentAction(ep.id, "anna", "again")).ok).toBe(true);
    const comments = await prisma.comment.findMany({ where: { episodeId: ep.id }, include: { user: true } });
    expect(comments).toHaveLength(2);
    expect(new Set(comments.map((x) => x.userId)).size).toBe(1);
    expect(comments[0].user.email).toMatch(/@bots\.mirage\.local$/);
    await prisma.series.delete({ where: { id: s.id } });
    await prisma.user.deleteMany({ where: { email: { endsWith: "@bots.mirage.local" } } });
  });
});

describe("data export (GDPR access/portability)", () => {
  it("contains the user's records but no password hash, sessions or tokens", async () => {
    const { exportUserData } = await import("@/lib/data-export");
    const u = await mk("VIEWER", "exporter");
    await prisma.session.create({ data: { id: `exp-sess-${tag}`, userId: u.id, expiresAt: new Date(Date.now() + 86400_000) } });
    const d = await exportUserData(u.id);
    expect(d?.account.email).toBe(u.email);
    expect(JSON.stringify(d)).not.toContain(u.passwordHash);
    expect(d?.account).not.toHaveProperty("passwordHash");
    expect(d?.data).not.toHaveProperty("Session");
    expect(JSON.stringify(d)).not.toContain(`exp-sess-${tag}`);
    expect(await exportUserData("nope")).toBeNull();
  });
});
