"use strict";

// ── Hardcoded fallback knowledge bases ───────────────────────────────────────
// Used when GitHub fetch fails. Keep in sync with the repo JSON files.
const FALLBACK_MAIN_KB = '{"squad_building":{"troop_counters":{"Tank":"beats Missile, weak to Aircraft","Missile":"beats Aircraft, weak to Tank","Aircraft":"beats Tank, weak to Missile"},"lineup_bonuses":{"3_same_type":"+5%","4_same_type":"+15%","5_same_type":"+20%"},"key_advice":["Focus on ONE main lineup","4-star heroes give significant power bonus","Upgrade turret and chip for main attack hero first"]},"season_2":{"name":"Polar Storm","weekly_schedule":{"week_1":{"priority":"Build Titanium Alloy Factory, upgrade Furnace, capture first Dig Site","city_unlock":"Level 1 cities unlock Day 3 at 12:00"},"week_2":{"priority":"Expand territory, upgrade Furnace, build Military Bases"},"week_3":{"priority":"Choose faction (Rebels or Gendarmerie) - determines Rare Soil War opponents"},"week_4":{"priority":"Rare Soil War begins - upgrade Alliance Furnace, coordinate alliance"},"week_5":{"priority":"Active war phase - attack/defense rotations"},"week_6":{"priority":"Push Faction Award points, defend Alliance Furnace"},"week_7":{"priority":"Faction Duel - 4v4 Capitol Conquest, final ranking"},"week_8":{"priority":"Season ends - Transfer Surge available based on rank"}},"temperature":{"critical_threshold":-20,"effects_below_threshold":["Cannot start rallies","Cannot use teleport"],"how_to_increase":["Upgrade High-heat Furnace","Stay near Alliance Furnace","Ask allies for Recon Plan (heats to 40C)","Tower of Victory decoration"]},"dig_sites":{"max_owned":4,"max_captures_per_day":2,"beast_weaknesses":{"Gorilla":"weak to Missile","Bear":"weak to Tank","Mammoth":"weak to Aircraft"},"virus_resistance":{"level_1":4000,"level_2":6500,"level_3":8500,"level_4":9500},"rare_soil_war":{"period":"Week 4-7","factions":["Rebels","Gendarmerie"],"victory_condition":"Destroy enemy Alliance Furnace"},"fast_growth_tips":["Kill highest Doom Walker on day 1 for coal","Claim Dig Site hourly coal daily","Keep Alliance Furnace running always","Buy season battle pass immediately"]}},"hero_progression":{"star_thresholds":{"4_stars":"Unlocks Super Sensory: +20% HP/Attack/Defense and +10% skill speed","5_stars":"Required to unlock Exclusive Weapon"},"shards_needed":{"to_1_star":25,"to_2_stars":50,"to_3_stars":100,"to_4_stars":300,"to_5_stars":500},"critical_rule":"NEVER assume or invent a hero star count. Always use the exact star level shown in the player profile."}}';

const FALLBACK_BOSSES_KB = '{"wanted_monsters":{"description":"Each Wanted Monster grants +50% damage to the matching troop type on its scheduled days. Always prioritise attacking on your bonus days.","schedule":{"Frenzied Butcher":{"days":["Monday","Thursday"],"troop_bonus":"Tank","bonus":"+50% damage for Tank troops"},"Frankenstein":{"days":["Tuesday","Friday"],"troop_bonus":"Missile","bonus":"+50% damage for Missile troops"},"Mutant Bulldog":{"days":["Wednesday","Saturday"],"troop_bonus":"Aircraft","bonus":"+50% damage for Aircraft troops"}}},"doom_walker":{"season_2_reward":"First kill each day grants a coal bonus — always kill the highest-level Doom Walker reachable","tip":"Kill on Day 1 of the season for maximum early coal"},"polar_beasts":{"description":"Season 2 Polar Storm dig site bosses — each beast is weak to one troop type","Bear":{"weakness":"Tank","location":"Dig Sites"},"Gorilla":{"weakness":"Missile","location":"Dig Sites"},"Mammoth":{"weakness":"Aircraft","location":"Dig Sites"}}}';

// Pre-built fallback string (used when all GitHub fetches fail)
const FALLBACK_KB_STR = JSON.stringify({
  ...JSON.parse(FALLBACK_MAIN_KB),
  bosses: JSON.parse(FALLBACK_BOSSES_KB),
});

