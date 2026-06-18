/**
 * badge-manager.js
 * Controla el badge visible en el ícono de la extensión.
 *
 * Lógica:
 * - Partido en vivo  →  muestra marcador "2-1" en rojo
 * - Sin partido      →  badge vacío o "•" si hay partidos hoy
 * - Sin datos        →  badge vacío
 */

const BADGE_COLORS = {
  live: "#e53935",    // rojo — partido en vivo
  today: "#1565c0",   // azul — hay partidos hoy pero ninguno en vivo
  empty: "#757575",   // gris — sin datos
};

/**
 * Actualiza el badge según el estado actual de los datos.
 * @param {object} data - datos normalizados del Mundial
 */
export function updateBadge(data) {
  if (!data) {
    clearBadge();
    return;
  }

  const { liveMatch, todayMatches } = data;

  if (liveMatch && liveMatch.status === "live") {
    const home = liveMatch.homeScore ?? "-";
    const away = liveMatch.awayScore ?? "-";
    const text = `${home}-${away}`;
    setBadge(text, BADGE_COLORS.live);
    return;
  }

  if (liveMatch && liveMatch.status === "halftime") {
    setBadge("HT", BADGE_COLORS.live);
    return;
  }

  // Hay partidos hoy pero ninguno en vivo
  const hasTodayMatches = todayMatches && todayMatches.length > 0;
  const hasUpcoming = hasTodayMatches && todayMatches.some((m) => m.status === "upcoming");

  if (hasUpcoming) {
    setBadge("⚽", BADGE_COLORS.today);
    return;
  }

  clearBadge();
}

/**
 * Limpia el badge (sin texto visible).
 */
export function clearBadge() {
  chrome.action.setBadgeText({ text: "" });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setBadge(text, backgroundColor) {
  // Truncar a 4 chars máximo (límite visual de Chrome)
  const truncated = String(text).slice(0, 4);
  chrome.action.setBadgeText({ text: truncated });
  chrome.action.setBadgeBackgroundColor({ color: backgroundColor });
}
