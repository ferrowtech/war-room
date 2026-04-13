from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional
import uuid
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

KNOWLEDGE_BASE = '{"squad_building":{"troop_counters":{"Tank":"beats Missile, weak to Aircraft","Missile":"beats Aircraft, weak to Tank","Aircraft":"beats Tank, weak to Missile"},"lineup_bonuses":{"3_same_type":"+5%","4_same_type":"+15%","5_same_type":"+20%"},"key_advice":["Focus on ONE main lineup","4-star heroes give significant power bonus","Upgrade turret and chip for main attack hero first"]},"season_2":{"name":"Polar Storm","weekly_schedule":{"week_1":{"priority":"Build Titanium Alloy Factory, upgrade Furnace, capture first Dig Site","city_unlock":"Level 1 cities unlock Day 3 at 12:00"},"week_2":{"priority":"Expand territory, upgrade Furnace, build Military Bases"},"week_3":{"priority":"Choose faction (Rebels or Gendarmerie) - determines Rare Soil War opponents"},"week_4":{"priority":"Rare Soil War begins - upgrade Alliance Furnace, coordinate alliance"},"week_5":{"priority":"Active war phase - attack/defense rotations"},"week_6":{"priority":"Push Faction Award points, defend Alliance Furnace"},"week_7":{"priority":"Faction Duel - 4v4 Capitol Conquest, final ranking"},"week_8":{"priority":"Season ends - Transfer Surge available based on rank"}},"temperature":{"critical_threshold":-20,"effects_below_threshold":["Cannot start rallies","Cannot use teleport"],"how_to_increase":["Upgrade High-heat Furnace","Stay near Alliance Furnace","Ask allies for Recon Plan (heats to 40C)","Tower of Victory decoration"]},"dig_sites":{"max_owned":4,"max_captures_per_day":2,"beast_weaknesses":{"Gorilla":"weak to Missile","Bear":"weak to Tank","Mammoth":"weak to Aircraft"},"virus_resistance":{"level_1":4000,"level_2":6500,"level_3":8500,"level_4":9500},"rare_soil_war":{"period":"Week 4-7","factions":["Rebels","Gendarmerie"],"victory_condition":"Destroy enemy Alliance Furnace"},"fast_growth_tips":["Kill highest Doom Walker on day 1 for coal","Claim Dig Site hourly coal daily","Keep Alliance Furnace running always","Buy season battle pass immediately"]}},"hero_progression":{"star_thresholds":{"4_stars":"Unlocks Super Sensory: +20% HP/Attack/Defense and +10% skill speed — the #1 priority upgrade threshold for every hero","5_stars":"Required to unlock Exclusive Weapon"},"shards_needed":{"to_1_star":25,"to_2_stars":50,"to_3_stars":100,"to_4_stars":300,"to_5_stars":500},"critical_rule":"NEVER assume or invent a hero star count. Always use the exact star level shown in the player profile. Give specific upgrade advice based on their actual current stars."}}'


class BriefRequest(BaseModel):
    question: str
    image_base64: Optional[str] = None
    server: str
    troop_type: str
    furnace_level: int
    heroes: List[str]
    season_week: Optional[int] = None


@api_router.get("/")
async def root():
    return {"message": "WAR ROOM API Online"}


import re as _re

WEEK_PRIORITY = {
    1: "Build Titanium Alloy Factory, upgrade Furnace, capture first Dig Site",
    2: "Expand territory, upgrade Furnace, build Military Bases",
    3: "Choose faction (Rebels or Gendarmerie) — determines Rare Soil War opponents",
    4: "Rare Soil War begins — upgrade Alliance Furnace, coordinate with alliance",
    5: "Active war phase — attack/defense rotations",
    6: "Push Faction Award points, defend Alliance Furnace",
    7: "Faction Duel — 4v4 Capitol Conquest, final ranking",
    8: "Season ends — Transfer Surge available based on rank",
}

SHARDS_TO_NEXT = {1: 25, 2: 50, 3: 100, 4: 300}  # shards needed to reach next star


def _build_heroes_data(heroes: List[str]):
    """Parse hero strings like 'Kimberly (5\u2605)' into structured dicts.
    Uses explicit Unicode codepoint U+2605 to avoid encoding ambiguity."""
    parsed = []
    # Accepts both the Unicode star U+2605 (★) and a plain digit fallback
    STAR_PATTERN = _re.compile(r'^(.+?)\s+\((\d)[\u2605\*]\)$')
    for h in heroes:
        h = h.strip()
        if not h or h.lower() == 'none':
            continue
        m = STAR_PATTERN.match(h)
        if m:
            name = m.group(1).strip()
            stars = int(m.group(2))
            parsed.append({"name": name, "stars": stars, "raw": h})
        else:
            # Last-resort: try splitting on space before '('
            logger.warning(f"[WAR ROOM] Hero string did not match star pattern: repr={repr(h)}")
            parsed.append({"name": h, "stars": None, "raw": h})
    return parsed


