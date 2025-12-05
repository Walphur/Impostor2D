const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

const CLIENT_DIR = path.join(__dirname, 'client');
app.use(express.static(CLIENT_DIR));

const rooms = {}; // code -> { code, hostId, players, phase, turnIndex, roles, votes, spoken }

function makeCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  let s = '';
  for (let i=0;i<4;i++) s += chars[Math.floor(Math.random()*chars.length)];
  return s;
}

function emitRoomState(room){
  if (!room) return;
  const payload = {
    roomCode: room.code,
    players: room.players,
    phase: room.phase,
    hostId: room.hostId,
    turnPlayerId: room.players[room.turnIndex]?.id || null,
  };
  io.to(room.code).emit('roomState', payload);
}

io.on('connection', (socket)=>{
  const playerId = socket.id;
  socket.emit('init', { playerId });
  console.log('Nuevo cliente', playerId);

  socket.on('disconnect', ()=>{
    console.log('Se fue', playerId);
    for (const code of Object.keys(rooms)){
      const room = rooms[code];
      const idx = room.players.findIndex(p=>p.id===playerId);
      if (idx !== -1){
        const [removed] = room.players.splice(idx,1);
        io.to(code).emit('log', `${removed.name} salió de la sala.`);
        if (room.hostId === playerId){
          if (room.players.length){
            room.hostId = room.players[0].id;
            io.to(code).emit('log', `${room.players[0].name} ahora es host.`);
          } else {
            delete rooms[code];
            continue;
          }
        }
        if (room.turnIndex >= room.players.length) room.turnIndex = 0;
        emitRoomState(room);
      }
    }
  });

  socket.on('createRoom', ({ name }, cb)=>{
    if (!name || typeof name !== 'string'){
      cb && cb({ ok:false, error:'Nombre inválido.' });
      return;
    }
    let code;
    do { code = makeCode(); } while (rooms[code]);

    const room = {
      code,
      hostId: playerId,
      players: [{ id: playerId, name }],
      phase: 'lobby',
      turnIndex: 0,
      roles: {},
      votes: {},
      spoken: {},
    };
    rooms[code] = room;
    socket.join(code);
    socket.data.roomCode = code;

    io.to(code).emit('log', `${name} creó la sala.`);
    emitRoomState(room);
    cb && cb({ ok:true, roomCode: code });
  });

  socket.on('joinRoom', ({ name, roomCode }, cb)=>{
    roomCode = (roomCode || '').toUpperCase();
    const room = rooms[roomCode];
    if (!room){
      cb && cb({ ok:false, error:'Sala no encontrada.' });
      return;
    }
    if (room.players.length >= 15){
      cb && cb({ ok:false, error:'Sala llena.' });
      return;
    }
    if (!name || typeof name !== 'string'){
      cb && cb({ ok:false, error:'Nombre inválido.' });
      return;
    }
    room.players.push({ id: playerId, name });
    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    io.to(roomCode).emit('log', `${name} se unió a la sala.`);
    emitRoomState(room);
    cb && cb({ ok:true });
  });

  socket.on('startGame', (_, cb)=>{
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room){
      cb && cb({ ok:false, error:'Sala inexistente.' });
      return;
    }
    if (room.hostId !== playerId){
      cb && cb({ ok:false, error:'Solo el host puede iniciar.' });
      return;
    }
    if (room.players.length < 3){
      cb && cb({ ok:false, error:'Necesitás al menos 3 jugadores.' });
      return;
    }
    const impIndex = Math.floor(Math.random()*room.players.length);
    room.roles = {};
    room.players.forEach((p,idx)=>{
      const role = idx===impIndex ? 'impostor' : 'ciudadano';
      room.roles[p.id] = role;
      io.to(p.id).emit('roleAssigned', { role });
    });
    room.phase = 'palabras';
    room.turnIndex = 0;
    room.votes = {};
    room.spoken = {};
    io.to(code).emit('log','La partida comenzó. Cada uno dice una palabra según su rol.');
    emitRoomState(room);
    cb && cb({ ok:true });
  });

  // Lógica común para pasar al siguiente turno o iniciar votación
  function advanceOrVote(room){
    const players = room.players;
    if (!players.length) return;

    const current = players[room.turnIndex];
    if (current){
      room.spoken[current.id] = true;
    }

    const allSpoken = players.length > 0 && players.every(p => room.spoken[p.id]);
    if (allSpoken){
      room.phase = 'votacion';
      room.votes = {};
      io.to(room.code).emit('votingStarted', { players });
      io.to(room.code).emit('log','Todos hablaron. Comienza la votación.');
      emitRoomState(room);
      return;
    }

    room.turnIndex = (room.turnIndex + 1) % players.length;
    emitRoomState(room);
  }

  // Cuando el jugador de turno toca "Ya dije mi palabra"
  socket.on('playerSpoke', ()=>{
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room || room.phase !== 'palabras') return;

    const current = room.players[room.turnIndex];
    if (!current || current.id !== playerId) return; // solo el jugador actual

    advanceOrVote(room);
  });

  // Cuando se acaba el tiempo, el host fuerza el avance
  socket.on('advanceTurnTimeout', ()=>{
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room || room.phase !== 'palabras') return;
    if (room.hostId !== playerId) return;
    advanceOrVote(room);
  });

  socket.on('castVote', ({ targetId })=>{
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room || room.phase !== 'votacion') return;
    room.votes[playerId] = targetId;
    const total = room.players.length;
    const current = Object.keys(room.votes).length;
    if (current >= total){
      resolveVoting(room);
    }
  });
});

function resolveVoting(room){
  const tally = {};
  for (const voterId of Object.keys(room.votes)){
    const targetId = room.votes[voterId];
    if (!targetId) continue;
    tally[targetId] = (tally[targetId]||0)+1;
  }
  let kickedId = null;
  let max = 0;
  for (const id of Object.keys(tally)){
    if (tally[id] > max){
      max = tally[id];
      kickedId = id;
    }
  }
  let kickedPlayer = null;
  let isImpostor = false;
  if (kickedId){
    const idx = room.players.findIndex(p=>p.id===kickedId);
    if (idx !== -1){
      kickedPlayer = room.players[idx];
      isImpostor = room.roles[kickedId] === 'impostor';
      room.players.splice(idx,1);
      io.to(room.code).emit('log', `${kickedPlayer.name} fue expulsado.`);
    }
  }
  room.phase = 'palabras';
  room.votes = {};
  room.spoken = {};
  if (room.turnIndex >= room.players.length) room.turnIndex = 0;
  io.to(room.code).emit('votingResults', { kickedPlayer, isImpostor });
  emitRoomState(room);
}

app.get('*', (req,res)=>{
  res.sendFile(path.join(CLIENT_DIR,'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=>{
  console.log('Impostor Arcane servidor escuchando en puerto', PORT);
});
