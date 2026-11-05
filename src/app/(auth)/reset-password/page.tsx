import type { Metadata } from "next";
import { getI18n } from "@/i18n/server";
import { findValidReset } from "@/lib/password-reset";
import { ResetPasswordForm } from "@/components/auth/reset-forms";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  // Reset links must never be indexed or leak via previews.
  return { title: t.auth.resetTitle, robots: { index: false, follow: false }, referrer: "no-referrer" };
}

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const valid = !!(await findValidReset(token));
  return <ResetPasswordForm token={token} valid={valid} />;
}
