import { describe, expect, it } from "vitest";
import { decideAccess, type AccessEpisode } from "./access";
import { nextCheckIn, previousUtcDay, CHECKIN_REWARDS } from "./rewards";
import { fmt, plural, pick } from "../i18n/shared";
import { findSku, priceFor } from "./payments/catalog";
import { cameoNameProblem, parseScriptJson, promptsFromScript, scriptToText } from "./show-rules";
import { canMovePayout, isValidIban, maskDetails, normalizeDetails, payoutCents, refundsCoins } from "./payout-rules";

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
    expect(priceFor({ eur: 5.49 })).toEqual({ amountCents: 549, currency: "EUR" });
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
import { chatMessagePrice, pickSkin, shouldSendPhoto, spicyBlock, isAdultMode, adultSeriesBlock, CHAT_FREE_MESSAGES, CHAT_MESSAGE_PRICE } from "./spicy";

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
    const adult = { kidsMode: false, adultConfirmedAt: new Date(), showAdult: true };
    expect(spicyBlock(adult, { isFamilySafe: false })).toBeNull();
    expect(spicyBlock(adult, { isFamilySafe: true })).toBe("family");
    expect(spicyBlock({ ...adult, kidsMode: true }, { isFamilySafe: false })).toBe("kids");
    expect(spicyBlock({ kidsMode: false, adultConfirmedAt: null, showAdult: false }, { isFamilySafe: false })).toBe("age");
    expect(spicyBlock({ ...adult, showAdult: false }, { isFamilySafe: false })).toBe("age");
    expect(spicyBlock(null, { isFamilySafe: false })).toBe("auth");
  });
  it("18+ series are hidden until the viewer turns 18+ content on", () => {
    const adult = { kidsMode: false, adultConfirmedAt: new Date(), showAdult: true };
    expect(isAdultMode(adult)).toBe(true);
    expect(isAdultMode({ ...adult, showAdult: false })).toBe(false);
    expect(isAdultMode({ ...adult, adultConfirmedAt: null })).toBe(false);
    expect(isAdultMode({ ...adult, kidsMode: true })).toBe(false);
    expect(isAdultMode(null)).toBe(false);
    expect(adultSeriesBlock(null, { isAdult: false })).toBeNull();
    expect(adultSeriesBlock(null, { isAdult: true })).toBe("auth");
    expect(adultSeriesBlock({ ...adult, kidsMode: true }, { isAdult: true })).toBe("kids");
    expect(adultSeriesBlock({ ...adult, showAdult: false }, { isAdult: true })).toBe("age");
    expect(adultSeriesBlock(adult, { isAdult: true })).toBeNull();
  });
});

describe("payout rules", () => {
  it("validates IBANs with the mod-97 checksum", () => {
    expect(isValidIban("DE89 3704 0044 0532 0130 00")).toBe(true);
    expect(isValidIban("GB82WEST12345698765432")).toBe(true);
    expect(isValidIban("DE88 3704 0044 0532 0130 00")).toBe(false);
    expect(isValidIban("hello")).toBe(false);
  });
  it("normalises and masks details", () => {
    expect(normalizeDetails("IBAN", " de89 3704 0044 0532 0130 00 ")).toBe("DE89370400440532013000");
    expect(normalizeDetails("PAYPAL", "A@B.co")).toBe("a@b.co");
    expect(normalizeDetails("PAYPAL", "nope")).toBeNull();
    expect(maskDetails("IBAN", "DE89370400440532013000")).toBe("DE89 •••• 3000");
    expect(maskDetails("PAYPAL", "anna@mail.com")).toBe("a•••@mail.com");
  });
  it("only allows forward status moves and refunds on reject/cancel", () => {
    expect(canMovePayout("PENDING", "APPROVED")).toBe(true);
    expect(canMovePayout("APPROVED", "CANCELED")).toBe(false);
    expect(canMovePayout("PAID", "REJECTED")).toBe(false);
    expect(refundsCoins("REJECTED")).toBe(true);
    expect(refundsCoins("PAID")).toBe(false);
    expect(payoutCents(1500)).toBe(900);
  });
});

describe("show rules", () => {
  it("validates cameo names", () => {
    expect(cameoNameProblem("Аня")).toBeNull();
    expect(cameoNameProblem("Dmitry_K")).toBeNull();
    expect(cameoNameProblem("a")).toBe("format");
    expect(cameoNameProblem("")).toBe("empty");
    expect(cameoNameProblem("t.me/spam")).not.toBeNull();
    expect(cameoNameProblem("nazi_fan")).toBe("banned");
    expect(cameoNameProblem("x".repeat(30))).toBe("format");
  });
  it("parses LLM JSON wrapped in prose and round-trips prompts", () => {
    const raw = 'Вот сценарий:\n```json\n{"title":"T","summary":"S","scenes":[{"prompt":"night street","text":"Она идёт"}],"question":"Q?","optionA":"A","optionB":"B","caption":"C"}\n```';
    const d = parseScriptJson(raw);
    expect(d?.title).toBe("T");
    expect(promptsFromScript(scriptToText(d!))).toEqual(["night street"]);
    expect(parseScriptJson("no json here")).toBeNull();
  });
});
