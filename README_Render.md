# Impostor Arcane – Local 2D + Online 3D con voz

Este proyecto combina:

- **Modo Local (2D)**: todos alrededor de una sola pantalla.
- **Modo Online (3D)**: salas online con Socket.IO, roles, ronda y votación.
- **Voz (WebRTC)**: chat de audio simple entre jugadores online.

## Estructura

En la raíz del repo deben estar:

```text
client/
  index.html
  styles.css
  main.js
  mesa-2d.js
  mode-local.js
  mode-online.js
  scene-3d.js
  voice-webrtc.js
package.json
server.js
```

## Uso local

```bash
npm install
npm start
```

Luego abrir http://localhost:3000

## Deploy en Render

- Tipo de servicio: **Web Service (Node)**  
- **Build Command**: `npm install`  
- **Start Command**: `node server.js`  
- **Root Directory**: vacío (porque package.json y server.js están en la raíz)
