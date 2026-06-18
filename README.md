# ⚽ Mundial 2026 Tracker — Chrome Extension

Extensión personal para seguir el Mundial 2026 sin cambiar de pestaña.

## Instalación (uso personal)

### 1. Generar los iconos
- Abre `generate-icons.html` en Chrome
- Se descargan automáticamente `icon16.png`, `icon48.png`, `icon128.png`
- Muévelos a la carpeta `icons/`

### 2. Cargar en Chrome
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

## Fuentes de datos

| Prioridad | Fuente | Auth |
|---|---|---|
| 1 | wc26.ai | Ninguna |
| 2 | openfootball (GitHub) | Ninguna |
| 3 | Cache local | N/A |

## Comportamiento

- **Partido en vivo** → badge muestra `2-1` en rojo, refresco cada 2 min
- **Sin partido** → refresco cada 15 min
- **Todas las fuentes caídas** → muestra último dato conocido con aviso
