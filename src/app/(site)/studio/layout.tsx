import { forbidInKidsMode, requireRole } from "@/lib/auth";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  await forbidInKidsMode();
  await requireRole(["CREATOR", "ADMIN"], "/studio");
  return <div className="mx-auto max-w-6xl px-4 pb-10 pt-[calc(var(--header-h)+24px)] md:px-10">{children}</div>;
}
