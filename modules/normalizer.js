/**
 * normalizer.js
 * Maps ESPN API raw responses to the internal schema used by the popup.
 *
 * Internal schema:
 * {
 *   liveMatch: LiveMatch | null,
 *   todayMatches: Match[],
 *   groups: { [groupName: string]: Standing[] }
 * }
 *
 * Match: { homeTeam, awayTeam, homeScore, awayScore, kickoff, status, minute }
 * Standing: { team, played, won, drawn, lost, gf, ga, pts }
 */

// ---------------------------------------------------------------------------
// ESPN Scoreboard  →  { liveMatch, todayMatches }
// ---------------------------------------------------------------------------

export function normalizeEspnScoreboard(raw) {
  const todayMatches = (raw.events || []).map(normalizeEspnEvent);
  const liveMatch = todayMatches.find(
    (m) => m.status === "live" || m.status === "halftime"
  ) || null;

  return { todayMatches, liveMatch };
}

function normalizeEspnEvent(event) {
  const comp       = event.competitions?.[0] ?? {};
  const home       = (comp.competitors ?? []).find((c) => c.homeAway === "home") ?? {};
  const away       = (comp.competitors ?? []).find((c) => c.homeAway === "away") ?? {};
  const statusType = event.status?.type ?? {};
  const state      = statusType.state ?? "pre";       // "pre" | "in" | "post"
  const detail     = statusType.detail ?? "";         // "Final" | "HT" | "67'" | "11:00 PM ET"
  const clock      = event.status?.displayClock ?? "";

  return {
    id:           event.id ?? null,
    homeTeam:     home.team?.displayName ?? "?",
    awayTeam:     away.team?.displayName ?? "?",
    homeAbbr:     home.team?.abbreviation ?? "???",
    awayAbbr:     away.team?.abbreviation ?? "???",
    homeFlagUrl:  home.team?.flag ?? "",
    awayFlagUrl:  away.team?.flag ?? "",
    homeScore:    state !== "pre" ? parseScore(home.score) : null,
    awayScore:    state !== "pre" ? parseScore(away.score) : null,
    kickoff:      event.date ?? null,
    status:       mapState(state, detail),
    minute:       state === "in" ? (clock || extractMinute(detail)) : null,
    detail,
  };
}

// ---------------------------------------------------------------------------
// ESPN Standings  →  { [groupName]: Standing[] }
// ---------------------------------------------------------------------------

export function normalizeEspnStandings(raw) {
  const groups = {};

  (raw.children ?? []).forEach((group) => {
    const name    = group.name ?? group.abbreviation ?? "?";
    const entries = group.standings?.entries ?? [];

    groups[name] = entries.map((entry) => {
      const stats   = buildStatsMap(entry.stats ?? []);
      return {
        team:   entry.team?.displayName ?? "?",
        abbr:   entry.team?.abbreviation ?? "???",
        played: statVal(stats, "gamesPlayed"),
        won:    statVal(stats, "wins"),
        drawn:  statVal(stats, "ties"),
        lost:   statVal(stats, "losses"),
        gf:     statVal(stats, "pointsFor"),
        ga:     statVal(stats, "pointsAgainst"),
        gd:     statVal(stats, "pointDifferential"),
        pts:    statVal(stats, "points"),
        rank:   statVal(stats, "rank"),
      };
    }).sort((a, b) => a.rank - b.rank);
  });

  return groups;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapState(espnState, detail) {
  if (espnState === "post") return "finished";
  if (espnState === "pre")  return "upcoming";
  // in-play
  const d = (detail ?? "").toLowerCase();
  if (d === "ht" || d === "halftime" || d === "half time") return "halftime";
  return "live";
}

function parseScore(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = parseInt(raw, 10);
  return isNaN(n) ? null : n;
}

function extractMinute(detail) {
  // ESPN sometimes puts "67'" in the detail field
  const m = String(detail ?? "").match(/(\d+)['′]/);
  return m ? m[1] : null;
}

function buildStatsMap(statsArray) {
  const map = {};
  (statsArray ?? []).forEach((s) => { map[s.name] = s; });
  return map;
}

function statVal(map, key) {
  const entry = map[key];
  if (!entry) return 0;
  return Math.round(parseFloat(entry.value) || 0);
}
