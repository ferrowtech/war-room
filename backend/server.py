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

KNOWLEDGE_BASE = '{"squad_building":{"troop_counters":{"Tank":"beats Missile, weak to Aircraft","Missile":"beats Aircraft, weak to Tank","Aircraft":"beats Tank, weak to Missile"},"lineup_bonuses":{"3_same_type":"+5%","4_same_type":"+15%","5_same_type":"+20%"},"key_advice":["Focus on ONE main lineup","4-star heroes give significant power bonus","Upgrade turret and chip for main attack hero first"]},"season_2":{"name":"Polar Storm","weekly_schedule":{"week_1":{"priority":"Build Titanium Alloy Factory, upgrade Furnace, capture first Dig Site","city_unlock":"Level 1 cities unlock Day 3 at 12:00"},"week_2":{"priority":"Expand territory, upgrade Furnace, build Military Bases"},"week_3":{"priority":"Choose faction (Rebels or Gendarmerie) - determines Rare Soil War opponents"},"week_4":{"priority":"Rare Soil War begins - upgrade Alliance Furnace, coordinate alliance"},"week_5":{"priority":"Active war phase - attack/defense rotations"},"week_6":{"priority":"Push Faction Award points, defend Alliance Furnace"},"week_7":{"priority":"Faction Duel - 4v4 Capitol Conquest, final ranking"},"week_8":{"priority":"Season ends - Transfer Surge available based on rank"}},"temperature":{"critical_threshold":-20,"effects_below_threshold":["Cannot start rallies","Cannot use teleport"],"how_to_increase":["Upgrade High-heat Furnace","Stay near Alliance Furnace","Ask allies for Recon Plan (heats to 40C)","Tower of Victory decoration"]},"dig_sites":{"max_owned":4,"max_captures_per_day":2,"beast_weaknesses":{"Gorilla":"weak to Missile","Bear":"weak to Tank","Mammoth":"weak to Aircraft"},"virus_resistance":{"level_1":4000,"level_2":6500,"level_3":8500,"level_4":9500},"rare_soil_war":{"period":"Week 4-7","factions":["Rebels","Gendarmerie"],"victory_condition":"Destroy enemy Alliance Furnace"},"fast_growth_tips":["Kill highest Doom Walker on day 1 for coal","Claim Dig Site hourly coal daily","Keep Alliance Furnace running always","Buy season battle pass immediately"]}}}'


class BriefRequest(BaseModel):
    question: str
    image_base64: Optional[str] = None
    server: str
    troop_type: str
    furnace_level: int
    heroes: List[str]


@api_router.get("/")
async def root():
    return {"message": "WAR ROOM API Online"}


@api_router.post("/brief")
async def get_brief(request: BriefRequest):
    # ANTHROPIC_API_KEY goes here via environment variable
    api_key = os.environ.get('EMERGENT_LLM_KEY', '')
    if not api_key:
        raise HTTPException(status_code=500, detail="API key not configured")

    heroes_str = ', '.join([h.strip() for h in request.heroes if h.strip()])

    system_prompt = f"""You are WAR ROOM, a tactical AI advisor for Last War: Survival game.

PLAYER PROFILE:
- Server: {request.server}
- Primary Troop Type: {request.troop_type}
- Furnace Level: {request.furnace_level}
- Top Heroes: {heroes_str if heroes_str else 'Not specified'}

KNOWLEDGE BASE:
{KNOWLEDGE_BASE}

BEAST TARGETING RULES (CRITICAL — never get these wrong):
- {request.troop_type} player → target DIG SITE BEASTS weak to {request.troop_type}
- Bear is weak to Tank   → Tank players attack BEAR dig sites
- Gorilla is weak to Missile → Missile players attack GORILLA dig sites
- Mammoth is weak to Aircraft → Aircraft players attack MAMMOTH dig sites
This player uses {request.troop_type}, so they should always target: {"Bear" if request.troop_type == "Tank" else "Gorilla" if request.troop_type == "Missile" else "Mammoth"} dig sites.

INSTRUCTIONS: Answer in the same language the user writes in (English or Russian). Be direct, specific, and tactical. Always reference the player's specific troop type ({request.troop_type}) and furnace level ({request.furnace_level}) in your advice. When mentioning dig sites or beasts, always recommend the correct beast type for this player's troop type. Keep answers under 200 words. Format with clear sections when helpful."""

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
