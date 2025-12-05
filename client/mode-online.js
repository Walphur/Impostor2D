import { initScene3D, updatePlayersInScene, handleResize } from './scene-3d.js';
import { setupVoice } from './voice-webrtc.js';

const onlineState = {
  socket: null,
  playerId: null,
  playerName: '',
  roomCode: null,
  isHost: false,
  hostId: null,
  players: [],
  phase: 'none',
  turnPlayerId: null,
  role: null,
};

let connectionLabelEl = null;
let sceneApi = null;

export function setConnectionLabel(el) {
  connectionLabelEl = el;
}

export function initOnlineMode() {
  sceneApi = initScene3D(document.getElementById('online-three-container'));
  window.addEventListener('resize', () => handleResize(sceneApi));

  const nameInput = document.getElementById('online-name');
  const btnCreate = document.getElementById('online-btn-create');
  const btnJoin = document.getElementById('online-btn-join');
  const roomInput = document.getElementById('online-room-code');
  const btnStart = document.getElementById('online-btn-start');
  const playerList = document.getElementById('online-player-list');
  const phaseLabel = document.getElementById('online-phase');
  const turnLabel = document.getElementById('online-turn');
  const roleCard = document.getElementById('online-role-card');
  const roleText = document.getElementById('online-role-text');
  const btnCallVote = document.getElementById('online-btn-callvote');
  const voteInfo = document.getElementById('online-vote-info');
  const voteArea = document.getElementById('online-vote-area');
  const logEl = document.getElementById('online-log');
  const btnVoice = document.getElementById('online-btn-voice');
  const voiceStatus = document.getElementById('online-voice-status');

  const socket = io();
  onlineState.socket = socket;

  function logLine(msg) {
    const div = document.createElement('div');
    div.className = 'online-log-line';
    div.textContent = msg;
    logEl.appendChild(div);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function refreshPlayers() {
    playerList.innerHTML = '';
    onlineState.players.forEach((p) => {
      const li = document.createElement('li');
      const spanName = document.createElement('span');
      spanName.textContent = p.name + (p.id === onlineState.playerId ? ' (vos)' : '');
      li.appendChild(spanName);
      const spanTag = document.createElement('span');
      spanTag.className = 'player-tag';
      if (p.id === onlineState.hostId) spanTag.textContent = 'host';
      li.appendChild(spanTag);
      playerList.appendChild(li);
    });
    updatePlayersInScene(sceneApi, onlineState.players, onlineState.turnPlayerId);
  }

  function setPhaseLabel() {
    const ph = onlineState.phase;
    let text =
      ph === 'lobby' ? 'Lobby: esperando jugadores.' :
      ph === 'palabras' ? 'Ronda de palabras.' :
      ph === 'votacion' ? 'Votación en curso.' :
      ph === 'resolucion' ? 'Resolviendo votación.' :
      'Sin sala';
    phaseLabel.textContent = text;
  }

  function setTurnLabel() {
    if (!onlineState.turnPlayerId) {
      turnLabel.textContent = '';
      return;
    }
    const p = onlineState.players.find(pl => pl.id === onlineState.turnPlayerId);
    if (!p) {
      turnLabel.textContent = '';
      return;
    }
    turnLabel.textContent = `Turno de: ${p.name}`;
  }

  btnCreate.addEventListener('click', () => {
    const name = (nameInput.value || '').trim();
    if (!name) { alert('Escribí tu nombre.'); return; }
    onlineState.playerName = name;
    socket.emit('createRoom', { name }, (res) => {
      if (!res?.ok) {
        alert(res?.error || 'Error creando sala.');
        return;
      }
      logLine(`Sala creada: ${res.roomCode}`);
      if (connectionLabelEl) connectionLabelEl.textContent = `Servidor: conectado · Sala ${res.roomCode}`;
    });
  });

  btnJoin.addEventListener('click', () => {
    const name = (nameInput.value || '').trim();
    const code = (roomInput.value || '').trim().toUpperCase();
    if (!name || !code) {
      alert('Poné tu nombre y el código de sala.');
      return;
    }
    onlineState.playerName = name;
    socket.emit('joinRoom', { name, roomCode: code }, (res) => {
      if (!res?.ok) {
        alert(res?.error || 'Error al unirse.');
        return;
      }
      logLine(`Te uniste a la sala ${code}.`);
      if (connectionLabelEl) connectionLabelEl.textContent = `Servidor: conectado · Sala ${code}`;
    });
  });

  btnStart.addEventListener('click', () => {
    socket.emit('startGame', {}, (res) => {
      if (!res?.ok) alert(res?.error || 'No se pudo iniciar la partida.');
    });
  });

  btnCallVote.addEventListener('click', () => {
    socket.emit('startVoting', {}, (res) => {
      if (!res?.ok) alert(res?.error || 'No se pudo iniciar la votación.');
    });
  });

  // Socket events
  socket.on('connect', () => {
    logLine('Conectado al servidor.');
    if (connectionLabelEl) connectionLabelEl.textContent = 'Servidor: conectado';
  });

  socket.on('disconnect', () => {
    logLine('Desconectado del servidor.');
    if (connectionLabelEl) connectionLabelEl.textContent = 'Servidor: desconectado';
  });

  socket.on('init', (payload) => {
    onlineState.playerId = payload.playerId;
    logLine(`Tu ID: ${payload.playerId}`);
  });

  socket.on('roomState', (payload) => {
    const { roomCode, players, phase, turnPlayerId, hostId } = payload;
    onlineState.roomCode = roomCode;
    onlineState.players = players || [];
    onlineState.phase = phase;
    onlineState.turnPlayerId = turnPlayerId;
    onlineState.hostId = hostId;
    onlineState.isHost = hostId === onlineState.playerId;

    btnStart.disabled = !onlineState.isHost || onlineState.players.length < 3;
    btnStart.classList.toggle('disabled', btnStart.disabled);
    btnCallVote.disabled = !onlineState.isHost || phase !== 'palabras';
    btnCallVote.classList.toggle('disabled', btnCallVote.disabled);

    refreshPlayers();
    setPhaseLabel();
    setTurnLabel();
  });

  socket.on('roleAssigned', (payload) => {
    onlineState.role = payload.role;
    roleCard.classList.remove('hidden');
    const isCitizen = onlineState.role === 'ciudadano';
    roleCard.classList.toggle('ciudadano', isCitizen);
    roleText.textContent = isCitizen ? 'CIUDADANO 🛡️' : 'IMPOSTOR 😈';
    logLine(`Tu rol es: ${onlineState.role.toUpperCase()}`);
  });

  socket.on('log', (msg) => {
    logLine(msg);
  });

  socket.on('votingStarted', (payload) => {
    voteInfo.textContent = 'Fase de votación: elegí a quién acusar.';
    voteArea.innerHTML = '';
    payload.players.forEach((p) => {
      if (p.id === onlineState.playerId) return;
      const row = document.createElement('div');
      row.className = 'player-list-row vote-row';

      const spanName = document.createElement('span');
      spanName.textContent = p.name;
      const btn = document.createElement('button');
      btn.className = 'secondary';
      btn.textContent = 'Votar';
      btn.onclick = () => {
        socket.emit('castVote', { targetId: p.id });
        voteInfo.textContent = `Voto emitido para ${p.name}. Esperando resultados...`;
        voteArea.innerHTML = '';
      };

      row.appendChild(spanName);
      row.appendChild(btn);
      voteArea.appendChild(row);
    });
  });

  socket.on('votingResults', (payload) => {
    const { kickedPlayer, isImpostor } = payload;
    voteArea.innerHTML = '';
    if (!kickedPlayer) {
      voteInfo.textContent = 'Empate o sin votos suficientes. Nadie fue expulsado.';
      logLine('Votación sin expulsados.');
      return;
    }
    const msg = `${kickedPlayer.name} fue expulsado. Era ${isImpostor ? 'IMPOSTOR' : 'CIUDADANO'}.`;
    voteInfo.textContent = msg;
    logLine(msg);
  });

  // WebRTC voice
  setupVoice(onlineState, socket, btnVoice, voiceStatus, logLine);

  // Señalización WebRTC
  socket.on('webrtc-offer', ({ from, offer }) => {
    window.__arcaneVoice?.onOffer(from, offer);
  });
  socket.on('webrtc-answer', ({ from, answer }) => {
    window.__arcaneVoice?.onAnswer(from, answer);
  });
  socket.on('webrtc-ice-candidate', ({ from, candidate }) => {
    window.__arcaneVoice?.onIceCandidate(from, candidate);
  });
  socket.on('webrtc-peers', ({ peerIds }) => {
    window.__arcaneVoice?.onPeers(peerIds);
  });
}
