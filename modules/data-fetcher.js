/**
 * data-fetcher.js
 * Fetches World Cup data from ESPN's internal (undocumented) JSON API.
 * No API key required. Fallback chain:
 *   Source 1: ESPN scoreboard (today's matches)
 *   Source 2: ESPN scoreboard with explicit date param
 *   Source 3: cache (handled by service-worker)
 */

import { normalizeEspnScoreboard, normalizeEspnStandings } from "./normalizer.js";

const FETCH_TIMEOUT_MS = 6000;

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world";
const ESPN_STANDINGS = "https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings";

const COMMON_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept": "application/json",
};

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Fetches all data needed by the popup.
 * Returns normalized object or null if all sources fail.
 * @returns {Promise<object|null>}
 */
export async function fetchWorldCupData() {
  try {
    // Run scoreboard and standings in parallel
    const [scoreboardRaw, standingsRaw] = await Promise.allSettled([
      fetchScoreboard(),
      fetchStandings(),
    ]);

    const hasScoreboard = scoreboardRaw.status === "fulfilled" && scoreboardRaw.value;
    const hasStandings  = standingsRaw.status  === "fulfilled" && standingsRaw.value;

    if (!hasScoreboard && !hasStandings) {
      console.error("[data-fetcher] Both ESPN endpoints failed.");
      return null;
    }

    const matches = hasScoreboard
      ? normalizeEspnScoreboard(scoreboardRaw.value)
      : { todayMatches: [], liveMatch: null };

    const groups = hasStandings
      ? normalizeEspnStandings(standingsRaw.value)
      : {};

    return {
      lastUpdated: new Date().toISOString(),
      source: "espn",
      liveMatch:    matches.liveMatch,
      todayMatches: matches.todayMatches,
      groups,
    };
  } catch (err) {
    console.error("[data-fetcher] Unexpected error:", err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Individual fetchers
// ---------------------------------------------------------------------------

async function fetchScoreboard() {
  const today = getTodayESPN();
  // ESPN scoreboard defaults to today; adding dates param makes it explicit
  const url = `${ESPN_BASE}/scoreboard?dates=${today}`;
  console.log(`[data-fetcher] Fetching scoreboard: ${url}`);

  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`ESPN scoreboard returned ${res.status}`);

  const json = await res.json();
  if (!json.events) throw new Error("ESPN scoreboard: no events field");
  return json;
}

async function fetchStandings() {
  console.log(`[data-fetcher] Fetching standings: ${ESPN_STANDINGS}`);
  const res = await fetchWithTimeout(ESPN_STANDINGS);
  if (!res.ok) throw new Error(`ESPN standings returned ${res.status}`);

  const json = await res.json();
  if (!json.children) throw new Error("ESPN standings: no children field");
  return json;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fetchWithTimeout(url, ms = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  return fetch(url, {
    signal: controller.signal,
    headers: COMMON_HEADERS,
  })
    .then((res) => { clearTimeout(timer); return res; })
    .catch((err) => {
      clearTimeout(timer);
      if (err.name === "AbortError") throw new Error(`Timeout: ${url}`);
      throw err;
    });
}

/** Returns today's date in YYYYMMDD format for ESPN API */
function getTodayESPN() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}
