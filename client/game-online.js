(function(){
  const connectionEl = document.getElementById('connection-indicator');
  const nameInput = document.getElementById('online-name');
  const btnCreate = document.getElementById('online-btn-create');
  const btnJoin = document.getElementById('online-btn-join');
  const roomInput = document.getElementById('online-room-code');
  const playerList = document.getElementById('online-player-list');
  const phaseEl = document.getElementById('online-phase');
  const turnEl = document.getElementById('online-turn');
  const btnStart = document.getElementById('online-btn-start');
  const cardEl = document.getElementById('online-card');
  const cardText = document.getElementById('online-card-text');
  const voteInfo = document.getElementById('online-vote-info');
  const voteArea = document.getElementById('online-vote-area');
  const btnCallVote = document.getElementById('online-btn-callvote');
  const logBox = document.getElementById('online-log');

  const state = {
    socket: null,
    playerId: null,
    roomCode: null,
    hostId: null,
    players: [],
    phase: 'none',
    turnPlayerId: null,
    role: null,
  };

  function log(msg){
    const div = document.createElement('div');
    div.className = 'log-line';
    div.textContent = msg;
    logBox.appendChild(div);
    logBox.scrollTop = logBox.scrollHeight;
  }

  function setConnection(connected, extra){
    if (connected){
      connectionEl.textContent = 'Servidor: conectado' + (extra ? ' · ' + extra : '');
      connectionEl.classList.remove('connection--disconnected');
      connectionEl.classList.add('connection--connected');
    } else {
      connectionEl.textContent = 'Servidor: desconectado';
      connectionEl.classList.add('connection--disconnected');
      connectionEl.classList.remove('connection--connected');
    }
  }

  function refreshPlayers(){
    playerList.innerHTML = '';
    state.players.forEach(p=>{
      const li = document.createElement('li');
      const s1 = document.createElement('span');
      s1.textContent = p.name + (p.id===state.playerId?' (vos)':'');
      li.appendChild(s1);
      const s2 = document.createElement('span');
      s2.className = 'player-tag';
      if (p.id===state.hostId) s2.textContent = 'host';
      li.appendChild(s2);
      playerList.appendChild(li);
    });
  }

  function refreshPhase(){
    const ph = state.phase;
    phaseEl.textContent = (
      ph==='lobby' ? 'lobby' :
      ph==='palabras' ? 'ronda de palabras' :
      ph==='votacion' ? 'votación' :
      ph==='fin' ? 'fin' : 'sin sala'
    );
    if (!state.turnPlayerId){
      turnEl.textContent = '';
    } else {
      const p = state.players.find(pl=>pl.id===state.turnPlayerId);
      if (p) turnEl.textContent = 'Turno de: '+p.name;
    }

    const isHost = state.hostId===state.playerId;
    btnStart.disabled = !(isHost && state.players.length>=3 && ph==='lobby');
    btnCallVote.disabled = !(isHost && ph==='palabras');
  }

  function refreshRole(){
    if (!state.role){
      cardEl.classList.add('role-card--hidden');
      return;
    }
    cardEl.classList.remove('role-card--hidden');
    cardEl.classList.toggle('role-card--citizen', state.role==='ciudadano');
    cardText.textContent = state.role==='impostor' ? 'IMPOSTOR 😈' : 'CIUDADANO 🛡️';
  }

  // --- Socket.IO ---
  const socket = io();
  state.socket = socket;

  socket.on('connect', ()=>{
    setConnection(true);
    log('Conectado al servidor.');
  });
  socket.on('disconnect', ()=>{
    setConnection(false);
    log('Desconectado del servidor.');
  });

  socket.on('init', payload=>{
    state.playerId = payload.playerId;
    log('Tu ID: '+payload.playerId);
  });

  socket.on('roomState', payload=>{
    state.roomCode = payload.roomCode;
    state.players = payload.players || [];
    state.phase = payload.phase;
    state.turnPlayerId = payload.turnPlayerId;
    state.hostId = payload.hostId;
    if (state.roomCode){
      setConnection(true, 'Sala '+state.roomCode);
    }
    refreshPlayers();
    refreshPhase();
  });

  socket.on('log', msg=>log(msg));

  socket.on('roleAssigned', payload=>{
    state.role = payload.role;
    refreshRole();
    log('Tu rol: '+payload.role.toUpperCase());
  });

  socket.on('votingStarted', payload=>{
    voteInfo.textContent = 'Votación iniciada. Elegí a quién acusar.';
    voteArea.innerHTML = '';
    payload.players.forEach(p=>{
      if (p.id===state.playerId) return;
      const row = document.createElement('div');
      row.className = 'vote-row';
      const span = document.createElement('span');
      span.textContent = p.name;
      const btn = document.createElement('button');
      btn.className = 'btn btn-secondary';
      btn.textContent = 'Votar';
      btn.onclick = ()=>{
        socket.emit('castVote', { targetId: p.id });
        voteInfo.textContent = 'Voto enviado. Esperando resultados...';
        voteArea.innerHTML = '';
      };
      row.appendChild(span);
      row.appendChild(btn);
      voteArea.appendChild(row);
    });
  });

  socket.on('votingResults', payload=>{
    const { kickedPlayer, isImpostor } = payload;
    voteArea.innerHTML = '';
    if (!kickedPlayer){
      voteInfo.textContent = 'Nadie fue expulsado (empate o sin votos).';
      log('Votación sin expulsados.');
      return;
    }
    const msg = `${kickedPlayer.name} fue expulsado. Era ${isImpostor?'IMPOSTOR':'CIUDADANO'}.`;
    voteInfo.textContent = msg;
    log(msg);
  });

  // --- UI actions ---
  btnCreate.addEventListener('click', ()=>{
    const name = (nameInput.value||'').trim();
    if (!name){ alert('Escribí tu nombre.'); return; }
    socket.emit('createRoom', { name }, (res)=>{
      if (!res || !res.ok){
        alert(res && res.error || 'Error creando sala.');
        return;
      }
      log('Sala creada: '+res.roomCode);
      setConnection(true,'Sala '+res.roomCode);
    });
  });

  btnJoin.addEventListener('click', ()=>{
    const name = (nameInput.value||'').trim();
    const code = (roomInput.value||'').trim().toUpperCase();
    if (!name || !code){
      alert('Poné tu nombre y el código de sala.');
      return;
    }
    socket.emit('joinRoom', { name, roomCode: code }, (res)=>{
      if (!res || !res.ok){
        alert(res && res.error || 'Error al unirse.');
        return;
      }
      log('Te uniste a la sala '+code+'.');
      setConnection(true,'Sala '+code);
    });
  });

  btnStart.addEventListener('click', ()=>{
    socket.emit('startGame', {}, (res)=>{
      if (!res || !res.ok){
        alert(res && res.error || 'No se pudo iniciar.');
      }
    });
  });

  btnCallVote.addEventListener('click', ()=>{
    socket.emit('startVoting', {}, (res)=>{
      if (!res || !res.ok){
        alert(res && res.error || 'No se pudo iniciar la votación.');
      }
    });
  });
})();
