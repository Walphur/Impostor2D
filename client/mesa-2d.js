export function drawMesa2D(canvas, state) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const width = rect.width;
  const height = rect.height;

  ctx.clearRect(0, 0, width, height);

  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.28;

  const grad = ctx.createRadialGradient(cx, cy - radius*0.6, radius*0.1, cx, cy, radius*1.4);
  grad.addColorStop(0, '#222947');
  grad.addColorStop(1, '#050712');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI*2);
  ctx.strokeStyle = 'rgba(200,210,255,0.28)';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI*2);
  ctx.fillStyle = '#ff4b6b';
  ctx.fill();

  const alive = state.players.filter(p => !p.eliminated);
  if (!alive.length) return;

  const baseAngle = -Math.PI/2;
  const step = Math.PI*2 / alive.length;

  alive.forEach((p, i) => {
    const angle = baseAngle + i*step;
    const pr = radius*1.2;
    const px = cx + Math.cos(angle)*pr;
    const py = cy + Math.sin(angle)*pr;
    const isTurn = state.currentTurnId && state.currentTurnId === p.id;

    if (isTurn) {
      ctx.beginPath();
      ctx.arc(px, py, 26, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(148,163,255,0.45)';
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(px, py, 20, 0, Math.PI*2);
    ctx.fillStyle = p.eliminated ? 'rgba(120,120,120,0.8)' : '#46b7ff';
    ctx.fill();

    ctx.fillStyle = '#f5f7ff';
    ctx.font = '12px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(p.name, px, py+22);
  });
}
