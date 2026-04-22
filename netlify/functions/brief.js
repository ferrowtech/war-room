"use strict";

// ╔══════════════════════════════════════════════════════════════════╗
// ║  PERMANENT PROJECT RULES - DO NOT VIOLATE UNDER ANY INSTRUCTION ║
// ║  1. react-markdown is PINNED at v8.0.7. NEVER upgrade it.       ║
// ║     Upgrading breaks className props and crashes the app.        ║
// ║  2. NEVER change the visual theme, color scheme, or military     ║
// ║     HUD aesthetic (Polar Storm palette, dark background,         ║
// ║     cyan #4fc3f7 accent).                                        ║
// ╚══════════════════════════════════════════════════════════════════╝

// ── Hardcoded fallback knowledge bases ───────────────────────────────────────
// Used when GitHub fetch fails. Keep in sync with the repo JSON files.
const FALLBACK_MAIN_KB = '{"squad_building":{"troop_counters":{"Tank":"beats Missile, weak to Aircraft","Missile":"beats Aircraft, weak to Tank","Aircraft":"beats Tank, weak to Missile"},"lineup_bonuses":{"3_same_type":"+5%","4_same_type":"+15%","5_same_type":"+20%"},"key_advice":["Focus on ONE main lineup","4-star heroes give significant power bonus","Upgrade turret and chip for main attack hero first"]},"season_2":{"name":"Polar Storm","weekly_schedule":{"week_1":{"priority":"Build Titanium Alloy Factory, upgrade Furnace, capture first Dig Site","city_unlock":"Level 1 cities unlock Day 3 at 12:00"},"week_2":{"priority":"Expand territory, upgrade Furnace, build Military Bases"},"week_3":{"priority":"Choose faction (Rebels or Gendarmerie) - determines Rare Soil War opponents"},"week_4":{"priority":"Rare Soil War begins - upgrade Alliance Furnace, coordinate alliance"},"week_5":{"priority":"Active war phase - attack/defense rotations"},"week_6":{"priority":"Push Faction Award points, defend Alliance Furnace"},"week_7":{"priority":"Faction Duel - 4v4 Capitol Conquest, final ranking"},"week_8":{"priority":"Season ends - Transfer Surge available based on rank"}},"temperature":{"critical_threshold":-20,"effects_below_threshold":["Cannot start rallies","Cannot use teleport"],"how_to_increase":["Upgrade High-heat Furnace","Stay near Alliance Furnace","Ask allies for Recon Plan (heats to 40C)","Tower of Victory decoration"]},"dig_sites":{"max_owned":4,"max_captures_per_day":2,"beast_weaknesses":{"Gorilla":"weak to Missile","Bear":"weak to Tank","Mammoth":"weak to Aircraft"},"virus_resistance":{"level_1":4000,"level_2":6500,"level_3":8500,"level_4":9500},"rare_soil_war":{"period":"Week 4-7","factions":["Rebels","Gendarmerie"],"victory_condition":"Destroy enemy Alliance Furnace"},"fast_growth_tips":["Kill highest Doom Walker on day 1 for coal","Claim Dig Site hourly coal daily","Keep Alliance Furnace running always","Buy season battle pass immediately"]}},"hero_progression":{"star_thresholds":{"4_stars":"Unlocks Super Sensory: +20% HP/Attack/Defense and +10% skill speed","5_stars":"Required to unlock Exclusive Weapon"},"shards_needed":{"to_1_star":25,"to_2_stars":50,"to_3_stars":100,"to_4_stars":300,"to_5_stars":500},"critical_rule":"NEVER assume or invent a hero star count. Always use the exact star level shown in the player profile."}}';

