import type { Metadata } from "next";
import { getI18n } from "@/i18n/server";
import { ForgotPasswordForm } from "@/components/auth/reset-forms";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.forgotTitle };
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
