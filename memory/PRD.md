# WAR ROOM — PRD & Memory

## Original Problem Statement
Build a web app called "WAR ROOM" — an AI tactical advisor for the "Last War: Survival" game.
- Dark military HUD aesthetic
- Commander Setup screen (Server number, Squad/Hero configuration)
- Main War Room chat interface with Claude AI
- Embedded game knowledge base
- Game-specific configurations and highly contextual tactical advice

## Architecture
```
/app/
├── netlify.toml                  # NODE_VERSION=22
├── netlify/functions/
│   ├── brief.js                  # Main LLM endpoint (Claude via Anthropic API)
│   ├── health.js                 # Healthcheck
│   └── server-week.js            # Auto-detects season week from cpt-hedge.com
├── frontend/src/components/
│   ├── SetupScreen.jsx           # Free-form 3-squad setup, troop type inferred
│   └── WarRoom.jsx               # Chat UI, EN/RU toggle, auto-week detection
├── knowledge/                    # 8 JSON knowledge base files
└── memory/PRD.md
```

## What's Been Implemented

### Phase 1 — Foundation (Session 1)
- Military HUD aesthetic (dark theme, scan lines, grid, glow effects)
- Commander Setup screen with server + furnace level inputs
- Basic chat interface with Claude integration (Emergent LLM key)
- Knowledge base JSON files (bosses, heroes, star progression, etc.)

### Phase 2 — Backend Migration & Features (Session 2)
- **Migrated** backend from Python/FastAPI to Netlify Functions (Node.js)
- Canvas-based image compression (max 1280px, max 3MB) to prevent upload failures
- Dynamic KB fetching from GitHub API (5-min cache, 8 JSON files)
- Boss schedule embedded in system prompt with today's boss auto-detection
- Notion API logging (async, 2s timeout, non-blocking)
- 6 Quick Action buttons (Today's Boss, Dig Sites, Temperature, Week Priority, Hero Advice, War Phase)
- 3-Squad hero setup: Squad 1 (Tank), Squad 2 (Aircraft), Squad 3 (Missile), 5 heroes each

### Phase 3 — UX Automation & Localization (Session 3, Feb 2026)
- **Removed manual Troop Type dropdown** — inferred from Squad 1 hero composition (most common hero type in slots 0–4; Tank is default)
- **Free-form squads** — All heroes available in any squad; Squad 1 = PRIMARY, Squad 2 = SECONDARY, Squad 3 = SUPPORT
- **Server Week Auto-detection** — `server-week.js` fetches `cpt-hedge.com/servers`, parses HTML/JSON for the server's current season week (graceful fallback if site unreachable)
- **EN/RU Language Toggle** — in top bar; saved to `localStorage('warroom_lang')`; translates all UI labels, squad names, quick actions, season tracker
- **Russian Quick Actions** — separate question translations for Russian users
- **Russian Weekly Schedule** — localized week-priority descriptions in SeasonTracker
- **Claude language directive** — `brief.js` system prompt instructs Claude to respond in Russian when `language=RU`
- **Notion language logging** — uses explicit `language` field from payload instead of Cyrillic detection

## Key Technical Details
- **Troop Type Inference**: `inferTroopType(heroes)` counts hero types in Squad 1 (indices 0–4). Most common type wins; Tank is default if all empty.
- **Season Week**: Stored as `profile.seasonWeek` (integer) in localStorage. Backward compat: falls back to computing from `profile.seasonStartDate` if `seasonWeek` is absent.
- **Language State**: `localStorage('warroom_lang')` = "EN" | "RU". Read by both SetupScreen (from localStorage directly) and WarRoom (React state).
- **Notion DB Schema**: Question, Server, Troop Type, Season Week, Furnace Level, Heroes, Has Image, Timestamp, Answer, Language

## 3rd Party Integrations
- **Anthropic Claude** (claude-sonnet-4-5) via Emergent LLM Key (`ANTHROPIC_API_KEY`)
- **Notion API** (`NOTION_TOKEN`, `NOTION_DATABASE_ID`) — async logging
- **GitHub API** — unauthenticated, fetches `/knowledge/*.json` dynamically

## LocalStorage Keys
- `warroom_profile` — `{ server, troopType, furnaceLevel, heroes[], seasonWeek }`
- `warroom_history` — last 20 Q&A pairs
- `warroom_lang` — "EN" | "RU"

### Phase 4 — Sidebar Widgets (Session 4, Feb 2026)
- **Removed Counter Intel widget** from sidebar
- **Removed Troop Type badge** from TopBar (only server number remains)
- **TODAY'S BOSS widget** — Mon/Thu=Frenzied Butcher(Tank), Tue/Fri=Frankenstein(Missile), Wed/Sat=Mutant Bulldog(Aircraft), Sun=none. Cyan-highlighted if matches Squad 1 type (+50% bonus day); gray otherwise
- **DIG SITE TARGET widget** — Tank→BEAR, Missile→GORILLA, Aircraft→MAMMOTH; shows beast + troop type matchup
- **WAR PHASE COUNTDOWN widget** — calculates time to next Wednesday or Saturday 12:00 ST; orange accent styling
- **SEASON WEEK PRIORITY** — redesigned as a prominent card with `text-5xl` week number, border-left cyan accent, thicker progress bar, larger priority text
- **UI text renames**: "ASK YOUR TACTICAL ADVISOR" → "TODAY'S FOCUS"; placeholder → "What do you need help with today?"; quick action "Today's Boss" → "Boss Deep Dive"
- All 4 widgets fully translated to Russian (EN/RU toggle)

### P2 — Content (User to provide)
- Populate `temperature_advanced.json`
- Populate `tips_and_tricks_s2.json`
- Populate `war_strategy_s2.json`

### P3 — Future Enhancements
- Multi-language expansion (e.g., Chinese, Spanish)
- Session persistence beyond localStorage (cloud sync)
- Hero tier list / recommendation engine
- Alliance coordination features
