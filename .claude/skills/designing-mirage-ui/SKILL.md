---
name: designing-mirage-ui
description: Use when creating or restyling any page, component, card, player overlay, modal or layout in the MIRAGE streaming platform, or when UI looks generic, flat, inconsistent, "AI-template"-like, or breaks on mobile.
---

# Designing MIRAGE UI

## Overview
MIRAGE is a premium streaming platform for AI-generated series. The look: **dark cinema + iridescent "mirage" glow**. Every screen must feel like a polished consumer app (Netflix/Apple TV level), never like an admin template.

## Design tokens (source of truth: `src/app/globals.css`)
| Token | Value | Use |
|---|---|---|
| `--bg` | `#07070b` | page background |
| `--surface` / `--surface-2` | `#111118` / `#1a1a24` | cards, panels |
| `--line` | `rgba(255,255,255,.08)` | borders, dividers |
| `--text` / `--muted` | `#f4f4f8` / `#9a9ab0` | text |
| `--accent` | `#ff2e63` (hot pink-red) | primary CTA, progress, live dots |
| `--mirage` | gradient `#7c5cff → #ff2e63 → #ffb547` | brand moments ONLY: logo, VIP, hero titles, coin glow |
| `--coin` | `#ffc83d` | coins / prices |
| `--vip` | `#c9a7ff` | VIP badges |

Fonts: display = **Unbounded** (headings, logo, hero), body = **Inter** (both via `next/font`, Cyrillic subset).

## Rules
1. **Mobile-first.** Vertical content (9:16) is primary. Design at 390px, then scale to 1440px+. Bottom tab bar on mobile, top nav on desktop.
2. **Card ratios:** vertical series `aspect-[9/16]` (short drama), horizontal `aspect-video`. Never stretch posters.
3. **Depth over borders:** layered surfaces, soft shadows, `backdrop-blur` glass for overlays on video. Borders only `--line`.
4. **Hero:** full-bleed poster/video, bottom gradient to `--bg`, title in Unbounded 40–72px, max 2 CTAs.
5. **Motion:** 150–250ms ease-out; cards scale 1.03 on hover (desktop only); respect `prefers-reduced-motion`.
6. **Gradient budget:** the `--mirage` gradient appears at most 1–2 times per screen.
7. **Badges:** `AI` model chip (e.g. "Sora", "Kling") — small, mono-ish, glass. `VIP` uses `--vip`. Locked episodes show lock + coin price.
8. **Empty/loading states are designed:** skeleton shimmer cards with the real aspect ratio, friendly empty states with an icon + CTA.
9. **Icons:** `lucide-react` only, 18–22px, stroke 1.75.
10. **Accessibility:** contrast ≥ 4.5:1 for body text, visible focus ring (`ring-2 ring-[--accent]/60`), all icon buttons have `aria-label`.

## Component locations
`src/components/ui/*` primitives (Button, Badge, Sheet, Skeleton) · `src/components/media/*` cards, rows, hero · `src/components/player/*` players. Reuse before creating.

## Common mistakes
- Pure `#000` backgrounds or gray-on-gray text → use tokens.
- Gradient on every button → only primary brand moments.
- Desktop-only hover affordances (no touch alternative).
- Hard-coded text instead of i18n keys (see adding-i18n-strings).
- Claiming a screen is done without looking at it → REQUIRED: verifying-ui-in-browser.
