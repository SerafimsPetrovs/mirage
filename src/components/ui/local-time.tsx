"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";

/** A date/time in the viewer's own time zone (the server renders UTC until hydration). */
export function LocalTime({ ms, withDay = true }: { ms: number; withDay?: boolean }) {
  const { locale } = useI18n();
  const fmt = (tz?: string) =>
    new Date(ms).toLocaleString(locale === "ru" ? "ru-RU" : "en-GB", {
      ...(withDay ? { weekday: "long", day: "numeric", month: "long" } : {}),
      hour: "2-digit",
      minute: "2-digit",
      ...(tz ? { timeZone: tz } : {}),
    });
  const [text, setText] = useState(() => `${fmt("UTC")} UTC`);
  useEffect(() => {
    const id = window.setTimeout(() => setText(fmt()), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, locale]);
  return <time dateTime={new Date(ms).toISOString()}>{text}</time>;
}