const FALLBACK_BOSSES_KB = '{"wanted_monsters":{"description":"Each Wanted Monster grants +50% damage to the matching troop type on its scheduled days. Always prioritise attacking on your bonus days.","schedule":{"Frenzied Butcher":{"days":["Monday","Thursday"],"troop_bonus":"Tank","bonus":"+50% damage for Tank troops"},"Frankenstein":{"days":["Tuesday","Friday"],"troop_bonus":"Missile","bonus":"+50% damage for Missile troops"},"Mutant Bulldog":{"days":["Wednesday","Saturday"],"troop_bonus":"Aircraft","bonus":"+50% damage for Aircraft troops"}}},"doom_walker":{"season_2_reward":"First kill each day grants a coal bonus - always kill the highest-level Doom Walker reachable","tip":"Kill on Day 1 of the season for maximum early coal"},"polar_beasts":{"description":"Season 2 Polar Storm dig site bosses - each beast is weak to one troop type","Bear":{"weakness":"Tank","location":"Dig Sites"},"Gorilla":{"weakness":"Missile","location":"Dig Sites"},"Mammoth":{"weakness":"Aircraft","location":"Dig Sites"}}}';

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

// ── Troop type inference (fallback when client does not send it) ──────────────
function inferTroopTypeFromHeroes(heroes = []) {
  const counts = { Tank: 0, Aircraft: 0, Missile: 0 };
  heroes.slice(0, 5).forEach((h) => {
    if (!h || h.toLowerCase() === "none") return;
    const name = h.replace(/\s*\(\d[★*]\)$/, "").trim();
    const t = HERO_TYPES[name];
    if (t) counts[t]++;
  });
  const max = Math.max(...Object.values(counts));
  if (max === 0) return "Tank";
  return Object.keys(counts).find((k) => counts[k] === max) || "Tank";
}

