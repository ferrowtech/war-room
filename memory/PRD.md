# WAR ROOM — PRD

## Overview
AI tactical advisor web app for Last War: Survival game. Military HUD aesthetic.

## Architecture
- **Frontend**: React (CRA + Craco), Tailwind CSS, Rajdhani/Chivo fonts, lucide-react
- **Backend**: FastAPI, emergentintegrations (Anthropic Claude claude-sonnet-4-5-20250929)
- **Storage**: localStorage only (no DB for user data)
- **AI**: Anthropic Claude via Emergent Universal Key

## Implemented (April 2026)

### Screen 1 — Commander Setup
- Server number input, troop type select (Tank/Aircraft/Missile)
- Furnace level slider 1–20, 3 hero name inputs
- "ENTER WAR ROOM" CTA, validation, saved to localStorage

### Screen 2 — War Room
- Top bar: WAR ROOM logo, server/troop badge, Edit Profile link
- Left panel: Commander profile summary (server, troop, furnace, heroes, counter intel)
  - Always visible on desktop (md+), collapsible overlay on mobile
  - **Season Week Tracker (Polar Storm)**: set Season 2 start date, shows current week 1–8 with progress bar and priority action. Editable.
- Center: Question textarea + image upload (file/camera), GET BRIEFING button
- Intelligence Report: typewriter effect, react-markdown v8 rendering with styled custom renderers
  - **COPY BRIEFING button** — always visible (disabled during typewriter animation), copies full response
- **Mission History**: collapsible MISSION HISTORY section below response, each item expandable with full markdown + COPY button; persisted in localStorage `warroom_history` (last 20)
- Bottom bar: MISSIONS REMAINING X/3, turns orange when ≤1
- Locked overlay when missions = 0 (DAILY MISSION LIMIT REACHED + placeholder Stripe button)

### AI Integration
- POST /api/brief — sends question + optional base64 image + player profile
- POST /api/debug-prompt — returns parsed hero data + full system prompt (no LLM call, for verification)
- System prompt structure: COMMANDER PROFILE block (verified facts, visual separators) → EXPLICIT UPGRADE PROHIBITIONS per hero → KNOWLEDGE BASE → BEAST TARGETING
- Hero parsing uses Unicode codepoint `\u2605` (★) regex to prevent encoding ambiguity
- Explicit per-hero "DO NOT suggest upgrading" prohibitions for heroes already at 4★ or 5★
- Model: claude-sonnet-4-5-20250929 via emergentintegrations
- Responds in English or Russian based on user input

### Tech Notes
- react-markdown downgraded to v8.0.7 (v10 broke `className` prop and caused runtime errors)

## Design
- Background: #0a0e1a with SVG noise texture overlay
- Accent: #4fc3f7 (cyan glow), Warning: #ff6f00 (orange)
- No rounded corners anywhere (rounded-none enforced globally)
- Scanning HUD line animation
- Font: Rajdhani (headings/labels/buttons), Chivo (body/AI text)

## Backlog
- P0: Add history/persistence of past responses
- P1: Share briefing button (copy to clipboard)
- P1: Real Stripe integration for premium tier
- P2: More knowledge base content (heroes, events)
- P2: Russian UI option
