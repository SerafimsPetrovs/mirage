import type { Metadata, Viewport } from "next";
import { Inter, Unbounded } from "next/font/google";
import "./globals.css";
import { getI18n } from "@/i18n/server";
import { getKidsMode } from "@/lib/auth";
import { I18nProvider } from "@/i18n/client";
import { ToastProvider } from "@/components/ui/toast";
import { CommandPalette } from "@/components/layout/command-palette";
import { PosterMorph } from "@/components/media/poster-morph";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter", display: "swap" });
const unbounded = Unbounded({ subsets: ["latin", "cyrillic"], variable: "--font-unbounded", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: { default: t.meta.title, template: "%s · MIRAGE" },
    description: t.meta.description,
    applicationName: "MIRAGE",
    icons: { icon: "/icon.svg" },
  };
}

export const viewport: Viewport = {
  themeColor: "#07070b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [{ locale }, kids] = await Promise.all([getI18n(), getKidsMode()]);
  return (
    <html lang={locale} className={`${inter.variable} ${unbounded.variable}`} data-theme={kids ? "kids" : undefined}>
      <body className="min-h-dvh">
        <I18nProvider locale={locale}>
          <ToastProvider>
            {children}
            <CommandPalette kids={kids} />
            <PosterMorph />
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