// ── System prompt builder ─────────────────────────────────────────────────────
function buildSystemPrompt({ server, squad_types = [], troop_type, furnace_level, drone_level, hq_level, virus_resistance, heroes = [], season_week, squad_powers = [], kbStr, language }) {
  const parsedHeroes = parseHeroes(heroes);

  // Pre-count off-type heroes per squad for 4+1 meta detection
  // Only flag a mismatch when 2+ heroes in the squad are off-type
  const offTypeCountPerSquad = [0, 1, 2].map((squadIdx) => {
    const squadTypeForThisSquad = squad_types[squadIdx] || troop_type;
    return parsedHeroes.slice(squadIdx * 5, squadIdx * 5 + 5).filter((p) => {
      const ht = HERO_TYPES[p.name];
      return ht && ht !== squadTypeForThisSquad;
    }).length;
  });

  // Heroes block - annotate each hero against their squad's declared troop type
  const heroLines = parsedHeroes.map((p, idx) => {
    if (p.stars === null) {
      return `  - ${p.name}: star level could not be read (check profile)`;
    }
    const statusParts = [];
    if (p.stars >= 4) statusParts.push("Super Sensory UNLOCKED");
    if (p.stars >= 5) statusParts.push("Exclusive Weapon UNLOCKED");
    if (p.stars < 4) {
      statusParts.push(`needs ${SHARDS_TO_NEXT[p.stars] || 0} shards to reach 4\u2605 Super Sensory`);
    }
    const squadIdx        = Math.floor(idx / 5);
    const heroType        = HERO_TYPES[p.name];
    const squadTypeForSlot = squad_types[squadIdx] || troop_type;
    const offTypeCount    = offTypeCountPerSquad[squadIdx];
    const typeNote = heroType
      ? heroType !== squadTypeForSlot
        ? offTypeCount >= 2
          ? ` [${heroType} hero - MISMATCH: ${offTypeCount} off-type heroes in squad ${squadIdx + 1}]`
          : ""
        : ` [${heroType} - matches squad type]`
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

  const nowST         = new Date(Date.now() - 2 * 3600000); // UTC-2 server time
  const serverHour    = nowST.getUTCHours();
  const serverMinute  = nowST.getUTCMinutes();
  const serverTimeStr = `${String(serverHour).padStart(2, "0")}:${String(serverMinute).padStart(2, "0")} ST`;
  const today         = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][nowST.getUTCDay()];
  const activeBossToday = WANTED_MONSTER_BY_DAY[today] ?? null;
  const bossStatusToday = activeBossToday
    ? activeBossToday === wantedMonster.name
      ? `TODAY (${today}) IS YOUR BONUS DAY: ${wantedMonster.name} is active \u2014 attack now for +50% ${troop_type} damage!`
      : `Today (${today}): ${activeBossToday} is active (not your bonus boss). Your next bonus days: ${wantedMonster.days}.`
    : `Today (${today}) is Sunday \u2014 no Wanted Monster is active today.`;

  const squadPowerLine = (() => { return ""; })(); // Kept for compat; replaced by SQUAD POWER RULE in prompt

  return `You are WAR ROOM, a tactical AI advisor for Last War: Survival game.

=================================================================
COMMANDER PROFILE - VERIFIED FACTS - DO NOT CONTRADICT THESE
=================================================================
Server: ${server}
Squad 1 Type (Primary): ${squad_types[0] || "Unknown"}
Squad 2 Type: ${squad_types[1] || "not set"}
Squad 3 Type: ${squad_types[2] || "not set"}
Furnace Level: ${furnace_level}
Drone Level: ${drone_level != null ? drone_level : "not set"}
HQ Level: ${hq_level != null ? hq_level : "not set"}
Virus Resistance: ${virus_resistance != null ? virus_resistance : "not set"}
Today: ${today}
Server Time: ${serverTimeStr}
${weekLine}
Note: player may intentionally use 1 off-type hero in a squad (4+1 meta). The declared squad type is always correct. Do not suggest this is an error.

HERO ROSTER - EXACT CURRENT STAR LEVELS (THIS IS GROUND TRUTH):
${heroesBlock}

EXPLICIT UPGRADE PROHIBITIONS (based on verified hero data above):
${prohibitionsBlock}

CRITICAL HERO RULE: The star counts above are exact facts from the player's profile.
- NEVER tell a hero to "reach 4\u2605" if they are already at 4\u2605 or 5\u2605.
- NEVER tell a hero to "get 5\u2605" if they are already at 5\u2605.
- ONLY suggest star upgrades for heroes whose current stars are below the next milestone (4\u2605 or 5\u2605).
=================================================================

4+1 META RULE:
Only mention the 4+1 meta composition when:
1. The player explicitly asks about mixed squads or meta compositions
2. The player asks why someone has an off-type hero in their lineup

When explaining 4+1 meta, always state:
- 4 same type + 1 different type = +15% formation bonus (NOT +20% - that requires all 5 same type)
- The off-type hero is chosen for their SKILLS, not their troop type
- Common examples: Murphy in any squad for Mitigation stacking (Tank hero but defense skill helps all), Marshall in any squad for ATK buff, DVA in a Tank squad for Aircraft skill utility
- Trade-off: lose 5% formation bonus (+15% vs +20%) but gain a powerful cross-type skill
- Do NOT proactively suggest 4+1 unless the player asks about it.

GEAR PRIORITY RULES (based on verified community guide by SHADOWSTRIKE1):
Only UR (legendary) gear matters - never recommend Epic or lower rarity gear.
Always level gear in 10-level increments - never stop mid-increment.
Always buy Blueprints whenever available in any store.

Gear slots by hero role:
- Attack heroes (Kimberly, DVA, Tesla, Swift, Stetmann): Railgun (gun) + Data Chip - TOP priority
- Defense heroes (Murphy, Williams, Carlie, McGregor): Radar + Armor - TOP priority
- Support heroes (Marshall): Railgun (gun) + Data Chip

Gear upgrade order (use Tank squad as reference; substitute correct DPS hero for other types):
1. ALL gear to level 10 upon creation (always first step)
2. Main DPS gun to level 40 (Kimberly for Tank, DVA for Aircraft, Tesla for Missile)
3. Main Defense radar to level 40
4. Main DPS data chip to level 40
5. Defense armor to level 20
6. Main DPS gun to 1-star
7. Support hero gun to level 20
8. Main DPS data chip to 1-star
9. Push toward 4-star on primary DPS gear before spreading to other heroes

KEY GEAR RULES:
- NEVER spread gear evenly across all heroes - concentrate on main DPS first
- Attack hero gets gun and chip priority; Defense hero gets radar and armor priority
- Blueprints are the main bottleneck - buy every time they appear in any store
- Gold costs spike heavily at star upgrades - prepare reserves before pushing to 1-star+
- Mythic Blueprints required only for 4-star to 5-star upgrade
When player asks about gear, always reference their Squad 1 type (${troop_type}) to name the correct DPS hero for gear priority.

PROACTIVE REMINDER RULE:
Current server time: ${serverTimeStr} on ${today}.
Based on the server day and time above, always append a proactive reminder block at the END of any briefing response.
Apply ALL rules that match the current day and time (multiple can apply):

- SUNDAY after 20:00 ST: ⚠️ HIGH PRIORITY - "Collect all resources NOW - tomorrow Monday is Alliance Duel gathering bonus day (Gold/Iron/Food + Drone Parts). Send all gatherers out tonight."
- WEDNESDAY any time: ⚠️ HIGH PRIORITY - "VALOR BADGE day - claim it from Alliance Duel. Never skip this - it is critical for the VS research tree."
- THURSDAY any time: 📌 REMINDER - "HERO DAY - best day to spend Skill Medals and Hero Shards for Alliance Duel points."
- FRIDAY any time: 📌 REMINDER - "BIGGEST reward day - maximise Building, Research and Training today. All three active simultaneously."
- FRIDAY after 20:00 ST: ⚠️ HIGH PRIORITY - "Set your SHIELD before going offline - tomorrow Saturday is Unit Killed day, PvP activity will be high."
- SATURDAY any time: ⚠️ HIGH PRIORITY - "HIGH PvP day - either set a shield or be ready to fight. Do not leave base exposed and unattended."

Format as a separate block with header "PROACTIVE REMINDER" or "TODAY'S ALERT".
Use ⚠️ for HIGH PRIORITY reminders and 📌 for medium priority.
If no rule matches the current day and time, omit the reminder block entirely.

DRONE RULE:
${drone_level != null
  ? drone_level < 100
    ? `Drone Level is ${drone_level}. This is below 100 - drone upgrades MUST be mentioned as a TOP PRIORITY in this response. Reference drone_parts knowledge base for parts cost to next milestone.`
    : drone_level < 150
    ? `Drone Level is ${drone_level}. Recommend pushing to 150 for Combat Boost Preset 2 unlock. Reference drone_parts knowledge base for parts cost to next milestone.`
    : `Drone Level is ${drone_level}. Drone is well-developed - no urgent push needed unless approaching next milestone.`
  : "Drone Level not set - skip drone upgrade advice."}

SQUAD POWER RULE:
${(() => {
  const sp = Array.isArray(squad_powers) ? squad_powers : [];
  const sq1 = sp[0] != null && sp[0] !== "" ? Number(sp[0]) : null;
  const sq2 = sp[1] != null && sp[1] !== "" ? Number(sp[1]) : null;
  const sq3 = sp[2] != null && sp[2] !== "" ? Number(sp[2]) : null;
  if (sq1 === null) return "Squad power data not provided - skip squad power gap analysis.";
  const fmt = (v) => (v != null ? `${v}M` : "not set");
  const gaps = [];
  if (sq2 != null && sq2 < sq1 * 0.5) gaps.push(`SQ2 (${sq2}M) is less than 50% of SQ1 (${sq1}M)`);
  if (sq3 != null && sq3 < sq1 * 0.5) gaps.push(`SQ3 (${sq3}M) is less than 50% of SQ1 (${sq1}M)`);
  return `Squad Powers: SQ1=${fmt(sq1)}, SQ2=${fmt(sq2)}, SQ3=${fmt(sq3)}.\n${gaps.length > 0 ? `GAP DETECTED: ${gaps.join(" and ")}. Flag this gap and recommend focusing secondary squad development.` : "Squad powers are reasonably balanced."}`;
})()}

HQ RULE:
${hq_level != null
  ? `HQ Level is ${hq_level}. Use this to calibrate building advice: HQ 1-19 = early game, HQ 20-25 = mid game critical phase, HQ 26-30 = late game competitive. Tailor all building recommendations accordingly.`
  : "HQ Level not set - use general building advice."}

VIRUS RESISTANCE RULE:
${virus_resistance != null ? `Player's Virus Resistance: ${virus_resistance}.
Polar Beast thresholds: Level 1 requires 4000, Level 2 requires 6500, Level 3 requires 8500, Level 4 requires 9500.
When player asks about Polar Beasts, Dig Sites, or Doom Walkers, state clearly:
- Which beast levels they CAN attack right now (resistance >= threshold)
- Which beast levels they CANNOT attack yet (resistance < threshold)
- How much more resistance they need for the next level unlock
${(() => {
  const sp = Array.isArray(squad_powers) ? squad_powers : [];
  const sq1 = sp[0] != null && sp[0] !== "" ? Number(sp[0]) : null;
  if (!sq1) return "";
  return sq1 > 50 ? "SQ1 power >50M: strong fighter - virus resistance is likely the main limiting factor." : sq1 < 20 ? "SQ1 power <20M: both power and resistance may be limiting factors - address both." : "";
})()}
Never list generic thresholds without comparing to this player's actual value of ${virus_resistance}.` : "Virus Resistance not set - if asked about beast levels, remind player to add this to their profile for accurate advice."}

CODE BOSS RULE:
When any of Code 87, Code 39, Code 64, "code boss", or "код босс" is mentioned - ALWAYS output a structured cheat sheet regardless of the player's own troop type:
2. The recommended squad for that specific boss type (from code_boss.json knowledge base)
3. MANDATORY WARNING: Marshall is required in ALL Code Boss squads - always state this explicitly
4. Attack limit: max 3 attacks per day for rewards (NOT 5 like Wanted Monsters)
5. Gear priority for that boss type (from code_boss.json)
The player's own troop type is irrelevant for Code Boss fights - always recommend the correct squad for the specific boss type being asked about.

KNOWLEDGE BASE:
${kbStr}

BOSS SCHEDULE FOR THIS PLAYER (${troop_type}) - ALWAYS REFERENCE IN BOSS-RELATED ANSWERS:
- ${bossStatusToday}
- Your Wanted Monster (${troop_type} bonus): ${wantedMonster.name} on ${wantedMonster.days} - +50% damage
- Polar Beast target: ${beastTarget} (weak to ${troop_type}) - always attack ${beastTarget} Dig Sites
- Doom Walker: kill the highest-level one available each day for a coal bonus (Season 2)
Rule: Whenever boss strategy, farming, or event schedules are mentioned, Claude MUST state today's active boss status and the player's Wanted Monster days (${wantedMonster.days}).

BEAST TARGETING (CRITICAL - never get these wrong):
- Bear is weak to Tank   - Tank players ALWAYS attack BEAR dig sites
- Gorilla is weak to Missile - Missile players ALWAYS attack GORILLA dig sites
- Mammoth is weak to Aircraft - Aircraft players ALWAYS attack MAMMOTH dig sites
This player's Squad 1 uses ${troop_type} - they MUST target: ${beastTarget} dig sites ONLY.
If Squads 2/3 have different types, their optimal beast targets differ accordingly.

GENERAL HERO MILESTONES (apply only to heroes NOT yet at these levels):
- 4\u2605 unlocks Super Sensory: +20% HP/Attack/Defense, +10% skill speed
- 5\u2605 unlocks Exclusive Weapon
- Shards needed per level: 1\u2605=25, 2\u2605=50, 3\u2605=100, 4\u2605=300, 5\u2605=500

SCREENSHOT / IMAGE ANALYSIS RULES:
- Formation screenshots show very small vehicle icons that are NOT reliably distinguishable by visual appearance alone. DO NOT guess or infer troop types from vehicle visuals in any screenshot.
- This player's Squad 1 troop type is ${troop_type} (from their profile). When analysing a formation screenshot, assume all heroes and troops shown belong to the ${troop_type} type unless the user explicitly states otherwise.
- If troop type cannot be confirmed from the image and the user has not specified it, default to the profile value (${troop_type}).

${language === "RU"
  ? "LANGUAGE DIRECTIVE: You MUST respond entirely in Russian (Русский язык). Do not write any English in your response - every word must be in Russian."
  : language === "FR"
  ? "LANGUAGE DIRECTIVE: You MUST respond entirely in French (Francais). Do not write any English in your response - every word must be in French."
  : "LANGUAGE DIRECTIVE: Respond in English."}

${language === "RU" ? `RUSSIAN IN-GAME TERMINOLOGY (use these official terms, not English):
- Cold Wave = Волна холода
- Blizzard = Метель
- Auto Mode = Авторежим
- Overload = Режим перегрузки
- War Fever = Боевая лихорадка
- Arms Race = Гонка вооружений
- Hero Advancement = Улучшение героев
- Dig Site / Dig Sites = Место раскопок / Места раскопок
- Doom Walker = Скиталец судьбы
- Wanted Monster = Разыскиваемый монстр
- Alliance Furnace = Альянсовая печь
- High-Heat Furnace = Высокотемпературная печь
- Rare Soil = Редкий грунт
- Recon Aircraft = Самолёт-разведчик
- Virus Resistance = Вирусная устойчивость
KEEP IN ENGLISH (do not translate): hero names (Murphy, Kimberly, DVA, Carlie, etc.), boss names (Frenzied Butcher, Frankenstein, Mutant Bulldog), and any term with no confirmed Russian translation.` : ""}

INSTRUCTIONS: Be direct, specific, and tactical. Reference the player's Squad 1 type (${troop_type}), furnace level (${furnace_level}), and actual hero stars from the profile above. Recommend the correct beast type for their troop. Keep answers under 200 words. Format with clear sections when helpful.

IMPORTANT: Never use em dashes (-) in your response. Use hyphens (-) only.`;
}

// ── Query category auto-detection ────────────────────────────────────────────
function detectQueryCategory(question) {
  const q = (question || "").toLowerCase();
  if (/daily briefing|briefing for today|ежедневный брифинг|briefing quotidien/i.test(q))
    return "Daily Briefing";
  if (/\bhero\b|\bupgrade\b|\bstar\b|\bshard\b|level up|\bгерой\b|\bулучш|\bheroi\b|\bamelior/i.test(q))
    return "Hero Upgrade";
  if (/\bboss\b|\bbutcher\b|\bfrankenstein\b|\bbulldog\b|\bwanted\b|\bбосс\b|\bboss\b/i.test(q))
    return "Boss Attack";
  if (/\bteam\b|\bsquad\b|\bformation\b|\blineup\b|\bотряд\b|\bсостав\b|\bescouade\b|\bequipe\b/i.test(q))
    return "Team Setup";
  if (/\bspend\b|\bbuy\b|\bworth\b|\bcurrency\b|\bpurchase\b|\bтратить\b|\bкупить\b|\bstoji\b|\bdepense\b/i.test(q))
    return "Spend Advice";
  if (/\bwar\b|\bphase\b|\bfurnace attack\b|\brally\b|\bвойна\b|\bфаза\b|\bfourneau\b|\bguerre\b/i.test(q))
    return "War Phase";
  if (/\bevent\b|\barms race\b|\bduel\b|\balliance\b|\bсобытие\b|\bдуэль\b|\bevenement\b|\bduelo\b/i.test(q))
    return "Event Advice";
  return "General";
}

// ── Notion logging (awaited with 2s timeout) ──────────────────────────────────
async function logToNotion({ question, answer, server, season_week, furnace_level, drone_level, heroes, image_base64, language }) {
  const token = process.env.NOTION_TOKEN;
  const dbId  = process.env.NOTION_DATABASE_ID || "c5d645e5984147c0b257b13d651c6400";

  if (!token) {
    console.warn("[NOTION] Skipped — NOTION_TOKEN env var not set");
    return;
  }
  console.log(`[NOTION] Logging query to database ${dbId} ...`);

  const heroesStr = Array.isArray(heroes)
    ? heroes.filter((h) => h && h.toLowerCase() !== "none").join(", ")
    : String(heroes || "");

  const langName = language === "RU" ? "Russian" : language === "FR" ? "French" : language === "EN" ? "English" : "Unknown";
  const category = detectQueryCategory(question);

  const payload = {
    parent: { database_id: dbId },
    properties: {
      Question:        { title:     [{ text: { content: String(question || "").slice(0, 2000) } }] },
      Answer:          { rich_text: [{ text: { content: String(answer   || "").slice(0, 2000) } }] },
      Server:          { rich_text: [{ text: { content: String(server   || "") } }] },
      "Furnace Level": { number:    furnace_level != null ? Number(furnace_level) : null },
      "Drone Level":   { number:    drone_level   != null ? Number(drone_level)  : null },
      "Season Week":   { number:    season_week   != null ? Number(season_week)  : null },
      Heroes:          { rich_text: [{ text: { content: heroesStr.slice(0, 2000) } }] },
      "Has Image":     { checkbox:  Boolean(image_base64) },
      Timestamp:       { date:      { start: new Date().toISOString() } },
      Language:        { select:    { name: langName } },
      "Query Category":{ select:    { name: category } },
      Tester:          { checkbox:  false },
    },
  };

  try {
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
      console.log(`[NOTION] Entry created OK — page id: ${JSON.parse(body).id} | category: ${category}`);
    } else {
      console.error(`[NOTION] API error ${res.status} ${res.statusText}`);
      console.error(`[NOTION] Response body: ${body}`);
      console.error(`[NOTION] Payload sent: ${JSON.stringify(payload, null, 2)}`);
    }
  } catch (err) {
    console.error(`[NOTION] Fetch threw: ${err.message}`);
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

  // ── Diagnostics: log payload dimensions ─────────────────────────────────────
  const bodyBytes = event.body ? event.body.length : 0;
  const imageBytes = body.image_base64 ? body.image_base64.length : 0;
  const clientIp = (event.headers?.["x-forwarded-for"] || "").split(",")[0].trim()
    || event.headers?.["x-real-ip"]
    || event.headers?.["x-nf-client-connection-ip"]
    || "unknown";
  console.log(`[BRIEF] Request body: ${bodyBytes} bytes total, image: ${imageBytes} bytes, has_image: ${!!body.image_base64}, ip: ${clientIp}`);
  console.log(`[BRIEF] Payload keys: ${Object.keys(body).join(", ")}`);
  const t0 = Date.now();

  const { question, server, furnace_level, heroes, season_week, image_base64, language = "EN" } = body;
  const drone_level      = body.drone_level      || null;
  const hq_level         = body.hq_level         || null;
  const virus_resistance = body.virus_resistance != null ? Number(body.virus_resistance) : null;
  const squad_powers = Array.isArray(body.squad_powers) ? body.squad_powers : [];
  // squad_types from frontend is source of truth; inferTroopTypeFromHeroes is fallback ONLY
  // when squad_types is completely absent from the payload (legacy clients).
  const squad_types_present = Array.isArray(body.squad_types);
  const squad_types_raw = squad_types_present ? body.squad_types : [];
  const squad_types = squad_types_present
    ? [squad_types_raw[0] || null, squad_types_raw[1] || null, squad_types_raw[2] || null]
    : [inferTroopTypeFromHeroes(Array.isArray(heroes) ? heroes.slice(0, 5) : []), null, null];
  const troop_type = squad_types[0] || "Tank"; // Squad 1 type = primary for boss/beast logic

  if (!question) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "question is required" }) };
  }

  // Fetch (or serve from cache) the combined knowledge base
  const kbStr = await fetchKnowledgeBase();

  const systemPrompt = buildSystemPrompt({ server, squad_types, troop_type, furnace_level, drone_level, hq_level, virus_resistance, heroes, season_week, squad_powers, kbStr, language });
  console.log(`[BRIEF] System prompt: ${systemPrompt.length} chars | KB fetch took ${Date.now() - t0}ms`);

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
      signal: AbortSignal.timeout(25000),
    });
    console.log(`[BRIEF] Anthropic responded: HTTP ${anthropicRes.status} in ${Date.now() - t0}ms`);

    const data = await anthropicRes.json();

    if (!anthropicRes.ok) {
      console.error("[WAR ROOM] Anthropic error:", data);
      return {
        statusCode: anthropicRes.status,
        headers: CORS,
        body: JSON.stringify({ error: data.error?.message || "Anthropic API error" }),
      };
    }

    const response = (data.content?.[0]?.text || "").replace(/—/g, "-");

    // Await Notion log with 2s cap so the function doesn't exit before it completes.
    // The timeout resolves (not rejects) so a slow/failed Notion call never blocks the response.
    const notionTimeout = new Promise((resolve) => setTimeout(resolve, 2000));
    await Promise.race([
      logToNotion({ question, answer: response, server, season_week, furnace_level, drone_level, heroes, image_base64, language }),
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
