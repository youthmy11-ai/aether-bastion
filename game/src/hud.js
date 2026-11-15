// Vector HUD, minimap, title screen, 3-card upgrade selector, and end-of-run panels.
// All hitboxes are defined in 1280x720 logical coordinates so pointer clicks stay exact.
import { DIFFICULTIES, DIFFICULTY_ORDER, FIELD, FONT_MONO, FONT_UI, PALETTE, SCREEN, UPGRADES, WAVES } from './config.js';

const UPGRADE_BY_ID = new Map(UPGRADES.map((u) => [u.id, u]));

export const UI_RECTS = {
  autoBtn: { x: 1030, y: 16, w: 108, h: 32 },
  muteBtn: { x: 1148, y: 16, w: 106, h: 32 },
  titleStartBtn: { x: 460, y: 556, w: 360, h: 54 },
  diffCard(index) {
    return { x: 256 + index * 264, y: 274, w: 240, h: 92 };
  },
  upgradeCard(index) {
    return { x: 164 + index * 324, y: 190, w: 304, h: 370 };
  },
  endRestartBtn: { x: 392, y: 560, w: 236, h: 52 },
  endTitleBtn: { x: 652, y: 560, w: 236, h: 52 },
};

export function inRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawPanelBox(ctx, x, y, w, h, border = PALETTE.borderGlow, fill = PALETTE.panel, radius = 12) {
  ctx.save();
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = border;
  ctx.stroke();
  ctx.restore();
}

