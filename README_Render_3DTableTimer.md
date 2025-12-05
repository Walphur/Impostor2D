# Impostor Arcane – Modo Local + Online (Mesa 3D + Temporizador)

Este paquete incluye:

- Modo **Local (2D)** con mesa circular y votación.
- Modo **Online** con:
  - creación de sala y unión por código
  - reparto de roles (1 impostor mínimo)
  - mesa pseudo‑3D vista desde la cámara (estilo Liar's Bar)
  - indicador visual de a quién le toca el turno
  - temporizador de 20 s por turno (se ve en todas las pantallas)
  - al terminar la primera ronda de palabras, se abre la votación automáticamente
  - botón opcional para llamar a votación manual

> NOTA: el chat de voz todavía **no está implementado**.  
> El juego está pensado para que los jugadores hablen por fuera (ej: llamada de voz, Discord, etc.)

## Estructura esperada del repo

Subí el contenido a la **raíz** de tu repositorio:

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

## Configuración para Render (Web Service Node)

- **Runtime:** Node
- **Root Directory:** _(vacío)_
- **Build Command:** `npm install`
- **Start Command:** `node server.js`

Luego hacé un "Clear build cache & deploy".  
La URL resultante servirá el juego completo.
