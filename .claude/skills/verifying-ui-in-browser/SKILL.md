---
name: verifying-ui-in-browser
description: Use when about to say a MIRAGE page, component, player or flow is done, fixed or looks good, or after any visual/CSS/layout change — before reporting completion to the user.
---

# Verifying UI in the Browser

## Overview
Typecheck passing ≠ UI working. Look at the page at mobile AND desktop sizes and read the console before claiming done.

## Procedure (Playwright MCP tools `mcp__plugin_playwright_playwright__*`, load via ToolSearch)
1. Dev server running (see running-mirage).
2. `browser_resize` 390×844 → `browser_navigate` to the page → `browser_take_screenshot`.
3. `browser_resize` 1440×900 → screenshot again.
4. `browser_console_messages` — zero errors (hydration warnings count as errors).
5. For flows, drive them: log in as a demo account, click the CTA, confirm the resulting state (e.g. balance decreased, episode plays, toast shown).
6. Compare against designing-mirage-ui rules: tokens, ratios, gradient budget, focus rings, no raw strings.

## Checklist per screen
- [ ] No horizontal scroll at 390px
- [ ] Images/posters load (no broken icons)
- [ ] Loading + empty states render
- [ ] Locked vs unlocked episode states both seen
- [ ] RU and EN both fit (EN/RU length differs — check wrapping)
- [ ] Console clean

## Report
Tell the user what was checked and what was seen; attach screenshot paths if useful. If something was not verified, say so explicitly.
