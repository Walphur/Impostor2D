import { drawMesa2D } from './mesa-2d.js';

const state = {
  players: [],       // { id, name, role, eliminated }
  impostorCount: 1,
  round: 0,
  phase: 'config',   // config | cartas | palabras | votacion | finronda
  currentTurnIndex: 0,
  currentTurnId: null,
};

let canvas;

export function initLocalMode() {
  const countInput = document.getElementById('local-player-count');
  const namesInput = document.getElementById('local-names');
  const impostorInput = document.getElementById('local-impostor-count');
  const btnLoad = document.getElementById('local-btn-load');
  const btnDeal = document.getElementById('local-btn-deal');
  const btnNextTurn = document.getElementById('local-btn-next-turn');
  const playerList = document.getElementById('local-player-list');
  const roundLabel = document.getElementById('local-round');
  const phaseLabel = document.getElementById('local-phase');
  const seeSelect = document.getElementById('local-see-card-select');
  const cardEl = document.getElementById('local-card');
  const cardText = document.getElementById('local-card-text');
  const btnGoVote = document.getElementById('local-btn-go-vote');
  const voteSelect = document.getElementById('local-vote-select');
  const btnKick = document.getElementById('local-btn-kick');
  const statusEl = document.getElementById('local-status');

  canvas = document.getElementById('local-mesa-canvas');
  window.addEventListener('resize', () => drawMesa2D(canvas, state));

  function setPhase(phase) {
    state.phase = phase;
    phaseLabel.textContent =
      phase === 'config' ? 'configuración' :
      phase === 'cartas' ? 'reparto de cartas' :
      phase === 'palabras' ? 'ronda de palabras' :
      phase === 'votacion' ? 'votación' :
      phase === 'finronda' ? 'fin de ronda' : phase;

    btnDeal.disabled = !(phase === 'config' && state.players.length >= 2);
    btnNextTurn.disabled = !(phase === 'palabras');
    btnNextTurn.classList.toggle('disabled', btnNextTurn.disabled);

    btnGoVote.disabled = !(phase === 'palabras');
    btnGoVote.classList.toggle('disabled', btnGoVote.disabled);

    const votingEnabled = phase === 'votacion';
    voteSelect.disabled = !votingEnabled;
    btnKick.disabled = !votingEnabled;
    btnKick.classList.toggle('disabled', btnKick.disabled);
  }

  function syncUI() {
    roundLabel.textContent = String(state.round);
    setPhase(state.phase);

    playerList.innerHTML = '';
    state.players.forEach((p) => {
      const li = document.createElement('li');
      const nameSpan = document.createElement('span');
      nameSpan.textContent = p.name;
      li.appendChild(nameSpan);

      const tag = document.createElement('span');
      tag.className = 'player-tag';
      if (p.eliminated) tag.textContent = 'expulsado';
      li.appendChild(tag);

      playerList.appendChild(li);
    });

    // select de ver cartas
    seeSelect.innerHTML = '<option value="">-- Elegir jugador --</option>';
    state.players.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      seeSelect.appendChild(opt);
    });

    // select de votación
    voteSelect.innerHTML = '<option value="">-- ¿A quién expulsan? --</option>';
    state.players.filter(p => !p.eliminated).forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      voteSelect.appendChild(opt);
    });

    drawMesa2D(canvas, state);
  }

  function resetForNewConfig() {
    state.round = 0;
    state.phase = 'config';
    state.players = [];
    state.currentTurnIndex = 0;
    state.currentTurnId = null;
    statusEl.textContent = '';
    cardEl.classList.add('hidden');
    syncUI();
  }

  btnLoad.addEventListener('click', () => {
    const nPlayers = Math.max(2, Math.min(15, parseInt(countInput.value || '0', 10)));
    const namesRaw = namesInput.value.trim();
    if (!namesRaw) {
      alert('Escribí al menos 2 nombres separados por coma.');
      return;
    }
    let names = namesRaw.split(',').map(s => s.trim()).filter(Boolean);
    if (names.length < 2) {
      alert('Escribí al menos 2 nombres válidos.');
      return;
    }
    if (names.length !== nPlayers) {
      nPlayers !== names.length && (countInput.value = String(names.length));
    }
    names = names.slice(0, 15);

    const impostors = Math.max(1, Math.min(4, parseInt(impostorInput.value || '1', 10)));
    state.impostorCount = impostors;

    state.players = names.map((name, idx) => ({
      id: 'p' + idx,
      name,
      role: 'ciudadano',
      eliminated: false,
    }));
    state.round = 0;
    state.phase = 'config';
    state.currentTurnIndex = 0;
    state.currentTurnId = null;
    statusEl.textContent = 'Jugadores cargados. Ahora repartí las cartas para empezar.';

    syncUI();
  });

  btnDeal.addEventListener('click', () => {
    if (!state.players || state.players.length < 2) {
      alert('Primero cargá los jugadores.');
      return;
    }
    const impostorCount = Math.min(state.impostorCount, state.players.length - 1);
    const indices = [...state.players.keys()];
    const chosen = [];
    while (chosen.length < impostorCount && indices.length > 0) {
      const idx = Math.floor(Math.random() * indices.length);
      chosen.push(indices.splice(idx, 1)[0]);
    }
    state.players.forEach((p, idx) => {
      p.role = chosen.includes(idx) ? 'impostor' : 'ciudadano';
      p.eliminated = false;
    });

    state.round += 1;
    state.phase = 'palabras';
    state.currentTurnIndex = 0;
    state.currentTurnId = state.players[0]?.id || null;
    statusEl.textContent = 'Cartas repartidas. Cada uno dice una palabra según su rol.';
    syncUI();
  });

  btnNextTurn.addEventListener('click', () => {
    if (state.phase !== 'palabras') return;
    const alive = state.players.filter(p => !p.eliminated);
    if (alive.length === 0) return;
    const order = alive.map(p => p.id);
    const idx = order.indexOf(state.currentTurnId);
    const nextIdx = (idx + 1) % order.length;
    state.currentTurnId = order[nextIdx];
    statusEl.textContent = `Turno de: ${alive[nextIdx].name}`;
    drawMesa2D(canvas, state);
  });

  seeSelect.addEventListener('change', () => {
    const id = seeSelect.value;
    if (!id) {
      cardEl.classList.add('hidden');
      return;
    }
    const p = state.players.find(pl => pl.id === id);
    if (!p) return;
    cardEl.classList.remove('hidden');
    cardEl.classList.toggle('ciudadano', p.role === 'ciudadano');
    cardText.textContent = p.role === 'impostor' ? 'IMPOSTOR 🃏' : 'CIUDADANO 🛡️';
  });

  btnGoVote.addEventListener('click', () => {
    if (state.phase !== 'palabras') return;
    state.phase = 'votacion';
    statusEl.textContent = 'Votación habilitada. Elegí a quién expulsar.';
    syncUI();
  });

  btnKick.addEventListener('click', () => {
    const id = voteSelect.value;
    if (!id) {
      alert('Elegí a alguien para expulsar.');
      return;
    }
    const p = state.players.find(pl => pl.id === id);
    if (!p) return;
    p.eliminated = true;
    const impostor = p.role === 'impostor';
    statusEl.textContent = `${p.name} fue expulsado. Era ${impostor ? 'IMPOSTOR' : 'CIUDADANO'}.`;
    state.phase = 'finronda';
    state.currentTurnId = null;
    syncUI();
  });

  // Inicial
  resetForNewConfig();
}
