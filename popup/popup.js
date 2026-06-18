/**
 * popup.js
 * Controla toda la UI del popup.
 * NO hace fetch directo — lee de chrome.storage.local (ya poblado por el service worker).
 * Esto garantiza apertura instantánea sin esperar red.
 */

// ---------------------------------------------------------------------------
// Referencias DOM
// ---------------------------------------------------------------------------

const liveSection     = document.getElementById("live-section");
const liveLabelEl     = document.getElementById("live-label");
const liveMinuteEl    = document.getElementById("live-minute");
const liveHomeFlag    = document.getElementById("live-home-flag");
const liveHomeName    = document.getElementById("live-home-name");
const liveHomeScore   = document.getElementById("live-home-score");
const liveAwayScore   = document.getElementById("live-away-score");
const liveAwayName    = document.getElementById("live-away-name");
const liveAwayFlag    = document.getElementById("live-away-flag");

const todayList       = document.getElementById("today-list");
const todayEmpty      = document.getElementById("today-empty");
const todayEmptyMsg   = document.getElementById("today-empty-msg");
const nextMatchInfo   = document.getElementById("next-match-info");

const groupsContainer = document.getElementById("groups-container");
const groupsEmpty     = document.getElementById("groups-empty");

const dataStatusEl    = document.getElementById("data-status");
const lastUpdatedEl   = document.getElementById("last-updated");
const errorOverlay    = document.getElementById("error-overlay");

const btnRefresh      = document.getElementById("btn-refresh");
const btnRetry        = document.getElementById("btn-retry");

const tabBtns         = document.querySelectorAll(".tab-btn");
const tabContents     = document.querySelectorAll(".tab-content");

// ---------------------------------------------------------------------------
// Inicialización
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", async () => {
  await loadAndRender();
  setupTabs();
  setupRefreshButton();
});

// ---------------------------------------------------------------------------
// Carga y renderizado principal
// ---------------------------------------------------------------------------

async function loadAndRender() {
  const { worldcupData, dataStatus } = await chrome.storage.local.get([
    "worldcupData",
    "dataStatus",
  ]);

  if (!worldcupData && dataStatus === "error") {
    showErrorOverlay();
    return;
  }

  if (!worldcupData) {
    // Primera carga — pedir al SW que busque datos ahora
    setStatus("Cargando datos...", "");
    return;
  }

  hideErrorOverlay();
  renderLive(worldcupData.liveMatch);
  renderToday(worldcupData.todayMatches);
  renderGroups(worldcupData.groups);
  renderFooter(worldcupData, dataStatus);
}

// ---------------------------------------------------------------------------
// Sección: Partido en vivo
// ---------------------------------------------------------------------------

function renderLive(liveMatch) {
  if (!liveMatch) {
    liveSection.classList.add("hidden");
    return;
  }

  liveSection.classList.remove("hidden");

  if (liveMatch.status === "halftime") {
    liveLabelEl.textContent = "MEDIO TIEMPO";
    liveMinuteEl.textContent = "";
  } else {
    liveLabelEl.textContent = "EN VIVO";
    liveMinuteEl.textContent = liveMatch.minute ? `${liveMatch.minute}'` : "";
  }

  liveHomeFlag.textContent  = liveMatch.homeFlagEmoji || "";
  liveHomeName.textContent  = abbreviate(liveMatch.homeTeam);
  liveHomeScore.textContent = liveMatch.homeScore ?? "-";
  liveAwayScore.textContent = liveMatch.awayScore ?? "-";
  liveAwayName.textContent  = abbreviate(liveMatch.awayTeam);
  liveAwayFlag.textContent  = liveMatch.awayFlagEmoji || "";
}

// ---------------------------------------------------------------------------
// Sección: Partidos de hoy
// ---------------------------------------------------------------------------

function renderToday(matches) {
  todayList.innerHTML = "";

  if (!matches || matches.length === 0) {
    todayEmpty.classList.remove("hidden");
    todayList.classList.add("hidden");
    todayEmptyMsg.textContent = "No hay partidos hoy.";
    nextMatchInfo.textContent = "";
    return;
  }

  todayEmpty.classList.add("hidden");
  todayList.classList.remove("hidden");

  matches.forEach((m) => {
    const item = createMatchItem(m);
    todayList.appendChild(item);
  });
}

function createMatchItem(match) {
  const item = document.createElement("div");
  item.className = "match-item";

  // Hora local
  const time = formatKickoff(match.kickoff);

  // Score o guión si no jugó
  let scoreText = "vs";
  if (match.homeScore !== null && match.awayScore !== null) {
    scoreText = `${match.homeScore}-${match.awayScore}`;
  }

  // Badge de estado
  const statusBadge = createStatusBadge(match.status, match.minute);

  item.innerHTML = `
    <span class="match-time">${time}</span>
    <div class="match-teams">
      <span class="match-flag">${match.homeFlagEmoji || ""}</span>
      <span>${abbreviate(match.homeTeam)}</span>
      <span class="match-vs">${scoreText}</span>
      <span>${abbreviate(match.awayTeam)}</span>
      <span class="match-flag">${match.awayFlagEmoji || ""}</span>
    </div>
  `;

  item.appendChild(statusBadge);
  return item;
}

