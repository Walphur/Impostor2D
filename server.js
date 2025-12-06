const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

let Client, GatewayIntentBits, ChannelType;
try {
  ({ Client, GatewayIntentBits, ChannelType } = require('discord.js'));
} catch (e) {
  console.log('discord.js no encontrado, se desactiva integración con Discord.');
}


const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;
const DISCORD_CATEGORY_ID = process.env.DISCORD_CATEGORY_ID || null;

let discordClient = null;
if (Client && DISCORD_TOKEN && DISCORD_GUILD_ID) {
  discordClient = new Client({ intents: [GatewayIntentBits.Guilds] });
  discordClient.login(DISCORD_TOKEN)
    .then(() => console.log('Discord bot conectado.'))
    .catch(err => console.error('Error al conectar Discord bot:', err));
} else {
  console.log('Discord bot desactivado: falta DISCORD_TOKEN o DISCORD_GUILD_ID.');
}

async function createDiscordVoiceChannel(roomCode) {
  if (!discordClient) return { channelId: null, inviteUrl: null };
  try {
    const guild = await discordClient.guilds.fetch(DISCORD_GUILD_ID);
    const channel = await guild.channels.create({
      name: `Sala ${roomCode}`,
      type: ChannelType.GuildVoice,
      parent: DISCORD_CATEGORY_ID || undefined,
      reason: 'Sala creada desde Impostor Arcane',
    });
    const invite = await channel.createInvite({
      maxAge: 0,
      maxUses: 0,
      reason: 'Invitación de voz para sala de Impostor Arcane',
    });
    return { channelId: channel.id, inviteUrl: invite.url };
  } catch (err) {
    console.error('Error creando canal de voz en Discord:', err);
    return { channelId: null, inviteUrl: null };
  }
}

async function deleteDiscordResources(room) {
  if (!discordClient || !room || !room.discordChannelId) return;
  try {
    const guild = await discordClient.guilds.fetch(DISCORD_GUILD_ID);
    const channel = await guild.channels.fetch(room.discordChannelId).catch(() => null);
    if (channel) {
      await channel.delete('Sala cerrada desde Impostor Arcane');
    }
  } catch (err) {
    console.error('Error al eliminar recursos de Discord:', err);
  }
}

// Intenta mutear en Discord al jugador expulsado, si se encuentra un miembro con ese nombre.
async function muteDiscordMember(room, playerName) {
  if (!discordClient || !DISCORD_GUILD_ID || !playerName) return;
  try {
    const guild = await discordClient.guilds.fetch(DISCORD_GUILD_ID);
    const members = await guild.members.fetch();
    const member = members.find(m =>
      m.displayName === playerName ||
      (m.user && (m.user.username === playerName || m.user.globalName === playerName))
    );
    if (!member) {
      console.log('No se encontró miembro de Discord para mutear con nombre', playerName);
      return;
    }
    if (!member.voice || !member.voice.channel) {
      console.log('Miembro', playerName, 'no está en un canal de voz, no se puede mutear.');
      return;
    }
    await member.voice.setMute(true, 'Expulsado de la ronda en Impostor Arcane');
    console.log('Miembro de Discord muteado:', playerName);
  } catch (err) {
    console.error('Error al mutear miembro de Discord:', err);
  }
}



const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

const CLIENT_DIR = path.join(__dirname, 'client');
app.use(express.static(CLIENT_DIR));

/**
 * room structure:
 * {
 *   code: string,
 *   hostId: string,
 *   maxPlayers: number,
 *   impostors: number,
 *   players: [{ id, name }],
 *   phase: 'lobby' | 'palabras' | 'votacion',
 *   turnIndex: number,
 *   roles: { [socketId]: 'impostor' | 'ciudadano' },
 *   word: string | null,
 *   spoken: { [socketId]: boolean },
 *   votes: { [socketId]: string | null },
 *   voteTimeout: NodeJS.Timeout | null
 * }
 */

const rooms = {}; // code -> room
const socketRoom = {}; // socketId -> code

const WORDS = [
  'GALAXIA','MISTERIO','AVENTURA','DESIERTO','OCÉANO','LABERINTO','TRAVESÍA',
  'MONTAÑA','ISLA','INVESTIGACIÓN','SECRETO','FESTIVAL','HOSPITAL','CIUDAD',
  'MUSEO','TORMENTA','PLANETA','CASTILLO','RECUERDO','NOCHE','VERANO',
  'MISIÓN','EXPEDICIÓN','MERKADO','BIBLIOTECA','CARNAVAL','CIENCIA','TESORO'
];

function randomWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

function generateCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code;
  do {
    let part = '';
    for (let i = 0; i < 4; i++) {
      part += chars[Math.floor(Math.random() * chars.length)];
    }
    code = 'ARC-' + part;
  } while (rooms[code]);
  return code;
}

function getRoomOfSocket(socketId) {
  const code = socketRoom[socketId];
  if (!code) return null;
  return rooms[code] || null;
}

