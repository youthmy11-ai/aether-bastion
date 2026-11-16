// Vector HUD, minimap, title card, wrapped upgrade cards, and clean end-of-run panels.
import { DIFFICULTIES, DIFFICULTY_ORDER, FIELD, FONT_MONO, FONT_UI, PALETTE, SCREEN, UPGRADES, WAVES } from './config.js';
import { findAssociatedSynergy, findReadySynergyHint } from './synergies.js';

const UPGRADE_BY_ID = new Map(UPGRADES.map((u) => [u.id, u]));

export const UI_RECTS = {
  autoBtn: { x: 1034, y: 17, w: 106, h: 34 },
  muteBtn: { x: 1148, y: 17, w: 100, h: 34 },
  titleStartBtn: { x: 440, y: 534, w: 400, h: 52 },
  diffCard(index) {
    return { x: 308 + index * 226, y: 270, w: 212, h: 90 };
  },
  upgradeCard(index) {
    return { x: 164 + index * 324, y: 180, w: 304, h: 392 };
  },
  endRestartBtn: { x: 382, y: 564, w: 246, h: 54 },
  endTitleBtn: { x: 652, y: 564, w: 246, h: 54 },
};

export function inRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function formatNumber(n) {
  return Math.round(n || 0).toLocaleString('en-US');
}

export function wrapText(ctx, text, cx, startY, maxWidth, lineHeight) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let current = '';
  for (let i = 0; i < words.length; i += 1) {
    const test = current ? `${current} ${words[i]}` : words[i];
    if (ctx.measureText(test).width <= maxWidth || !current) {
      current = test;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  if (current) lines.push(current);
  const offset = ((lines.length - 1) * lineHeight) / 2;
  for (let i = 0; i < lines.length; i += 1) {
    ctx.fillText(lines[i], cx, startY - offset + i * lineHeight);
  }
}

function drawPanelBox(ctx, x, y, w, h, border = PALETTE.borderGlow, fill = PALETTE.panel, radius = 12) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = border;
  ctx.stroke();
  ctx.restore();
}

