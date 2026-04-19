"use strict";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

const SITE_URL    = "https://cpt-hedge.com";
const SERVERS_URL = `${SITE_URL}/servers`;

// In-memory cache — reuse between warm Netlify invocations (5-min TTL)
const cache = { data: null, timestamp: 0 };
const CACHE_TTL_MS = 5 * 60 * 1000;

// Fetch all server data from cpt-hedge.com.
// Strategy: parse /servers HTML to find the Next.js page chunk URL,
// fetch that chunk, extract the embedded JSON blob.
async function fetchServerData() {
  const now = Date.now();
  if (cache.data && now - cache.timestamp < CACHE_TTL_MS) {
    console.log("[SERVER-WEEK] Served from cache");
    return cache.data;
  }

  // Step 1: Get the /servers page HTML to discover the chunk URL
  const htmlRes = await fetch(SERVERS_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; war-room-bot/1.0)" },
    signal: AbortSignal.timeout(8000),
  });
  if (!htmlRes.ok) throw new Error(`HTML fetch HTTP ${htmlRes.status}`);
  const html = await htmlRes.text();
  console.log(`[SERVER-WEEK] HTML fetched: ${html.length} chars`);

  // Step 2: Find the app/servers/page-*.js chunk URL in the script tags
  const chunkMatch = html.match(/\/_next\/static\/chunks\/app\/servers\/page-[a-f0-9]+\.js[^"']*/);
  if (!chunkMatch) throw new Error("Could not find servers page chunk URL in HTML");
  const chunkUrl = `${SITE_URL}${chunkMatch[0]}`;
  console.log(`[SERVER-WEEK] Chunk URL: ${chunkUrl}`);

  // Step 3: Fetch the JS chunk
  const chunkRes = await fetch(chunkUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; war-room-bot/1.0)" },
    signal: AbortSignal.timeout(10000),
  });
  if (!chunkRes.ok) throw new Error(`Chunk fetch HTTP ${chunkRes.status}`);
  const js = await chunkRes.text();
  console.log(`[SERVER-WEEK] Chunk fetched: ${js.length} chars`);

  // Step 4: Extract the embedded JSON — d=JSON.parse('{"c":[...]}')
  const jsonMatch = js.match(/JSON\.parse\('(\{"c":\[[\s\S]*?\})\'\)/);
  if (!jsonMatch) throw new Error("Could not find server JSON in chunk");
  const data = JSON.parse(jsonMatch[1]);
  console.log(`[SERVER-WEEK] Parsed ${data.c.length} server entries`);

  cache.data = data.c;
  cache.timestamp = now;
  return data.c;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };

  const server = event.queryStringParameters?.server;
  if (!server) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "server param required" }) };
  }

  const serverStr = String(server).trim();

  try {
    const servers = await fetchServerData();

    // Find by exact id match
    const entry = servers.find((e) => String(e.id).trim() === serverStr);

    if (!entry) {
      console.warn(`[SERVER-WEEK] Server ${serverStr} not found in ${servers.length} entries`);
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ week: null, season: null, error: "server not found" }),
      };
    }

    const week   = entry.currentWeek   || null;
    const season = entry.currentSeason || null;

    console.log(`[SERVER-WEEK] Server ${serverStr}: season=${season}, week=${week}, isPostSeason=${entry.isPostSeason}`);

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        week,
        season,
        isPostSeason: entry.isPostSeason || false,
        source: "cpt-hedge",
      }),
    };
  } catch (err) {
    console.error("[SERVER-WEEK] Error:", err.message);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