function emitRoomState(room) {
    roomCode: room.code,
  const payload = {
    code: room.code,
    hostId: room.hostId,
    maxPlayers: room.maxPlayers,
    impostors: room.impostors,
    phase: room.phase,
    turnIndex: room.turnIndex,
    players: room.players.map(p => ({ id: p.id, name: p.name })),
    discordInviteUrl: room.discordInviteUrl || null
  };
  io.to(room.code).emit('roomState', payload);
}

function resetVoting(room) {
  if (room.voteTimeout) {
    clearTimeout(room.voteTimeout);
    room.voteTimeout = null;
  }
  room.votes = {};
}

function allSpoken(room) {
  return room.players.every(p => room.spoken[p.id]);
}

function startVoting(room) {
  room.phase = 'votacion';
  resetVoting(room);
  io.to(room.code).emit('votingStarted');
  emitRoomState(room);

  // Cerrar votación automáticamente a los 3 minutos.
  room.voteTimeout = setTimeout(() => {
    finishVoting(room, 'Tiempo agotado');
  }, 180000);
}

function finishVoting(room, reason) {
  room.phase = 'lobby';
  room.spoken = {};
  room.turnIndex = 0;

  // Contar votos
  const tally = {};
  Object.values(room.votes).forEach(targetId => {
    if (!targetId) return; // saltar voto
    tally[targetId] = (tally[targetId] || 0) + 1;
  });

  let kickedPlayer = null;
  let maxVotes = 0;
  for (const [targetId, count] of Object.entries(tally)) {
    if (count > maxVotes) {
      maxVotes = count;
      kickedPlayer = room.players.find(p => p.id === targetId) || null;
    }
  }

  let isImpostor = false;
  if (kickedPlayer && room.roles && room.roles[kickedPlayer.id] === 'impostor') {
    isImpostor = true;
  }

  io.to(room.code).emit('votingResults', {
    reason,
    kickedPlayer: kickedPlayer ? { id: kickedPlayer.id, name: kickedPlayer.name } : null,
    isImpostor
  });

  // Intentar mutear al jugador expulsado en Discord (si existe)
  if (kickedPlayer) {
    muteDiscordMember(room, kickedPlayer.name).catch(err =>
      console.error('Error al mutear expulsado en Discord:', err)
    );
  }

  resetVoting(room);
  emitRoomState(room);
}
const code = generateCode();
      const room = {
        code,
        hostId: socket.id,
        maxPlayers,
        impostors,
        players: [{ id: socket.id, name }],
        phase: 'lobby',
        turnIndex: 0,
        roles: {},
        word: null,
        spoken: {},
        votes: {},
        voteTimeout: null,
        discordChannelId: null,
        discordInviteUrl: null
      };
      rooms[code] = room;
      socketRoom[socket.id] = code;
      socket.join(code);

      console.log(`Sala ${code} creada por ${socket.id}`);
      emitRoomState(room);

      // Crear canal de voz en Discord (si está habilitado)
      if (discordClient) {
        createDiscordVoiceChannel(code)
          .then(({ channelId, inviteUrl }) => {
            room.discordChannelId = channelId;
            room.discordInviteUrl = inviteUrl;
            emitRoomState(room);
          })
          .catch(err => console.error('Error al crear canal de voz para sala', code, err));
      }

      cb && cb({ ok: true, code, roomCode: code, me: { id: socket.id, name }, isHost: true });
    } catch (err) {
      console.error('Error createRoom', err);
      cb && cb({ ok: false, error: 'Error interno del servidor.' });
    }
  });

  socket.on('joinRoom', (data, cb) => {
    try {
      const codeRaw = (data && (data.code || data.roomCode)) || '';
      const code = codeRaw.trim().toUpperCase();
      const name = (data && data.name || '').trim() || 'Jugador';

      const room = rooms[code];
      if (!room) {
        cb && cb({ ok: false, error: 'Sala no encontrada.' });
        return;
      }
      if (room.players.length >= room.maxPlayers) {
        cb && cb({ ok: false, error: 'La sala está llena.' });
        return;
      }

      socket.join(code);
      socketRoom[socket.id] = code;
      room.players.push({ id: socket.id, name });
      room.spoken[socket.id] = false;

      console.log(`Socket ${socket.id} se unió a sala ${code}`);
      emitRoomState(room);

      cb && cb({ ok: true, code, me: { id: socket.id, name }, isHost: room.hostId === socket.id });
    } catch (err) {
      console.error('Error joinRoom', err);
      cb && cb({ ok: false, error: 'Error interno del servidor.' });
    }
  });

  socket.on('startRound', (cb) => {
    try {
      const room = getRoomOfSocket(socket.id);
      if (!room) {
        cb && cb({ ok: false, error: 'No estás en ninguna sala.' });
        return;
      }
      if (room.hostId !== socket.id) {
        cb && cb({ ok: false, error: 'Solo el anfitrión puede iniciar la ronda.' });
        return;
      }
      if (room.players.length < 3) {
        cb && cb({ ok: false, error: 'Necesitás al menos 3 jugadores.' });
        return;
      }

      // Asignar roles
      room.roles = {};
      const shuffled = [...room.players];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const impostorPlayers = shuffled.slice(0, room.impostors);
      const impostorIds = new Set(impostorPlayers.map(p => p.id));

      room.players.forEach(p => {
        const role = impostorIds.has(p.id) ? 'impostor' : 'ciudadano';
        room.roles[p.id] = role;
      });

      room.word = randomWord();
      room.phase = 'palabras';
      room.turnIndex = 0;
      room.spoken = {};
      room.players.forEach(p => {
        room.spoken[p.id] = false;
      });
      resetVoting(room);

      // Enviar rol individual a cada jugador
      room.players.forEach(p => {
        const role = room.roles[p.id];
        const payload = {
          role,
          word: role === 'ciudadano' ? room.word : null
        };
        io.to(p.id).emit('yourRole', payload);
      });

      io.to(room.code).emit('roundStarted', {
        wordLength: room.word.length,
        turnIndex: room.turnIndex
      });
      emitRoomState(room);

      cb && cb({ ok: true });
    } catch (err) {
      console.error('Error startRound', err);
      cb && cb({ ok: false, error: 'Error interno del servidor.' });
    }
  });

  socket.on('endTurn', (cb) => {
    try {
      const room = getRoomOfSocket(socket.id);
      if (!room) {
        cb && cb({ ok: false, error: 'No estás en ninguna sala.' });
        return;
      }
      if (room.phase !== 'palabras') {
        cb && cb({ ok: false, error: 'No estamos en fase de palabras.' });
        return;
      }
      const current = room.players[room.turnIndex];
      if (!current || current.id !== socket.id) {
        cb && cb({ ok: false, error: 'No es tu turno.' });
        return;
      }

      room.spoken[socket.id] = true;
      io.to(room.code).emit('playerSpoken', { playerId: socket.id });

      if (allSpoken(room)) {
        startVoting(room);
      } else {
        // Buscar siguiente jugador que no haya hablado
        let nextIndex = room.turnIndex;
        for (let i = 0; i < room.players.length; i++) {
          nextIndex = (nextIndex + 1) % room.players.length;
          const p = room.players[nextIndex];
          if (!room.spoken[p.id]) {
            room.turnIndex = nextIndex;
            break;
          }
        }
        io.to(room.code).emit('turnChanged', { turnIndex: room.turnIndex });
        emitRoomState(room);
      }

      cb && cb({ ok: true });
    } catch (err) {
      console.error('Error endTurn', err);
      cb && cb({ ok: false, error: 'Error interno del servidor.' });
    }
  });

  socket.on('submitVote', (data, cb) => {
    try {
      const room = getRoomOfSocket(socket.id);
      if (!room) {
        cb && cb({ ok: false, error: 'No estás en ninguna sala.' });
        return;
      }
      if (room.phase !== 'votacion') {
        cb && cb({ ok: false, error: 'No estamos en fase de votación.' });
        return;
      }
      const targetId = data ? data.targetId || null : null;
      room.votes[socket.id] = targetId;

      io.to(room.code).emit('voteRegistered', {
        voterId: socket.id,
        targetId
      });

      // Si todos votaron, cerrar votación antes del timeout
      if (Object.keys(room.votes).length >= room.players.length) {
        finishVoting(room, 'Todos votaron');
      }

      cb && cb({ ok: true });
    } catch (err) {
      console.error('Error submitVote', err);
      cb && cb({ ok: false, error: 'Error interno del servidor.' });
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket desconectado', socket.id);
    const code = socketRoom[socket.id];
    if (!code) return;
    const room = rooms[code];
    if (!room) {
      delete socketRoom[socket.id];
      return;
    }

    // quitar jugador
    room.players = room.players.filter(p => p.id !== socket.id);
    delete room.spoken[socket.id];
    delete room.roles[socket.id];
    delete room.votes[socket.id];
    delete socketRoom[socket.id];

    if (room.players.length === 0) {
      if (room.voteTimeout) clearTimeout(room.voteTimeout);
      // Eliminar también recursos de Discord asociados a la sala
      deleteDiscordResources(room);
      delete rooms[code];
      console.log('Sala', code, 'eliminada (sin jugadores)');
      return;
    }

    // Si se fue el host, asignar nuevo host
    if (room.hostId === socket.id) {
      room.hostId = room.players[0].id;
    }

    // Ajustar turnIndex si hace falta
    if (room.turnIndex >= room.players.length) {
      room.turnIndex = 0;
    }

    emitRoomState(room);
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(CLIENT_DIR, 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Impostor Arcane servidor escuchando en puerto', PORT);
});