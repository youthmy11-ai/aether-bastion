// High-craft Canvas2D renderer: cosmic nebulae, parallax stars, interactive pylons,
// telegraphs, overcharge auras, particles, floating combat text, and clean screen gating.
import { FIELD, FONT_MONO, PALETTE, SCREEN } from './config.js';
import {
  drawEndOverlay,
  drawHud,
  drawPausedOverlay,
  drawTitleOverlay,
  drawUpgradeOverlay,
} from './hud.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(window.innerWidth * ratio));
    const height = Math.max(1, Math.round(window.innerHeight * ratio));
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function drawBackdropAndGrid(state) {
    ctx.fillStyle = PALETTE.arenaBg;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);

    // Multi-layered cosmic nebulae for depth behind tactical grid
    const nebulae = state.nebulae;
    for (let i = 0; i < nebulae.length; i += 1) {
      const n = nebulae[i];
      const grad = ctx.createRadialGradient(n.x, n.y, 18, n.x, n.y, n.r);
      grad.addColorStop(0, n.inner);
      grad.addColorStop(1, n.outer);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }

    // Subtle orbital station ring in background
    ctx.save();
    ctx.translate(640, 386);
    ctx.rotate(state.elapsed * 0.08);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.lineWidth = 2;
    ctx.setLineDash([18, 14]);
    ctx.beginPath();
    ctx.arc(0, 0, 265, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    const stars = state.stars;
    for (let i = 0; i < stars.length; i += 1) {
      const s = stars[i];
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = s.tint;
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.beginPath();
    ctx.rect(FIELD.arenaLeft, FIELD.arenaTop, FIELD.arenaRight - FIELD.arenaLeft, FIELD.arenaBottom - FIELD.arenaTop);
    ctx.clip();

    const step = 48;
    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = FIELD.arenaLeft; x <= FIELD.arenaRight; x += step) {
      ctx.moveTo(x, FIELD.arenaTop);
      ctx.lineTo(x, FIELD.arenaBottom);
    }
    for (let y = FIELD.arenaTop; y <= FIELD.arenaBottom; y += step) {
      ctx.moveTo(FIELD.arenaLeft, y);
      ctx.lineTo(FIELD.arenaRight, y);
    }
    ctx.stroke();

    if (state.gridPulse > 0) {
      ctx.strokeStyle = `rgba(103, 232, 249, ${(state.gridPulse * 0.34).toFixed(3)})`;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(state.gridPulseX, state.gridPulseY, (1 - state.gridPulse) * 320 + 30, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    ctx.strokeStyle = PALETTE.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(FIELD.arenaLeft, FIELD.arenaTop, FIELD.arenaRight - FIELD.arenaLeft, FIELD.arenaBottom - FIELD.arenaTop);
    ctx.strokeStyle = PALETTE.cyan;
    ctx.lineWidth = 2.5;
    const cl = 24;
    const l = FIELD.arenaLeft;
    const r = FIELD.arenaRight;
    const t = FIELD.arenaTop;
    const b = FIELD.arenaBottom;
    ctx.beginPath();
    ctx.moveTo(l, t + cl); ctx.lineTo(l, t); ctx.lineTo(l + cl, t);
    ctx.moveTo(r - cl, t); ctx.lineTo(r, t); ctx.lineTo(r, t + cl);
    ctx.moveTo(l, b - cl); ctx.lineTo(l, b); ctx.lineTo(l + cl, b);
    ctx.moveTo(r - cl, b); ctx.lineTo(r, b); ctx.lineTo(r, b - cl);
    ctx.stroke();
  }

  function drawPylons(state) {
    const pylons = state.pylons;
    for (let i = 0; i < pylons.length; i += 1) {
      const py = pylons[i];
      ctx.save();
      ctx.translate(py.x, py.y);
      if (!py.active) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, py.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        continue;
      }
      const ratio = Math.max(0, py.hp / py.maxHp);
      const glow = py.flash > 0 ? '#ffffff' : ratio < 0.45 ? '#fbbf24' : '#38bdf8';
      ctx.fillStyle = ratio < 0.45 ? 'rgba(251, 191, 36, 0.22)' : 'rgba(14, 116, 144, 0.22)';
      ctx.beginPath();
      ctx.arc(0, 0, py.radius + 12 + Math.sin(py.pulse) * 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = glow;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, py.radius + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
      ctx.stroke();

      ctx.rotate(py.pulse * 0.25);
      ctx.fillStyle = py.flash > 0 ? '#ffffff' : '#0f233c';
      ctx.strokeStyle = glow;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (let k = 0; k < 6; k += 1) {
        const a = (k * Math.PI) / 3;
        if (k === 0) ctx.moveTo(Math.cos(a) * py.radius, Math.sin(a) * py.radius);
        else ctx.lineTo(Math.cos(a) * py.radius, Math.sin(a) * py.radius);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, 7.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawMortars(state) {
    const mortars = state.pools.mortars;
    for (let i = 0; i < mortars.length; i += 1) {
      const m = mortars[i];
      if (!m.active) continue;
      const t = Math.min(1, m.elapsed / m.duration);
      ctx.save();
      ctx.fillStyle = `rgba(244, 63, 94, ${(0.09 + t * 0.24).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = t > 0.78 ? '#fbbf24' : '#fb7185';
      ctx.lineWidth = 2.2;
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(251, 113, 133, 0.3)';
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.radius * t, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(m.x - 9, m.y); ctx.lineTo(m.x + 9, m.y);
      ctx.moveTo(m.x, m.y - 9); ctx.lineTo(m.x, m.y + 9);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawCrystals(state) {
    const crystals = state.pools.crystals;
    for (let i = 0; i < crystals.length; i += 1) {
      const c = crystals[i];
      if (!c.active) continue;
      const s = 5.5 + Math.sin(c.pulse) * 1.1;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.28)';
      ctx.beginPath();
      ctx.arc(0, 0, s + 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#67e8f9';
      ctx.beginPath();
      ctx.moveTo(0, -s); ctx.lineTo(s * 0.72, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.72, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(-1.2, -1.2, 2.4, 2.4);
      ctx.restore();
    }
  }

  function drawEnemy(e, state) {
    if (e.telegraph > 0 && (e.kind === 'sniper' || e.isBoss)) {
      const locked = e.telegraph <= 0.24;
      const len = 1150;
      ctx.save();
      if (e.isBoss && e.bossPhase === 3) {
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.22)';
        ctx.lineWidth = e.radius * 1.4;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x + Math.cos(e.aimAngle) * 760, e.y + Math.sin(e.aimAngle) * 760);
        ctx.stroke();
      }
      ctx.strokeStyle = locked ? '#fbbf24' : 'rgba(255, 183, 3, 0.56)';
      ctx.lineWidth = locked ? 3.5 : 1.7;
      if (!locked) ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + Math.cos(e.aimAngle) * len, e.y + Math.sin(e.aimAngle) * len);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.angle);

    const hit = e.flash > 0;
    const stunned = e.stun > 0;

    if (e.isBoss) {
      const pCol = e.bossPhase === 3 ? '#fbbf24' : e.bossPhase === 2 ? '#fb7185' : '#f43f5e';
      ctx.fillStyle = 'rgba(244, 63, 94, 0.14)';
      ctx.beginPath();
      ctx.arc(0, 0, e.radius + 22, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.rotate(state.elapsed * 0.9);
      ctx.strokeStyle = hit ? '#ffffff' : pCol;
      ctx.lineWidth = 3.2;
      for (let k = 0; k < 4; k += 1) {
        ctx.beginPath();
        ctx.arc(0, 0, e.radius + 10, k * Math.PI * 0.5 + 0.14, (k + 1) * Math.PI * 0.5 - 0.14);
        ctx.stroke();
      }
      ctx.restore();

      ctx.fillStyle = hit ? '#ffffff' : '#1e1b2e';
      ctx.strokeStyle = hit ? '#ffffff' : pCol;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let k = 0; k < 8; k += 1) {
        const a = (k * Math.PI) / 4;
        const r = k % 2 === 0 ? e.radius : e.radius * 0.86;
        if (k === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = pCol;
      ctx.fillRect(10, -24, 28, 7);
      ctx.fillRect(10, 17, 28, 7);

      ctx.fillStyle = e.telegraph > 0 ? '#fbbf24' : pCol;
      ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
    } else if (e.kind === 'swarmer' || e.kind === 'shard') {
      const col = hit ? '#ffffff' : e.telegraph > 0 ? '#fbbf24' : e.kind === 'shard' ? '#e879f9' : '#ff4d6d';
      ctx.fillStyle = hit ? '#ffffff' : '#2a0f1c';
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(e.radius + 3, 0);
      ctx.lineTo(-e.radius * 0.85, -e.radius * 0.82);
      ctx.lineTo(-e.radius * 0.4, 0);
      ctx.lineTo(-e.radius * 0.85, e.radius * 0.82);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(1, 0, e.kind === 'shard' ? 2.5 : 3.8, 0, Math.PI * 2); ctx.fill();
    } else if (e.kind === 'sniper') {
      const col = hit ? '#ffffff' : '#ffb703';
      ctx.fillStyle = hit ? '#ffffff' : '#271e0a';
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.3;
      ctx.beginPath();
      ctx.moveTo(e.radius + 7, 0);
      ctx.lineTo(-2, -e.radius * 0.72);
      ctx.lineTo(-e.radius, 0);
      ctx.lineTo(-2, e.radius * 0.72);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = e.telegraph > 0 ? '#fef08a' : col;
      ctx.fillRect(2, -2.5, e.radius, 5);
    } else if (e.kind === 'bastion') {
      const col = hit ? '#ffffff' : '#38bdf8';
      ctx.fillStyle = hit ? '#ffffff' : '#0f253a';
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let k = 0; k < 6; k += 1) {
        const a = (k * Math.PI) / 3;
        if (k === 0) ctx.moveTo(Math.cos(a) * e.radius, Math.sin(a) * e.radius);
        else ctx.lineTo(Math.cos(a) * e.radius, Math.sin(a) * e.radius);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#67e8f9';
      ctx.lineWidth = 4.8;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius + 6, -0.68, 0.68);
      ctx.stroke();
      ctx.fillStyle = '#fb7185';
      ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, Math.PI * 2); ctx.fill();
    } else if (e.kind === 'mortar') {
      const col = hit ? '#ffffff' : '#fb7185';
      ctx.fillStyle = hit ? '#ffffff' : '#2a1322';
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.3;
      ctx.beginPath(); ctx.arc(0, 0, e.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(-6, -12, 12, 6);
      ctx.fillRect(-6, 6, 12, 6);
    } else if (e.kind === 'splitter') {
      const col = hit ? '#ffffff' : '#c084fc';
      ctx.fillStyle = hit ? '#ffffff' : '#231338';
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.3;
      ctx.beginPath();
      ctx.moveTo(0, -e.radius); ctx.lineTo(e.radius, 0); ctx.lineTo(0, e.radius); ctx.lineTo(-e.radius, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#e879f9';
      ctx.beginPath(); ctx.arc(0, 0, e.radius * 0.48, 0, Math.PI * 2); ctx.stroke();
    }

    if (stunned) {
      ctx.strokeStyle = '#a78bfa';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, e.radius + 8, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();

    if (!e.isBoss && e.hp < e.maxHp) {
      const w = e.radius * 1.9;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 10, w, 4.5);
      ctx.fillStyle = '#fb7185';
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 10, w * Math.max(0, e.hp / e.maxHp), 4.5);
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    const overcharged = state.overchargeTimer > 0;

    for (let i = 0; i < state.afterimages.length; i += 1) {
      const g = state.afterimages[i];
      ctx.save();
      ctx.globalAlpha = (g.life / 0.22) * 0.48;
      ctx.translate(g.x, g.y);
      ctx.rotate(g.angle);
      ctx.fillStyle = overcharged ? '#fbbf24' : '#67e8f9';
      ctx.beginPath();
      ctx.moveTo(p.radius + 4, 0);
      ctx.lineTo(-p.radius, -p.radius * 0.78);
      ctx.lineTo(-p.radius * 0.45, 0);
      ctx.lineTo(-p.radius, p.radius * 0.78);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    for (let d = 0; d < p.drones; d += 1) {
      const a = p.droneAngle + (Math.PI * 2 * d) / p.drones;
      const dx = p.x + Math.cos(a) * 42;
      const dy = p.y + Math.sin(a) * 42;
      ctx.save();
      ctx.translate(dx, dy);
      ctx.fillStyle = '#0f292e';
      ctx.strokeStyle = '#2dd4bf';
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#99f6e4';
      ctx.beginPath(); ctx.arc(0, 0, 2.8, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    const blinking = p.hitInvulnTimer > 0 && Math.floor(p.hitInvulnTimer * 16) % 2 === 0;
    if (blinking) return;

    ctx.save();
    ctx.translate(p.x, p.y);

    if (overcharged) {
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 13, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (p.shield > 0) {
      ctx.strokeStyle = `rgba(56, 189, 248, ${(0.3 + 0.34 * (p.shield / p.maxShield)).toFixed(2)})`;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 7.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.rotate(p.aimAngle);
    const moving = Math.hypot(p.vx, p.vy) > 20;
    if (moving || p.dashActiveTimer > 0) {
      ctx.fillStyle = p.dashActiveTimer > 0 ? '#a78bfa' : overcharged ? '#fbbf24' : '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(-p.radius * 0.55, -5.5);
      ctx.lineTo(-p.radius - (p.dashActiveTimer > 0 ? 20 : 11), 0);
      ctx.lineTo(-p.radius * 0.55, 5.5);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = p.flash > 0 ? '#fb7185' : '#0c1f38';
    ctx.strokeStyle = p.dashInvulnTimer > 0 ? '#ffffff' : overcharged ? '#fde047' : '#67e8f9';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(p.radius + 6, 0);
    ctx.lineTo(-p.radius * 0.75, -p.radius * 0.85);
    ctx.lineTo(-p.radius * 0.35, 0);
    ctx.lineTo(-p.radius * 0.75, p.radius * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = overcharged ? '#fbbf24' : '#38bdf8';
    ctx.beginPath(); ctx.arc(2, 0, 4.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawBoltsAndEffects(state, hideFloatingText) {
    const pBolts = state.pools.playerBolts;
    for (let i = 0; i < pBolts.length; i += 1) {
      const b = pBolts[i];
      if (!b.active) continue;
      const a = Math.atan2(b.vy, b.vx);
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(a);
      ctx.fillStyle = b.color;
      ctx.fillRect(-11, -b.radius * 0.56, 18, b.radius * 1.12);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-3, -1.3, 9, 2.6);
      ctx.restore();
    }

    const eBolts = state.pools.enemyBolts;
    for (let i = 0; i < eBolts.length; i += 1) {
      const b = eBolts[i];
      if (!b.active) continue;
      if (b.isRail) {
        const a = Math.atan2(b.vy, b.vx);
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(a);
        ctx.fillStyle = b.color;
        ctx.fillRect(-16, -3.2, 28, 6.4);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-10, -1.3, 20, 2.6);
        ctx.restore();
      } else {
        ctx.fillStyle = b.color;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff1f2';
        ctx.beginPath(); ctx.arc(b.x, b.y, b.radius * 0.45, 0, Math.PI * 2); ctx.fill();
      }
    }

    const rings = state.pools.rings;
    for (let i = 0; i < rings.length; i += 1) {
      const r = rings[i];
      if (!r.active) continue;
      ctx.save();
      ctx.globalAlpha = Math.max(0, r.life / r.maxLife);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.lineWidth;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const arcs = state.arcs || [];
    for (let i = 0; i < arcs.length; i += 1) {
      const arc = arcs[i];
      const alpha = Math.max(0, arc.life / arc.maxLife);
      const dx = arc.x2 - arc.x1;
      const dy = arc.y2 - arc.y1;
      const nx = -dy * 0.12;
      const ny = dx * 0.12;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = arc.color;
      ctx.lineWidth = 4.2;
      ctx.beginPath();
      ctx.moveTo(arc.x1, arc.y1);
      ctx.lineTo(arc.x1 + dx * 0.33 + nx, arc.y1 + dy * 0.33 + ny);
      ctx.lineTo(arc.x1 + dx * 0.66 - nx * 0.75, arc.y1 + dy * 0.66 - ny * 0.75);
      ctx.lineTo(arc.x2, arc.y2);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.restore();
    }

    const parts = state.pools.particles;
    for (let i = 0; i < parts.length; i += 1) {
      const p = parts[i];
      if (!p.active) continue;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    if (hideFloatingText) return;
    const texts = state.pools.texts;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < texts.length; i += 1) {
      const t = texts[i];
      if (!t.active) continue;
      ctx.globalAlpha = Math.min(1, (t.life / t.maxLife) * 1.4);
      ctx.font = `800 ${t.size}px ${FONT_MONO}`;
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawReticle(ui) {
    if (!ui.pointer || !ui.pointer.active) return;
    ctx.save();
    ctx.translate(ui.pointer.x, ui.pointer.y);
    ctx.strokeStyle = 'rgba(103, 232, 249, 0.88)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.moveTo(-15, 0); ctx.lineTo(-6, 0);
    ctx.moveTo(6, 0); ctx.lineTo(15, 0);
    ctx.moveTo(0, -15); ctx.lineTo(0, -6);
    ctx.moveTo(0, 6); ctx.lineTo(0, 15);
    ctx.stroke();
    ctx.restore();
  }

  function draw(state, screen, ui) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const shakeX = state.shake > 0.2 ? (Math.sin(state.elapsed * 73) * state.shake) : 0;
    const shakeY = state.shake > 0.2 ? (Math.cos(state.elapsed * 91) * state.shake) : 0;
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x + shakeX * view.scale, view.y + shakeY * view.scale);

    const isEndScreen = screen === SCREEN.VICTORY || screen === SCREEN.OVER;
    const hideFloatingText = screen !== SCREEN.PLAY;

    drawBackdropAndGrid(state);
    drawPylons(state);
    drawMortars(state);
    drawCrystals(state);

    const enemies = state.pools.enemies;
    for (let i = 0; i < enemies.length; i += 1) {
      if (enemies[i].active) drawEnemy(enemies[i], state);
    }

    drawPlayer(state);
    drawBoltsAndEffects(state, hideFloatingText);

    if (screen === SCREEN.TITLE) {
      drawTitleOverlay(ctx, state, ui);
      return;
    }

    if (isEndScreen) {
      drawEndOverlay(ctx, state, screen, ui);
      return;
    }

    if (screen === SCREEN.UPGRADE) {
      drawUpgradeOverlay(ctx, state);
      drawHud(ctx, state, ui);
      return;
    }

    drawHud(ctx, state, ui);
    if (screen === SCREEN.PLAY) drawReticle(ui);
    else if (screen === SCREEN.PAUSED) drawPausedOverlay(ctx);
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
