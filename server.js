const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

const CLIENT_DIR = path.join(__dirname, 'client');
app.use(express.static(CLIENT_DIR));

// ----- Salas y lógica de juego online -----

const rooms = {};

function generateRoomCode() {
  const letters = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += letters[Math.floor(Math.random() * letters.length)];
  }
  return code;
}

function emitRoomState(room) {
  if (!room) return;
  const payload = {
    roomCode: room.code,
    players: room.players,
    phase: room.phase,
    turnPlayerId: room.players[room.turnIndex]?.id || null,
    hostId: room.hostId,
  };
  io.to(room.code).emit('roomState', payload);
}

io.on('connection', (socket) => {
  const playerId = uuidv4();
  socket.data.playerId = playerId;
  socket.emit('init', { playerId });

  console.log('Nuevo cliente conectado:', playerId);

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', playerId);
    for (const code of Object.keys(rooms)) {
      const room = rooms[code];
      const idx = room.players.findIndex((p) => p.id === playerId);
      if (idx !== -1) {
        const [removed] = room.players.splice(idx, 1);
        io.to(room.code).emit('log', `${removed.name} salió de la sala.`);

        if (room.hostId === playerId) {
          if (room.players.length > 0) {
            room.hostId = room.players[0].id;
            io.to(room.code).emit('log', `${room.players[0].name} ahora es host.`);
          } else {
            delete rooms[code];
            console.log('Sala vacía, eliminada:', code);
            continue;
          }
        }

        if (room.turnIndex >= room.players.length) {
          room.turnIndex = 0;
        }
        emitRoomState(room);
      }
    }
  });

  socket.on('createRoom', ({ name }, cb) => {
    if (!name || typeof name !== 'string') {
      cb?.({ ok: false, error: 'Nombre inválido.' });
      return;
    }
    let code;
    do {
      code = generateRoomCode();
    } while (rooms[code]);

    const room = {
      code,
      hostId: playerId,
      players: [{ id: playerId, name }],
      phase: 'lobby',
      turnIndex: 0,
      roles: {},
      votes: {},
    };
    rooms[code] = room;

    socket.join(code);
    socket.data.roomCode = code;
    io.to(code).emit('log', `${name} creó la sala.`);
    emitRoomState(room);

    cb?.({ ok: true, roomCode: code });
  });

  socket.on('joinRoom', ({ name, roomCode }, cb) => {
    roomCode = (roomCode || '').toUpperCase();
    const room = rooms[roomCode];
    if (!room) {
      cb?.({ ok: false, error: 'Sala no encontrada.' });
      return;
    }
    if (room.players.length >= 15) {
      cb?.({ ok: false, error: 'Sala llena (máx. 15 jugadores).' });
      return;
    }
    if (!name || typeof name !== 'string') {
      cb?.({ ok: false, error: 'Nombre inválido.' });
      return;
    }

    room.players.push({ id: playerId, name });
    socket.join(roomCode);
    socket.data.roomCode = roomCode;

    io.to(roomCode).emit('log', `${name} se unió a la sala.`);
    emitRoomState(room);
    cb?.({ ok: true });
  });

  socket.on('startGame', (_, cb) => {
    const roomCode = socket.data.roomCode;
    const room = rooms[roomCode];
    if (!room) {
      cb?.({ ok: false, error: 'Sala inexistente.' });
      return;
    }
    if (room.hostId !== playerId) {
      cb?.({ ok: false, error: 'Solo el host puede iniciar.' });
      return;
    }
    if (room.players.length < 3) {
      cb?.({ ok: false, error: 'Se necesitan al menos 3 jugadores.' });
      return;
    }

    const impostorIndex = Math.floor(Math.random() * room.players.length);
    room.roles = {};
    room.players.forEach((p, index) => {
      const role = index === impostorIndex ? 'impostor' : 'ciudadano';
      room.roles[p.id] = role;
      io.to(p.id).emit('roleAssigned', { role });
    });

    room.phase = 'palabras';
    room.turnIndex = 0;
    room.votes = {};

    io.to(roomCode).emit('log', 'La partida comenzó. Cada uno dice una palabra según su rol.');
    emitRoomState(room);
    cb?.({ ok: true });
  });

  socket.on('startVoting', (_, cb) => {
    const roomCode = socket.data.roomCode;
    const room = rooms[roomCode];
    if (!room) {
      cb?.({ ok: false, error: 'Sala inexistente.' });
      return;
    }
    if (room.hostId !== playerId) {
      cb?.({ ok: false, error: 'Solo el host puede llamar a votación.' });
      return;
    }

    room.phase = 'votacion';
    room.votes = {};

    io.to(roomCode).emit('votingStarted', {
      players: room.players,
    });
    io.to(roomCode).emit('log', 'Comienza la votación.');
    emitRoomState(room);
    cb?.({ ok: true });
  });

  socket.on('castVote', ({ targetId }) => {
    const roomCode = socket.data.roomCode;
    const room = rooms[roomCode];
    if (!room || room.phase !== 'votacion') return;

    room.votes[playerId] = targetId;
    io.to(roomCode).emit('log', `Alguien ha emitido su voto.`);

    const totalVoters = room.players.length;
    const votesCount = Object.keys(room.votes).length;
    if (votesCount >= totalVoters) {
      resolveVoting(room);
    }
  });

  // Señalización WebRTC
  socket.on('webrtc-ready', () => {
    const roomCode = socket.data.roomCode;
    const room = rooms[roomCode];
    if (!room) return;
    const peerIds = room.players.map((p) => p.id);
    io.to(roomCode).emit('webrtc-peers', { peerIds });
  });

  socket.on('webrtc-offer', ({ to, offer }) => {
    io.to(to).emit('webrtc-offer', { from: playerId, offer });
  });

  socket.on('webrtc-answer', ({ to, answer }) => {
    io.to(to).emit('webrtc-answer', { from: playerId, answer });
  });

  socket.on('webrtc-ice-candidate', ({ to, candidate }) => {
    io.to(to).emit('webrtc-ice-candidate', { from: playerId, candidate });
  });
});

function resolveVoting(room) {
  const tally = {};
  for (const voterId of Object.keys(room.votes)) {
    const targetId = room.votes[voterId];
    if (!targetId) continue;
    tally[targetId] = (tally[targetId] || 0) + 1;
  }

  let kickedId = null;
  let maxVotes = 0;
  Object.keys(tally).forEach((pid) => {
    if (tally[pid] > maxVotes) {
      kickedId = pid;
      maxVotes = tally[pid];
    }
  });

  let kickedPlayer = null;
  let isImpostor = false;

  if (kickedId) {
    const idx = room.players.findIndex((p) => p.id === kickedId);
    if (idx !== -1) {
      kickedPlayer = room.players[idx];
      isImpostor = room.roles[kickedId] === 'impostor';
      room.players.splice(idx, 1);
      io.to(room.code).emit('log', `${kickedPlayer.name} fue expulsado.`);
    }
  }

  room.phase = 'palabras';
  room.votes = {};
  if (room.turnIndex >= room.players.length) room.turnIndex = 0;

  io.to(room.code).emit('votingResults', { kickedPlayer, isImpostor });
  emitRoomState(room);
}

// Fallback: SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(CLIENT_DIR, 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Impostor Arcane escuchando en puerto ' + PORT);
});
