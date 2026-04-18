"use strict";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };

  const server = event.queryStringParameters?.server;
  if (!server) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "server param required" }) };
  }

  try {
    const res = await fetch("https://cpt-hedge.com/servers", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; war-room-bot/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    const html = await res.text();
    const serverStr = String(server).trim();

    // ── Strategy 1: embedded JSON array ──────────────────────────
    const jsonMatch = html.match(/\[\s*\{[\s\S]*?\}\s*\]/);
    if (jsonMatch) {
      try {
        const arr = JSON.parse(jsonMatch[0]);
        const entry = arr.find(
          (e) => String(e.server || e.server_id || e.id || "").trim() === serverStr
        );
        if (entry) {
          const week = entry.week ?? entry.season_week ?? entry.current_week ?? null;
          const startDate = entry.start_date ?? entry.season_start ?? null;
          if (week) return { statusCode: 200, headers: CORS, body: JSON.stringify({ week: Number(week), season: 2, source: "json" }) };
          if (startDate) {
            const w = dateToWeek(startDate);
            return { statusCode: 200, headers: CORS, body: JSON.stringify({ week: w, season: 2, source: "json_date" }) };
          }
        }
      } catch (_) { /* not valid JSON, continue */ }
    }

    // ── Strategy 2: HTML table row containing the server number ──
    // Strip tags to get text and search line by line
    const lines = html.split(/[\n\r]+/);
    // Find the line index that contains our server number as a standalone value
    const serverPattern = new RegExp(`(?:^|[^\\d])${serverStr}(?:[^\\d]|$)`);
    const idx = lines.findIndex((l) => serverPattern.test(l));

    if (idx !== -1) {
      // Look at surrounding ±5 lines for week or date information
      const context = lines.slice(Math.max(0, idx - 3), idx + 8).join(" ");
      const cleaned = context.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

      // Try week number pattern e.g. "Week 3" or "week3" or "/8"
      const weekMatch = cleaned.match(/[Ww]eek[\s:]*(\d+)/) || cleaned.match(/(\d)\s*\/\s*8/);
      if (weekMatch) {
        const w = Math.min(Math.max(parseInt(weekMatch[1]), 1), 8);
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ week: w, season: 2, source: "html_week" }) };
      }

      // Try ISO date pattern e.g. 2025-01-15
      const dateMatch = cleaned.match(/(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        const w = dateToWeek(dateMatch[1]);
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ week: w, season: 2, source: "html_date" }) };
      }

      // Try DD/MM/YYYY or MM/DD/YYYY
      const slashDate = cleaned.match(/(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/);
      if (slashDate) {
        const iso = `${slashDate[3]}-${slashDate[2].padStart(2,"0")}-${slashDate[1].padStart(2,"0")}`;
        const w = dateToWeek(iso);
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ week: w, season: 2, source: "html_slash_date" }) };
      }

      // Return a snippet for debugging if nothing matched
      console.log(`[SERVER-WEEK] Found server ${serverStr} but could not extract week. Context: ${cleaned.slice(0, 300)}`);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ week: null, season: 2, debug: cleaned.slice(0, 300) }) };
    }

    // Server not found in page
    console.warn(`[SERVER-WEEK] Server ${serverStr} not found in page (${html.length} chars)`);
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ week: null, season: 2, error: "server not found" }) };

  } catch (err) {
    console.error("[SERVER-WEEK] Error:", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

function dateToWeek(dateStr) {
  const start = new Date(dateStr);
  const now   = new Date();
  const days  = Math.floor((now - start) / 86400000);
  return Math.min(Math.max(Math.floor(days / 7) + 1, 1), 8);
}
