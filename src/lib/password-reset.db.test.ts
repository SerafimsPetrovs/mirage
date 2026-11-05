import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./db";
import { hashPassword, verifyPassword } from "./auth";
import { createPasswordReset, findValidReset, RESET_PER_HOUR, resetPassword } from "./password-reset";

const tag = Date.now().toString(36);
const email = `reset${tag}@t.t`;
let userId: string;

beforeAll(async () => {
  const u = await prisma.user.create({ data: { email, name: "R", passwordHash: await hashPassword("old-pass") } });
  userId = u.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: userId } });
});

describe("password reset", () => {
  it("unknown emails get no token (no enumeration)", async () => {
    expect(await createPasswordReset(`nobody${tag}@t.t`)).toBeNull();
  });

  it("a token works once, logs out everywhere and kills older links", async () => {
    await prisma.session.create({ data: { id: `s-${tag}`, userId, expiresAt: new Date(Date.now() + 86400_000) } });
    const older = await createPasswordReset(email.toUpperCase());
    const r = await createPasswordReset(email);
    expect(r && older).toBeTruthy();
    // only the hash is stored
    expect(await prisma.passwordReset.count({ where: { tokenHash: r!.token } })).toBe(0);

    expect(await resetPassword(r!.token, "new-pass-1")).toBe(userId);
    const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(await verifyPassword("new-pass-1", u.passwordHash)).toBe(true);
    expect(await prisma.session.count({ where: { userId } })).toBe(0);

    expect(await resetPassword(r!.token, "again-pass")).toBeNull();
    expect(await findValidReset(older!.token)).toBeNull();
  });

  it("expired tokens are rejected", async () => {
    await prisma.passwordReset.deleteMany({ where: { userId } });
    const r = await createPasswordReset(email);
    await prisma.passwordReset.updateMany({ where: { userId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await resetPassword(r!.token, "whatever-1")).toBeNull();
  });

  it(`allows at most ${RESET_PER_HOUR} emails per hour`, async () => {
    await prisma.passwordReset.deleteMany({ where: { userId } });
    for (let i = 0; i < RESET_PER_HOUR; i++) expect(await createPasswordReset(email)).not.toBeNull();
    expect(await createPasswordReset(email)).toBeNull();
  });
});
