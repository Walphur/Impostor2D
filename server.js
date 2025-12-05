const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { randomUUID } = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

// Servir cliente
app.use(express.static(path.join(__dirname, 'client')));

// --- Lógica de salas ---

/**
 * rooms: {
 *   [code]: {
 *     code,
 *     hostId,
 *     players: [{ id, name, alive, role, isHost }],
 *     phase: 'Lobby' | 'Ronda' | 'Votación' | 'Fin',
 *     voting: false,
 *   }
 * }
 */
const rooms = {};

function makeRoomCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function getRoomForSocket(socket) {
  const roomCode = socket.data.roomCode;
  if (!roomCode) return null;
  return rooms[roomCode] || null;
}

io.on('connection', (socket) => {
  console.log('Cliente conectado', socket.id);

  socket.on('disconnect', () => {
    const room = getRoomForSocket(socket);
    if (!room) return;
    room.players = room.players.filter(p => p.id !== socket.id);

    if (room.players.length === 0) {
      delete rooms[room.code];
      console.log('Sala vacía eliminada', room.code);
      return;
    }

    if (room.hostId === socket.id) {
      room.hostId = room.players[0].id;
      room.players[0].isHost = true;
    }
    io.to(room.code).emit('roomState', {
      players: room.players,
      phase: room.phase,
      voting: room.voting,
    });
  });

  socket.on('createRoom', (data, cb) => {
    const name = (data?.name || '').trim();
    if (!name) {
      cb && cb({ ok: false, error: 'Nombre requerido.' });
      return;
    }

    let code;
    do {
      code = makeRoomCode();
    } while (rooms[code]);

    const player = {
      id: socket.id,
      name,
      alive: true,
      role: null,
      isHost: true,
    };

    const room = {
      code,
      hostId: socket.id,
      players: [player],
      phase: 'Lobby',
      voting: false,
    };
    rooms[code] = room;

    socket.join(code);
    socket.data.roomCode = code;

    cb && cb({ ok: true, roomCode: code });

    io.to(code).emit('roomJoined', {
      roomCode: code,
      isHost: true,
      players: room.players,
    });
  });

  socket.on('joinRoom', (data, cb) => {
    const name = (data?.name || '').trim();
    const roomCode = (data?.roomCode || '').trim().toUpperCase();
    if (!name || !roomCode) {
      cb && cb({ ok: false, error: 'Nombre y código requeridos.' });
      return;
    }

    const room = rooms[roomCode];
    if (!room) {
      cb && cb({ ok: false, error: 'Sala no encontrada.' });
      return;
    }
    if (room.players.length >= 15) {
      cb && cb({ ok: false, error: 'La sala está llena.' });
      return;
    }

    const player = {
      id: socket.id,
      name,
      alive: true,
      role: null,
      isHost: false,
    };
    room.players.push(player);

    socket.join(roomCode);
    socket.data.roomCode = roomCode;

    cb && cb({ ok: true });

    // A todos
    io.to(roomCode).emit('roomJoined', {
      roomCode,
      isHost: socket.id === room.hostId,
      players: room.players,
    });
  });

  socket.on('startGame', (data) => {
    const room = rooms[data?.roomCode];
    if (!room) return;
    if (room.hostId !== socket.id) return;
    if (room.players.length < 2) return;

    // Determinar cantidad de impostores sencilla
    const total = room.players.length;
    let impostores = 1;
    if (total >= 7) impostores = 2;
    if (total >= 11) impostores = 3;

    const indices = room.players.map((_, i) => i);
    indices.sort(() => Math.random() - 0.5);
    const impostorIdx = indices.slice(0, impostores);

    room.players.forEach((p, idx) => {
      p.alive = true;
      p.role = impostorIdx.includes(idx) ? 'Impostor' : 'Ciudadano';
    });

    room.phase = 'Ronda';
    room.voting = false;

    // Enviar rol a cada jugador individual
    room.players.forEach((p) => {
      io.to(p.id).emit('rolesAssigned', {
        myRole: p.role,
      });
    });

    io.to(room.code).emit('roomState', {
      players: room.players,
      phase: room.phase,
      voting: room.voting,
    });
  });

  socket.on('startVoting', (data) => {
    const room = rooms[data?.roomCode];
    if (!room) return;
    if (room.hostId !== socket.id) return;
    if (room.phase !== 'Ronda') return;

    room.phase = 'Votación';
    room.voting = true;
    room.votes = {}; // { voterId: targetId }

    io.to(room.code).emit('votingStarted');
    io.to(room.code).emit('roomState', {
      players: room.players,
      phase: room.phase,
      voting: room.voting,
    });
  });

  socket.on('castVote', (data) => {
    const room = rooms[data?.roomCode];
    if (!room || !room.voting) return;
    if (!room.players.find(p => p.id === socket.id && p.alive !== false)) return;

    const targetId = data?.targetId;
    room.votes = room.votes || {};
    room.votes[socket.id] = targetId;

    // ¿Todos los vivos votaron?
    const vivos = room.players.filter(p => p.alive !== false);
    const votos = Object.keys(room.votes || {}).length;
    if (votos >= vivos.length) {
      terminarVotacion(room);
    }
  });

  // WebRTC
  socket.on('voiceJoin', (data) => {
    const roomCode = data?.roomCode;
    if (!roomCode) return;
    socket.join(`voice:${roomCode}`);
  });

  socket.on('webrtcOffer', (data) => {
    const { roomCode, to, sdp } = data || {};
    if (!roomCode || !to || !sdp) return;
    io.to(to).emit('webrtcOffer', { from: socket.id, sdp });
  });

  socket.on('webrtcAnswer', (data) => {
    const { roomCode, to, sdp } = data || {};
    if (!roomCode || !to || !sdp) return;
    io.to(to).emit('webrtcAnswer', { from: socket.id, sdp });
  });

  socket.on('webrtcIceCandidate', (data) => {
    const { roomCode, to, candidate } = data || {};
    if (!roomCode || !to || !candidate) return;
    io.to(to).emit('webrtcIceCandidate', { from: socket.id, candidate });
  });
});