function createStatusBadge(status, minute) {
  const span = document.createElement("span");
  span.className = "match-status-badge";

  switch (status) {
    case "live":
      span.classList.add("status-live");
      span.textContent = minute ? `${minute}'` : "LIVE";
      break;
    case "halftime":
      span.classList.add("status-halftime");
      span.textContent = "HT";
      break;
    case "finished":
      span.classList.add("status-finished");
      span.textContent = "FT";
      break;
    case "upcoming":
      span.classList.add("status-upcoming");
      span.textContent = "→";
      break;
    default:
      span.textContent = "";
  }

  return span;
}

// ---------------------------------------------------------------------------
// Sección: Tabla de grupos
// ---------------------------------------------------------------------------

function renderGroups(groups) {
  groupsContainer.innerHTML = "";

  if (!groups || Object.keys(groups).length === 0) {
    groupsEmpty.classList.remove("hidden");
    return;
  }

  groupsEmpty.classList.add("hidden");

  Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([groupName, standings]) => {
      const card = createGroupCard(groupName, standings);
      groupsContainer.appendChild(card);
    });
}

function createGroupCard(groupName, standings) {
  const card = document.createElement("div");
  card.className = "group-card";

  const title = document.createElement("div");
  title.className = "group-title";
  title.textContent = `Grupo ${groupName}`;

  const table = document.createElement("table");
  table.className = "group-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Equipo</th>
        <th>PJ</th>
        <th>GD</th>
        <th>Pts</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody");
  standings.forEach((team) => {
    const gd = (team.gf || 0) - (team.ga || 0);
    const gdStr = gd > 0 ? `+${gd}` : `${gd}`;
    const row = document.createElement("tr");
    row.innerHTML = `
      <td title="${team.team}">${team.flagEmoji || ""} ${abbreviateGroup(team.team)}</td>
      <td>${team.played}</td>
      <td>${gdStr}</td>
      <td class="td-pts">${team.pts}</td>
    `;
    tbody.appendChild(row);
  });

  card.appendChild(title);
  card.appendChild(table);
  return card;
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function renderFooter(data, dataStatus) {
  if (dataStatus === "stale") {
    setStatus("⚠ Sin conexión — datos desactualizados", "stale");
  } else if (dataStatus === "error") {
    setStatus("Error al cargar datos", "error");
  } else {
    const src = data.source ? `Fuente: ${data.source}` : "";
    setStatus(src, "");
  }

  if (data.lastUpdated) {
    const mins = minutesAgo(data.lastUpdated);
    lastUpdatedEl.textContent =
      mins === 0 ? "hace un momento" : `hace ${mins} min`;
  }
}

function setStatus(text, modifier) {
  dataStatusEl.textContent = text;
  dataStatusEl.className = "data-status";
  if (modifier) dataStatusEl.classList.add(modifier);
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

function setupTabs() {
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;

      tabBtns.forEach((b) => b.classList.remove("active"));
      tabContents.forEach((c) => c.classList.add("hidden"));

      btn.classList.add("active");
      document.getElementById(`tab-${target}`).classList.remove("hidden");
    });
  });
}

// ---------------------------------------------------------------------------
// Botón de refresh manual
// ---------------------------------------------------------------------------

function setupRefreshButton() {
  btnRefresh.addEventListener("click", async () => {
    btnRefresh.classList.add("spinning");
    btnRefresh.disabled = true;

    // Pedir al service worker que refresque ahora
    await chrome.runtime.sendMessage({ action: "forceRefresh" });

    // Esperar un momento y recargar la UI
    setTimeout(async () => {
      await loadAndRender();
      btnRefresh.classList.remove("spinning");
      btnRefresh.disabled = false;
    }, 1500);
  });

  btnRetry.addEventListener("click", async () => {
    hideErrorOverlay();
    await loadAndRender();
  });
}

// ---------------------------------------------------------------------------
// Error overlay
// ---------------------------------------------------------------------------

function showErrorOverlay() {
  errorOverlay.classList.remove("hidden");
}

function hideErrorOverlay() {
  errorOverlay.classList.add("hidden");
}

// ---------------------------------------------------------------------------
// Helpers de formato
// ---------------------------------------------------------------------------

function formatKickoff(isoString) {
  if (!isoString) return "--:--";
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "--:--";
  }
}

function minutesAgo(isoString) {
  try {
    const diff = Date.now() - new Date(isoString).getTime();
    return Math.floor(diff / 60000);
  } catch {
    return 0;
  }
}

/** Abrevia nombre de equipo a máx 3 chars para scoreboard en vivo */
function abbreviate(name) {
  if (!name) return "?";
  // Usar las primeras 3 letras en mayúscula
  return name.slice(0, 3).toUpperCase();
}

/** Abrevia nombre de equipo para tabla de grupos — un poco más */
function abbreviateGroup(name) {
  if (!name) return "?";
  if (name.length <= 10) return name;
  return name.slice(0, 9) + "…";
}
