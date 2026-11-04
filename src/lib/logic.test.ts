import { describe, expect, it } from "vitest";
import { decideAccess, type AccessEpisode } from "./access";
import { nextCheckIn, previousUtcDay, CHECKIN_REWARDS } from "./rewards";
import { fmt, plural, pick } from "../i18n/shared";
import { findSku, priceFor } from "./payments/catalog";

const series = { freeEpisodes: 5, defaultCoinPrice: 30, creatorId: "creator" };
const ep = (number: number, coinPrice: number | null = null): AccessEpisode => ({ id: "e" + number, number, coinPrice, series });
const viewer = { id: "u1", role: "VIEWER" as const, subscription: null };
const future = new Date(Date.now() + 86400_000);
const past = new Date(Date.now() - 86400_000);

describe("decideAccess", () => {
  it("free episodes are open to anonymous users", () => {
    expect(decideAccess(null, ep(5), false)).toEqual({ ok: true, reason: "free" });
  });
  it("locked episode asks anonymous user to log in with price", () => {
    expect(decideAccess(null, ep(6), false)).toEqual({ ok: false, reason: "login", price: 30 });
  });
  it("uses per-episode price override", () => {
    expect(decideAccess(viewer, ep(6, 45), false)).toEqual({ ok: false, reason: "locked", price: 45 });
  });
  it("unlocked episode is watchable", () => {
    expect(decideAccess(viewer, ep(6), true)).toEqual({ ok: true, reason: "unlocked" });
  });
  it("active VIP opens everything, expired VIP does not", () => {
    expect(decideAccess({ ...viewer, subscription: { status: "ACTIVE", currentPeriodEnd: future } }, ep(9), false).ok).toBe(true);
    expect(decideAccess({ ...viewer, subscription: { status: "ACTIVE", currentPeriodEnd: past } }, ep(9), false).ok).toBe(false);
    expect(decideAccess({ ...viewer, subscription: { status: "CANCELED", currentPeriodEnd: future } }, ep(9), false).ok).toBe(false);
  });
  it("creator and admin can watch their content", () => {
    expect(decideAccess({ id: "creator", role: "CREATOR", subscription: null }, ep(9), false)).toEqual({ ok: true, reason: "owner" });
    expect(decideAccess({ id: "a", role: "ADMIN", subscription: null }, ep(9), false)).toEqual({ ok: true, reason: "owner" });
  });
});

describe("nextCheckIn", () => {
  it("first check-in starts streak at 1", () => {
    expect(nextCheckIn(null, "2026-11-03")).toEqual({ streak: 1, reward: CHECKIN_REWARDS[0] });
  });
  it("same day returns null", () => {
    expect(nextCheckIn({ day: "2026-11-03", streak: 2 }, "2026-11-03")).toBeNull();
  });
  it("consecutive day increments streak", () => {
    expect(nextCheckIn({ day: "2026-11-02", streak: 2 }, "2026-11-03")).toEqual({ streak: 3, reward: CHECKIN_REWARDS[2] });
  });
  it("gap resets streak", () => {
    expect(nextCheckIn({ day: "2026-10-30", streak: 4 }, "2026-11-03")?.streak).toBe(1);
  });
  it("cycle wraps after 7 days", () => {
    expect(nextCheckIn({ day: "2026-11-02", streak: 7 }, "2026-11-03")?.reward).toBe(CHECKIN_REWARDS[0]);
  });
  it("previousUtcDay crosses month boundary", () => {
    expect(previousUtcDay("2026-11-01")).toBe("2026-10-31");
  });
});

describe("i18n helpers", () => {
  const forms = ["серия", "серии", "серий"];
  it("russian plurals", () => {
    expect([1, 2, 5, 11, 21, 22, 25, 112].map((n) => plural(n, forms))).toEqual([
      "серия", "серии", "серий", "серий", "серия", "серии", "серий", "серий",
    ]);
  });
  it("english plurals", () => {
    expect(plural(1, ["episode", "episodes", "episodes"], "en")).toBe("episode");
    expect(plural(3, ["episode", "episodes", "episodes"], "en")).toBe("episodes");
  });
  it("fmt replaces placeholders", () => {
    expect(fmt("Открыть за {price}", { price: 30 })).toBe("Открыть за 30");
  });
  it("pick falls back to RU when EN empty", () => {
    expect(pick({ titleRu: "Мираж", titleEn: "" }, "title", "en")).toBe("Мираж");
    expect(pick({ titleRu: "Мираж", titleEn: "Mirage" }, "title", "en")).toBe("Mirage");
  });
});