// ── GitHub dynamic discovery ──────────────────────────────────────────────────
const GITHUB_CONTENTS_API = "https://api.github.com/repos/ferrowtech/war-room/contents/knowledge";
const MAIN_KB_FILENAME     = "lastwar_knowledge_base.json";

// ── In-memory cache (persists across warm invocations in the same container) ──
const KB_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const kbCache = { data: null, timestamp: 0 };

async function fetchKnowledgeBase() {
  const now = Date.now();

  if (kbCache.data && now - kbCache.timestamp < KB_CACHE_TTL_MS) {
    console.log("[WAR ROOM] Knowledge base served from cache");
    return kbCache.data;
  }

  // ── Step 1: discover files via GitHub Contents API ──
  let fileList;
  try {
    const listRes = await fetch(GITHUB_CONTENTS_API, {
      headers: { "User-Agent": "war-room-bot" },
      signal: AbortSignal.timeout(5000),
    });
    if (!listRes.ok) throw new Error(`HTTP ${listRes.status}`);
    const items = await listRes.json();
    fileList = items.filter((f) => f.type === "file" && f.name.endsWith(".json"));
    console.log(`[WAR ROOM] Discovered ${fileList.length} knowledge files: ${fileList.map((f) => f.name).join(", ")}`);
  } catch (err) {
    console.error("[WAR ROOM] GitHub directory listing failed — using hardcoded fallback:", err.message);
    return FALLBACK_KB_STR;
  }

  // ── Step 2: fetch all files in parallel via their download_url ──
  const results = await Promise.allSettled(
    fileList.map((file) =>
      fetch(file.download_url, { signal: AbortSignal.timeout(5000) }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
    )
  );

  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.warn(`[WAR ROOM] Failed to fetch ${fileList[i].name}: ${r.reason}`);
    }
  });

  // ── Step 3: merge — main KB spread at root, all others keyed by filename ──
  const mainIdx = fileList.findIndex((f) => f.name === MAIN_KB_FILENAME);
  if (mainIdx === -1 || results[mainIdx].status === "rejected") {
    console.error("[WAR ROOM] Main KB unavailable — using hardcoded fallback");
    return FALLBACK_KB_STR;
  }

  const combined = { ...results[mainIdx].value };
  results.forEach((r, i) => {
    if (i === mainIdx || r.status !== "fulfilled") return;
    const key = fileList[i].name.replace(/\.json$/, "");
    combined[key] = r.value;
  });

  const kbStr = JSON.stringify(combined);
  kbCache.data = kbStr;
  kbCache.timestamp = now;
  console.log(`[WAR ROOM] Knowledge base cached: ${fileList.length} files, ${kbStr.length} chars`);
  return kbStr;
}

// ── Boss lookup maps (player-specific prompt lines) ───────────────────────────
const WANTED_MONSTER = {
  Tank:     { name: "Frenzied Butcher", days: "Monday & Thursday"    },
  Missile:  { name: "Frankenstein",     days: "Tuesday & Friday"     },
  Aircraft: { name: "Mutant Bulldog",   days: "Wednesday & Saturday" },
};

const POLAR_BEAST = {
  Tank:     "Bear",
  Missile:  "Gorilla",
  Aircraft: "Mammoth",
};

// Hero-to-type map — mirrors SetupScreen.jsx HEROES constant
const HERO_TYPES = {
  Murphy: "Tank", Kimberly: "Tank", Marshall: "Tank", Williams: "Tank",
  Mason: "Tank", Violet: "Tank", Richard: "Tank", Monica: "Tank",
  Scarlett: "Tank", Stetmann: "Tank",
  DVA: "Aircraft", Carlie: "Aircraft", Schuyler: "Aircraft", Morrison: "Aircraft",
  Lucius: "Aircraft", Sarah: "Aircraft", Maxwell: "Aircraft", Cage: "Aircraft",
  Swift: "Missile", Tesla: "Missile", Fiona: "Missile", Adam: "Missile",
  Venom: "Missile", McGregor: "Missile", Elsa: "Missile", Kane: "Missile",
};

