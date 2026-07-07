# Gutly — App & Feature Overview

## 1. What it is
**Gutly** is a mobile app (React Native / Expo, iOS + Android) that guides people with **IBS / gut sensitivity** through the **low-FODMAP diet** — a clinically recognized, two-phase elimination-and-reintroduction process for identifying which foods trigger digestive symptoms.

It blends three things:
- **Clinical credibility** (Google-Fit-style stats, evidence-informed content)
- **Playful warmth** (a mascot + gamification, à la Yazio / Headspace / Waterllama)
- **Local-first privacy** (all data on-device; health data never leaves the phone)

**Target user:** someone (often diagnosed with IBS) trying to calm gut symptoms by finding their personal food triggers — overwhelmed by the FODMAP process and wanting gentle, structured guidance.

**Tone of voice:** warm, encouraging, plain-English, never scolding. Bad gut days are met with support, not blame.

## 2. Core concept — the FODMAP journey
1. **Elimination phase** (~4–6 weeks): temporarily remove common trigger foods to calm the gut and create a clean symptom baseline.
2. **Reintroduction phase** (~8 weeks): systematically test the 6 FODMAP groups one at a time (3-day challenges) to learn personal triggers.
3. **Maintenance:** a personalized list of safe foods.

A pure-JS **pattern-detection engine** (no AI) correlates logged meals with symptoms by timestamp (6-hour window) and surfaces observational insights ("bloating tends to follow high-FODMAP dinners") — always correlation, never diagnosis.

