---
name: adding-i18n-strings
description: Use when adding or changing any user-visible text, labels, buttons, toasts, emails, errors or metadata in MIRAGE, or when text appears untranslated or mixed Russian/English.
---

# Adding i18n Strings

## Overview
MIRAGE ships Russian (default) and English. No user-visible literal strings in components.

## Where things live
- Dictionaries: `src/i18n/ru.ts` (source of truth, typed) and `src/i18n/en.ts` (must satisfy `typeof ru`, so a missing key is a type error).
- Locale: cookie `locale` (`ru` | `en`), read in `src/i18n/server.ts` → `getDict()`; client components use `useT()` from `src/i18n/client.tsx`.
- Content data (series titles/descriptions) is stored per-locale in DB fields `titleRu/titleEn`, `descriptionRu/descriptionEn`; use `pick(obj, "title", locale)` from `src/i18n/pick.ts`, falling back to RU.

## Pattern
```ts
// ru.ts
player: { unlockFor: "Открыть за {price}", nextEpisode: "Следующая серия" }
// component
const t = await getDict();               // server
t.player.unlockFor.replace("{price}", String(price))   // or fmt(t.player.unlockFor, { price })
```

## Rules
- Group keys by screen/feature (`home`, `player`, `studio`, `admin`, `auth`, `wallet`).
- Plurals in RU need 3 forms → use `plural(n, ["серия","серии","серий"])` from `src/i18n/plural.ts`.
- Numbers/dates via `Intl` with the active locale.
- After adding keys, run `npx tsc --noEmit` — EN must compile.
