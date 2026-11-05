---
name: adding-i18n-strings
description: Use when adding or changing any user-visible text, labels, buttons, toasts, errors or metadata in MIRAGE, or when text appears untranslated or mixed Russian/English.
---

# Adding i18n Strings

## Overview
MIRAGE ships English (default, main language) and Russian. No user-visible literal strings in components.

## Where things live
- Dictionaries: `src/i18n/ru.ts` (source of truth, exports `Dict = typeof ru`) and `src/i18n/en.ts` (typed `Dict`, so a missing key is a type error).
- Server components / actions: `const { t, locale } = await getI18n()` from `src/i18n/server.ts`.
- Client components: `const { t, locale } = useI18n()` from `src/i18n/client.tsx`.
- Helpers in `src/i18n/shared.ts`: `fmt(template, vars)`, `plural(n, forms, locale)`, `pick(obj, "title", locale)`, `formatNumber`, `formatMoney`, `formatDate`.
- Locale = cookie `locale` (`ru` | `en`), else `DEFAULT_LOCALE` = `en` (browser language is not used). Switch via `setLocaleAction` (`LangSwitch` component).
- DB content is bilingual: `titleRu/titleEn`, `descriptionRu/En`, `taglineRu/En`, `promptNotesRu/En`, poll `questionRu/En`, option `labelRu/En`. Read with `pick()` (falls back to the other language when empty). In creator forms English is required, Russian optional.

## Pattern
```ts
// ru.ts → player: { unlockFor: "Открыть за {price}" }
fmt(t.player.unlockFor, { price: 30 })
`${n} ${plural(n, t.common.episodes, locale)}`   // common.episodes = ["серия","серии","серий"]
```

## Rules
- Group keys by screen (`home`, `player`, `series`, `studio`, `admin`, `wallet`, …).
- Add the key to BOTH files in the same edit; run `npx tsc --noEmit`.
- Never use `Date.now()`/`new Date()` math inside component bodies (react-hooks/purity lint) — use helpers in `src/lib/rewards.ts` (`daysAgo`, `lastNDays`, `utcDay`).