## 3. Design system
- **Palette (sage/green):** primary `#5a8a5a`, dark `#2d6a2d` / ink `#1c241c`, page bg `#fafbfa`, cards white w/ hairline `#eef2ee` border, muted text `#8a9a8a`, soft text `#6b7a6b`. Risk colors: low = green `#e8f0e8`/`#2d6a2d`, moderate = amber `#fbeed3`/`#a05a10`, high = red `#fde0e0`/`#a03030`.
- **Typography:** system font (SF Pro / Roboto). Chunky near-black headlines (weight 700, large titles 26–28px). Sentence case. Captions sometimes fail strict AA contrast (a known cleanup item).
- **Shape:** rounded — cards 16–20px radius, pills/chips fully rounded, tiles 14px.
- **Buttons:** filled green = **primary** action; black-outline (transparent bg, `#1c241c` border) = **secondary**; red = **destructive**. Ghost text links (green, no border) for inline "See X" actions.
- **Icons:** Tabler-style outline icons (custom SVG via react-native-svg): tab bar (filled when selected, outline when not), search, barcode, Material `arrow-back` for app bars.
- **App bar:** Material-3-style. Default = **large** (slim back-arrow row + big headline below); also a **small** inline variant. No dividers.
- **Transitions:** detail screens (My Progress, Cultura's Colony) push in **from the right** (custom slide-over), not bottom-up.
- **Food = emoji** everywhere (🥕 🍝 🥛), each with a Low/Moderate/High risk pill.

## 4. Mascot — "Cultura"
A friendly **probiotic microbe** (sage-green blob with cilia, a face, cheeks) — the emotional anchor of the app.
- **Moods** (reflect the day's gut score): good / so-so / bad — changes color, mouth, eyes, adds a sweat-drop on bad days.
- **Evolution forms** (tied to gamification level): **Spore → Sprout → Grown → Thriving** (Thriving adds a leafy crown + sparkles). Same recognizable character, visibly leveling up (deliberately *not* Pokémon-style species-morphing).
- **Animations:** breathes + blinks + gently sways on the Today hero; springs in on level-up; floats with a glow + twinkling sparkles on the paywall; steams while "cooking" on the recipes tile; heart-beats on the empty-state illustration.
- **Custom scene illustrations** (same visual language): tending a potted sprout (empty state), politely refusing a milk glass (elimination), peeking over cloches (reintroduction), wearing a chef hat (recipes), holding a cookbook (premium), pointing at a lightbulb (GutGuide).

## 5. Gamification — "Cultura's colony"
A microbiome-themed progress system (analogous to Waterllama's water theme).
- **Points** (derived purely from the log, never stored separately): symptom-free days (+20), low-FODMAP meals (+5, max 3/day), daily logging (+10), completed reintro tests (+50). 100 pts/level. **Rough days never cost points** — rewards consistency, not perfection.
- **Cultura's colony:** a collection of **6 distinct probiotic species** (scientifically-styled: coccus, bacillus/rod, bifidobacterium/Y-shape, streptococcus/chain, budding yeast, diplococcus/pair) — each a different color, shape, and size, all with consistent faces and cilia. Shown grouped with **"×2 / ×3" multipliers** rather than rendering every member.
- **Completion:** colony maxes at 12 members (level 13). At completion it shows a one-time celebration + switches to a **"days thriving" streak** as the long-term maintenance metric.
- **Streak pill** (🔥 symptom-free days) in the header. (Gems were considered but dropped to avoid a fake economy.)

## 6. Navigation — bottom tab bar + modals
**4 tabs + a center "+" button:**
1. **Today** (home) — daily dashboard
2. **Foods** — food explorer
3. **( + )** — opens a "what to log?" chooser (meal / symptom / sleep / stress)
4. **My Plan** — the two-phase journey
5. **GutGuide** — Q&A knowledge base

## 7. Screens & features
**Today (home):**
- Reactive Cultura **mood card** (big, centered, animated) with a status message + Day/phase pill
- **Today's metrics** tiles (Low-FODMAP adherence ring, symptoms, sleep) → tap "See My Progress"
- **Cultura's colony** card (species cluster + level/streak) → "See Colony"
- **Cycle tracking** card (period toggle with a "why it matters" explainer) for users who menstruate
- **Phase progress** widget, **"Eat well today"** recipe suggestions (elimination), **pattern insights**, **today's timeline** of entries
- Empty/first-run state: a hero Cultura illustration + "How it works"

**My Progress** (Google-Fit-style stats screen): big weekly **gut-score ring**, metric cards (calm days / adherence / avg sleep), **7-day bar charts** (adherence, symptoms, sleep — today highlighted), Cultura level footer.

**Foods (explorer):** search any food; rows with emoji + risk pill + trigger band; food detail (safe portions, FODMAP groups, low-FODMAP swaps, fermentation/histamine notes, cross-intolerance warnings). A **Recipes** tile (animated cooking Cultura) → recipes list with a premium upsell.

**My Plan:** two big phase cards with **custom Cultura scene illustrations** (elimination = refusing milk; reintroduction = cloches), status badges, the 6-category reintroduction tracker (3-day challenges), period-pause warning, medical disclaimer.

**GutGuide:** 50 evidence-informed FODMAP Q&As, searchable, topic-filter chips (🌿 emoji), expandable cards, "not medical advice" footer.

**Logging (modals):** meal / symptom / sleep / stress. The **meal screen** (recently redesigned): AppBar, a 14-day **day-picker strip** (backdate forgotten entries; time not required), **search-first** food entry, food result rows with +/✓, a "Your meal" card (removable pills + portion S/M/L), **sticky bottom bar** with live FODMAP verdict + Save, secondary **Scan barcode** (real OpenFoodFacts lookup). *(AI photo-scan and "describe meal" AI are currently hidden.)*

**Other modals:** paywall (premium hero), settings, doctor-export (shareable text summary), edit-entry, log-feedback popup (Cultura reacts after each log), level-up celebration, scan-limit.

## 8. Monetization (freemium)
- **Free forever:** food lookup, barcode, all logging, GutGuide, the full **elimination** phase, first reintro challenge.
- **Premium:** full reintroduction (all 6 groups), all 50+ recipes, full pattern history, doctor-ready export. (Intended to move to real App/Play Store IAP via RevenueCat; currently a local flag.)

## 9. Internationalization
UI chrome in **5 languages** (EN, DE, ES, FR, IT), auto-detected from the phone with a manual override in Settings. Long-form content (food names, GutGuide answers, swaps) localized via separate translation tables (currently English fallback for many).

## 10. Compliance
Not a medical device. Disclaimers: onboarding red-flag screening, an always-accessible **Health disclaimer** in Settings, contextual notes on Plan + AI features + GutGuide, and **Terms / Privacy** links (placeholder URLs). Best done with an IBS diagnosis + FODMAP-trained dietitian.

## 11. Tech & data
- **Stack:** Expo SDK 54, React Native 0.81, react-native-svg (all illustrations are hand-built vector), Animated API (no animation libs), @expo/vector-icons.
- **Persistence:** local **AsyncStorage** only (no backend/account/sync yet). Schema-versioned. Gamification + stats are *derived* from the log, so nothing can desync.
- **Known gaps / next steps:** no cloud backup (data lost on reinstall) → consider optional Supabase sync; the logging modals besides meal still use the older form layout; a reusable loader/skeleton/retry kit for when networked features arrive; accessibility contrast pass on muted text.

## 12. What's polished vs not (for a design pass)
- **Polished & modern:** Today, My Plan, My Progress, Cultura's Colony, GutGuide, the meal-logging screen, all Cultura illustrations/animations.
- **Still original/utilitarian (best candidates for a redesign):** the symptom / sleep / stress logging modals, the Settings screen, the barcode & paywall flows.
