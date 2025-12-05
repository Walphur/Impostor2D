(function(){
  const connectionEl = document.getElementById('connection-indicator');
  const nameInput = document.getElementById('online-name');
  const btnCreate = document.getElementById('online-btn-create');
  const btnJoin = document.getElementById('online-btn-join');
  const roomInput = document.getElementById('online-room-code');
  const playerList = document.getElementById('online-player-list');
  const phaseEl = document.getElementById('online-phase');
  const turnEl = document.getElementById('online-turn');
  const timerEl = document.getElementById('online-timer');
  const btnStart = document.getElementById('online-btn-start');
  const cardEl = document.getElementById('online-card');
  const cardText = document.getElementById('online-card-text');
  const voteInfo = document.getElementById('online-vote-info');
  const voteArea = document.getElementById('online-vote-area');
  const btnCallVote = document.getElementById('online-btn-callvote');
  const logBox = document.getElementById('online-log');
  const canvas = document.getElementById('online-canvas');
  const ctx = canvas.getContext('2d');

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

  let timerInterval = null;
  let timerSeconds = 0;

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

  function isHost(){
    return state.playerId && state.hostId && state.playerId === state.hostId;
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
      else turnEl.textContent = '';
    }

    btnStart.disabled = !(isHost() && state.players.length>=3 && ph==='lobby');
    btnCallVote.disabled = !(isHost() && ph==='palabras');
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

  function updateTimerLabel(){
    if (state.phase !== 'palabras'){
      timerEl.textContent = '';
      return;
    }
    timerEl.textContent = 'Tiempo para palabra: ' + timerSeconds + ' s';
  }

  function stopTimer(){
    if (timerInterval){
      clearInterval(timerInterval);
      timerInterval = null;
    }
    timerSeconds = 0;
    updateTimerLabel();
  }

  function startTurnTimer(){
    stopTimer();
    if (state.phase !== 'palabras' || !state.turnPlayerId) return;
    timerSeconds = 20;
    updateTimerLabel();
    timerInterval = setInterval(()=>{
      timerSeconds--;
      if (timerSeconds <= 0){
        stopTimer();
        // el host avanza el turno; para los demás solo se queda en cero
        if (isHost()){
          state.socket.emit('advanceTurn');
        }
      } else {
        updateTimerLabel();
      }
    }, 1000);
  }

  function resizeCanvas(){
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    drawTable();
  }

  window.addEventListener('resize', resizeCanvas);

  function drawTable(){
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0,0,w,h);

    const cx = w/2;
    const cy = h*0.6;
    const rx = Math.min(w,h)*0.32;
    const ry = rx*0.55;

    const grad = ctx.createRadialGradient(cx,cy-ry, rx*0.4, cx,cy, rx*1.4);
    grad.addColorStop(0,'#3b1f2a');
    grad.addColorStop(1,'#12070a');
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,w,h);

    // mesa (elipse)
    ctx.save();
    ctx.translate(cx,cy);
    ctx.scale(1, ry/rx);
    ctx.beginPath();
    ctx.arc(0,0,rx,0,Math.PI*2);
    ctx.fillStyle = '#7a4326';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,205,160,0.7)';
    ctx.stroke();
    ctx.restore();

    // línea centro
    ctx.save();
    ctx.translate(cx,cy);
    ctx.scale(1, ry/rx);
    ctx.beginPath();
    ctx.arc(0,0,rx*0.4,0,Math.PI*2);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    if (!state.players.length) return;

    const base = Math.PI; // frente a la cámara
    const step = Math.PI*2/state.players.length;

    state.players.forEach((p,i)=>{
      const angle = base + i*step;
      const pr = rx*1.15;
      const px = cx + Math.cos(angle)*pr;
      const py = cy + Math.sin(angle)*ry*1.1; // elipse proyectada

      const isTurn = state.turnPlayerId === p.id;
      if (isTurn){
        ctx.beginPath();
        ctx.arc(px,py-6,26,0,Math.PI*2);
        ctx.fillStyle = 'rgba(151,167,255,0.45)';
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(px,py-8,20,0,Math.PI*2);
      ctx.fillStyle = '#46b7ff';
      ctx.fill();

      ctx.fillStyle = '#f5f7ff';
      ctx.font = '12px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(p.name,px,py+16);
    });
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
    stopTimer();
  });

  socket.on('init', payload=>{
    state.playerId = payload.playerId;
    log('Tu ID: '+payload.playerId);
  });

  socket.on('roomState', payload=>{
    const prevPhase = state.phase;
    const prevTurn = state.turnPlayerId;

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
    drawTable();

    const turnChanged = (state.phase==='palabras' &&
                        (state.phase !== prevPhase || state.turnPlayerId !== prevTurn));

    if (state.phase !== 'palabras'){
      stopTimer();
    } else if (turnChanged){
      startTurnTimer();
    }
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
    stopTimer();
    (payload.players || []).forEach(p=>{
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

  resizeCanvas();
})();
