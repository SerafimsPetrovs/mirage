import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "./db";
import { createEmailVerification, verifyEmail, VERIFY_PER_HOUR } from "./email-verify";
import { PayoutError, requestPayout } from "./payouts";
import { rewardInviterOnReturn } from "./referrals";

const tag = Date.now().toString(36);
const ids: string[] = [];
let seq = 0;
const user = async (data: Record<string, unknown> = {}) => {
  const u = await prisma.user.create({ data: { email: `ev${tag}${seq++}@t.t`, name: "U", passwordHash: "x", ...data } });
  ids.push(u.id);
  return u;
};

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
});

describe("email verification", () => {
  it("a token confirms the email exactly once; only its hash is stored", async () => {
    const u = await user();
    const v = await createEmailVerification(u.id);
    expect(v).not.toBeNull();
    const row = await prisma.emailVerification.findFirstOrThrow({ where: { userId: u.id } });
    expect(row.tokenHash).not.toContain(v!.token);
    expect(await verifyEmail(v!.token)).toBe(u.id);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).emailVerifiedAt).not.toBeNull();
    expect(await verifyEmail(v!.token)).toBeNull();
  });

  it("rejects wrong, empty, huge and expired tokens", async () => {
    const u = await user();
    const v = await createEmailVerification(u.id);
    expect(await verifyEmail("")).toBeNull();
    expect(await verifyEmail("x".repeat(500))).toBeNull();
    expect(await verifyEmail(v!.token + "a")).toBeNull();
    await prisma.emailVerification.updateMany({ where: { userId: u.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await verifyEmail(v!.token)).toBeNull();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).emailVerifiedAt).toBeNull();
  });

  it("using one link invalidates the other links of the account", async () => {
    const u = await user();
    const a = await createEmailVerification(u.id);
    const b = await createEmailVerification(u.id);
    expect(await verifyEmail(b!.token)).toBe(u.id);
    expect(await verifyEmail(a!.token)).toBeNull();
  });

  it("no tokens for confirmed or banned accounts; at most 3 emails an hour", async () => {
    expect(await createEmailVerification((await user({ emailVerifiedAt: new Date() })).id)).toBeNull();
    expect(await createEmailVerification((await user({ banned: true })).id)).toBeNull();
    const u = await user();
    for (let i = 0; i < VERIFY_PER_HOUR; i++) expect(await createEmailVerification(u.id)).not.toBeNull();
    expect(await createEmailVerification(u.id)).toBeNull();
  });

  it("payouts need a confirmed email", async () => {
    const c = await user({ role: "CREATOR", payoutCoins: 5000 });
    await expect(requestPayout(c.id, { coins: 1500, method: "PAYPAL", details: "me@example.com", holderName: "Jane Doe" })).rejects.toThrow(PayoutError);
    await expect(requestPayout(c.id, { coins: 1500, method: "PAYPAL", details: "me@example.com", holderName: "Jane Doe" })).rejects.toMatchObject({ code: "UNVERIFIED" });
  });

  it("the inviter is rewarded only for a friend with a confirmed email", async () => {
    const inviter = await user({ emailVerifiedAt: new Date() });
    const friend = await user({ referredById: inviter.id, createdAt: new Date(Date.now() - 2 * 86400_000) });
    expect(await prisma.$transaction((tx) => rewardInviterOnReturn(tx, friend.id))).toBe(false);
    await prisma.user.update({ where: { id: friend.id }, data: { emailVerifiedAt: new Date() } });
    expect(await prisma.$transaction((tx) => rewardInviterOnReturn(tx, friend.id))).toBe(true);
  });
});
