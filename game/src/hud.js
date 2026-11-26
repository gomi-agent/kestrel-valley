// The instrument panel, drawn on a 2D canvas over the 3D view: a compass strip, an
// airspeed dial, an altimeter, an attitude ball, and the bars a pilot actually watches —
// throttle, fuel, damage. Amber and cyan on smoked glass, lit like the real thing.

const AMBER = '#ffc46b';
const CYAN = '#8fe3ff';
const INK = '#0d1117';
const GLASS = 'rgba(10, 14, 20, 0.55)';
const RED = '#ff6b5e';

const kt = (ms) => ms * 1.944;
const ft = (m) => m * 3.281;

function dial(ctx, x, y, r, label, valueText) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = GLASS;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,196,107,0.65)';
  ctx.stroke();
  ctx.fillStyle = AMBER;
  ctx.font = `600 ${Math.round(r * 0.19)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y + r * 0.58);
  ctx.fillStyle = '#f4f7fa';
  ctx.font = `700 ${Math.round(r * 0.3)}px system-ui, sans-serif`;
  ctx.fillText(valueText, x, y - r * 0.08);
}

function needle(ctx, x, y, r, angle, colour) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(angle) * r * 0.78, y + Math.sin(angle) * r * 0.78);
  ctx.lineWidth = 3;
  ctx.strokeStyle = colour;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = colour;
  ctx.fill();
}

function ticks(ctx, x, y, r, count, every, labelFn) {
  ctx.fillStyle = 'rgba(244,247,250,0.85)';
  ctx.strokeStyle = 'rgba(244,247,250,0.7)';
  ctx.font = `600 ${Math.round(r * 0.2)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  for (let i = 0; i <= count; i += 1) {
    const a = Math.PI * 0.75 + (i / count) * Math.PI * 1.5;
    const long = i % every === 0;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * 0.86, y + Math.sin(a) * r * 0.86);
    ctx.lineTo(x + Math.cos(a) * r * (long ? 0.68 : 0.76), y + Math.sin(a) * r * (long ? 0.68 : 0.76));
    ctx.lineWidth = long ? 2 : 1;
    ctx.stroke();
    if (labelFn && long) ctx.fillText(labelFn(i), x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5 + r * 0.07);
  }
}

function bar(ctx, x, y, w, label, frac, colour, warn) {
  ctx.fillStyle = GLASS;
  ctx.fillRect(x, y, w, 16);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, 16);
  ctx.fillStyle = warn && frac < 0.25 ? RED : colour;
  ctx.fillRect(x + 2, y + 2, (w - 4) * Math.max(0, Math.min(1, frac)), 12);
  ctx.fillStyle = '#f4f7fa';
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x, y - 5);
}

