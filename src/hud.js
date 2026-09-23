const GREEN = '#a5f5bc';
const DIM = 'rgba(165,245,188,.42)';
const AMBER = '#ffe3a0';
const DEG = Math.PI / 180;

function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function label(ctx, value, x, y, align = 'center', size = 11) {
  ctx.font = `500 ${size}px "IBM Plex Mono", "Courier New", monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.save();
  ctx.strokeStyle = 'rgba(9,31,29,.3)';
  ctx.lineWidth = 1;
  ctx.lineJoin = 'round';
  ctx.strokeText(String(value), x, y);
  ctx.restore();
  ctx.fillText(String(value), x, y);
}

export class FlightHUD {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = 1;
    this.height = 1;
    this.dpr = 1;
  }

  resize(width, height, dpr = 1) {
    this.width = width;
    this.height = height;
    this.dpr = Math.min(dpr, 2);
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
  }

  draw(state) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const mobile = w < 650;
    const mobileReady = mobile && state.mode === 'ready';
    const cx = w / 2;
    const cy = h * (mobile ? 0.48 : 0.455);
    const compact = w < 1050;
    const spread = mobile ? 110 : Math.min(compact ? w * 0.27 : 245, 245);
    const heading = ((state.heading || 0) % 360 + 360) % 360;
    const pitch = (state.pitch || 0) / DEG;
    const roll = state.roll || 0;
    const telemetryY = mobile ? cy : cy + 15;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = GREEN;
    ctx.fillStyle = GREEN;
    ctx.lineWidth = 1;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    ctx.globalAlpha = 0.84;
    ctx.shadowColor = 'rgba(5,31,24,.7)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1;

    // Heading tape, with the bearing directly under the index triangle.
    const compassY = mobile ? 45 : compact ? 100 : 110;
    const compassWidth = Math.min(380, w * 0.4);
    if (!mobileReady) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - compassWidth / 2, compassY - 28, compassWidth, 55);
    ctx.clip();
    const pxPerDegree = 4.4;
    for (let step = -65; step <= 65; step += 5) {
      const tickHeading = Math.floor(heading / 5) * 5 + step;
      const x = cx + (tickHeading - heading) * pxPerDegree;
      const deg = ((tickHeading % 360) + 360) % 360;
      const major = deg % 10 === 0;
      ctx.globalAlpha = Math.max(0.2, 0.96 * (1 - Math.abs(x - cx) / (compassWidth * 0.85)));
      line(ctx, x, compassY, x, compassY + (major ? 9 : 5));
      if (major) {
        const cardinal = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[deg];
        label(ctx, cardinal || String(Math.round(deg / 10)).padStart(2, '0'), x, compassY - 12, 'center', 10);
      }
    }
    ctx.restore();
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.moveTo(cx - 4, compassY + 17);
    ctx.lineTo(cx + 4, compassY + 17);
    ctx.lineTo(cx, compassY + 12);
    ctx.closePath();
    ctx.fill();
    label(ctx, String(Math.round(heading) % 360).padStart(3, '0'), cx, compassY + 33, 'center', 12);
    }

    // Moving pitch ladder, clipped to keep the flight path uncluttered.
    if (!mobileReady) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - 180, Math.max(compassY + 60, cy - 125), 360, Math.min(252, h - 212 - Math.max(compassY + 60, cy - 125)));
    ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate(-roll);
    const pitchScale = 6.7;
    for (let value = -80; value <= 80; value += 5) {
      const y = (pitch - value) * pitchScale;
      if (Math.abs(y) > 210) continue;
      const horizon = value === 0;
      const major = value % 10 === 0;
      const outer = (horizon ? 114 : major ? 83 : 59) * (mobile ? 0.68 : 1);
      const inner = (horizon ? 35 : major ? 29 : 26) * (mobile ? 0.75 : 1);
      ctx.globalAlpha = horizon ? 0.85 : major ? 0.69 : 0.38;
      ctx.setLineDash(value < 0 ? [5, 4] : []);
      line(ctx, -outer, y, -inner, y);
      line(ctx, inner, y, outer, y);
      ctx.setLineDash([]);
      if (major && !horizon) {
        const hook = value > 0 ? 5 : -5;
        line(ctx, -outer, y, -outer, y + hook);
        line(ctx, outer, y, outer, y + hook);
        label(ctx, Math.abs(value), -outer - 15, y, 'center', 10);
        label(ctx, Math.abs(value), outer + 15, y, 'center', 10);
      }
    }
    ctx.restore();

    // Fixed aircraft reference and small bank index.
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(cx - 34, cy);
    ctx.lineTo(cx - 12, cy);
    ctx.lineTo(cx - 7, cy + 6);
    ctx.moveTo(cx + 34, cy);
    ctx.lineTo(cx + 12, cy);
    ctx.lineTo(cx + 7, cy + 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.stroke();
    }

    if (!mobile) {
    const bankY = cy - 99;
    ctx.globalAlpha = 0.34;
    for (const angle of [-60, -30, 0, 30, 60]) {
      const a = (angle - 90) * DEG;
      const radius = 37;
      line(ctx, cx + Math.cos(a) * radius, bankY + Math.sin(a) * radius,
        cx + Math.cos(a) * (radius + 5), bankY + Math.sin(a) * (radius + 5));
    }
    ctx.globalAlpha = 0.7;
    ctx.save();
    ctx.translate(cx, bankY);
    ctx.rotate(-roll);
    ctx.beginPath();
    ctx.moveTo(-3, -30);
    ctx.lineTo(0, -35);
    ctx.lineTo(3, -30);
    ctx.stroke();
    ctx.restore();
    }

    // Primary flight instruments.
    const sx = mobileReady ? w - 57 : cx - spread;
    const ax = mobileReady ? w - 57 : cx + spread;
    const speedY = mobileReady ? Math.min(201, h * 0.31) : telemetryY;
    const altitudeY = mobileReady ? speedY + 100 : telemetryY;
    const boxWidth = 66;
    ctx.globalAlpha = 0.9;
    label(ctx, 'SPEED', sx, speedY - 29, 'center', 10);
    label(ctx, 'ALT', ax, altitudeY - 29, 'center', 10);
    ctx.globalAlpha = 0.96;
    this.valueBox(sx, speedY, boxWidth, Math.round(state.speed || 0), 'right');
    this.valueBox(ax, altitudeY, boxWidth + 4, Math.round(state.altitude || 0).toLocaleString('en-US'), 'left');
    ctx.globalAlpha = 0.76;
    label(ctx, 'KM/H', sx, speedY + 27, 'center', 9);
    label(ctx, 'METERS', ax, altitudeY + 27, 'center', 9);
    if (h > 680 && !mobile) {
      ctx.globalAlpha = 0.68;
      label(ctx, `THR ${Math.round((state.throttle ?? 0.7) * 100)}%`, sx, telemetryY + 70, 'center', 10);
      label(ctx, `G ${Math.min(9.9, 1 + Math.abs(roll) * 1.5 + Math.abs(pitch) * 0.035).toFixed(1)}`, ax, telemetryY + 70, 'center', 10);
    }

    // Projected enemy target. The world supplies viewport pixel coordinates.
    const target = mobileReady ? null : state.target;
    if (target && !target.behind && Number.isFinite(target.x) && Number.isFinite(target.y)) {
      const tx = target.x;
      const ty = target.y;
      const onscreen = tx > 42 && tx < w - 42 && ty > 80 && ty < h - 175;
      if (onscreen) {
        const locked = state.locked;
        ctx.globalAlpha = 0.95;
        ctx.strokeStyle = locked ? AMBER : GREEN;
        ctx.fillStyle = locked ? AMBER : GREEN;
        const r = locked ? 23 : 27;
        const corner = 9;
        for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          ctx.beginPath();
          ctx.moveTo(tx + dx * (r - corner), ty + dy * r);
          ctx.lineTo(tx + dx * r, ty + dy * r);
          ctx.lineTo(tx + dx * r, ty + dy * (r - corner));
          ctx.stroke();
        }
        if (locked) {
          ctx.globalAlpha = 0.62;
          ctx.beginPath();
          ctx.moveTo(tx, ty - 13);
          ctx.lineTo(tx + 13, ty);
          ctx.lineTo(tx, ty + 13);
          ctx.lineTo(tx - 13, ty);
          ctx.closePath();
          ctx.stroke();
        }
        ctx.globalAlpha = 0.9;
        label(ctx, locked ? 'LOCK' : state.acquiring ? 'ACQ' : 'TGT · L', tx + r + 9, ty - 15, 'left', 10);
        label(ctx, target.name || 'F-15C', tx + r + 9, ty + 1, 'left', 11);
        label(ctx, `${((target.distance || 0) / 1000).toFixed(2)} KM`, tx + r + 9, ty + 17, 'left', 10);
        if (locked && state.mode === 'playing') {
          label(ctx, 'SHOOT', tx, ty + 44, 'center', 10);
        }
      } else {
        this.targetDirection(tx - cx, ty - cy, cx, cy, spread);
      }
    } else if (target) {
      this.targetDirection((target.x || cx + 1) - cx, (target.y || cy) - cy, cx, cy, spread);
    }

    ctx.strokeStyle = GREEN;
    ctx.fillStyle = GREEN;
    if (state.rearView) label(ctx, 'REAR VIEW · HOLD V', cx, mobile ? 100 : 174, 'center', 11);
    if (state.warning && state.mode === 'playing') {
      ctx.globalAlpha = 0.75 + Math.sin((state.time || 0) * 7) * 0.2;
      ctx.fillStyle = AMBER;
      label(ctx, state.warning, cx, Math.min(h - 236, cy + 154), 'center', 12);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }

  valueBox(x, y, width, text, direction) {
    const ctx = this.ctx;
    const left = x - width / 2;
    const right = x + width / 2;
    const notch = direction === 'right' ? right : left;
    const sign = direction === 'right' ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(left, y - 13);
    ctx.lineTo(right, y - 13);
    ctx.lineTo(right, y + 13);
    ctx.lineTo(left, y + 13);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(notch, y - 4);
    ctx.lineTo(notch + sign * 5, y);
    ctx.lineTo(notch, y + 4);
    ctx.stroke();
    label(ctx, text, x, y + 1, 'center', 17);
  }

  targetDirection(dx, dy, cx, cy, spread) {
    const ctx = this.ctx;
    const angle = Math.atan2(dy, dx);
    const radius = Math.min(spread - 35, 180);
    ctx.save();
    ctx.translate(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius * 0.7);
    ctx.rotate(angle);
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(-7, -5);
    ctx.lineTo(0, 0);
    ctx.lineTo(-7, 5);
    ctx.stroke();
    ctx.restore();
  }
}

export function radarPosition(x, z, heading, extent = 68) {
  const cos = Math.cos(heading), sin = Math.sin(heading);
  let rx = (x * cos + z * sin) / 8000 * 75;
  let ry = (z * cos - x * sin) / 8000 * 75;
  const edge = Math.max(Math.abs(rx), Math.abs(ry));
  if (edge > extent) { rx *= extent / edge; ry *= extent / edge; }
  return { x: rx, y: ry };
}

export function drawRadar(canvas, state) {
  const ctx = canvas.getContext('2d');
  const size = 176;
  const scale = canvas.width / size;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, size, size);
  const cx = 88;
  const cy = 88;
  const radius = 75;
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = DIM;
  ctx.fillStyle = 'rgba(8,31,30,.15)';
  ctx.beginPath();
  ctx.rect(cx - radius, cy - radius, radius * 2, radius * 2);
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - radius + 1, cy - radius + 1, radius * 2 - 2, radius * 2 - 2);
  ctx.clip();
  ctx.strokeStyle = 'rgba(165,245,188,.15)';
  for (const ring of [25, 50]) {
    ctx.beginPath();
    ctx.rect(cx - ring, cy - ring, ring * 2, ring * 2);
    ctx.stroke();
  }
  line(ctx, cx - radius, cy, cx + radius, cy);
  line(ctx, cx, cy - radius, cx, cy + radius);
  const sweep = (state.time || 0) * 0.8;
  for (let i = 0; i < 22; i++) {
    const angle = sweep - i * 0.024;
    ctx.strokeStyle = `rgba(165,245,188,${(1 - i / 22) * 0.11})`;
    const edge = radius / Math.max(Math.abs(Math.cos(angle)), Math.abs(Math.sin(angle)));
    line(ctx, cx, cy, cx + Math.cos(angle) * edge, cy + Math.sin(angle) * edge);
  }
  ctx.strokeStyle = 'rgba(165,245,188,.4)';
  line(ctx, cx, cy, cx + Math.cos(sweep) * radius, cy + Math.sin(sweep) * radius);
  const heading = state.playerHeading ?? (state.heading || 0) * DEG;
  const cos = Math.cos(heading);
  const sin = Math.sin(heading);
  for (const enemy of state.enemies || []) {
    const { x, y } = radarPosition(enemy.x || 0, enemy.z || 0, heading);
    ctx.strokeStyle = enemy.selected ? AMBER : GREEN;
    ctx.fillStyle = enemy.selected ? AMBER : GREEN;
    ctx.globalAlpha = enemy.selected ? 1 : 0.76;
    if (enemy.selected) {
      ctx.strokeRect(cx + x - 5, cy + y - 5, 10, 10);
    }
    ctx.fillRect(cx + x - 1.5, cy + y - 1.5, 3, 3);
  }
  if (state.wingman) {
    const { x, y } = radarPosition(state.wingman.x, state.wingman.z, heading);
    ctx.strokeStyle = '#83e5ff'; ctx.fillStyle = '#83e5ff'; ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.moveTo(cx + x, cy + y - 5); ctx.lineTo(cx + x + 5, cy + y);
    ctx.lineTo(cx + x, cy + y + 5); ctx.lineTo(cx + x - 5, cy + y); ctx.closePath(); ctx.stroke();
    label(ctx, 'PX', cx + x + 8, cy + y - 6, 'left', 8);
  }
  ctx.restore();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = GREEN;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 6);
  ctx.lineTo(cx + 4, cy + 4);
  ctx.lineTo(cx, cy + 2);
  ctx.lineTo(cx - 4, cy + 4);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 0.7;
  const northEdge = 82 / Math.max(Math.abs(sin), Math.abs(cos));
  label(ctx, 'N', cx - sin * northEdge, cy - cos * northEdge, 'center', 9);
  label(ctx, '8 KM', cx, 172, 'center', 8);
  ctx.globalAlpha = 1;
}
