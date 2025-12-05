const path = require('path');
const express = require('express');
const http = require('http');

const app = express();
const server = http.createServer(app);

const CLIENT_DIR = path.join(__dirname, 'client');

// Servir archivos estáticos (index.html, JS, CSS, etc)
app.use(express.static(CLIENT_DIR));

// Fallback: cualquier ruta devuelve index.html (por si usás rutas en el futuro)
app.get('*', (req, res) => {
  res.sendFile(path.join(CLIENT_DIR, 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Impostor Arcane 2D escuchando en puerto ' + PORT);
});
