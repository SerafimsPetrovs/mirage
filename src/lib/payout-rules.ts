// Pure rules for creator withdrawals. No DB / server imports — unit-tested in logic.test.ts.

/** Minimum withdrawal. */
export const PAYOUT_MIN_COINS = 1500;
/** Euro cents paid out per withdrawable coin (covers payment fees and taxes on the platform side). */
export const PAYOUT_CENTS_PER_COIN = 0.6;
export const PAYOUT_CURRENCY = "EUR";

export const PAYOUT_METHODS = ["IBAN", "PAYPAL"] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

export const PAYOUT_STATUSES = ["PENDING", "APPROVED", "PAID", "REJECTED", "CANCELED"] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];
/** Statuses that still hold the reserved coins (and block a new request). */
export const OPEN_PAYOUT: PayoutStatus[] = ["PENDING", "APPROVED"];

export function payoutCents(coins: number) {
  return Math.floor(coins * PAYOUT_CENTS_PER_COIN);
}

/** Allowed status changes. Admin: approve / pay / reject. Creator: cancel while pending. */
const FLOW: Record<PayoutStatus, PayoutStatus[]> = {
  PENDING: ["APPROVED", "PAID", "REJECTED", "CANCELED"],
  APPROVED: ["PAID", "REJECTED"],
  PAID: [],
  REJECTED: [],
  CANCELED: [],
};

export function canMovePayout(from: string, to: PayoutStatus) {
  return (FLOW[from as PayoutStatus] ?? []).includes(to);
}

/** Coins go back to the creator's withdrawable balance. */
export function refundsCoins(to: PayoutStatus) {
  return to === "REJECTED" || to === "CANCELED";
}

/** ISO 13616 IBAN check (format + mod-97). */
export function isValidIban(raw: string) {
  const iban = raw.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const moved = iban.slice(4) + iban.slice(0, 4);
  let rem = 0;
  for (const ch of moved) {
    const v = ch >= "A" && ch <= "Z" ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of v) rem = (rem * 10 + Number(d)) % 97;
  }
  return rem === 1;
}

// Strict on purpose: only characters real addresses use (no <, >, quotes, brackets…).
const EMAIL_RE = /^[A-Za-z0-9._%+-]{1,64}@(?:[A-Za-z0-9-]{1,63}\.)+[A-Za-z]{2,24}$/;

/** Normalised payout details, or null when invalid. */
export function normalizeDetails(method: PayoutMethod, raw: string): string | null {
  const v = raw.trim();
  if (method === "IBAN") return isValidIban(v) ? v.replace(/\s+/g, "").toUpperCase() : null;
  return EMAIL_RE.test(v) && v.length <= 254 ? v.toLowerCase() : null;
}

/** Safe to show in lists: "DE89 •••• 3000", "j•••@mail.com". */
export function maskDetails(method: string, details: string) {
  if (method === "IBAN") return `${details.slice(0, 4)} •••• ${details.slice(-4)}`;
  const [name, domain] = details.split("@");
  return `${name.slice(0, 1)}•••@${domain ?? ""}`;
}
