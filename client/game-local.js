(function(){
  const state = {
    players: [],
    impostorCount: 1,
    round: 0,
    phase: 'config',
    turnIndex: 0,
    turnId: null,
  };

  const roundEl = document.getElementById('local-round');
  const phaseEl = document.getElementById('local-phase');
  const countInput = document.getElementById('local-player-count');
  const namesInput = document.getElementById('local-names');
  const impostorInput = document.getElementById('local-impostor-count');
  const btnLoad = document.getElementById('local-btn-load');
  const btnDeal = document.getElementById('local-btn-deal');
  const btnNext = document.getElementById('local-btn-next');
  const playerList = document.getElementById('local-player-list');
  const seeSelect = document.getElementById('local-see-select');
  const cardEl = document.getElementById('local-card');
  const cardText = document.getElementById('local-card-text');
  const btnOpenVote = document.getElementById('local-btn-open-vote');
  const voteSelect = document.getElementById('local-vote-select');
  const btnKick = document.getElementById('local-btn-kick');
  const statusEl = document.getElementById('local-status');

  const canvas = document.getElementById('local-canvas');
  const ctx = canvas.getContext('2d');

  function resizeCanvas(){
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    draw();
  }

  window.addEventListener('resize', resizeCanvas);

  function setPhase(ph){
    state.phase = ph;
    phaseEl.textContent = (
      ph === 'config' ? 'configuración' :
      ph === 'palabras' ? 'ronda de palabras' :
      ph === 'votación' ? 'votación' :
      ph === 'fin' ? 'fin de ronda' : ph
    );
    btnDeal.disabled = !(ph === 'config' && state.players.length >= 2);
    btnNext.disabled = !(ph === 'palabras');
    btnOpenVote.disabled = !(ph === 'palabras');
    voteSelect.disabled = !(ph === 'votación');
    btnKick.disabled = !(ph === 'votación');
  }

  function syncUI(){
    roundEl.textContent = String(state.round);
    setPhase(state.phase);

    playerList.innerHTML = '';
    state.players.forEach(p=>{
      const li = document.createElement('li');
      const s1 = document.createElement('span');
      s1.textContent = p.name;
      li.appendChild(s1);
      const s2 = document.createElement('span');
      s2.className = 'player-tag';
      if (p.eliminated) s2.textContent = 'expulsado';
      li.appendChild(s2);
      playerList.appendChild(li);
    });

    seeSelect.innerHTML = '<option value="">-- Elegir jugador --</option>';
    voteSelect.innerHTML = '<option value="">-- ¿A quién expulsan? --</option>';
    state.players.forEach((p)=>{
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      seeSelect.appendChild(opt);

      if (!p.eliminated){
        const opt2 = document.createElement('option');
        opt2.value = p.id;
        opt2.textContent = p.name;
        voteSelect.appendChild(opt2);
      }
    });

    draw();
  }

  function draw(){
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0,0,w,h);

    const cx = w/2;
    const cy = h/2;
    const radius = Math.min(w,h)*0.28;

    const grad = ctx.createRadialGradient(cx,cy-radius*0.6,radius*0.2,cx,cy,radius*1.4);
    grad.addColorStop(0,'#22294b');
    grad.addColorStop(1,'#050713');
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,w,h);

    ctx.beginPath();
    ctx.arc(cx,cy,radius,0,Math.PI*2);
    ctx.strokeStyle = 'rgba(210,220,255,0.3)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx,cy,3,0,Math.PI*2);
    ctx.fillStyle = '#ff4b6c';
    ctx.fill();

    const alive = state.players.filter(p=>!p.eliminated);
    if (!alive.length) return;

    const base = -Math.PI/2;
    const step = Math.PI*2/alive.length;
    alive.forEach((p,i)=>{
      const angle = base + i*step;
      const pr = radius*1.2;
      const px = cx + Math.cos(angle)*pr;
      const py = cy + Math.sin(angle)*pr;

      const isTurn = state.turnId === p.id;
      if (isTurn){
        ctx.beginPath();
        ctx.arc(px,py,24,0,Math.PI*2);
        ctx.fillStyle = 'rgba(151,167,255,0.45)';
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(px,py,18,0,Math.PI*2);
      ctx.fillStyle = '#46b7ff';
      ctx.fill();

      ctx.fillStyle = '#f5f7ff';
      ctx.font = '12px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(p.name,px,py+19);
    });
  }

  btnLoad.addEventListener('click', ()=>{
    const count = Math.max(2,Math.min(15,parseInt(countInput.value||'0',10)));
    const raw = namesInput.value.trim();
    if (!raw){ alert('Escribí los nombres separados por coma.'); return; }
    let names = raw.split(',').map(s=>s.trim()).filter(Boolean);
    if (names.length<2){ alert('Necesitás al menos 2 jugadores.'); return;}
    if (names.length!==count) countInput.value = String(names.length);
    names = names.slice(0,15);

    const impCount = Math.max(1,Math.min(4,parseInt(impostorInput.value||'1',10)));
    state.impostorCount = impCount;

    state.players = names.map((name,idx)=>({
      id:'p'+idx,
      name,
      role:'ciudadano',
      eliminated:false,
    }));
    state.round = 0;
    state.phase = 'config';
    state.turnIndex = 0;
    state.turnId = null;
    statusEl.textContent = 'Jugadores cargados. Repartí las cartas para empezar.';
    cardEl.classList.add('role-card--hidden');
    syncUI();
  });

  btnDeal.addEventListener('click', ()=>{
    if (!state.players.length){ alert('Primero cargá jugadores.'); return; }
    const impCount = Math.min(state.impostorCount,state.players.length-1);
    const indices = [...state.players.keys()];
    const chosen = [];
    while(chosen.length<impCount && indices.length){
      const i = Math.floor(Math.random()*indices.length);
      chosen.push(indices.splice(i,1)[0]);
    }
    state.players.forEach((p,idx)=>{
      p.role = chosen.includes(idx)?'impostor':'ciudadano';
      p.eliminated = false;
    });
    state.round += 1;
    state.phase = 'palabras';
    state.turnIndex = 0;
    state.turnId = state.players[0].id;
    statusEl.textContent = 'Cartas repartidas. Cada uno dice una palabra según su rol.';
    syncUI();
  });

  btnNext.addEventListener('click', ()=>{
    if (state.phase!=='palabras') return;
    const alive = state.players.filter(p=>!p.eliminated);
    if (!alive.length) return;
    const order = alive.map(p=>p.id);
    const idx = order.indexOf(state.turnId);
    const next = (idx+1)%order.length;
    state.turnId = order[next];
    const p = alive[next];
    statusEl.textContent = 'Turno de: '+p.name;
    draw();
  });

  seeSelect.addEventListener('change', ()=>{
    const id = seeSelect.value;
    if (!id){ cardEl.classList.add('role-card--hidden'); return; }
    const p = state.players.find(pl=>pl.id===id);
    if (!p) return;
    cardEl.classList.remove('role-card--hidden');
    cardEl.classList.toggle('role-card--citizen', p.role==='ciudadano');
    cardText.textContent = p.role==='impostor' ? 'IMPOSTOR 😈' : 'CIUDADANO 🛡️';
  });

  btnOpenVote.addEventListener('click', ()=>{
    if (state.phase!=='palabras') return;
    state.phase = 'votación';
    statusEl.textContent = 'Votación habilitada: elegí a quién expulsar.';
    syncUI();
  });

  btnKick.addEventListener('click', ()=>{
    const id = voteSelect.value;
    if (!id){ alert('Elegí a alguien.'); return; }
    const p = state.players.find(pl=>pl.id===id);
    if (!p) return;
    p.eliminated = true;
    const msg = `${p.name} fue expulsado. Era ${p.role==='impostor'?'IMPOSTOR':'CIUDADANO'}.`;
    statusEl.textContent = msg;
    state.phase = 'fin';
    state.turnId = null;
    syncUI();
  });

  resizeCanvas();
  syncUI();
})();