// Wanted Monster active on each day of the week (null = Sunday, no boss)
const WANTED_MONSTER_BY_DAY = {
  Monday:    "Frenzied Butcher",
  Tuesday:   "Frankenstein",
  Wednesday: "Mutant Bulldog",
  Thursday:  "Frenzied Butcher",
  Friday:    "Frankenstein",
  Saturday:  "Mutant Bulldog",
  Sunday:    null,
};

// ── Constants ─────────────────────────────────────────────────────────────────
const WEEK_PRIORITY = {
  1: "Build Titanium Alloy Factory, upgrade Furnace, capture first Dig Site",
  2: "Expand territory, upgrade Furnace, build Military Bases",
  3: "Choose faction (Rebels or Gendarmerie) \u2014 determines Rare Soil War opponents",
  4: "Rare Soil War begins \u2014 upgrade Alliance Furnace, coordinate with alliance",
  5: "Active war phase \u2014 attack/defense rotations",
  6: "Push Faction Award points, defend Alliance Furnace",
  7: "Faction Duel \u2014 4v4 Capitol Conquest, final ranking",
  8: "Season ends \u2014 Transfer Surge available based on rank",
};

const SHARDS_TO_NEXT = { 1: 25, 2: 50, 3: 100, 4: 300 };

// ── Hero parsing ──────────────────────────────────────────────────────────────
// Uses explicit Unicode codepoint U+2605 (\u2605) to avoid encoding ambiguity.
// Also accepts * as a fallback in case the star glyph is mangled in transit.
const STAR_PATTERN = /^(.+?)\s+\((\d)[\u2605*]\)$/;

function parseHeroes(heroes) {
  const parsed = [];
  for (const h of heroes) {
    const trimmed = h.trim();
    if (!trimmed || trimmed.toLowerCase() === "none") continue;
    const m = trimmed.match(STAR_PATTERN);
    if (m) {
      parsed.push({ name: m[1].trim(), stars: parseInt(m[2], 10), raw: trimmed });
    } else {
      console.warn(`[WAR ROOM] Hero string did not match star pattern: ${JSON.stringify(trimmed)}`);
      parsed.push({ name: trimmed, stars: null, raw: trimmed });
    }
  }
  return parsed;
}

