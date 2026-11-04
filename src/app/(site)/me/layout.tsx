import { forbidInKidsMode } from "@/lib/auth";

/** Profile, settings and wallet are hidden in kids mode. */
export default async function MeLayout({ children }: { children: React.ReactNode }) {
  await forbidInKidsMode();
  return children;
}