/** Draw the whole panel for this frame. `view` carries the game's public state. */
export function drawHud(ctx, w, h, flight, view) {
  ctx.clearRect(0, 0, w, h);
  if (view.state === 'title') return;
  const cx = w / 2;

  // Compass strip along the top, heading in the middle.
  const heading = ((flight.yaw * 180 / Math.PI) % 360 + 360) % 360;
  ctx.fillStyle = GLASS;
  ctx.fillRect(cx - 170, 12, 340, 34);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.strokeRect(cx - 170, 12, 340, 34);
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - 168, 14, 336, 30);
  ctx.clip();
  ctx.fillStyle = '#f4f7fa';
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
  for (let d = -60; d <= 60; d += 5) {
    const deg = Math.round((heading + d) / 5) * 5;
    const norm = ((deg % 360) + 360) % 360;
    const x = cx + (deg - heading) * 4.2;
    if (deg % 45 === 0) ctx.fillText(names[norm] || String(norm), x, 36);
    else if (deg % 15 === 0) {
      ctx.fillRect(x - 0.5, 30, 1, 8);
    }
  }
  ctx.restore();
  ctx.fillStyle = AMBER;
  ctx.font = '700 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(Math.round(heading)).padStart(3, '0') + '°', cx, 62);

  // Objective and score.
  ctx.fillStyle = '#f4f7fa';
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.fillText(view.objective, cx, 92);
  ctx.textAlign = 'right';
  ctx.fillStyle = AMBER;
  ctx.font = '700 20px system-ui, sans-serif';
  ctx.fillText(String(view.score), w - 22, 36);
  ctx.fillStyle = 'rgba(244,247,250,0.8)';
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillText(view.sortieName, w - 22, 56);
  ctx.fillText(`RINGS ${view.ringsDone}/${view.ringsTotal}`, w - 22, 74);

  // Bars, top-left.
  bar(ctx, 22, 30, 128, 'THROTTLE', flight.throttle, CYAN, false);
  bar(ctx, 22, 74, 128, 'FUEL', flight.fuel / 100, AMBER, true);
  bar(ctx, 22, 118, 128, 'DAMAGE', flight.damage / 100, RED, false);

  // Dials along the bottom: airspeed, attitude, altitude.
  const r = Math.min(74, h * 0.105);
  const dy = h - r - 26;
  const sx = 30 + r;
  dial(ctx, sx, dy, r, 'AIRSPEED · KT', String(Math.round(kt(flight.speed))));
  ticks(ctx, sx, dy, r, 14, 2, (i) => String(i * 10));
  needle(ctx, sx, dy, r, Math.PI * 0.75 + Math.min(1, kt(flight.speed) / 140) * Math.PI * 1.5, CYAN);

  const ax = w - 30 - r;
  dial(ctx, ax, dy, r, 'ALTITUDE · FT', String(Math.max(0, Math.round(ft(flight.y - 12)))));
  ticks(ctx, ax, dy, r, 15, 3, (i) => String(i / 10));
  needle(ctx, ax, dy, r, Math.PI * 0.75 + Math.min(1, ft(flight.y) / 1500) * Math.PI * 1.5, AMBER);

  // Attitude ball in the middle: the horizon rolls and slides with the aircraft.
  const bx = cx;
  const by = dy;
  ctx.save();
  ctx.beginPath();
  ctx.arc(bx, by, r * 0.92, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#274b63';
  ctx.fillRect(bx - r, by - r, r * 2, r * 2);
  ctx.translate(bx, by);
  ctx.rotate(-flight.roll);
  const drop = Math.max(-r, Math.min(r, flight.pitch * r * 1.6));
  ctx.fillStyle = '#6d5433';
  ctx.fillRect(-r, drop, r * 2, r * 2);
  ctx.fillStyle = '#f4f7fa';
  ctx.fillRect(-r, drop - 1, r * 2, 2);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(bx, by, r * 0.92, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,196,107,0.65)';
  ctx.stroke();
  ctx.fillStyle = AMBER;
  ctx.fillRect(bx - r * 0.42, by - 1.5, r * 0.84, 3);
  ctx.beginPath();
  ctx.arc(bx, by, 3, 0, Math.PI * 2);
  ctx.fill();

  // Vertical speed under the altimeter.
  ctx.fillStyle = '#f4f7fa';
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const vs = Math.round(ft(flight.vy) * 60 / 100) * 100;
  ctx.fillText(`VS ${vs > 0 ? '+' : ''}${flight.onGround ? 0 : vs} FPM`, ax, dy + r + 20);

  // Warnings and the centre message.
  let warnY = 128;
  ctx.font = '700 19px system-ui, sans-serif';
  if (flight.stalled && Math.floor(performance.now() / 350) % 2 === 0) {
    ctx.fillStyle = RED;
    ctx.fillText('STALL', cx, warnY);
    warnY += 26;
  }
  if (flight.fuel <= 0 && !flight.onGround) {
    ctx.fillStyle = RED;
    ctx.fillText('ENGINE OUT — GLIDE FOR THE FIELD', cx, warnY);
  } else if (flight.fuel < 22 && flight.fuel > 0) {
    ctx.fillStyle = AMBER;
    ctx.fillText('LOW FUEL', cx, warnY);
  }
  if (view.message && view.messageT > 0) {
    ctx.fillStyle = AMBER;
    ctx.font = '700 26px system-ui, sans-serif';
    ctx.fillText(view.message, cx, 168);
  }
}