function drawUpgradeIcon(ctx, icon, cx, cy, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  if (icon === 'spread') {
    for (let i = -1; i <= 1; i += 1) {
      ctx.save();
      ctx.rotate(i * 0.34);
      ctx.fillRect(-2, -15, 4, 24);
      ctx.restore();
    }
  } else if (icon === 'bolt') {
    ctx.beginPath();
    ctx.moveTo(4, -15);
    ctx.lineTo(-9, 2);
    ctx.lineTo(0, 2);
    ctx.lineTo(-4, 15);
    ctx.lineTo(9, -2);
    ctx.lineTo(0, -2);
    ctx.closePath();
    ctx.fill();
  } else if (icon === 'star') {
    ctx.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const r = i % 2 === 0 ? 15 : 6;
      const a = (i * Math.PI) / 4 - Math.PI / 2;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  } else if (icon === 'pierce') {
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(7, 4);
    ctx.lineTo(2, 4);
    ctx.lineTo(2, 15);
    ctx.lineTo(-2, 15);
    ctx.lineTo(-2, 4);
    ctx.lineTo(-7, 4);
    ctx.closePath();
    ctx.fill();
  } else if (icon === 'shield') {
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(12, -8);
    ctx.lineTo(10, 5);
    ctx.lineTo(0, 15);
    ctx.lineTo(-10, 5);
    ctx.lineTo(-12, -8);
    ctx.closePath();
    ctx.stroke();
  } else if (icon === 'dash') {
    ctx.beginPath();
    ctx.moveTo(-12, -8);
    ctx.lineTo(3, 0);
    ctx.lineTo(-12, 8);
    ctx.moveTo(-1, -10);
    ctx.lineTo(14, 0);
    ctx.lineTo(-1, 10);
    ctx.stroke();
  } else if (icon === 'emp') {
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0.3, 2.3);
    ctx.stroke();
  } else if (icon === 'drone') {
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(13, -7, 3.5, 0, Math.PI * 2);
    ctx.arc(-13, 7, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (icon === 'hull') {
    ctx.fillRect(-3.5, -13, 7, 26);
    ctx.fillRect(-13, -3.5, 26, 7);
  } else {
    ctx.beginPath();
    ctx.arc(0, -2, 10, Math.PI, 0, false);
    ctx.lineTo(10, 11);
    ctx.moveTo(-10, -2);
    ctx.lineTo(-10, 11);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMinimap(ctx, state) {
  const mw = 156;
  const mh = 86;
  const mx = FIELD.width - mw - 36;
  const my = FIELD.height - mh - 36;
  drawPanelBox(ctx, mx, my, mw, mh, 'rgba(56, 189, 248, 0.45)', 'rgba(6, 11, 22, 0.84)', 8);

  const arenaW = FIELD.arenaRight - FIELD.arenaLeft;
  const arenaH = FIELD.arenaBottom - FIELD.arenaTop;
  const mapX = (wx) => mx + 6 + ((wx - FIELD.arenaLeft) / arenaW) * (mw - 12);
  const mapY = (wy) => my + 6 + ((wy - FIELD.arenaTop) / arenaH) * (mh - 12);

  // Crystals
  ctx.fillStyle = 'rgba(103, 232, 249, 0.5)';
  const crystals = state.pools.crystals;
  for (let i = 0; i < crystals.length; i += 1) {
    if (!crystals[i].active) continue;
    ctx.fillRect(mapX(crystals[i].x) - 1, mapY(crystals[i].y) - 1, 2, 2);
  }

  // Mortars
  ctx.strokeStyle = 'rgba(251, 113, 133, 0.7)';
  ctx.lineWidth = 1;
  const mortars = state.pools.mortars;
  for (let i = 0; i < mortars.length; i += 1) {
    if (!mortars[i].active) continue;
    ctx.beginPath();
    ctx.arc(mapX(mortars[i].x), mapY(mortars[i].y), 5, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Enemies
  const enemies = state.pools.enemies;
  for (let i = 0; i < enemies.length; i += 1) {
    const e = enemies[i];
    if (!e.active) continue;
    ctx.fillStyle = e.isBoss ? '#fbbf24' : e.kind === 'sniper' ? '#ffb703' : e.kind === 'bastion' ? '#60a5fa' : '#fb7185';
    const r = e.isBoss ? 4.5 : 2.3;
    ctx.beginPath();
    ctx.arc(mapX(e.x), mapY(e.y), r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Player dot
  ctx.fillStyle = '#67e8f9';
  ctx.beginPath();
  ctx.arc(mapX(state.player.x), mapY(state.player.y), 3.3, 0, Math.PI * 2);
  ctx.fill();
}

export function drawHud(ctx, state, ui) {
  const p = state.player;
  // Top-left: Hull, Shield, Level/XP
  drawPanelBox(ctx, 26, 12, 338, 52, 'rgba(56, 189, 248, 0.35)', 'rgba(8, 13, 25, 0.85)', 8);
  ctx.textBaseline = 'middle';
  ctx.font = `700 12px ${FONT_MONO}`;
  ctx.textAlign = 'left';

  // Hull Bar
  ctx.fillStyle = PALETTE.emerald;
  ctx.fillText('HULL', 38, 26);
  ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
  ctx.fillRect(82, 20, 146, 10);
  ctx.fillStyle = p.hp / p.maxHp > 0.35 ? PALETTE.emerald : PALETTE.danger;
  ctx.fillRect(82, 20, Math.max(0, 146 * (p.hp / p.maxHp)), 10);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `700 11px ${FONT_MONO}`;
  ctx.fillText(`${Math.ceil(p.hp)}/${p.maxHp}`, 236, 26);

  // Shield Bar
  ctx.fillStyle = PALETTE.cyan;
  ctx.font = `700 12px ${FONT_MONO}`;
  ctx.fillText('AEGIS', 38, 45);
  ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
  ctx.fillRect(82, 39, 146, 9);
  ctx.fillStyle = PALETTE.cyan;
  ctx.fillRect(82, 39, Math.max(0, 146 * (p.shield / p.maxShield)), 9);
  ctx.fillStyle = PALETTE.cyanBright;
  ctx.font = `700 11px ${FONT_MONO}`;
  ctx.fillText(`${Math.ceil(p.shield)}/${p.maxShield}`, 236, 44);

  // Level + XP thin strip along bottom of top-left bar
  ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
  ctx.fillRect(38, 55, 314, 4);
  ctx.fillStyle = PALETTE.amber;
  ctx.fillRect(38, 55, Math.min(314, 314 * (state.xp / state.xpNext)), 4);
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.amber;
  ctx.font = `700 11px ${FONT_MONO}`;
  ctx.fillText(`LV ${state.playerLevel}`, 352, 26);

  // Top-center: Sector / Wave or Boss HP
  const wave = WAVES[state.waveIndex];
  drawPanelBox(ctx, 416, 12, 448, 52, state.boss ? '#f43f5e' : 'rgba(56, 189, 248, 0.35)', 'rgba(8, 13, 25, 0.85)', 8);
  ctx.textAlign = 'center';
  if (state.boss && state.boss.active) {
    ctx.fillStyle = '#fb7185';
    ctx.font = `800 13px ${FONT_UI}`;
    ctx.fillText(`BOSS · ARCHON SOVEREIGN [PHASE ${state.boss.bossPhase}]`, 640, 26);
    ctx.fillStyle = 'rgba(30, 41, 59, 0.95)';
    ctx.fillRect(444, 39, 392, 12);
    const ratio = Math.max(0, state.boss.hp / state.boss.maxHp);
    ctx.fillStyle = state.boss.bossPhase === 3 ? '#fbbf24' : '#f43f5e';
    ctx.fillRect(444, 39, 392 * ratio, 12);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.strokeRect(444, 39, 392, 12);
  } else {
    ctx.fillStyle = PALETTE.cyanBright;
    ctx.font = `800 13px ${FONT_UI}`;
    ctx.fillText(`${wave.title}  [${state.difficulty.label}]`, 640, 26);
    const pct = wave.duration > 0 ? Math.min(1, state.waveElapsed / wave.duration) : 1;
    ctx.fillStyle = 'rgba(30, 41, 59, 0.95)';
    ctx.fillRect(468, 40, 344, 8);
    ctx.fillStyle = PALETTE.cyan;
    ctx.fillRect(468, 40, 344 * pct, 8);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `700 11px ${FONT_MONO}`;
    ctx.fillText(`WAVE ${state.waveIndex + 1}/${state.totalWaveCount}`, 640, 56);
  }

  // Top-right: Score, Combo, Best, Auto-fire & Mute buttons
  drawPanelBox(ctx, 882, 12, 372, 52, 'rgba(56, 189, 248, 0.35)', 'rgba(8, 13, 25, 0.85)', 8);
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `700 10px ${FONT_MONO}`;
  ctx.fillText(`BEST ${Math.max(ui.best, state.score).toLocaleString()}`, 894, 23);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 20px ${FONT_MONO}`;
  ctx.fillText(state.score.toLocaleString(), 894, 44);

  // Combo badge + decay timer bar
  if (state.combo > 1) {
    ctx.fillStyle = PALETTE.amber;
    ctx.font = `800 15px ${FONT_MONO}`;
    ctx.fillText(`x${state.combo.toFixed(1)}`, 974, 42);
    ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
    ctx.fillRect(974, 53, 44, 4);
    ctx.fillStyle = PALETTE.amber;
    ctx.fillRect(974, 53, 44 * Math.min(1, state.comboTimer / 3.8), 4);
  }

  // Auto-fire toggle pill
  const ab = UI_RECTS.autoBtn;
  drawPanelBox(ctx, ab.x, ab.y, ab.w, ab.h, ui.autoFire ? PALETTE.emerald : PALETTE.border, 'rgba(15, 23, 42, 0.9)', 6);
  ctx.textAlign = 'center';
  ctx.fillStyle = ui.autoFire ? PALETTE.emerald : PALETTE.muted;
  ctx.font = `700 11px ${FONT_MONO}`;
  ctx.fillText(`[F] AUTO:${ui.autoFire ? 'ON' : 'OFF'}`, ab.x + ab.w / 2, ab.y + ab.h / 2 + 1);

  // Mute toggle pill
  const mb = UI_RECTS.muteBtn;
  drawPanelBox(ctx, mb.x, mb.y, mb.w, mb.h, ui.muted ? PALETTE.crimson : PALETTE.cyan, 'rgba(15, 23, 42, 0.9)', 6);
  ctx.fillStyle = ui.muted ? PALETTE.crimson : PALETTE.cyanBright;
  ctx.fillText(`[M] ${ui.muted ? 'MUTED' : 'AUDIO'}`, mb.x + mb.w / 2, mb.y + mb.h / 2 + 1);

  // Bottom-left: Dash & EMP tactical cooldown modules
  drawPanelBox(ctx, 36, FIELD.height - 76, 300, 44, 'rgba(56, 189, 248, 0.35)', 'rgba(8, 13, 25, 0.84)', 8);
  const dashReady = p.dashTimer <= 0;
  const dashRatio = dashReady ? 1 : 1 - p.dashTimer / p.dashCooldown;
  ctx.textAlign = 'left';
  ctx.fillStyle = dashReady ? PALETTE.cyanBright : PALETTE.muted;
  ctx.font = `700 11px ${FONT_MONO}`;
  ctx.fillText('[SPACE] PHASE DASH', 48, FIELD.height - 61);
  ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
  ctx.fillRect(48, FIELD.height - 50, 124, 8);
  ctx.fillStyle = dashReady ? PALETTE.cyanBright : '#0284c7';
  ctx.fillRect(48, FIELD.height - 50, 124 * dashRatio, 8);

  const empReady = p.empTimer <= 0;
  const empRatio = empReady ? 1 : 1 - p.empTimer / p.empCooldown;
  ctx.fillStyle = empReady ? PALETTE.violet : PALETTE.muted;
  ctx.fillText('[Q] EMP NOVA', 194, FIELD.height - 61);
  ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
  ctx.fillRect(194, FIELD.height - 50, 128, 8);
  ctx.fillStyle = empReady ? PALETTE.violet : '#6d28d9';
  ctx.fillRect(194, FIELD.height - 50, 128 * empRatio, 8);

  // Compact weapon / systems telemetry strip
  drawPanelBox(ctx, 346, FIELD.height - 76, 290, 44, 'rgba(56, 189, 248, 0.25)', 'rgba(8, 13, 25, 0.8)', 8);
  const rof = (1 / p.fireInterval).toFixed(1);
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `700 10px ${FONT_MONO}`;
  ctx.fillText('SYSTEMS TELEMETRY', 358, FIELD.height - 62);
  ctx.fillStyle = PALETTE.cyanBright;
  ctx.font = `700 11px ${FONT_MONO}`;
  ctx.fillText(
    `DMG ${Math.round(p.boltDamage)}x${p.boltCount} · ROF ${rof}/s · DRN ${p.drones}`,
    358,
    FIELD.height - 46,
  );

  // Bottom-right Minimap
  drawMinimap(ctx, state);

  // Wave / Boss announcement banner
  if (state.waveBannerTimer > 0) {
    const alpha = Math.min(1, state.waveBannerTimer * 1.4);
    ctx.save();
    ctx.globalAlpha = alpha;
    drawPanelBox(ctx, 410, 86, 460, 38, PALETTE.amber, 'rgba(9, 15, 29, 0.88)', 8);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.amber;
    ctx.font = `800 15px ${FONT_UI}`;
    ctx.fillText(state.waveBannerText, 640, 105);
    ctx.restore();
  }
}

export function drawTitleOverlay(ctx, state, ui) {
  ctx.save();
  ctx.fillStyle = 'rgba(4, 8, 18, 0.56)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  drawPanelBox(ctx, 194, 72, 892, 576, 'rgba(56, 189, 248, 0.65)', 'rgba(8, 14, 28, 0.92)', 16);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.cyanBright;
  ctx.font = `700 13px ${FONT_MONO}`;
  ctx.fillText('ORBITAL DEFENSE PROTOCOL · TWIN-STICK ARENA', 640, 114);

  ctx.fillStyle = PALETTE.text;
  ctx.font = `900 54px ${FONT_UI}`;
  ctx.fillText('AETHER BASTION', 640, 164);

  ctx.fillStyle = PALETTE.muted;
  ctx.font = `500 16px ${FONT_UI}`;
  ctx.fillText('Hold the orbital chamber across 4 escalating sectors, forge upgrades, and shatter the Archon Sovereign.', 640, 206);

  if (ui.best > 0) {
    ctx.fillStyle = PALETTE.amber;
    ctx.font = `700 14px ${FONT_MONO}`;
    ctx.fillText(`LOCAL RECORD: ${ui.best.toLocaleString()} PTS`, 640, 238);
  }

  // Difficulty cards
  for (let i = 0; i < DIFFICULTY_ORDER.length; i += 1) {
    const id = DIFFICULTY_ORDER[i];
    const diff = DIFFICULTIES[id];
    const selected = state.difficultyId === id;
    const r = UI_RECTS.diffCard(i);
    drawPanelBox(
      ctx,
      r.x,
      r.y,
      r.w,
      r.h,
      selected ? PALETTE.cyanBright : 'rgba(71, 85, 105, 0.55)',
      selected ? 'rgba(14, 34, 62, 0.95)' : 'rgba(15, 23, 42, 0.85)',
      10,
    );
    ctx.textAlign = 'center';
    ctx.fillStyle = selected ? PALETTE.cyanBright : PALETTE.text;
    ctx.font = `800 17px ${FONT_UI}`;
    ctx.fillText(`[${i + 1}] ${diff.label}`, r.x + r.w / 2, r.y + 30);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `500 12px ${FONT_UI}`;
    ctx.fillText(diff.desc.split('·')[0].trim(), r.x + r.w / 2, r.y + 56);
    ctx.fillStyle = selected ? PALETTE.amber : PALETTE.muted;
    ctx.font = `700 11px ${FONT_MONO}`;
    ctx.fillText(`SCORE x${diff.scoreMult.toFixed(2)}`, r.x + r.w / 2, r.y + 75);
  }

  // Controls Matrix
  drawPanelBox(ctx, 256, 392, 768, 134, 'rgba(56, 189, 248, 0.25)', 'rgba(10, 17, 32, 0.86)', 10);
  ctx.fillStyle = PALETTE.cyan;
  ctx.font = `700 12px ${FONT_MONO}`;
  ctx.fillText('FLIGHT & COMBAT CONTROLS', 640, 415);

  const controls = [
    ['WASD / ARROWS', 'Thruster Move'],
    ['MOUSE + CLICK', 'Aim & Plasma Volley'],
    ['SPACE', 'Phase Dash (i-frames)'],
    ['Q / RIGHT-CLICK', 'EMP Pulse Nova'],
    ['F / M', 'Auto-Fire / Mute Audio'],
    ['P / ESC', 'Tactical Pause'],
  ];
  ctx.font = `600 13px ${FONT_UI}`;
  for (let i = 0; i < controls.length; i += 1) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const cx = 384 + col * 256;
    const cy = 450 + row * 40;
    ctx.fillStyle = PALETTE.amber;
    ctx.font = `700 12px ${FONT_MONO}`;
    ctx.fillText(controls[i][0], cx, cy);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `500 13px ${FONT_UI}`;
    ctx.fillText(controls[i][1], cx, cy + 17);
  }

  // Launch Button
  const btn = UI_RECTS.titleStartBtn;
  drawPanelBox(ctx, btn.x, btn.y, btn.w, btn.h, PALETTE.cyanBright, 'rgba(14, 116, 144, 0.42)', 10);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 19px ${FONT_UI}`;
  ctx.fillText('DEPLOY BASTION  [SPACE / CLICK]', 640, btn.y + btn.h / 2 + 1);
  ctx.restore();
}

export function drawUpgradeOverlay(ctx, state) {
  ctx.save();
  ctx.fillStyle = 'rgba(4, 8, 18, 0.72)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.amber;
  ctx.font = `700 13px ${FONT_MONO}`;
  ctx.fillText(`LEVEL ${state.playerLevel} REACHED · SECTOR ${state.waveIndex + 1}`, 640, 108);

  ctx.fillStyle = PALETTE.text;
  ctx.font = `900 36px ${FONT_UI}`;
  ctx.fillText('SELECT TACTICAL UPGRADE', 640, 146);

  const choices = state.upgradeChoices;
  for (let i = 0; i < choices.length; i += 1) {
    const u = choices[i];
    const r = UI_RECTS.upgradeCard(i);
    const rank = (state.upgrades[u.id] || 0) + 1;
    drawPanelBox(ctx, r.x, r.y, r.w, r.h, u.color, PALETTE.card, 14);

    // Top tier badge
    ctx.fillStyle = u.color;
    ctx.font = `800 12px ${FONT_MONO}`;
    ctx.fillText(`${u.tier} · RANK ${rank}/${u.maxStacks}`, r.x + r.w / 2, r.y + 34);

    drawUpgradeIcon(ctx, u.icon, r.x + r.w / 2, r.y + 108, u.color);

    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 22px ${FONT_UI}`;
    ctx.fillText(u.name, r.x + r.w / 2, r.y + 182);

    // Wrap description cleanly into 2 lines
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `500 15px ${FONT_UI}`;
    const parts = u.desc.split('·');
    if (parts.length > 1) {
      ctx.fillText(parts[0].trim(), r.x + r.w / 2, r.y + 228);
      ctx.fillText(parts.slice(1).join('·').trim(), r.x + r.w / 2, r.y + 254);
    } else {
      ctx.fillText(u.desc, r.x + r.w / 2, r.y + 236);
    }

    // Bottom select pill
    drawPanelBox(ctx, r.x + 36, r.y + r.h - 66, r.w - 72, 40, u.color, 'rgba(15, 23, 42, 0.95)', 8);
    ctx.fillStyle = u.color;
    ctx.font = `800 14px ${FONT_MONO}`;
    ctx.fillText(`INSTALL [${i + 1}]`, r.x + r.w / 2, r.y + r.h - 45);
  }

  ctx.fillStyle = PALETTE.muted;
  ctx.font = `600 14px ${FONT_MONO}`;
  ctx.fillText('PRESS [1], [2], [3] OR CLICK AN UPGRADE MODULE', 640, 608);
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
  ctx.font = `700 15px ${FONT_MONO}`;
  ctx.fillText('SPACE / ENTER TO RESUME', 640, 422);
  ctx.restore();
}

export function drawEndOverlay(ctx, state, screen, ui) {
  const victory = screen === SCREEN.VICTORY;
  const accent = victory ? PALETTE.amber : PALETTE.crimson;
  ctx.save();
  ctx.fillStyle = 'rgba(4, 8, 18, 0.76)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  drawPanelBox(ctx, 270, 96, 740, 540, accent, PALETTE.panel, 16);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = accent;
  ctx.font = `800 13px ${FONT_MONO}`;
  ctx.fillText(victory ? 'ARCHON SOVEREIGN NEUTRALIZED · SECTOR SECURED' : 'HULL INTEGRITY LOST · BASTION OFFLINE', 640, 134);

  ctx.fillStyle = PALETTE.text;
  ctx.font = `900 46px ${FONT_UI}`;
  ctx.fillText(victory ? 'VICTORY ACHIEVED' : 'MISSION FAILED', 640, 182);

  if (ui.isNewBest) {
    ctx.fillStyle = PALETTE.amber;
    ctx.font = `800 14px ${FONT_MONO}`;
    ctx.fillText('★ NEW HIGH SCORE RECORD ★', 640, 222);
  }

  const acc = state.shotsFired > 0 ? Math.min(100, Math.round((state.shotsHit / state.shotsFired) * 100)) : 0;
  const stats = [
    ['FINAL SCORE', state.score.toLocaleString()],
    ['BEST SCORE', Math.max(ui.best, state.score).toLocaleString()],
    ['DIFFICULTY', state.difficulty.label],
    ['SECTOR REACHED', `${state.waveIndex + 1} / ${state.totalWaveCount}`],
    ['HOSTILES DESTROYED', `${state.kills}`],
    ['PEAK COMBO', `x${state.peakCombo.toFixed(1)}`],
    ['ACCURACY', `${acc}%`],
    ['SURVIVAL TIME', `${Math.floor(state.elapsed)}s`],
  ];

  drawPanelBox(ctx, 326, 250, 628, 188, 'rgba(71, 85, 105, 0.5)', 'rgba(12, 19, 36, 0.88)', 10);
  for (let i = 0; i < stats.length; i += 1) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const sx = 356 + col * 314;
    const sy = 282 + row * 40;
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `700 12px ${FONT_MONO}`;
    ctx.fillText(stats[i][0], sx, sy);
    ctx.textAlign = 'right';
    ctx.fillStyle = i === 0 ? accent : PALETTE.text;
    ctx.font = `800 16px ${FONT_MONO}`;
    ctx.fillText(stats[i][1], sx + 264, sy);
  }

  // Installed upgrade badges
  const installed = Object.entries(state.upgrades);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `700 12px ${FONT_MONO}`;
  const upgSummary =
    installed.length > 0
      ? `MODULES: ${installed
          .map(([id, n]) => `${(UPGRADE_BY_ID.get(id)?.name ?? id).toUpperCase()} x${n}`)
          .slice(0, 4)
          .join(' · ')}`
      : 'NO UPGRADE MODULES INSTALLED';
  ctx.fillText(upgSummary, 640, 490);

  const b1 = UI_RECTS.endRestartBtn;
  drawPanelBox(ctx, b1.x, b1.y, b1.w, b1.h, accent, 'rgba(15, 23, 42, 0.95)', 10);
  ctx.fillStyle = accent;
  ctx.font = `800 16px ${FONT_UI}`;
  ctx.fillText('PLAY AGAIN [SPACE / R]', b1.x + b1.w / 2, b1.y + b1.h / 2 + 1);

  const b2 = UI_RECTS.endTitleBtn;
  drawPanelBox(ctx, b2.x, b2.y, b2.w, b2.h, PALETTE.cyan, 'rgba(15, 23, 42, 0.95)', 10);
  ctx.fillStyle = PALETTE.cyanBright;
  ctx.font = `800 16px ${FONT_UI}`;
  ctx.fillText('TITLE SCREEN [T]', b2.x + b2.w / 2, b2.y + b2.h / 2 + 1);

  ctx.restore();
}
