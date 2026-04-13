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
- Center: Question textarea + image upload (file/camera), GET BRIEFING button
- Intelligence Report: typewriter effect, react-markdown rendering
- Bottom bar: MISSIONS REMAINING X/3, turns orange when ≤1
- Locked overlay when missions = 0 (DAILY MISSION LIMIT REACHED + placeholder Stripe button)

### AI Integration
- POST /api/brief — sends question + optional base64 image + player profile
- System prompt includes player profile + full knowledge base JSON
- Model: claude-sonnet-4-5-20250929 via emergentintegrations
- Responds in English or Russian based on user input

### Rate Limiting
- 3 requests/day, stored in localStorage (`warroom_missions`)
- Resets at midnight (by date comparison)

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
