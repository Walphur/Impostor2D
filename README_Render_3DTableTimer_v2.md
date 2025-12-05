# Impostor Arcane – Mesa 3D + Tiempo 10s (v2)

Cambios clave:

- Botón **Modo Online** y **Modo Local (2D)** funcionan como un switch:
  sólo uno queda resaltado a la vez.
- Modo Online:
  - Mesa pseudo-3D visible también en PC (altura mínima fija).
  - Turnos con **tiempo máximo 10 segundos**.
  - Cada jugador, cuando ya dijo su palabra, toca **"Ya dije mi palabra"**.
  - Apenas toca el botón, pasa al siguiente jugador.
  - Si se acaba el tiempo y no tocó, el host avanza solo.
  - Cuando todos hablaron, la **votación se inicia automáticamente** (sin botón extra).

## Estructura

Subí estos archivos a la raíz del repo:

```text
client/
  index.html
  styles.css
  main.js
  game-local.js
  game-online.js
package.json
server.js
```

## Render (Web Service Node)

- Root Directory: _(vacío)_
- Build Command: `npm install`
- Start Command: `node server.js`