describe("payment catalog", () => {
  it("finds coin packs and vip plans", () => {
    expect(findSku("coins_600")?.kind).toBe("COINS");
    expect(findSku("vip_month")?.kind).toBe("VIP");
    expect(findSku("nope")).toBeNull();
  });
  it("prices in locale currency", () => {
    expect(priceFor({ rub: 549, usd: 9.99 }, "en")).toEqual({ amountCents: 999, currency: "USD" });
    expect(priceFor({ rub: 549, usd: 9.99 }, "ru")).toEqual({ amountCents: 54900, currency: "RUB" });
  });
});

import { safePath } from "./url";
describe("safePath", () => {
  it("allows same-origin paths and blocks open redirects", () => {
    expect(safePath("/watch/1")).toBe("/watch/1");
    expect(safePath("//evil.com")).toBe("/");
    expect(safePath(String.raw`/\evil.com`)).toBe("/");
    expect(safePath("https://evil.com")).toBe("/");
    expect(safePath(undefined)).toBe("/");
  });
});

import { splitCharge, splitShare } from "./access";
import { chatMessagePrice, pickSkin, shouldSendPhoto, spicyBlock, CHAT_FREE_MESSAGES, CHAT_MESSAGE_PRICE } from "./spicy";

describe("coin split", () => {
  it("spends bonus first", () => {
    expect(splitCharge(30, { paidCoins: 100, bonusCoins: 10 })).toEqual({ bonus: 10, paid: 20 });
    expect(splitCharge(30, { paidCoins: 0, bonusCoins: 50 })).toEqual({ bonus: 30, paid: 0 });
  });
  it("returns null when total is not enough", () => {
    expect(splitCharge(30, { paidCoins: 10, bonusCoins: 19 })).toBeNull();
  });
  it("creator share: withdrawable only from paid coins", () => {
    expect(splitShare({ paid: 20, bonus: 10 })).toEqual({ coins: 10, credits: 5 });
    expect(splitShare({ paid: 0, bonus: 30 })).toEqual({ coins: 0, credits: 15 });
    expect(splitShare({ paid: 31, bonus: 0 })).toEqual({ coins: 15, credits: 0 });
  });
});

describe("spicy rules", () => {
  it("roulette respects weights and handles empty pools", () => {
    const pool = [{ rarity: "common" }, { rarity: "epic" }];
    expect(pickSkin(pool, 0)).toBe(pool[0]);
    expect(pickSkin(pool, 0.99)).toBe(pool[1]);
    expect(pickSkin([], 0.5)).toBeNull();
  });
  it("chat: first messages free", () => {
    expect(chatMessagePrice(0)).toBe(0);
    expect(chatMessagePrice(CHAT_FREE_MESSAGES - 1)).toBe(0);
    expect(chatMessagePrice(CHAT_FREE_MESSAGES)).toBe(CHAT_MESSAGE_PRICE);
  });
  it("photo drops when asked or every few replies", () => {
    expect(shouldSendPhoto("покажи себя", 0, true)).toBe(true);
    expect(shouldSendPhoto("hi", 1, true)).toBe(false);
    expect(shouldSendPhoto("hi", 4, true)).toBe(true);
    expect(shouldSendPhoto("send me a selfie", 9, false)).toBe(false);
  });
  it("18+ add-ons are blocked in kids mode, on family series and until 18+ is confirmed", () => {
    const adult = { kidsMode: false, adultConfirmedAt: new Date() };
    expect(spicyBlock(adult, { isFamilySafe: false })).toBeNull();
    expect(spicyBlock(adult, { isFamilySafe: true })).toBe("family");
    expect(spicyBlock({ ...adult, kidsMode: true }, { isFamilySafe: false })).toBe("kids");
    expect(spicyBlock({ kidsMode: false, adultConfirmedAt: null }, { isFamilySafe: false })).toBe("age");
    expect(spicyBlock(null, { isFamilySafe: false })).toBe("auth");
  });
});
