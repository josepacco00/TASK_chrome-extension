# ⚽ Mundial 2026 Tracker — Chrome Extension

Extensión personal para seguir el Mundial 2026 sin cambiar de pestaña.

## Instalación (uso personal)

### 1. Cargar en Chrome
1. Abre Chrome y ve a `chrome://extensions`
2. Activa **"Modo desarrollador"** (switch arriba a la derecha)
3. Click en **"Cargar descomprimida"**
4. Selecciona la carpeta `wc2026-extension`
5. ¡Listo! El ícono aparece en la barra del navegador

## Estructura

```
wc2026-extension/
├── manifest.json          # Config MV3
├── service-worker.js      # Fetch periódico + badge
├── popup/
│   ├── popup.html         # UI
│   ├── popup.js           # Lógica del popup
│   └── popup.css          # Estilos
├── modules/
│   ├── data-fetcher.js    # Fetch con fallback automático
│   ├── normalizer.js      # Schema unificado de datos
│   └── badge-manager.js   # Badge del ícono
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Fuente de datos

| Fuente | Endpoint | Auth |
|---|---|---|
| **ESPN (scoreboard)** | `site.api.espn.com/.../fifa.world/scoreboard` | Ninguna |
| **ESPN (standings)** | `site.api.espn.com/.../fifa.world/standings` | Ninguna |
| **Cache local** | `chrome.storage.local` | N/A |

ESPN expone una API JSON interna sin autenticación, verificada en funcionamiento durante el torneo.
Si el endpoint falla, la extensión sirve el último dato conocido del cache con un aviso visual.

## Comportamiento

- **Partido en vivo** → badge muestra `2-1` en rojo, refresco cada 2 min
- **Sin partido activo** → refresco cada 15 min
- **ESPN no responde** → muestra último dato conocido con aviso "datos desactualizados"
- **Sin datos y sin cache** → mensaje claro de error con botón de reintento
