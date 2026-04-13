"use strict";

// ── Knowledge base ──────────────────────────────────────────────────────────
const KNOWLEDGE_BASE = '{"squad_building":{"troop_counters":{"Tank":"beats Missile, weak to Aircraft","Missile":"beats Aircraft, weak to Tank","Aircraft":"beats Tank, weak to Missile"},"lineup_bonuses":{"3_same_type":"+5%","4_same_type":"+15%","5_same_type":"+20%"},"key_advice":["Focus on ONE main lineup","4-star heroes give significant power bonus","Upgrade turret and chip for main attack hero first"]},"season_2":{"name":"Polar Storm","weekly_schedule":{"week_1":{"priority":"Build Titanium Alloy Factory, upgrade Furnace, capture first Dig Site","city_unlock":"Level 1 cities unlock Day 3 at 12:00"},"week_2":{"priority":"Expand territory, upgrade Furnace, build Military Bases"},"week_3":{"priority":"Choose faction (Rebels or Gendarmerie) - determines Rare Soil War opponents"},"week_4":{"priority":"Rare Soil War begins - upgrade Alliance Furnace, coordinate alliance"},"week_5":{"priority":"Active war phase - attack/defense rotations"},"week_6":{"priority":"Push Faction Award points, defend Alliance Furnace"},"week_7":{"priority":"Faction Duel - 4v4 Capitol Conquest, final ranking"},"week_8":{"priority":"Season ends - Transfer Surge available based on rank"}},"temperature":{"critical_threshold":-20,"effects_below_threshold":["Cannot start rallies","Cannot use teleport"],"how_to_increase":["Upgrade High-heat Furnace","Stay near Alliance Furnace","Ask allies for Recon Plan (heats to 40C)","Tower of Victory decoration"]},"dig_sites":{"max_owned":4,"max_captures_per_day":2,"beast_weaknesses":{"Gorilla":"weak to Missile","Bear":"weak to Tank","Mammoth":"weak to Aircraft"},"virus_resistance":{"level_1":4000,"level_2":6500,"level_3":8500,"level_4":9500},"rare_soil_war":{"period":"Week 4-7","factions":["Rebels","Gendarmerie"],"victory_condition":"Destroy enemy Alliance Furnace"},"fast_growth_tips":["Kill highest Doom Walker on day 1 for coal","Claim Dig Site hourly coal daily","Keep Alliance Furnace running always","Buy season battle pass immediately"]}},"hero_progression":{"star_thresholds":{"4_stars":"Unlocks Super Sensory: +20% HP/Attack/Defense and +10% skill speed","5_stars":"Required to unlock Exclusive Weapon"},"shards_needed":{"to_1_star":25,"to_2_stars":50,"to_3_stars":100,"to_4_stars":300,"to_5_stars":500},"critical_rule":"NEVER assume or invent a hero star count. Always use the exact star level shown in the player profile."}}';

// ── Constants ───────────────────────────────────────────────────────────────
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

// ── Hero parsing ─────────────────────────────────────────────────────────────
// Uses explicit Unicode codepoint U+2605 (\u2605) to avoid encoding ambiguity.
// Also accepts * as fallback in case the star glyph is mangled in transit.
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