function terminarVotacion(room) {
  const votosPorJugador = {};
  Object.values(room.votes || {}).forEach((targetId) => {
    if (!targetId) return;
    votosPorJugador[targetId] = (votosPorJugador[targetId] || 0) + 1;
  });

  let expulsado = null;
  let maxVotos = 0;
  Object.entries(votosPorJugador).forEach(([targetId, count]) => {
    if (count > maxVotos) {
      maxVotos = count;
      expulsado = targetId;
    }
  });

  let expelledPlayer = null;
  if (expulsado) {
    expelledPlayer = room.players.find(p => p.id === expulsado);
    if (expelledPlayer) {
      expelledPlayer.alive = false;
    }
  }

  // Determinar resultado de la partida
  const vivosImpostores = room.players.filter(p => p.alive !== false && p.role === 'Impostor').length;
  const vivosCiudadanos = room.players.filter(p => p.alive !== false && p.role === 'Ciudadano').length;

  let outcome = '';
  if (vivosImpostores === 0) {
    outcome = '¡Ganan los ciudadanos!';
    room.phase = 'Fin';
    room.voting = false;
  } else if (vivosImpostores >= vivosCiudadanos) {
    outcome = 'Los impostores toman el control. ¡Ganan los impostores!';
    room.phase = 'Fin';
    room.voting = false;
  } else {
    outcome = 'La partida sigue. Podés seguir jugando o hacer otra ronda.';
    room.phase = 'Ronda';
    room.voting = false;
  }

  io.to(room.code).emit('votingResult', {
    expelled: expelledPlayer,
    outcome,
    players: room.players,
    phase: room.phase,
  });

  io.to(room.code).emit('roomState', {
    players: room.players,
    phase: room.phase,
    voting: room.voting,
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Impostor Arcane server escuchando en puerto', PORT);
});
