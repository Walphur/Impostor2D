const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let lastOrder = [];
let lastCurrent = null;
let lastTimestamp = 0;

function resizeCanvas(){
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function drawTable(timestamp){
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0,0,w,h);

  const grad = ctx.createRadialGradient(w/2,h/2,10,w/2,h/2,Math.max(w,h)/1.2);
  grad.addColorStop(0,"#0b1120");
  grad.addColorStop(1,"#020617");
  ctx.fillStyle = grad;
  ctx.fillRect(0,0,w,h);

  const order = lastOrder;
  if(!order || !order.length) return;

  const radiusTable = Math.min(w,h)/4;
  ctx.beginPath();
  ctx.arc(w/2,h/2,radiusTable,0,Math.PI*2);
  ctx.fillStyle = "#111827";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#4b5563";
  ctx.stroke();

  const count = order.length;
  const radiusPlayers = radiusTable + 60;

  const t = timestamp / 1000;
  const pulse = 1 + 0.15*Math.sin(t*3);

  for(let i=0;i<count;i++){
    const name = order[i];
    const angle = (i / count) * Math.PI * 2 - Math.PI/2;
    const x = w/2 + Math.cos(angle)*radiusPlayers;
    const y = h/2 + Math.sin(angle)*radiusPlayers;

    const isCurrent = (name === lastCurrent);

    const baseR = 18;
    const r = isCurrent ? baseR * pulse : baseR;

    ctx.beginPath();
    ctx.arc(x,y,r,0,Math.PI*2);
    ctx.fillStyle = isCurrent ? "#22c55e" : "#38bdf8";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#020617";
    ctx.stroke();

    ctx.fillStyle = "#e5e7eb";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(name, x, y+32);
  }
}

function loop(timestamp){
  lastTimestamp = timestamp;
  drawTable(timestamp);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

window.updateTurnVisual = function(currentName, order){
  lastOrder = order || [];
  lastCurrent = currentName || null;
};