function drawUpgradeIcon(ctx, icon, cx, cy, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = color;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(0, 0, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  if (icon === 'spread') {
    for (let i = -1; i <= 1; i += 1) {
      ctx.save();
      ctx.rotate(i * 0.34);
      ctx.fillRect(-2.2, -16, 4.4, 25);
      ctx.restore();
    }
  } else if (icon === 'bolt') {
    ctx.beginPath();
    ctx.moveTo(4, -16); ctx.lineTo(-10, 2); ctx.lineTo(0, 2);
    ctx.lineTo(-4, 16); ctx.lineTo(10, -2); ctx.lineTo(0, -2);
    ctx.closePath();
    ctx.fill();
  } else if (icon === 'star') {
    ctx.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const r = i % 2 === 0 ? 16 : 6.5;
      const a = (i * Math.PI) / 4 - Math.PI / 2;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  } else if (icon === 'pierce') {
    ctx.beginPath();
    ctx.moveTo(0, -17); ctx.lineTo(8, 4); ctx.lineTo(2.5, 4);
    ctx.lineTo(2.5, 16); ctx.lineTo(-2.5, 16); ctx.lineTo(-2.5, 4); ctx.lineTo(-8, 4);
    ctx.closePath();
    ctx.fill();
  } else if (icon === 'shield') {
    ctx.beginPath();
    ctx.moveTo(0, -15); ctx.lineTo(13, -8); ctx.lineTo(10, 6);
    ctx.lineTo(0, 16); ctx.lineTo(-10, 6); ctx.lineTo(-13, -8);
    ctx.closePath();
    ctx.stroke();
  } else if (icon === 'dash') {
    ctx.beginPath();
    ctx.moveTo(-13, -8); ctx.lineTo(3, 0); ctx.lineTo(-13, 8);
    ctx.moveTo(-1, -10); ctx.lineTo(15, 0); ctx.lineTo(-1, 10);
    ctx.stroke();
  } else if (icon === 'emp') {
    ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 17, 0.3, 2.3); ctx.stroke();
  } else if (icon === 'drone') {
    ctx.beginPath(); ctx.arc(0, 0, 7.5, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(14, -7, 3.8, 0, Math.PI * 2); ctx.arc(-14, 7, 3.8, 0, Math.PI * 2); ctx.fill();
  } else if (icon === 'hull') {
    ctx.fillRect(-3.8, -14, 7.6, 28);
    ctx.fillRect(-14, -3.8, 28, 7.6);
  } else {
    ctx.beginPath();
    ctx.arc(0, -2, 11, Math.PI, 0, false);
    ctx.lineTo(11, 12);
    ctx.moveTo(-11, -2);
    ctx.lineTo(-11, 12);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMinimap(ctx, state) {
  const mw = 166;
  const mh = 92;
  const mx = FIELD.width - mw - 34;
  const my = FIELD.height - mh - 34;
  drawPanelBox(ctx, mx, my, mw, mh, 'rgba(56, 189, 248, 0.55)', 'rgba(6, 11, 22, 0.88)', 8);

  const arenaW = FIELD.arenaRight - FIELD.arenaLeft;
  const arenaH = FIELD.arenaBottom - FIELD.arenaTop;
  const mapX = (wx) => mx + 7 + ((wx - FIELD.arenaLeft) / arenaW) * (mw - 14);
  const mapY = (wy) => my + 7 + ((wy - FIELD.arenaTop) / arenaH) * (mh - 14);

  // Energy Pylons
  ctx.fillStyle = 'rgba(56, 189, 248, 0.72)';
  for (let i = 0; i < state.pylons.length; i += 1) {
    const py = state.pylons[i];
    if (!py.active) continue;
    ctx.fillRect(mapX(py.x) - 2, mapY(py.y) - 2, 4, 4);
  }

  // Crystals
  ctx.fillStyle = 'rgba(103, 232, 249, 0.58)';
  const crystals = state.pools.crystals;
  for (let i = 0; i < crystals.length; i += 1) {
    if (!crystals[i].active) continue;
    ctx.fillRect(mapX(crystals[i].x) - 1.2, mapY(crystals[i].y) - 1.2, 2.4, 2.4);
  }

  // Mortars
  ctx.strokeStyle = 'rgba(251, 113, 133, 0.8)';
  ctx.lineWidth = 1.2;
  const mortars = state.pools.mortars;
  for (let i = 0; i < mortars.length; i += 1) {
    if (!mortars[i].active) continue;
    ctx.beginPath();
    ctx.arc(mapX(mortars[i].x), mapY(mortars[i].y), 5.5, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Enemies
  const enemies = state.pools.enemies;
  for (let i = 0; i < enemies.length; i += 1) {
    const e = enemies[i];
    if (!e.active) continue;
    ctx.fillStyle = e.isBoss ? '#fbbf24' : e.kind === 'sniper' ? '#ffb703' : e.kind === 'bastion' ? '#60a5fa' : '#fb7185';
    const r = e.isBoss ? 5 : 2.8;
    ctx.beginPath();
    ctx.arc(mapX(e.x), mapY(e.y), r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Player dot
  ctx.fillStyle = '#67e8f9';
  ctx.beginPath();
  ctx.arc(mapX(state.player.x), mapY(state.player.y), 3.8, 0, Math.PI * 2);
  ctx.fill();
}

export function drawHud(ctx, state, ui) {
  const p = state.player;
  // Top-left: Hull, Shield, Level/XP (larger high-contrast typography for thumbnail clarity)
  drawPanelBox(ctx, 26, 10, 356, 58, 'rgba(56, 189, 248, 0.45)', 'rgba(7, 13, 27, 0.88)', 8);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  ctx.fillStyle = PALETTE.emerald;
  ctx.font = `800 13px ${FONT_MONO}`;
  ctx.fillText('HULL', 38, 25);
  ctx.fillStyle = 'rgba(30, 41, 59, 0.92)';
  ctx.fillRect(88, 19, 152, 12);
  ctx.fillStyle = p.hp / p.maxHp > 0.35 ? PALETTE.emerald : PALETTE.danger;
  ctx.fillRect(88, 19, Math.max(0, 152 * (p.hp / p.maxHp)), 12);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `700 13px ${FONT_MONO}`;
  ctx.fillText(`${Math.ceil(p.hp)}/${p.maxHp}`, 248, 25);

  ctx.fillStyle = PALETTE.cyan;
  ctx.font = `800 13px ${FONT_MONO}`;
  ctx.fillText('AEGIS', 38, 45);
  ctx.fillStyle = 'rgba(30, 41, 59, 0.92)';
  ctx.fillRect(88, 39, 152, 11);
  ctx.fillStyle = PALETTE.cyan;
  ctx.fillRect(88, 39, Math.max(0, 152 * (p.shield / p.maxShield)), 11);
  ctx.fillStyle = PALETTE.cyanBright;
  ctx.font = `700 13px ${FONT_MONO}`;
  ctx.fillText(`${Math.ceil(p.shield)}/${p.maxShield}`, 248, 45);

  ctx.fillStyle = 'rgba(30, 41, 59, 0.95)';
  ctx.fillRect(38, 58, 332, 5);
  ctx.fillStyle = PALETTE.amber;
  ctx.fillRect(38, 58, Math.min(332, 332 * (state.xp / state.xpNext)), 5);
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.amber;
  ctx.font = `800 13px ${FONT_MONO}`;
  ctx.fillText(`LV ${state.playerLevel}`, 370, 25);

  // Top-center: Sector / Wave or Boss HP
  const wave = WAVES[state.waveIndex];
  drawPanelBox(ctx, 398, 10, 470, 58, state.boss ? '#f43f5e' : 'rgba(56, 189, 248, 0.45)', 'rgba(7, 13, 27, 0.88)', 8);
  ctx.textAlign = 'center';
  if (state.boss && state.boss.active) {
    ctx.fillStyle = '#fb7185';
    ctx.font = `800 15px ${FONT_UI}`;
    ctx.fillText(`BOSS · ARCHON SOVEREIGN [PHASE ${state.boss.bossPhase}]`, 633, 25);
    ctx.fillStyle = 'rgba(30, 41, 59, 0.95)';
    ctx.fillRect(422, 39, 422, 14);
    const ratio = Math.max(0, state.boss.hp / state.boss.maxHp);
    ctx.fillStyle = state.boss.bossPhase === 3 ? '#fbbf24' : '#f43f5e';
    ctx.fillRect(422, 39, 422 * ratio, 14);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.strokeRect(422, 39, 422, 14);
  } else {
    ctx.fillStyle = PALETTE.cyanBright;
    ctx.font = `800 15px ${FONT_UI}`;
    ctx.fillText(`${wave.title}  [${state.difficulty.label}]`, 633, 25);
    const pct = wave.duration > 0 ? Math.min(1, state.waveElapsed / wave.duration) : 1;
    ctx.fillStyle = 'rgba(30, 41, 59, 0.95)';
    ctx.fillRect(436, 40, 394, 9);
    ctx.fillStyle = PALETTE.cyan;
    ctx.fillRect(436, 40, 394 * pct, 9);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `700 12px ${FONT_MONO}`;
    ctx.fillText(`WAVE ${state.waveIndex + 1}/${state.totalWaveCount}`, 633, 58);
  }

  // Top-right: Score, Combo, Best, Auto-fire & Mute buttons
  drawPanelBox(ctx, 884, 10, 370, 58, 'rgba(56, 189, 248, 0.45)', 'rgba(7, 13, 27, 0.88)', 8);
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `700 11px ${FONT_MONO}`;
  ctx.fillText(`BEST ${formatNumber(Math.max(ui.best, state.score))}`, 896, 22);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 22px ${FONT_MONO}`;
  ctx.fillText(formatNumber(state.score), 896, 45);

  if (state.combo > 1) {
    ctx.fillStyle = PALETTE.amber;
    ctx.font = `800 16px ${FONT_MONO}`;
    ctx.fillText(`x${state.combo.toFixed(1)}`, 986, 42);
    ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
    ctx.fillRect(986, 54, 42, 4);
    ctx.fillStyle = PALETTE.amber;
    ctx.fillRect(986, 54, 42 * Math.min(1, state.comboTimer / 3.8), 4);
  }

  const ab = UI_RECTS.autoBtn;
  drawPanelBox(ctx, ab.x, ab.y, ab.w, ab.h, ui.autoFire ? PALETTE.emerald : PALETTE.border, 'rgba(15, 23, 42, 0.92)', 6);
  ctx.textAlign = 'center';
  ctx.fillStyle = ui.autoFire ? PALETTE.emerald : PALETTE.muted;
  ctx.font = `700 12px ${FONT_MONO}`;
  ctx.fillText(`[F] AUTO:${ui.autoFire ? 'ON' : 'OFF'}`, ab.x + ab.w / 2, ab.y + ab.h / 2 + 1);

  const mb = UI_RECTS.muteBtn;
  drawPanelBox(ctx, mb.x, mb.y, mb.w, mb.h, ui.muted ? PALETTE.crimson : PALETTE.cyan, 'rgba(15, 23, 42, 0.92)', 6);
  ctx.fillStyle = ui.muted ? PALETTE.crimson : PALETTE.cyanBright;
  ctx.fillText(`[M] ${ui.muted ? 'MUTED' : 'AUDIO'}`, mb.x + mb.w / 2, mb.y + mb.h / 2 + 1);

  // Bottom-left: Dash, EMP & Overcharge + Systems Telemetry
  drawPanelBox(ctx, 34, FIELD.height - 82, 330, 50, 'rgba(56, 189, 248, 0.4)', 'rgba(7, 13, 27, 0.88)', 8);
  const dashReady = p.dashTimer <= 0;
  const dashRatio = dashReady ? 1 : 1 - p.dashTimer / p.dashCooldown;
  ctx.textAlign = 'left';
  ctx.fillStyle = dashReady ? PALETTE.cyanBright : PALETTE.muted;
  ctx.font = `800 12px ${FONT_MONO}`;
  ctx.fillText('[SPACE] DASH', 46, FIELD.height - 65);
  ctx.fillStyle = 'rgba(30, 41, 59, 0.92)';
  ctx.fillRect(46, FIELD.height - 52, 92, 9);
  ctx.fillStyle = dashReady ? PALETTE.cyanBright : '#0284c7';
  ctx.fillRect(46, FIELD.height - 52, 92 * dashRatio, 9);

  const empReady = p.empTimer <= 0;
  const empRatio = empReady ? 1 : 1 - p.empTimer / p.empCooldown;
  ctx.fillStyle = empReady ? PALETTE.violet : PALETTE.muted;
  ctx.fillText('[Q] EMP', 152, FIELD.height - 65);
  ctx.fillStyle = 'rgba(30, 41, 59, 0.92)';
  ctx.fillRect(152, FIELD.height - 52, 92, 9);
  ctx.fillStyle = empReady ? PALETTE.violet : '#6d28d9';
  ctx.fillRect(152, FIELD.height - 52, 92 * empRatio, 9);

  const overActive = state.overchargeTimer > 0;
  ctx.fillStyle = overActive ? PALETTE.amber : PALETTE.muted;
  ctx.fillText(overActive ? 'OVERCHARGE' : 'CHARGE', 258, FIELD.height - 65);
  ctx.fillStyle = 'rgba(30, 41, 59, 0.92)';
  ctx.fillRect(258, FIELD.height - 52, 92, 9);
  ctx.fillStyle = overActive ? PALETTE.amber : '#f59e0b';
  ctx.fillRect(258, FIELD.height - 52, 92 * Math.min(1, state.overchargeMeter / 100), 9);

  drawPanelBox(ctx, 376, FIELD.height - 82, 316, 50, state.synergies.length > 0 ? PALETTE.amber : 'rgba(56, 189, 248, 0.3)', 'rgba(7, 13, 27, 0.86)', 8);
  const rof = (1 / p.fireInterval).toFixed(1);
  ctx.fillStyle = state.synergies.length > 0 ? PALETTE.amber : PALETTE.muted;
  ctx.font = `700 11px ${FONT_MONO}`;
  ctx.fillText(
    state.synergies.length > 0 ? `RELIC: ${state.synergies[0].name}` : `MODE: ${state.difficulty.label}`,
    388,
    FIELD.height - 65,
  );
  ctx.fillStyle = PALETTE.cyanBright;
  ctx.font = `800 13px ${FONT_MONO}`;
  ctx.fillText(`DMG ${Math.round(p.boltDamage)}x${p.boltCount} · ROF ${rof}/s · DRN ${p.drones}`, 388, FIELD.height - 46);

  drawMinimap(ctx, state);

  if (state.waveBannerTimer > 0) {
    const alpha = Math.min(1, state.waveBannerTimer * 1.4);
    ctx.save();
    ctx.globalAlpha = alpha;
    drawPanelBox(ctx, 410, 92, 460, 40, PALETTE.amber, 'rgba(7, 13, 27, 0.9)', 8);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.amber;
    ctx.font = `800 15px ${FONT_UI}`;
    ctx.fillText(state.waveBannerText, 640, 112);
    ctx.restore();
  }
}

export function drawTitleOverlay(ctx, state, ui) {
  ctx.save();
  // Keep outer battle vivid & glowing around the sleek central glass panel
  ctx.fillStyle = 'rgba(4, 8, 18, 0.10)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  drawPanelBox(ctx, 290, 108, 700, 504, 'rgba(103, 232, 249, 0.88)', 'rgba(6, 12, 26, 0.78)', 16);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.cyanBright;
  ctx.font = `800 13px ${FONT_MONO}`;
  ctx.fillText('ORBITAL DEFENSE PROTOCOL · TWIN-STICK ARENA', 640, 142);

  ctx.fillStyle = PALETTE.text;
  ctx.font = `900 54px ${FONT_UI}`;
  ctx.fillText('AETHER BASTION', 640, 190);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = `500 14px ${FONT_UI}`;
  ctx.fillText('Defend the chamber across 4 sectors, forge relic synergies, and shatter the Archon Sovereign.', 640, 228);

  if (ui.best > 0) {
    ctx.fillStyle = PALETTE.amber;
    ctx.font = `800 14px ${FONT_MONO}`;
    ctx.fillText(`LOCAL RECORD: ${formatNumber(ui.best)} PTS`, 640, 253);
  }

  for (let i = 0; i < DIFFICULTY_ORDER.length; i += 1) {
    const id = DIFFICULTY_ORDER[i];
    const diff = DIFFICULTIES[id];
    const selected = state.difficultyId === id;
    const r = UI_RECTS.diffCard(i);
    drawPanelBox(
      ctx, r.x, r.y, r.w, r.h,
      selected ? PALETTE.cyanBright : 'rgba(100, 116, 139, 0.55)',
      selected ? 'rgba(14, 42, 74, 0.88)' : 'rgba(15, 23, 42, 0.76)',
      10,
    );
    ctx.textAlign = 'center';
    ctx.fillStyle = selected ? PALETTE.cyanBright : PALETTE.text;
    ctx.font = `800 16px ${FONT_UI}`;
    ctx.fillText(`[${i + 1}] ${diff.label}`, r.x + r.w / 2, r.y + 28);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `500 12px ${FONT_UI}`;
    ctx.fillText(diff.desc.split('·')[0].trim(), r.x + r.w / 2, r.y + 52);
    ctx.fillStyle = selected ? PALETTE.amber : PALETTE.muted;
    ctx.font = `700 11px ${FONT_MONO}`;
    ctx.fillText(`SCORE x${diff.scoreMult.toFixed(2)}`, r.x + r.w / 2, r.y + 72);
  }

  drawPanelBox(ctx, 308, 378, 664, 136, 'rgba(56, 189, 248, 0.36)', 'rgba(8, 15, 30, 0.78)', 10);
  ctx.fillStyle = PALETTE.cyanBright;
  ctx.font = `800 12px ${FONT_MONO}`;
  ctx.fillText('FLIGHT & COMBAT CONTROLS', 640, 398);

  const controls = [
    ['WASD / ARROWS', 'Thruster Move'],
    ['MOUSE + CLICK', 'Aim & Plasma Volley'],
    ['SPACE', 'Phase Dash (i-frames)'],
    ['Q / RIGHT-CLICK', 'EMP Pulse Nova'],
    ['F / M', 'Auto-Fire / Mute Audio'],
    ['P / ESC', 'Tactical Pause'],
  ];
  for (let i = 0; i < controls.length; i += 1) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const cx = 420 + col * 220;
    const cy = 432 + row * 40;
    ctx.fillStyle = PALETTE.amber;
    ctx.font = `800 12px ${FONT_MONO}`;
    ctx.fillText(controls[i][0], cx, cy);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `500 13px ${FONT_UI}`;
    ctx.fillText(controls[i][1], cx, cy + 17);
  }

  const btn = UI_RECTS.titleStartBtn;
  drawPanelBox(ctx, btn.x, btn.y, btn.w, btn.h, PALETTE.cyanBright, 'rgba(14, 116, 144, 0.58)', 10);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 19px ${FONT_UI}`;
  ctx.fillText('DEPLOY BASTION  [SPACE / CLICK]', 640, btn.y + btn.h / 2 + 1);
  ctx.restore();
}

export function drawUpgradeOverlay(ctx, state) {
  ctx.save();
  ctx.fillStyle = 'rgba(4, 8, 18, 0.62)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.amber;
  ctx.font = `800 13px ${FONT_MONO}`;
  ctx.fillText(`LEVEL ${state.playerLevel} REACHED · SECTOR ${state.waveIndex + 1}`, 640, 108);

  ctx.fillStyle = PALETTE.text;
  ctx.font = `900 36px ${FONT_UI}`;
  ctx.fillText('SELECT TACTICAL UPGRADE', 640, 144);

  const choices = state.upgradeChoices;
  for (let i = 0; i < choices.length; i += 1) {
    const u = choices[i];
    const r = UI_RECTS.upgradeCard(i);
    const rank = (state.upgrades[u.id] || 0) + 1;
    const syn = findReadySynergyHint(state.upgrades, u.id);
    const pairSyn = syn || findAssociatedSynergy(u.id);
    drawPanelBox(ctx, r.x, r.y, r.w, r.h, syn ? PALETTE.amber : u.color, PALETTE.card, 14);

    ctx.fillStyle = u.color;
    ctx.font = `800 12px ${FONT_MONO}`;
    ctx.fillText(`${u.tier} · RANK ${rank}/${u.maxStacks}`, r.x + r.w / 2, r.y + 26);

    drawUpgradeIcon(ctx, u.icon, r.x + r.w / 2, r.y + 78, u.color);

    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 20px ${FONT_UI}`;
    ctx.fillText(u.name, r.x + r.w / 2, r.y + 132);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = `500 14px ${FONT_UI}`;
    wrapText(ctx, u.desc, r.x + r.w / 2, r.y + 174, r.w - 52, 20);

    drawPanelBox(ctx, r.x + 28, r.y + 212, r.w - 56, 28, 'rgba(148, 163, 184, 0.28)', 'rgba(15, 23, 42, 0.92)', 6);
    ctx.fillStyle = u.color;
    ctx.font = `800 12px ${FONT_MONO}`;
    ctx.fillText(u.tag, r.x + r.w / 2, r.y + 226);

    if (syn) {
      drawPanelBox(ctx, r.x + 22, r.y + 250, r.w - 44, 54, PALETTE.amber, 'rgba(251, 191, 36, 0.15)', 8);
      ctx.fillStyle = PALETTE.amber;
      ctx.font = `800 11px ${FONT_MONO}`;
      ctx.fillText(`★ UNLOCKS SYNERGY: ${syn.name}`, r.x + r.w / 2, r.y + 267);
      ctx.fillStyle = '#fef08a';
      ctx.font = `600 11px ${FONT_UI}`;
      ctx.fillText(syn.bonus, r.x + r.w / 2, r.y + 288);
    } else if (pairSyn) {
      drawPanelBox(ctx, r.x + 22, r.y + 250, r.w - 44, 54, 'rgba(56, 189, 248, 0.42)', 'rgba(15, 23, 42, 0.88)', 8);
      ctx.fillStyle = PALETTE.cyanBright;
      ctx.font = `800 11px ${FONT_MONO}`;
      ctx.fillText(`◆ SYNERGY PAIR: ${pairSyn.name}`, r.x + r.w / 2, r.y + 267);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `500 11px ${FONT_UI}`;
      ctx.fillText(pairSyn.bonus, r.x + r.w / 2, r.y + 288);
    } else {
      drawPanelBox(ctx, r.x + 22, r.y + 250, r.w - 44, 54, 'rgba(74, 222, 128, 0.38)', 'rgba(15, 23, 42, 0.88)', 8);
      ctx.fillStyle = PALETTE.emerald;
      ctx.font = `800 11px ${FONT_MONO}`;
      ctx.fillText('◆ CORE SYSTEM AUGMENT', r.x + r.w / 2, r.y + 267);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `500 11px ${FONT_UI}`;
      ctx.fillText('Stacks multiplicatively with Overcharge', r.x + r.w / 2, r.y + 288);
    }

    drawPanelBox(ctx, r.x + 34, r.y + 322, r.w - 68, 44, syn ? PALETTE.amber : u.color, 'rgba(15, 23, 42, 0.96)', 8);
    ctx.fillStyle = syn ? PALETTE.amber : u.color;
    ctx.font = `800 15px ${FONT_MONO}`;
    ctx.fillText(`INSTALL [${i + 1}]`, r.x + r.w / 2, r.y + 344);
  }

  ctx.fillStyle = PALETTE.muted;
  ctx.font = `700 13px ${FONT_MONO}`;
  ctx.fillText('PRESS [1], [2], [3] OR CLICK AN UPGRADE MODULE', 640, 602);
  ctx.restore();
}

export function drawPausedOverlay(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(4, 8, 18, 0.68)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  drawPanelBox(ctx, 410, 240, 460, 230, PALETTE.cyan, PALETTE.panel, 14);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.text;
  ctx.font = `900 40px ${FONT_UI}`;
  ctx.fillText('MISSION PAUSED', 640, 310);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `500 16px ${FONT_UI}`;
  ctx.fillText('Press P or Esc to resume · R to restart run', 640, 368);
  ctx.fillStyle = PALETTE.cyanBright;
  ctx.font = `800 15px ${FONT_MONO}`;
  ctx.fillText('SPACE / ENTER TO RESUME', 640, 422);
  ctx.restore();
}

export function drawEndOverlay(ctx, state, screen, ui) {
  const victory = screen === SCREEN.VICTORY;
  const accent = victory ? PALETTE.amber : PALETTE.crimson;
  ctx.save();
  ctx.fillStyle = 'rgba(4, 8, 18, 0.56)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  drawPanelBox(ctx, 250, 78, 780, 566, accent, 'rgba(7, 13, 27, 0.92)', 16);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = accent;
  ctx.font = `800 13px ${FONT_MONO}`;
  ctx.fillText(victory ? 'ARCHON SOVEREIGN NEUTRALIZED · SECTOR SECURED' : 'HULL INTEGRITY LOST · BASTION OFFLINE', 640, 118);

  ctx.fillStyle = PALETTE.text;
  ctx.font = `900 48px ${FONT_UI}`;
  ctx.fillText(victory ? 'VICTORY ACHIEVED' : 'MISSION FAILED', 640, 168);

  if (ui.isNewBest) {
    ctx.fillStyle = PALETTE.amber;
    ctx.font = `800 15px ${FONT_MONO}`;
    ctx.fillText('★ NEW HIGH SCORE RECORD ★', 640, 208);
  }

  const acc = state.shotsFired > 0 ? Math.min(100, Math.round((state.shotsHit / state.shotsFired) * 100)) : 0;
  const stats = [
    ['FINAL SCORE', formatNumber(state.score)],
    ['BEST SCORE', formatNumber(Math.max(ui.best, state.score))],
    ['DIFFICULTY', state.difficulty.label],
    ['SECTOR REACHED', `${state.waveIndex + 1} / ${state.totalWaveCount}`],
    ['HOSTILES DESTROYED', `${state.kills}`],
    ['PEAK COMBO', `x${state.peakCombo.toFixed(1)}`],
    ['ACCURACY', `${acc}%`],
    ['SURVIVAL TIME', `${Math.floor(state.elapsed)}s`],
  ];

  drawPanelBox(ctx, 306, 236, 668, 196, 'rgba(71, 85, 105, 0.55)', 'rgba(11, 18, 34, 0.9)', 10);
  for (let i = 0; i < stats.length; i += 1) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const sx = 336 + col * 330;
    const sy = 270 + row * 42;
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `700 13px ${FONT_MONO}`;
    ctx.fillText(stats[i][0], sx, sy);
    ctx.textAlign = 'right';
    ctx.fillStyle = i === 0 ? accent : PALETTE.text;
    ctx.font = `800 18px ${FONT_MONO}`;
    ctx.fillText(stats[i][1], sx + 282, sy);
  }

  const installed = Object.entries(state.upgrades);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.cyanBright;
  ctx.font = `700 12px ${FONT_MONO}`;
  const upgSummary = installed.length > 0
    ? `MODULES: ${installed.map(([id, n]) => `${(UPGRADE_BY_ID.get(id)?.name ?? id).toUpperCase()} x${n}`).slice(0, 4).join(' · ')}`
    : 'NO UPGRADE MODULES INSTALLED';
  ctx.fillText(upgSummary, 640, 466);

  if (state.synergies.length > 0) {
    drawPanelBox(ctx, 370, 490, 540, 34, PALETTE.amber, 'rgba(251, 191, 36, 0.14)', 8);
    ctx.fillStyle = PALETTE.amber;
    ctx.font = `800 12px ${FONT_MONO}`;
    ctx.fillText(`★ RELIC SYNERGIES: ${state.synergies.map((s) => s.name).join(' · ')}`, 640, 507);
  }

  const b1 = UI_RECTS.endRestartBtn;
  drawPanelBox(ctx, b1.x, b1.y, b1.w, b1.h, accent, 'rgba(14, 116, 144, 0.35)', 10);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 17px ${FONT_UI}`;
  ctx.fillText('PLAY AGAIN [SPACE / R]', b1.x + b1.w / 2, b1.y + b1.h / 2 + 1);

  const b2 = UI_RECTS.endTitleBtn;
  drawPanelBox(ctx, b2.x, b2.y, b2.w, b2.h, PALETTE.cyanBright, 'rgba(15, 23, 42, 0.94)', 10);
  ctx.fillStyle = PALETTE.cyanBright;
  ctx.font = `800 17px ${FONT_UI}`;
  ctx.fillText('TITLE SCREEN [T]', b2.x + b2.w / 2, b2.y + b2.h / 2 + 1);

  ctx.restore();
}