def _build_system_prompt(request) -> tuple[str, str, str]:
    """Returns (system_prompt, heroes_block, prohibitions_block)."""
    parsed_heroes = _build_heroes_data(request.heroes)

    # Build heroes_block with explicit status labels
    hero_lines = []
    for p in parsed_heroes:
        name, stars = p["name"], p["stars"]
        if stars is None:
            hero_lines.append(f"  - {name}: star level could not be read (check profile)")
            continue
        status_parts = []
        if stars >= 4:
            status_parts.append("Super Sensory UNLOCKED")
        if stars >= 5:
            status_parts.append("Exclusive Weapon UNLOCKED")
        if stars < 4:
            shards = SHARDS_TO_NEXT.get(stars, 0)
            status_parts.append(f"needs {shards} shards to reach 4\u2605 Super Sensory")
        status = "; ".join(status_parts)
        hero_lines.append(f"  - {name}: {stars}\u2605 — {status}")

    heroes_block = "\n".join(hero_lines) if hero_lines else "  (no heroes set)"

    # Build explicit per-hero prohibitions for heroes already at milestone stars
    prohibition_lines = []
    for p in parsed_heroes:
        name, stars = p["name"], p["stars"]
        if stars is None:
            continue
        if stars >= 5:
            prohibition_lines.append(
                f"  - {name} is ALREADY at 5\u2605. Exclusive Weapon and Super Sensory are BOTH UNLOCKED. "
                f"DO NOT suggest upgrading {name}'s stars — they are maxed."
            )
        elif stars >= 4:
            prohibition_lines.append(
                f"  - {name} is ALREADY at 4\u2605. Super Sensory is UNLOCKED. "
                f"DO NOT suggest {name} needs to reach 4\u2605 — they are already there."
            )
    prohibitions_block = "\n".join(prohibition_lines) if prohibition_lines else "  (all heroes below 4\u2605 — upgrades may be recommended)"

    # Season week line
    week_line = ""
    if request.season_week:
        priority = WEEK_PRIORITY.get(request.season_week, "")
        week_line = f"Current Season Week: {request.season_week}/8 — {priority}"

    beast_target = "Bear" if request.troop_type == "Tank" else "Gorilla" if request.troop_type == "Missile" else "Mammoth"

    system_prompt = f"""You are WAR ROOM, a tactical AI advisor for Last War: Survival game.

=================================================================
COMMANDER PROFILE — VERIFIED FACTS — DO NOT CONTRADICT THESE
=================================================================
Server: {request.server}
Primary Troop Type: {request.troop_type}
Furnace Level: {request.furnace_level}
{week_line}

HERO ROSTER — EXACT CURRENT STAR LEVELS (THIS IS GROUND TRUTH):
{heroes_block}

EXPLICIT UPGRADE PROHIBITIONS (based on verified hero data above):
{prohibitions_block}

CRITICAL HERO RULE: The star counts above are exact facts from the player's profile.
- NEVER tell a hero to "reach 4\u2605" if they are already at 4\u2605 or 5\u2605.
- NEVER tell a hero to "get 5\u2605" if they are already at 5\u2605.
- ONLY suggest star upgrades for heroes whose current stars are below the next milestone (4\u2605 or 5\u2605).
=================================================================

GAME KNOWLEDGE BASE:
{KNOWLEDGE_BASE}

BEAST TARGETING (CRITICAL — never get these wrong):
- Bear is weak to Tank   → Tank players ALWAYS attack BEAR dig sites
- Gorilla is weak to Missile → Missile players ALWAYS attack GORILLA dig sites
- Mammoth is weak to Aircraft → Aircraft players ALWAYS attack MAMMOTH dig sites
This player uses {request.troop_type} → they MUST target: {beast_target} dig sites ONLY.

GENERAL HERO MILESTONES (apply only to heroes NOT yet at these levels):
- 4\u2605 unlocks Super Sensory: +20% HP/Attack/Defense, +10% skill speed
- 5\u2605 unlocks Exclusive Weapon
- Shards needed per level: 1\u2605=25, 2\u2605=50, 3\u2605=100, 4\u2605=300, 5\u2605=500

INSTRUCTIONS: Answer in the same language the user writes in (English or Russian). Be direct, specific, and tactical. Reference the player's troop type ({request.troop_type}), furnace level ({request.furnace_level}), and actual hero stars from the profile above. Recommend the correct beast type for their troop. Keep answers under 200 words. Format with clear sections when helpful."""

    return system_prompt, heroes_block, prohibitions_block


@api_router.post("/brief")
async def get_brief(request: BriefRequest):
    api_key = os.environ.get('EMERGENT_LLM_KEY', '')
    if not api_key:
        raise HTTPException(status_code=500, detail="API key not configured")

    system_prompt, heroes_block, prohibitions_block = _build_system_prompt(request)

    logger.info(f"[WAR ROOM] /brief — heroes block:\n{heroes_block}")
    logger.info(f"[WAR ROOM] /brief — prohibitions:\n{prohibitions_block}")
    logger.info(f"[WAR ROOM] /brief — FULL SYSTEM PROMPT:\n{'='*60}\n{system_prompt}\n{'='*60}")

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=str(uuid.uuid4()),
            system_message=system_prompt
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")

        file_contents = []
        if request.image_base64:
            file_contents.append(ImageContent(image_base64=request.image_base64))

        user_message = UserMessage(
            text=request.question,
            file_contents=file_contents if file_contents else None
        )

        response = await chat.send_message(user_message)
        return {"response": response}

    except Exception as e:
        logger.error(f"Claude API error: {e}")
        raise HTTPException(status_code=500, detail=f"Tactical advisor offline: {str(e)}")


@api_router.post("/debug-prompt")
async def debug_prompt(request: BriefRequest):
    """Returns the exact system prompt that would be sent to Claude for the given profile.
    Use this to verify hero star parsing and prompt construction without consuming LLM credits."""
    system_prompt, heroes_block, prohibitions_block = _build_system_prompt(request)
    parsed_heroes = _build_heroes_data(request.heroes)
    return {
        "heroes_raw": request.heroes,
        "heroes_parsed": parsed_heroes,
        "heroes_block": heroes_block,
        "prohibitions_block": prohibitions_block,
        "system_prompt": system_prompt,
        "system_prompt_length": len(system_prompt),
    }


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
