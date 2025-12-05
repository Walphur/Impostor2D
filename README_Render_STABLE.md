# Impostor Arcane – Multiplayer Stable

Este proyecto incluye:

- Modo **Local 2D** (una sola pantalla).
- Modo **Online** con salas, host, reparto de roles y votación.
- Servidor Node + Express + Socket.IO listo para Render.

## Estructura esperada del repo (cuando lo subas a GitHub)

Colocá el contenido de `server/` en la raíz del repo:

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

## Render (Web Service)

- Root Directory: _(vacío)_
- Build Command: `npm install`
- Start Command: `node server.js`

Luego de deploy, entrá a la URL y probá:

- Modo Local (2D): sin sockets.
- Modo Online:
  - Escribís nombre → Crear sala.
  - Te devuelve un código (en el log de la derecha).
  - Otro jugador se une con ese código.
  - El host puede iniciar partida, se reparten roles y se habilita votación.