// ── System prompt builder ─────────────────────────────────────────────────────
function buildSystemPrompt({ server, troop_type, furnace_level, heroes = [], season_week, kbStr }) {
  const parsedHeroes = parseHeroes(heroes);

  // Heroes block — one line per hero with exact star status + troop type label
  const heroLines = parsedHeroes.map((p) => {
    if (p.stars === null) {
      return `  - ${p.name}: star level could not be read (check profile)`;
    }
    const statusParts = [];
    if (p.stars >= 4) statusParts.push("Super Sensory UNLOCKED");
    if (p.stars >= 5) statusParts.push("Exclusive Weapon UNLOCKED");
    if (p.stars < 4) {
      statusParts.push(`needs ${SHARDS_TO_NEXT[p.stars] || 0} shards to reach 4\u2605 Super Sensory`);
    }
    const heroType = HERO_TYPES[p.name];
    const typeNote = heroType
      ? heroType !== troop_type
        ? ` [${heroType} hero \u2014 NOT ${troop_type}, do NOT recommend for ${troop_type} lineup]`
        : ` [${heroType} hero \u2014 matches player troop type]`
      : "";
    return `  - ${p.name}: ${p.stars}\u2605 \u2014 ${statusParts.join("; ")}${typeNote}`;
  });
  const heroesBlock = heroLines.length > 0 ? heroLines.join("\n") : "  (no heroes set)";

  // Explicit per-hero upgrade prohibitions for heroes already at 4★ or 5★
  const prohibitionLines = parsedHeroes
    .filter((p) => p.stars !== null && p.stars >= 4)
    .map((p) =>
      p.stars >= 5
        ? `  - ${p.name} is ALREADY at 5\u2605. Exclusive Weapon and Super Sensory are BOTH UNLOCKED. ` +
          `DO NOT suggest upgrading ${p.name}'s stars \u2014 they are maxed.`
        : `  - ${p.name} is ALREADY at 4\u2605. Super Sensory is UNLOCKED. ` +
          `DO NOT suggest ${p.name} needs to reach 4\u2605 \u2014 they are already there.`
    );
  const prohibitionsBlock =
    prohibitionLines.length > 0
      ? prohibitionLines.join("\n")
      : "  (all heroes below 4\u2605 \u2014 upgrades may be recommended)";

  const weekLine =
    season_week && WEEK_PRIORITY[season_week]
      ? `Current Season Week: ${season_week}/8 \u2014 ${WEEK_PRIORITY[season_week]}`
      : "";

  const beastTarget    = POLAR_BEAST[troop_type]    || "Bear";
  const wantedMonster  = WANTED_MONSTER[troop_type] || { name: "Unknown", days: "check schedule" };

  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const activeBossToday = WANTED_MONSTER_BY_DAY[today] ?? null;
  const bossStatusToday = activeBossToday
    ? activeBossToday === wantedMonster.name
      ? `TODAY (${today}) IS YOUR BONUS DAY: ${wantedMonster.name} is active \u2014 attack now for +50% ${troop_type} damage!`
      : `Today (${today}): ${activeBossToday} is active (not your bonus boss). Your next bonus days: ${wantedMonster.days}.`
    : `Today (${today}) is Sunday \u2014 no Wanted Monster is active today.`;

  return `You are WAR ROOM, a tactical AI advisor for Last War: Survival game.

=================================================================
COMMANDER PROFILE \u2014 VERIFIED FACTS \u2014 DO NOT CONTRADICT THESE
=================================================================
Server: ${server}
Primary Troop Type: ${troop_type}
Furnace Level: ${furnace_level}
Today: ${today}
${weekLine}

HERO ROSTER \u2014 EXACT CURRENT STAR LEVELS (THIS IS GROUND TRUTH):
${heroesBlock}

EXPLICIT UPGRADE PROHIBITIONS (based on verified hero data above):
${prohibitionsBlock}

CRITICAL HERO RULE: The star counts above are exact facts from the player's profile.
- NEVER tell a hero to "reach 4\u2605" if they are already at 4\u2605 or 5\u2605.
- NEVER tell a hero to "get 5\u2605" if they are already at 5\u2605.
- ONLY suggest star upgrades for heroes whose current stars are below the next milestone (4\u2605 or 5\u2605).
=================================================================

KNOWLEDGE BASE:
${kbStr}

BOSS SCHEDULE FOR THIS PLAYER (${troop_type}) \u2014 ALWAYS REFERENCE IN BOSS-RELATED ANSWERS:
- ${bossStatusToday}
- Your Wanted Monster (${troop_type} bonus): ${wantedMonster.name} on ${wantedMonster.days} \u2014 +50% damage
- Polar Beast target: ${beastTarget} (weak to ${troop_type}) \u2014 always attack ${beastTarget} Dig Sites
- Doom Walker: kill the highest-level one available each day for a coal bonus (Season 2)
Rule: Whenever boss strategy, farming, or event schedules are mentioned, Claude MUST state today's active boss status and the player's Wanted Monster days (${wantedMonster.days}).

BEAST TARGETING (CRITICAL \u2014 never get these wrong):
- Bear is weak to Tank   \u2192 Tank players ALWAYS attack BEAR dig sites
- Gorilla is weak to Missile \u2192 Missile players ALWAYS attack GORILLA dig sites
- Mammoth is weak to Aircraft \u2192 Aircraft players ALWAYS attack MAMMOTH dig sites
This player uses ${troop_type} \u2192 they MUST target: ${beastTarget} dig sites ONLY.

GENERAL HERO MILESTONES (apply only to heroes NOT yet at these levels):
- 4\u2605 unlocks Super Sensory: +20% HP/Attack/Defense, +10% skill speed
- 5\u2605 unlocks Exclusive Weapon
- Shards needed per level: 1\u2605=25, 2\u2605=50, 3\u2605=100, 4\u2605=300, 5\u2605=500

SCREENSHOT / IMAGE ANALYSIS RULES:
- Formation screenshots show very small vehicle icons that are NOT reliably distinguishable by visual appearance alone. DO NOT guess or infer troop types from vehicle visuals in any screenshot.
- This player's troop type is ${troop_type} (from their profile). When analysing a formation screenshot, assume ALL heroes and troops shown belong to the ${troop_type} type unless the user explicitly states otherwise in their message.
- If troop type cannot be confirmed from the image and the user has not specified it, default to the profile value (${troop_type}).

INSTRUCTIONS: Answer in the same language the user writes in (English or Russian). Be direct, specific, and tactical. Reference the player's troop type (${troop_type}), furnace level (${furnace_level}), and actual hero stars from the profile above. Recommend the correct beast type for their troop. Keep answers under 200 words. Format with clear sections when helpful.`;
}