// ── System prompt builder ────────────────────────────────────────────────────
function buildSystemPrompt({ server, troop_type, furnace_level, heroes = [], season_week }) {
  const parsedHeroes = parseHeroes(heroes);

  // Heroes block — one line per hero with exact star status
  const heroLines = parsedHeroes.map((p) => {
    if (p.stars === null) {
      return `  - ${p.name}: star level could not be read (check profile)`;
    }
    const statusParts = [];
    if (p.stars >= 4) statusParts.push("Super Sensory UNLOCKED");
    if (p.stars >= 5) statusParts.push("Exclusive Weapon UNLOCKED");
    if (p.stars < 4) {
      const shards = SHARDS_TO_NEXT[p.stars] || 0;
      statusParts.push(`needs ${shards} shards to reach 4\u2605 Super Sensory`);
    }
    return `  - ${p.name}: ${p.stars}\u2605 \u2014 ${statusParts.join("; ")}`;
  });
  const heroesBlock = heroLines.length > 0 ? heroLines.join("\n") : "  (no heroes set)";

  // Explicit per-hero upgrade prohibitions for heroes already at 4★ or 5★
  const prohibitionLines = parsedHeroes
    .filter((p) => p.stars !== null && p.stars >= 4)
    .map((p) => {
      if (p.stars >= 5) {
        return (
          `  - ${p.name} is ALREADY at 5\u2605. Exclusive Weapon and Super Sensory are BOTH UNLOCKED. ` +
          `DO NOT suggest upgrading ${p.name}'s stars \u2014 they are maxed.`
        );
      }
      return (
        `  - ${p.name} is ALREADY at 4\u2605. Super Sensory is UNLOCKED. ` +
        `DO NOT suggest ${p.name} needs to reach 4\u2605 \u2014 they are already there.`
      );
    });
  const prohibitionsBlock =
    prohibitionLines.length > 0
      ? prohibitionLines.join("\n")
      : "  (all heroes below 4\u2605 \u2014 upgrades may be recommended)";

  const weekLine =
    season_week && WEEK_PRIORITY[season_week]
      ? `Current Season Week: ${season_week}/8 \u2014 ${WEEK_PRIORITY[season_week]}`
      : "";

  const beastTarget =
    troop_type === "Tank" ? "Bear" : troop_type === "Missile" ? "Gorilla" : "Mammoth";

  return `You are WAR ROOM, a tactical AI advisor for Last War: Survival game.

=================================================================
COMMANDER PROFILE \u2014 VERIFIED FACTS \u2014 DO NOT CONTRADICT THESE
=================================================================
Server: ${server}
Primary Troop Type: ${troop_type}
Furnace Level: ${furnace_level}
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

GAME KNOWLEDGE BASE:
${KNOWLEDGE_BASE}

BEAST TARGETING (CRITICAL \u2014 never get these wrong):
- Bear is weak to Tank   \u2192 Tank players ALWAYS attack BEAR dig sites
- Gorilla is weak to Missile \u2192 Missile players ALWAYS attack GORILLA dig sites
- Mammoth is weak to Aircraft \u2192 Aircraft players ALWAYS attack MAMMOTH dig sites
This player uses ${troop_type} \u2192 they MUST target: ${beastTarget} dig sites ONLY.

GENERAL HERO MILESTONES (apply only to heroes NOT yet at these levels):
- 4\u2605 unlocks Super Sensory: +20% HP/Attack/Defense, +10% skill speed
- 5\u2605 unlocks Exclusive Weapon
- Shards needed per level: 1\u2605=25, 2\u2605=50, 3\u2605=100, 4\u2605=300, 5\u2605=500

INSTRUCTIONS: Answer in the same language the user writes in (English or Russian). Be direct, specific, and tactical. Reference the player's troop type (${troop_type}), furnace level (${furnace_level}), and actual hero stars from the profile above. Recommend the correct beast type for their troop. Keep answers under 200 words. Format with clear sections when helpful.`;
}

// ── CORS headers ─────────────────────────────────────────────────────────────
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

// ── Handler ──────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: CORS,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers: CORS,
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

  const { question, server, troop_type, furnace_level, heroes, season_week, image_base64 } = body;

  if (!question) {
    return {
      statusCode: 400,
      headers: CORS,
      body: JSON.stringify({ error: "question is required" }),
    };
  }

  const systemPrompt = buildSystemPrompt({ server, troop_type, furnace_level, heroes, season_week });

  // Build user message content (with optional image attachment)
  const userContent = image_base64
    ? [
        {
          type: "image",
          source: { type: "base64", media_type: "image/jpeg", data: image_base64 },
        },
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
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ response }),
    };
  } catch (err) {
    console.error("[WAR ROOM] Fetch error:", err);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: `Tactical advisor offline: ${err.message}` }),
    };
  }
};
