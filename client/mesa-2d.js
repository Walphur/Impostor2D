export function drawMesa2D(canvas, state) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const { width, height } = canvas.getBoundingClientRect();
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, width, height);

  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.28;

  // Fondo suave radial
  const grad = ctx.createRadialGradient(cx, cy - radius * 0.6, radius * 0.1, cx, cy, radius * 1.4);
  grad.addColorStop(0, '#222947');
  grad.addColorStop(1, '#050712');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Círculo mesa
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(200,210,255,0.28)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Punto rojo centro
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#ff4b6b';
  ctx.fill();

  const alivePlayers = state.players.filter(p => !p.eliminated);
  if (alivePlayers.length === 0) return;

  const baseAngle = -Math.PI / 2;
  const step = (Math.PI * 2) / alivePlayers.length;

  alivePlayers.forEach((p, index) => {
    const angle = baseAngle + index * step;
    const pr = radius * 1.2;
    const px = cx + Math.cos(angle) * pr;
    const py = cy + Math.sin(angle) * pr;

    // Circulito jugador
    const isCurrentTurn = state.currentTurnId && state.currentTurnId === p.id;
    const outerR = 20;
    if (isCurrentTurn) {
      ctx.beginPath();
      ctx.arc(px, py, outerR + 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(148, 163, 255, 0.45)';
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(px, py, outerR, 0, Math.PI * 2);
    ctx.fillStyle = p.eliminated ? 'rgba(120,120,120,0.8)' : '#46b7ff';
    ctx.fill();

    // Nombre
    ctx.fillStyle = '#f5f7ff';
    ctx.font = '12px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(p.name, px, py + outerR + 4);
  });
}
