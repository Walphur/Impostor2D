const WORDS = [
  "PLAYA","PIZZA","HOSPITAL","PERRO","CELULAR","MÚSICA","CAFÉ",
  "AUTO","MONTAÑA","LUNA","RÍO","HELADO","FÚTBOL","COMPUTADORA",
  "BIBLIOTECA","SUPERMERCADO","AVIÓN","PLANTA","DOCTOR","ENFERMERA"
];

let players = []; // { name, role, word, alive }
let turnOrder = [];
let turnIndex = 0;
let currentWord = null;
let phase = "config"; // config | palabras | discusion | votacion | terminado
let roundNumber = 0;
let turnsPlayedThisRound = 0;

let timerSeconds = 0;
let timerId = null;

const TURN_TIME = 12; // segundos por turno

function $(id){ return document.getElementById(id); }

// --- Sonidos simples con Web Audio (beeps) ---
let audioCtx = null;
function ensureAudioCtx(){
  if(!audioCtx){
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){}
  }
}
function playBeep(freq=880, duration=0.12){
  ensureAudioCtx();
  if(!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.value = 0.15;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  const now = audioCtx.currentTime;
  osc.start(now);
  osc.stop(now+duration);
}
function playTurnSound(){
  playBeep(1040,0.09);
}
function playVoteSound(){
  playBeep(420,0.16);
}
function playWinSound(){
  playBeep(880,0.14);
  setTimeout(()=>playBeep(1180,0.22),160);
}
function playLoseSound(){
  playBeep(260,0.22);
  setTimeout(()=>playBeep(200,0.18),220);
}

function updateStatusLine(){
  $("statusLine").innerText = "Ronda: " + roundNumber + " · Fase: " + phase;
}

function setButtons(){
  $("nextTurnBtn").disabled = (phase !== "palabras");
  $("startVoteBtn").disabled = (phase !== "discusion");
  $("confirmVoteBtn").disabled = (phase !== "votacion");
}

function resetTimer(){
  if(timerId){
    clearInterval(timerId);
    timerId = null;
  }
  $("timer").innerText = "";
}

function startTurnTimer(){
  resetTimer();
  if(phase !== "palabras" || !turnOrder.length) return;
  timerSeconds = TURN_TIME;
  $("timer").innerText = "Tiempo de turno: " + timerSeconds + " s";
  timerId = setInterval(()=>{
    timerSeconds--;
    if(timerSeconds <= 0){
      resetTimer();
      autoAdvanceTurn();
    }else{
      $("timer").innerText = "Tiempo de turno: " + timerSeconds + " s";
    }
  },1000);
}

function setupPlayers(){
  const num = parseInt($("numPlayers").value) || 0;
  if(num < 2 || num > 15){
    alert("Poné entre 2 y 15 jugadores.");
    return;
  }

  const rawNames = $("namesInput").value.trim();
  let names = [];

  if(rawNames){
    names = rawNames.split(",").map(n => n.trim()).filter(n => n);
  }

  if(!names.length){
    names = Array.from({length:num}, (_,i)=>"Jugador "+(i+1));
  }

  if(names.length !== num){
    alert("La cantidad de nombres debe coincidir con el número de jugadores, o dejá vacío para nombres automáticos.");
    return;
  }

  players = names.map(n => ({ name:n, role:null, word:null, alive:true }));
  turnOrder = names.slice();
  turnIndex = 0;
  currentWord = null;
  phase = "config";
  roundNumber = 0;
  turnsPlayedThisRound = 0;
  resetTimer();

  renderPlayers();
  fillWhoSelects();
  $("card").innerText = "";
  $("turnInfo").innerText = "Jugadores cargados. Ahora repartí las cartas para empezar.";
  $("voteResult").innerText = "";
  $("votePhaseText").innerText = "Después de que todos digan una palabra se habilita la votación.";
  updateStatusLine();
  if(window.updateTurnVisual){
    window.updateTurnVisual(null, turnOrder);
  }
  setButtons();
}

function chooseRandomWord(){
  return WORDS[Math.floor(Math.random()*WORDS.length)];
}

function shuffle(arr){
  arr = [...arr];
  for(let i = arr.length-1; i>0; i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function startLocalGame(){
  if(players.length < 2){
    alert("Primero cargá al menos 2 jugadores.");
    return;
  }
  const vivos = players.filter(p=>p.alive);
  if(vivos.length < 2){
    alert("Quedan menos de 2 jugadores vivos.");
    return;
  }
  let imp = parseInt($("numImpostors").value) || 1;
  if(imp < 1) imp = 1;
  if(imp > 4) imp = 4;
  if(imp >= vivos.length) imp = vivos.length - 1;

  currentWord = chooseRandomWord();

  const indices = vivos.map((p,i)=>i);
  const shuffled = shuffle(indices);
  const impostorIdx = shuffled.slice(0, imp);
  const civilIdx = shuffled.slice(imp);

  vivos.forEach(p => { p.role = null; p.word = null; });

  impostorIdx.forEach(i => {
    vivos[i].role = "IMPOSTOR";
    vivos[i].word = null;
  });

  civilIdx.forEach(i => {
    vivos[i].role = "CIVIL";
    vivos[i].word = currentWord;
  });

  turnOrder = vivos.map(p => p.name);
  turnIndex = 0;
  turnsPlayedThisRound = 0;
  roundNumber += 1;
  phase = "palabras";

  renderPlayers();
  fillWhoSelects();
  $("card").innerText = "Cartas repartidas. Elegí un jugador para ver su carta.";
  $("voteResult").innerText = "";
  $("votePhaseText").innerText = "Ronda " + roundNumber + ": primero todos dicen una palabra, luego discuten y votan.";
  updateTurnUI();
  updateStatusLine();
  setButtons();
  startTurnTimer();
  playTurnSound();
}

function renderPlayers(){
  const ul = $("playersList");
  ul.innerHTML = "";
  players.forEach(p => {
    if(!p.alive) return;
    const li = document.createElement("li");
    li.textContent = p.name + (p.role ? "" : "");
    ul.appendChild(li);
  });
}

function fillWhoSelects(){
  const sel = $("whoSelect");
  const voteSel = $("voteSelect");
  const currentWho = sel.value;
  const currentVote = voteSel.value;

  sel.innerHTML = '<option value="">-- Elegir jugador --</option>';
  voteSel.innerHTML = '<option value="">-- ¿A quién expulsan? --</option>';

  players.forEach(p => {
    if(!p.alive) return;
    const opt1 = document.createElement("option");
    opt1.value = p.name;
    opt1.textContent = p.name;
    sel.appendChild(opt1);

    const opt2 = document.createElement("option");
    opt2.value = p.name;
    opt2.textContent = p.name;
    voteSel.appendChild(opt2);
  });

  if(currentWho) sel.value = currentWho;
  if(currentVote) voteSel.value = currentVote;
}

function showCardForSelected(){
  const name = $("whoSelect").value;
  const card = $("card");
  if(!name){
    card.innerText = "";
    return;
  }
  const p = players.find(pl => pl.name === name && pl.alive);
  if(!p){
    card.innerText = "No se encontró el jugador o ya fue expulsado.";
    return;
  }
  if(p.role === "IMPOSTOR"){
    card.innerText = name + ": SOS IMPOSTOR 😈 (no sabés la palabra)";
  }else if(p.role === "CIVIL"){
    card.innerText = name + ": PALABRA SECRETA → " + (p.word || "");
  }else{
    card.innerText = name + ": Aún sin rol, primero repartí las cartas.";
  }
}

function updateTurnUI(){
  if(!turnOrder.length || phase !== "palabras"){
    $("turnInfo").innerText = "";
    if(window.updateTurnVisual){
      window.updateTurnVisual(null, []);
    }
    return;
  }
  const currentName = turnOrder[turnIndex];
  $("turnInfo").innerText = "Turno de: " + currentName + " (decí UNA palabra relacionada)";
  if(window.updateTurnVisual){
    window.updateTurnVisual(currentName, turnOrder);
  }
}

function advanceTurn(manual){
  if(phase !== "palabras"){
    if(manual) alert("Ahora no están en fase de palabras.");
    return;
  }
  if(!turnOrder.length){
    if(manual) alert("Todavía no hay turnos, primero repartí las cartas.");
    return;
  }

  turnsPlayedThisRound += 1;

  if(turnsPlayedThisRound >= turnOrder.length){
    phase = "discusion";
    resetTimer();
    $("turnInfo").innerText = "Ronda terminada. Ahora hablen libremente y cuando estén listos, apreten 'Ir a votación'.";
    if(window.updateTurnVisual){
      window.updateTurnVisual(null, turnOrder);
    }
    $("votePhaseText").innerText = "Fase de discusión: hablen y luego vayan a votación.";
    updateStatusLine();
    setButtons();
    playTurnSound();
    return;
  }

  turnIndex = (turnIndex + 1) % turnOrder.length;
  updateTurnUI();
  updateStatusLine();
  setButtons();
  startTurnTimer();
  playTurnSound();
}

function nextTurn(){
  advanceTurn(true);
}

function autoAdvanceTurn(){
  advanceTurn(false);
}

function goToVoting(){
  if(phase !== "discusion"){
    alert("Primero tienen que terminar la ronda de palabras.");
    return;
  }
  phase = "votacion";
  $("votePhaseText").innerText = "Fase de votación: elegí a quién expulsan y apretá 'Expulsar seleccionado'.";
  updateStatusLine();
  setButtons();
  playVoteSound();
}

function resolveVote(){
  if(phase !== "votacion"){
    alert("Todavía no están en fase de votación.");
    return;
  }
  const name = $("voteSelect").value;
  if(!name){
    alert("Elegí a quién expulsan.");
    return;
  }
  const p = players.find(pl => pl.name === name && pl.alive);
  if(!p){
    alert("Ese jugador ya no está en juego.");
    return;
  }
  p.alive = false;

  let msg = "Expulsaron a " + name + ". ";
  if(p.role === "IMPOSTOR"){
    msg += "¡Era IMPOSTOR! 😈";
  }else if(p.role === "CIVIL"){
    msg += "Era CIVIL.";
  }else{
    msg += "No tenía rol asignado (raro).";
  }

  const impostoresVivos = players.filter(pl => pl.alive && pl.role === "IMPOSTOR").length;
  const civilesVivos = players.filter(pl => pl.alive && pl.role === "CIVIL").length;

  if(impostoresVivos === 0){
    msg += " → Fin de la partida: GANAN LOS CIVILES 🎉";
    phase = "terminado";
    showBanner("¡GANAN LOS CIVILES! 🎉","No quedaron impostores vivos.");
    playWinSound();
  }else if(impostoresVivos >= civilesVivos){
    msg += " → Fin de la partida: GANAN LOS IMPOSTORES 😈";
    phase = "terminado";
    showBanner("GANAN LOS IMPOSTORES 😈","Los impostores igualan o superan en número a los civiles.");
    playLoseSound();
  }else{
    msg += " → Sigue la partida. Preparando nueva ronda de palabras.";
    phase = "palabras";
    const vivos = players.filter(pl => pl.alive);
    turnOrder = vivos.map(pl => pl.name);
    turnIndex = 0;
    turnsPlayedThisRound = 0;

    // reasignar roles y palabra para nueva ronda
    let imp = Math.min(impostoresVivos, 4);
    if(imp < 1) imp = 1;
    if(imp >= vivos.length) imp = vivos.length - 1;

    currentWord = chooseRandomWord();
    const indices = vivos.map((p,i)=>i);
    const shuffledIdx = shuffle(indices);
    const impostorIdx2 = shuffledIdx.slice(0, imp);
    const civilIdx2 = shuffledIdx.slice(imp);

    vivos.forEach(pl => { pl.role = null; pl.word = null; });
    impostorIdx2.forEach(i => { vivos[i].role = "IMPOSTOR"; });
    civilIdx2.forEach(i => { vivos[i].role = "CIVIL"; vivos[i].word = currentWord; });

    $("card").innerText = "Nueva ronda. Cartas actualizadas para los que siguen vivos.";
    $("votePhaseText").innerText = "Ronda " + (roundNumber+1) + ": primero todos dicen una palabra, luego discuten y votan.";
    roundNumber += 1;
    updateTurnUI();
    startTurnTimer();
  }

  $("voteResult").innerText = msg;
  renderPlayers();
  fillWhoSelects();
  updateStatusLine();
  setButtons();
}

function showBanner(title, subtitle){
  $("bannerTitle").innerText = title;
  $("bannerSubtitle").innerText = subtitle;
  $("banner").style.display = "flex";
}

function closeBannerAndReset(){
  $("banner").style.display = "none";
  // volver a la configuración pero manteniendo nombres
  players.forEach(p => { p.alive = true; p.role = null; p.word = null; });
  turnOrder = players.map(p=>p.name);
  turnIndex = 0;
  phase = "config";
  roundNumber = 0;
  turnsPlayedThisRound = 0;
  resetTimer();
  renderPlayers();
  fillWhoSelects();
  $("card").innerText = "";
  $("turnInfo").innerText = "Jugadores listos. Podés repartir cartas para una nueva partida.";
  $("voteResult").innerText = "";
  $("votePhaseText").innerText = "Después de que todos digan una palabra se habilita la votación.";
  if(window.updateTurnVisual){
    window.updateTurnVisual(null, turnOrder);
  }
  updateStatusLine();
  setButtons();
}

// Exponer para el HTML
window.setupPlayers = setupPlayers;
window.startLocalGame = startLocalGame;
window.nextTurn = nextTurn;
window.showCardForSelected = showCardForSelected;
window.goToVoting = goToVoting;
window.resolveVote = resolveVote;
window.closeBannerAndReset = closeBannerAndReset;
