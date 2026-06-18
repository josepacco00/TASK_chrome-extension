/**
 * service-worker.js
 * Background Service Worker — Manifest V3
 *
 * Responsabilidades:
 * - Programar alarmas periódicas para refrescar datos
 * - Ejecutar el fetch con fallback
 * - Guardar resultados en chrome.storage.local
 * - Actualizar el badge del ícono
 */

import { fetchWorldCupData } from "./modules/data-fetcher.js";
import { updateBadge, clearBadge } from "./modules/badge-manager.js";

// ---------------------------------------------------------------------------
// Configuración de intervalos
// ---------------------------------------------------------------------------
const ALARM_NAME_LIVE    = "wc2026-live";    // cada 2 min durante partido en vivo
const ALARM_NAME_REGULAR = "wc2026-regular"; // cada 15 min sin partido activo

const INTERVAL_LIVE_MIN    = 2;
const INTERVAL_REGULAR_MIN = 15;

// ---------------------------------------------------------------------------
// Listener de mensajes desde el popup
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "forceRefresh") {
    refreshData().then(() => scheduleAlarm()).then(() => sendResponse({ ok: true }));
    return true; // mantiene el canal abierto para respuesta async
  }
});

// ---------------------------------------------------------------------------
// Instalación / activación del Service Worker
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(async () => {
  console.log("[SW] Extensión instalada — iniciando primera carga...");
  await refreshData();
  scheduleAlarm();
});

chrome.runtime.onStartup.addListener(async () => {
  console.log("[SW] Chrome iniciado — recargando datos...");
  await refreshData();
  scheduleAlarm();
});

// ---------------------------------------------------------------------------
// Listener de alarmas
// ---------------------------------------------------------------------------

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME_LIVE || alarm.name === ALARM_NAME_REGULAR) {
    console.log(`[SW] Alarma disparada: ${alarm.name}`);
    await refreshData();
    scheduleAlarm(); // re-evalúa el intervalo según si hay partido en vivo
  }
});

// ---------------------------------------------------------------------------
// Lógica principal de refresco
// ---------------------------------------------------------------------------

async function refreshData() {
  try {
    const freshData = await fetchWorldCupData();

    if (freshData) {
      // Datos frescos obtenidos de alguna fuente
      await chrome.storage.local.set({
        worldcupData: freshData,
        dataStatus: "fresh",
      });
      updateBadge(freshData);
      console.log(`[SW] Datos actualizados desde: ${freshData.source}`);
    } else {
      // Todas las fuentes fallaron — marcar como stale pero no borrar datos
      const existing = await chrome.storage.local.get("worldcupData");
      if (existing.worldcupData) {
        await chrome.storage.local.set({ dataStatus: "stale" });
        console.warn("[SW] Todas las fuentes fallaron — usando cache existente.");
      } else {
        await chrome.storage.local.set({ dataStatus: "error" });
        clearBadge();
        console.error("[SW] Sin datos y sin cache disponible.");
      }
    }
  } catch (err) {
    console.error("[SW] Error inesperado en refreshData:", err);
    await chrome.storage.local.set({ dataStatus: "error" });
    clearBadge();
  }
}

// ---------------------------------------------------------------------------
// Programación de alarmas adaptativa
// ---------------------------------------------------------------------------

async function scheduleAlarm() {
  // Limpiar alarmas previas
  await chrome.alarms.clearAll();

  const stored = await chrome.storage.local.get("worldcupData");
  const data = stored.worldcupData;

  const hasLiveMatch =
    data?.liveMatch &&
    (data.liveMatch.status === "live" || data.liveMatch.status === "halftime");

  if (hasLiveMatch) {
    // Refrescar cada 2 minutos si hay partido en vivo
    chrome.alarms.create(ALARM_NAME_LIVE, { periodInMinutes: INTERVAL_LIVE_MIN });
    console.log(`[SW] Alarma configurada: cada ${INTERVAL_LIVE_MIN} min (partido en vivo)`);
  } else {
    // Refrescar cada 15 minutos en estado normal
    chrome.alarms.create(ALARM_NAME_REGULAR, { periodInMinutes: INTERVAL_REGULAR_MIN });
    console.log(`[SW] Alarma configurada: cada ${INTERVAL_REGULAR_MIN} min (sin partido activo)`);
  }
}