// ── Notion logging (awaited with 2s timeout) ──────────────────────────────────
async function logToNotion({ question, answer, server, troop_type, season_week, furnace_level, heroes, image_base64 }) {
  const token = process.env.NOTION_TOKEN;
  const dbId  = process.env.NOTION_DATABASE_ID || "a52c8cc8-cf7a-4f17-b90c-3b0d9f7e98a6";

  if (!token) {
    console.warn("[NOTION] Skipped — NOTION_TOKEN env var not set");
    return;
  }
  console.log(`[NOTION] Logging query to database ${dbId} ...`);

  const heroesStr = Array.isArray(heroes)
    ? heroes.filter((h) => h && h.toLowerCase() !== "none").join(", ")
    : String(heroes || "");

  const payload = {
    parent: { database_id: dbId },
    properties: {
      Question:        { title:     [{ text: { content: String(question || "").slice(0, 2000) } }] },
      Server:          { rich_text: [{ text: { content: String(server || "") } }] },
      "Troop Type":    { select:    { name: troop_type || "Unknown" } },
      "Season Week":   { number:    season_week   ? Number(season_week)   : null },
      "Furnace Level": { number:    furnace_level  ? Number(furnace_level)  : null },
      Heroes:          { rich_text: [{ text: { content: heroesStr.slice(0, 2000) } }] },
      "Has Image":     { checkbox:  Boolean(image_base64) },
      Timestamp:       { date:      { start: new Date().toISOString() } },
      Answer:          { rich_text: [{ text: { content: String(answer || "").slice(0, 2000) } }] },
      Language:        { select:    { name: /[\u0400-\u04FF]/.test(question) ? "Russian" : "English" } },
    },
  };

  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization:    `Bearer ${token}`,
      "Content-Type":   "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify(payload),
  });

  const body = await res.text();
  if (res.ok) {
    console.log(`[NOTION] Entry created OK — page id: ${JSON.parse(body).id}`);
  } else {
    console.error(`[NOTION] API error ${res.status} ${res.statusText}`);
    console.error(`[NOTION] Response body: ${body}`);
    console.error(`[NOTION] Payload sent: ${JSON.stringify(payload, null, 2)}`);
  }
}

// ── CORS headers ──────────────────────────────────────────────────────────────
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

// ── Handler ───────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  const { question, server, troop_type, furnace_level, heroes, season_week, image_base64 } = body;

  if (!question) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "question is required" }) };
  }

  // Fetch (or serve from cache) the combined knowledge base
  const kbStr = await fetchKnowledgeBase();

  const systemPrompt = buildSystemPrompt({ server, troop_type, furnace_level, heroes, season_week, kbStr });

  // Build user message content (with optional image attachment)
  const userContent = image_base64
    ? [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image_base64 } },
        { type: "text", text: question },
      ]
    : question;

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    const data = await anthropicRes.json();

    if (!anthropicRes.ok) {
      console.error("[WAR ROOM] Anthropic error:", data);
      return {
        statusCode: anthropicRes.status,
        headers: CORS,
        body: JSON.stringify({ error: data.error?.message || "Anthropic API error" }),
      };
    }

    const response = data.content?.[0]?.text || "";

    // Await Notion log with 2s cap so the function doesn't exit before it completes.
    // The timeout resolves (not rejects) so a slow/failed Notion call never blocks the response.
    const notionTimeout = new Promise((resolve) => setTimeout(resolve, 2000));
    await Promise.race([
      logToNotion({ question, answer: response, server, troop_type, season_week, furnace_level, heroes, image_base64 }),
      notionTimeout,
    ]).catch((err) => console.error(`[NOTION] Unexpected error: ${err.message}`));

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ response }) };
  } catch (err) {
    console.error("[WAR ROOM] Fetch error:", err);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: `Tactical advisor offline: ${err.message}` }),
    };
  }
};
