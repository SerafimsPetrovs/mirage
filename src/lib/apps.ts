import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./db";
import { InsufficientCoinsError, spendCoins } from "./coins";

export const APP_CATEGORIES = ["IMAGE", "VIDEO", "VOICE", "MUSIC", "TEXT", "TOOLS"] as const;

export class AppError extends Error {
  constructor(public code: "AUTH" | "KIDS" | "NOT_FOUND" | "INSUFFICIENT" | "NO_FILE") {
    super(code);
  }
}

type Buyer = { id: string; kidsMode: boolean } | null;

export async function ownsApp(userId: string | undefined, appId: string) {
  if (!userId) return false;
  return !!(await prisma.aiAppPurchase.findUnique({ where: { userId_appId: { userId, appId } } }));
}

/**
 * Buys a paid app once (bonus coins first; the money is the platform's — no creator share).
 * Free apps and repeated purchases are no-ops. Family mode can't buy.
 */
export async function buyApp(user: Buyer, slug: string) {
  if (!user) throw new AppError("AUTH");
  if (user.kidsMode) throw new AppError("KIDS");
  const app = await prisma.aiApp.findUnique({ where: { slug } });
  if (!app || !app.active) throw new AppError("NOT_FOUND");
  if (app.priceCoins <= 0) return { charged: 0 };
  try {
    return await prisma.$transaction(async (tx) => {
      // Unique (userId, appId) first: a double click rolls back the second charge.
      await tx.aiAppPurchase.create({ data: { userId: user.id, appId: app.id, coins: app.priceCoins } });
      await spendCoins(tx, user.id, app.priceCoins, "APP", { note: `app:${app.slug}` });
      return { charged: app.priceCoins };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { charged: 0 };
    if (e instanceof InsufficientCoinsError) throw new AppError("INSUFFICIENT");
    throw e;
  }
}

/** Where the installer for this OS lives — only for owners of paid apps. Counts the download. */
export async function downloadRef(user: Buyer, slug: string, os: "win" | "mac") {
  const app = await prisma.aiApp.findUnique({ where: { slug } });
  if (!app || !app.active) throw new AppError("NOT_FOUND");
  if (user?.kidsMode) throw new AppError("KIDS");
  if (app.priceCoins > 0) {
    if (!user) throw new AppError("AUTH");
    if (!(await ownsApp(user.id, app.id))) throw new AppError("NOT_FOUND");
  }
  const ref = os === "win" ? app.winFile : app.macFile;
  if (!ref) throw new AppError("NO_FILE");
  await prisma.aiApp.update({ where: { id: app.id }, data: { downloads: { increment: 1 } } });
  return { ref, name: `${app.slug}-${os}` };
}

export const appSchema = z.object({
  id: z.string().max(64).optional(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{2,40}$/),
  name: z.string().trim().min(2).max(60),
  taglineRu: z.string().max(140).default(""),
  taglineEn: z.string().max(140).default(""),
  descriptionRu: z.string().max(4000).default(""),
  descriptionEn: z.string().max(4000).default(""),
  category: z.enum(APP_CATEGORIES),
  hue: z.number().int().min(0).max(359).default(260),
  priceCoins: z.number().int().min(0).max(100_000),
  winFile: z.string().max(300).default(""),
  macFile: z.string().max(300).default(""),
  webUrl: z
    .string()
    .max(300)
    .refine((v) => !v || /^https:\/\//.test(v), "https only")
    .default(""),
  requirements: z.string().max(200).default(""),
  featured: z.boolean().default(false),
  active: z.boolean().default(true),
});

/** Installer refs: an uploaded storage file or an https link. */
const fileRef = (v: string) => !v || /^storage:files\/[\w.-]+$/.test(v) || /^https:\/\//.test(v);

export async function saveApp(input: z.infer<typeof appSchema>) {
  if (!fileRef(input.winFile) || !fileRef(input.macFile)) throw new AppError("NO_FILE");
  const { id, ...data } = input;
  return id ? prisma.aiApp.update({ where: { id }, data }) : prisma.aiApp.create({ data });
}
