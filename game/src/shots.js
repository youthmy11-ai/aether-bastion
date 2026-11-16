// Deterministic screenshot scene stager (?shot=title|play|upgrade|victory&seed=N)
// plus backward-compatible aliases (start->title, end->victory).
import { BOSS_CFG, ENEMY_CFG, FIELD, SCREEN, STEP } from './config.js';
import { acquire } from './entities.js';
import { evaluateSynergies, findReadySynergyHint } from './synergies.js';
import { EV_OVER, EV_UPGRADE, EV_VICTORY } from './world.js';

const UPGRADE_PRIORITY = {
  twin_bolts: 100,
  heavy_plasma: 95,
  rapid_cycle: 90,
  orbital_drone: 88,
  pierce_rail: 84,
  aegis_matrix: 78,
  emp_overcharge: 70,
  phase_thrusters: 66,
  nano_plating: 60,
  magnet_core: 54,
};

function chooseBestUpgradeIndex(choices, upgrades = {}) {
  let bestIdx = 0;
  let bestRank = -1;
  for (let i = 0; i < choices.length; i += 1) {
    let rank = UPGRADE_PRIORITY[choices[i].id] || 0;
    if (findReadySynergyHint(upgrades, choices[i].id)) rank += 35;
    if (rank > bestRank) {
      bestRank = rank;
      bestIdx = i;
    }
  }
  return bestIdx;
}

export function tacticalAutopilot(state) {
  const p = state.player;
  const cx = (FIELD.arenaLeft + FIELD.arenaRight) / 2;
  const cy = (FIELD.arenaTop + FIELD.arenaBottom) / 2;

  let fx = (cx - p.x) * 0.0022;
  let fy = (cy - p.y) * 0.0022;
  let nearestEnemy = null;
  let nearestDist = Infinity;
  let nearbyThreatCount = 0;
  let urgentDanger = false;

  const enemies = state.pools.enemies;
  for (let i = 0; i < enemies.length; i += 1) {
    const e = enemies[i];
    if (!e.active) continue;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < nearestDist) { nearestDist = d; nearestEnemy = e; }
    if (d < p.empRadius * 0.88) nearbyThreatCount += 1;
    if (d < e.radius + p.radius + 78) {
      const weight = (130 / d) * (e.isBoss ? 2.2 : 1.3);
      fx += (dx / d) * weight;
      fy += (dy / d) * weight;
      if (d < e.radius + p.radius + 32) urgentDanger = true;
    }
    if (e.telegraph > 0 && e.telegraph < 0.3 && (e.kind === 'sniper' || e.isBoss)) {
      const px = -Math.sin(e.aimAngle);
      const py = Math.cos(e.aimAngle);
      const proj = (p.x - e.x) * px + (p.y - e.y) * py;
      if (Math.abs(proj) < 38) {
        const side = proj >= 0 ? 1 : -1;
        fx += px * side * 3.5;
        fy += py * side * 3.5;
        urgentDanger = true;
      }
    }
  }

  const bolts = state.pools.enemyBolts;
  for (let i = 0; i < bolts.length; i += 1) {
    const b = bolts[i];
    if (!b.active) continue;
    const dx = p.x - b.x;
    const dy = p.y - b.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 135) {
      const dot = (p.x - b.x) * b.vx + (p.y - b.y) * b.vy;
      if (dot > 0) {
        const sp = Math.hypot(b.vx, b.vy) || 1;
        const perpX = -b.vy / sp;
        const perpY = b.vx / sp;
        const side = dx * perpX + dy * perpY >= 0 ? 1 : -1;
        fx += perpX * side * (160 / d);
        fy += perpY * side * (160 / d);
        if (d < 46) urgentDanger = true;
      }
    }
  }

  const mortars = state.pools.mortars;
  for (let i = 0; i < mortars.length; i += 1) {
    const m = mortars[i];
    if (!m.active) continue;
    const dx = p.x - m.x;
    const dy = p.y - m.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < m.radius + 36) {
      fx += (dx / d) * 3.2;
      fy += (dy / d) * 3.2;
      if (m.elapsed / m.duration > 0.72) urgentDanger = true;
    }
  }

  if (!urgentDanger) {
    let bestCrystal = null;
    let bestCScore = Infinity;
    const crystals = state.pools.crystals;
    for (let i = 0; i < crystals.length; i += 1) {
      const c = crystals[i];
      if (!c.active) continue;
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < bestCScore) { bestCScore = d; bestCrystal = c; }
    }
    if (bestCrystal && bestCScore < 340) {
      const d = bestCScore || 1;
      fx += ((bestCrystal.x - p.x) / d) * 0.95;
      fy += ((bestCrystal.y - p.y) / d) * 0.95;
    }
  }

  if (nearestEnemy) {
    const toTarget = Math.atan2(nearestEnemy.y - p.y, nearestEnemy.x - p.x);
    const strafe = toTarget + Math.PI / 2;
    fx += Math.cos(strafe) * 0.55;
    fy += Math.sin(strafe) * 0.55;
  }

  const len = Math.hypot(fx, fy) || 1;
  const moveX = fx / len;
  const moveY = fy / len;
  const aimX = nearestEnemy ? nearestEnemy.x : cx;
  const aimY = nearestEnemy ? nearestEnemy.y : cy;

  return {
    moveX, moveY, aimX, aimY, aimActive: true, fire: true,
    dash: urgentDanger && p.dashTimer === 0,
    emp: (nearbyThreatCount >= 3 || urgentDanger) && p.empTimer === 0,
  };
}

export function normalizeShotName(raw) {
  const name = (raw || 'title').toLowerCase();
  if (name === 'start' || name === 'title') return 'title';
  if (name === 'play') return 'play';
  if (name === 'upgrade') return 'upgrade';
  if (name === 'end' || name === 'victory') return 'victory';
  if (name === 'over') return 'over';
  return 'title';
}

function clearVisualPools(pools) {
  for (const key of ['enemies', 'playerBolts', 'enemyBolts', 'crystals', 'mortars', 'particles', 'rings', 'texts']) {
    const list = pools[key];
    for (let i = 0; i < list.length; i += 1) list[i].active = false;
  }
}

function spawnParticleCluster(pools, x, y, color, count, minR = 8, maxR = 34) {
  for (let k = 0; k < count; k += 1) {
    const pt = acquire(pools.particles);
    if (!pt) break;
    const a = (k / count) * Math.PI * 2 + 0.35;
    const r = minR + ((k * 7) % Math.max(1, maxR - minR));
    pt.active = true;
    pt.x = x + Math.cos(a) * r;
    pt.y = y + Math.sin(a) * r;
    pt.vx = Math.cos(a) * 130;
    pt.vy = Math.sin(a) * 130;
    pt.size = 3.6;
    pt.life = 0.3;
    pt.maxLife = 0.42;
    pt.color = color;
  }
}

export function stageAttractBattle(world) {
  const s = world.state;
  const p = s.player;
  const pools = s.pools;
  clearVisualPools(pools);

  // Left showcase wing: Overcharged Bastion Ship + 2 Sentinel Drones + dash trail
  p.x = 148;
  p.y = 368;
  p.vx = 250;
  p.vy = -60;
  p.dashActiveTimer = 0.04;
  p.drones = 2;
  p.droneAngle = 0.7;
  p.aimAngle = -0.18;
  s.overchargeTimer = 5.2;
  s.overchargeMeter = 70;
  s.gridPulse = 0.65;
  s.gridPulseX = 148;
  s.gridPulseY = 368;

  s.afterimages.length = 0;
  for (let i = 1; i <= 4; i += 1) {
    s.afterimages.push({ x: p.x - i * 20, y: p.y + i * 16, angle: -0.25, life: 0.22 - i * 0.04 });
  }

  // Right showcase wing: Archon Sovereign Dreadnought + flanking hostiles
  const boss = acquire(pools.enemies);
  boss.active = true;
  boss.kind = 'boss';
  boss.isBoss = true;
  boss.bossPhase = 2;
  boss.x = 1138;
  boss.y = 358;
  boss.radius = BOSS_CFG.radius;
  boss.maxHp = BOSS_CFG.hp;
  boss.hp = Math.round(BOSS_CFG.hp * 0.62);
  boss.angle = Math.PI - 0.12;
  boss.aimAngle = Math.PI - 0.26;
  boss.telegraph = 0.16;
  s.boss = boss;

  const wingEnemies = [
    { kind: 'bastion', x: 154, y: 168, a: 0.45, tel: 0 },
    { kind: 'swarmer', x: 108, y: 552, a: -0.6, tel: 0.22 },
    { kind: 'swarmer', x: 208, y: 586, a: -1.1, tel: 0 },
    { kind: 'sniper', x: 1142, y: 148, a: Math.PI - 0.18, tel: 0.45 },
    { kind: 'splitter', x: 1132, y: 572, a: Math.PI + 0.3, tel: 0 },
    { kind: 'mortar', x: 96, y: 124, a: 0.5, tel: 0 },
  ];
  for (let i = 0; i < wingEnemies.length; i += 1) {
    const spec = wingEnemies[i];
    const e = acquire(pools.enemies);
    if (!e) break;
    const cfg = ENEMY_CFG[spec.kind];
    e.active = true;
    e.kind = spec.kind;
    e.isBoss = false;
    e.x = spec.x;
    e.y = spec.y;
    e.radius = cfg.radius;
    e.maxHp = cfg.hp;
    e.hp = cfg.hp;
    e.angle = spec.a;
    e.aimAngle = spec.a;
    e.telegraph = spec.tel;
  }

  // Visible plasma volleys streaking through outer margins
  const pShots = [
    { x: 196, y: 348, a: -0.22, col: '#fde047' },
    { x: 204, y: 368, a: -0.14, col: '#67e8f9' },
    { x: 238, y: 274, a: -0.45, col: '#2dd4bf' },
    { x: 222, y: 452, a: 0.52, col: '#fde047' },
    { x: 1055, y: 215, a: -0.05, col: '#67e8f9' },
  ];
  for (let i = 0; i < pShots.length; i += 1) {
    const b = acquire(pools.playerBolts);
    if (!b) break;
    b.active = true;
    b.x = pShots[i].x;
    b.y = pShots[i].y;
    b.vx = Math.cos(pShots[i].a) * 780;
    b.vy = Math.sin(pShots[i].a) * 780;
    b.radius = 5;
    b.color = pShots[i].col;
    b.life = 1.4;
  }

  for (let k = 0; k < 10; k += 1) {
    const b = acquire(pools.enemyBolts);
    if (!b) break;
    const a = k * ((Math.PI * 2) / 10) + 0.28;
    const d = 76 + (k % 2) * 38;
    b.active = true;
    b.x = boss.x + Math.cos(a) * d;
    b.y = boss.y + Math.sin(a) * d;
    b.vx = Math.cos(a) * 280;
    b.vy = Math.sin(a) * 280;
    b.radius = 5.5;
    b.color = k % 2 === 0 ? '#f43f5e' : '#fb7185';
    b.isRail = false;
    b.life = 2.5;
  }

  const m = acquire(pools.mortars);
  if (m) {
    m.active = true;
    m.x = 1098;
    m.y = 636;
    m.radius = 52;
    m.elapsed = 0.85;
    m.duration = 1.35;
  }

  const r1 = acquire(pools.rings);
  if (r1) { r1.active = true; r1.x = 220; r1.y = 240; r1.radius = 52; r1.maxRadius = 110; r1.life = 0.28; r1.maxLife = 0.4; r1.color = '#67e8f9'; r1.lineWidth = 3; }
  const r2 = acquire(pools.rings);
  if (r2) { r2.active = true; r2.x = 1138; r2.y = 358; r2.radius = 86; r2.maxRadius = 140; r2.life = 0.26; r2.maxLife = 0.4; r2.color = '#fbbf24'; r2.lineWidth = 3.5; }

  for (let i = 0; i < s.pylons.length; i += 1) {
    s.pylons[i].active = true;
    s.pylons[i].hp = i % 2 === 0 ? 28 : 72;
    s.pylons[i].flash = i % 2 === 0 ? 0.08 : 0;
  }
  s.arcs = [
    { x1: 247, y1: 240, x2: 154, y2: 168, color: '#67e8f9', life: 0.3, maxLife: 0.34 },
    { x1: 247, y1: 240, x2: 247, y2: 534, color: '#38bdf8', life: 0.26, maxLife: 0.34 },
    { x1: 1033, y1: 534, x2: 1132, y2: 572, color: '#fbbf24', life: 0.3, maxLife: 0.34 },
  ];

  const cSpots = [[115, 290], [235, 465], [1055, 295], [1185, 465]];
  for (let i = 0; i < cSpots.length; i += 1) {
    const c = acquire(pools.crystals);
    if (!c) break;
    c.active = true;
    c.x = cSpots[i][0];
    c.y = cSpots[i][1];
    c.value = 18;
    c.life = 12;
    c.pulse = i;
  }

  spawnParticleCluster(pools, 247, 240, '#67e8f9', 12);
  spawnParticleCluster(pools, 1138, 358, '#fbbf24', 12, 18, 56);
  spawnParticleCluster(pools, 132, 376, '#38bdf8', 10);
  spawnParticleCluster(pools, 1085, 620, '#fb7185', 10);
}

export function composePlayShowcase(world) {
  const s = world.state;
  const p = s.player;
  const pools = s.pools;

  p.x = 290;
  p.y = 385;
  p.vx = 260;
  p.vy = -85;
  p.dashActiveTimer = 0.04;
  p.hitInvulnTimer = 0;
  p.hp = Math.min(p.maxHp, 86);
  p.shield = Math.max(24, Math.round(p.maxShield * 0.72));
  p.drones = Math.max(2, p.drones);
  p.boltCount = Math.max(2, p.boltCount);
  p.droneAngle = 0.65;

  if (!s.upgrades.twin_bolts) s.upgrades.twin_bolts = 1;
  if (!s.upgrades.rapid_cycle) s.upgrades.rapid_cycle = 1;
  const synRes = evaluateSynergies(s.upgrades);
  s.synergies = synRes.active;
  s.synergyFlags = synRes.flags;

  s.waveBannerTimer = 0;
  s.shake = 0;
  s.overchargeTimer = 4.6;
  s.overchargeMeter = 64;
  s.gridPulse = 0.58;
  s.gridPulseX = 620;
  s.gridPulseY = 365;
  s.combo = Math.max(4.5, s.combo);
  s.comboTimer = 3.0;

  s.afterimages.length = 0;
  for (let i = 1; i <= 4; i += 1) {
    s.afterimages.push({ x: p.x - i * 24, y: p.y + i * 8, angle: -0.1, life: 0.22 - i * 0.04 });
  }

  clearVisualPools(pools);

  const boss = acquire(pools.enemies);
  boss.active = true;
  boss.kind = 'boss';
  boss.isBoss = true;
  boss.bossPhase = 2;
  boss.x = 942;
  boss.y = 328;
  boss.radius = BOSS_CFG.radius;
  boss.maxHp = Math.round(BOSS_CFG.hp * s.difficulty.enemyHp);
  boss.hp = Math.round(boss.maxHp * 0.54);
  boss.angle = Math.atan2(p.y - boss.y, p.x - boss.x);
  boss.aimAngle = Math.atan2(455 - boss.y, 280 - boss.x);
  boss.telegraph = 0.18;
  boss.flash = 0.04;
  boss.stun = 0;
  s.boss = boss;
  p.aimAngle = Math.atan2(boss.y - p.y, boss.x - p.x);

  const escorts = [
    { kind: 'bastion', x: 635, y: 365, hpRatio: 0.64, telegraph: 0 },
    { kind: 'swarmer', x: 498, y: 235, hpRatio: 0.72, telegraph: 0.22 },
    { kind: 'swarmer', x: 552, y: 272, hpRatio: 0.55, telegraph: 0 },
    { kind: 'swarmer', x: 465, y: 505, hpRatio: 0.85, telegraph: 0 },
    { kind: 'mortar', x: 815, y: 505, hpRatio: 0.7, telegraph: 0 },
    { kind: 'sniper', x: 1062, y: 170, hpRatio: 0.8, telegraph: 0.48 },
    { kind: 'splitter', x: 765, y: 175, hpRatio: 0.68, telegraph: 0 },
  ];
  for (let i = 0; i < escorts.length; i += 1) {
    const spec = escorts[i];
    const e = acquire(pools.enemies);
    if (!e) break;
    const cfg = ENEMY_CFG[spec.kind];
    e.active = true;
    e.kind = spec.kind;
    e.isBoss = false;
    e.x = spec.x;
    e.y = spec.y;
    e.radius = cfg.radius;
    e.maxHp = Math.round(cfg.hp * s.difficulty.enemyHp);
    e.hp = Math.round(e.maxHp * spec.hpRatio);
    e.angle = Math.atan2(p.y - e.y, p.x - e.x);
    e.aimAngle = Math.atan2(p.y - 25 - e.y, p.x + 20 - e.x);
    e.telegraph = spec.telegraph;
    e.flash = spec.kind === 'bastion' ? 0.05 : 0;
    e.stun = 0;
  }

  const aimA = p.aimAngle;
  const shotSpecs = [
    { x: 375, y: 368, a: aimA - 0.04, crit: false, col: '#fde047' },
    { x: 382, y: 384, a: aimA + 0.04, crit: true, col: '#fbbf24' },
    { x: 492, y: 356, a: aimA - 0.03, crit: false, col: '#67e8f9' },
    { x: 502, y: 372, a: aimA + 0.03, crit: false, col: '#fde047' },
    { x: 785, y: 336, a: aimA, crit: true, col: '#fbbf24' },
    { x: 418, y: 292, a: -0.22, crit: false, col: '#2dd4bf' },
  ];
  for (let i = 0; i < shotSpecs.length; i += 1) {
    const b = acquire(pools.playerBolts);
    if (!b) break;
    b.active = true;
    b.x = shotSpecs[i].x;
    b.y = shotSpecs[i].y;
    b.vx = Math.cos(shotSpecs[i].a) * 780;
    b.vy = Math.sin(shotSpecs[i].a) * 780;
    b.radius = shotSpecs[i].crit ? 5.2 : 4.2;
    b.color = shotSpecs[i].col;
    b.life = 1.2;
  }

  for (let k = 0; k < 12; k += 1) {
    const b = acquire(pools.enemyBolts);
    if (!b) break;
    const a = k * ((Math.PI * 2) / 12) + 0.35;
    const dist = 78 + (k % 3) * 46;
    b.active = true;
    b.x = boss.x + Math.cos(a) * dist;
    b.y = boss.y + Math.sin(a) * dist;
    b.vx = Math.cos(a) * 290;
    b.vy = Math.sin(a) * 290;
    b.radius = 5.5;
    b.color = k % 2 === 0 ? '#f43f5e' : '#fb7185';
    b.isRail = false;
    b.life = 3;
  }
  const extraEnemyBolts = [
    { x: 582, y: 356, a: Math.PI - 0.14, col: '#38bdf8' },
    { x: 582, y: 374, a: Math.PI + 0.14, col: '#38bdf8' },
    { x: 705, y: 215, a: Math.PI * 0.72, col: '#d946ef' },
  ];
  for (let i = 0; i < extraEnemyBolts.length; i += 1) {
    const b = acquire(pools.enemyBolts);
    if (!b) break;
    b.active = true;
    b.x = extraEnemyBolts[i].x;
    b.y = extraEnemyBolts[i].y;
    b.vx = Math.cos(extraEnemyBolts[i].a) * 320;
    b.vy = Math.sin(extraEnemyBolts[i].a) * 320;
    b.radius = 5.2;
    b.color = extraEnemyBolts[i].col;
    b.isRail = false;
    b.life = 3;
  }

  const mortarSpots = [{ x: 485, y: 432, r: 68, t: 0.96 }, { x: 705, y: 255, r: 62, t: 0.58 }];
  for (let i = 0; i < mortarSpots.length; i += 1) {
    const m = acquire(pools.mortars);
    if (!m) break;
    m.active = true;
    m.x = mortarSpots[i].x;
    m.y = mortarSpots[i].y;
    m.radius = mortarSpots[i].r;
    m.elapsed = mortarSpots[i].t;
    m.duration = 1.35;
    m.damage = 24;
  }

  const crystalSpots = [[418, 315], [448, 345], [582, 455], [708, 428], [608, 212], [755, 330]];
  for (let i = 0; i < crystalSpots.length; i += 1) {
    const c = acquire(pools.crystals);
    if (!c) break;
    c.active = true;
    c.x = crystalSpots[i][0];
    c.y = crystalSpots[i][1];
    c.value = 18;
    c.life = 12;
    c.pulse = i * 0.9;
  }

  for (let i = 0; i < s.pylons.length; i += 1) {
    s.pylons[i].active = true;
    s.pylons[i].hp = i === 0 ? 22 : i === 2 ? 34 : 76;
    s.pylons[i].flash = i === 0 ? 0.1 : i === 2 ? 0.06 : 0;
  }

  const r1 = acquire(pools.rings);
  if (r1) { r1.active = true; r1.x = 247; r1.y = 240; r1.radius = 92; r1.maxRadius = 165; r1.life = 0.3; r1.maxLife = 0.42; r1.color = '#fbbf24'; r1.lineWidth = 4; }
  const r2 = acquire(pools.rings);
  if (r2) { r2.active = true; r2.x = 942; r2.y = 328; r2.radius = 88; r2.maxRadius = 152; r2.life = 0.24; r2.maxLife = 0.4; r2.color = '#fbbf24'; r2.lineWidth = 3.5; }
  const r3 = acquire(pools.rings);
  if (r3) { r3.active = true; r3.x = 635; r3.y = 365; r3.radius = 52; r3.maxRadius = 92; r3.life = 0.26; r3.maxLife = 0.4; r3.color = '#67e8f9'; r3.lineWidth = 3; }

  s.arcs = [
    { x1: 247, y1: 240, x2: 498, y2: 235, color: '#67e8f9', life: 0.32, maxLife: 0.34 },
    { x1: 498, y1: 235, x2: 635, y2: 365, color: '#fbbf24', life: 0.3, maxLife: 0.34 },
    { x1: 635, y1: 365, x2: 765, y2: 175, color: '#67e8f9', life: 0.28, maxLife: 0.34 },
    { x1: 247, y1: 240, x2: 247, y2: 534, color: '#38bdf8', life: 0.26, maxLife: 0.34 },
  ];

  spawnParticleCluster(pools, 247, 240, '#fbbf24', 14);
  spawnParticleCluster(pools, 610, 365, '#67e8f9', 10);
  spawnParticleCluster(pools, 898, 332, '#fbbf24', 10);
  spawnParticleCluster(pools, 502, 240, '#ff4d6d', 8);

  const labels = [
    { x: 258, y: 196, txt: 'PYLON OVERLOAD!', col: '#fbbf24', sz: 15 },
    { x: 896, y: 268, txt: '128! CRIT', col: '#fbbf24', sz: 17 },
    { x: 635, y: 326, txt: 'BLOCK', col: '#67e8f9', sz: 13 },
    { x: 502, y: 202, txt: '+320', col: '#f1f5f9', sz: 14 },
    { x: 765, y: 142, txt: '88!', col: '#fbbf24', sz: 16 },
  ];
  for (let i = 0; i < labels.length; i += 1) {
    const t = acquire(pools.texts);
    if (!t) break;
    t.active = true;
    t.x = labels[i].x;
    t.y = labels[i].y;
    t.vy = -40;
    t.life = 0.56;
    t.maxLife = 0.72;
    t.text = labels[i].txt;
    t.color = labels[i].col;
    t.size = labels[i].sz;
  }
}

export function stageShot(rawName, world) {
  const name = normalizeShotName(rawName);
  world.reset('vanguard');

  if (name === 'title') {
    for (let i = 0; i < Math.round(4.5 / STEP); i += 1) {
      world.step(STEP, { moveX: 0, moveY: 0, aimActive: false, fire: false, dash: false, emp: false }, true);
    }
    stageAttractBattle(world);
    return {
      screen: SCREEN.TITLE,
      ui: { best: 14850, autoFire: false, muted: false, isNewBest: false, pointer: { x: 640, y: 360, active: false } },
    };
  }

  if (name === 'upgrade') {
    const maxSteps = Math.round(70 / STEP);
    let upgradesSeen = 0;
    for (let i = 0; i < maxSteps; i += 1) {
      const ev = world.step(STEP, tacticalAutopilot(world.state), false);
      if (ev & EV_UPGRADE && world.state.upgradeChoices.length > 0) {
        upgradesSeen += 1;
        if (upgradesSeen >= 2) break;
        world.applyUpgrade(chooseBestUpgradeIndex(world.state.upgradeChoices, world.state.upgrades));
      }
      if (ev & EV_OVER) break;
    }
    if (world.state.upgradeChoices.length === 0) {
      world.state.xp = world.state.xpNext;
      world.step(STEP, tacticalAutopilot(world.state), false);
    }
    world.state.upgrades.rapid_cycle = 1;
    world.state.player.x = 104;
    world.state.player.y = 376;
    world.state.player.drones = 1;
    world.state.waveBannerTimer = 0;
    return {
      screen: SCREEN.UPGRADE,
      ui: { best: Math.max(4200, world.state.score), autoFire: true, muted: false, isNewBest: false, pointer: { x: 640, y: 360, active: true } },
    };
  }

  if (name === 'play') {
    world.reset('overdrive');
    const maxPlayTicks = Math.round(115 / STEP);
    for (let i = 0; i < maxPlayTicks; i += 1) {
      const ev = world.step(STEP, tacticalAutopilot(world.state), false);
      if (ev & EV_UPGRADE && world.state.upgradeChoices.length > 0) {
        world.applyUpgrade(chooseBestUpgradeIndex(world.state.upgradeChoices, world.state.upgrades));
      }
      if (ev & EV_OVER) {
        world.reset('overdrive');
        continue;
      }
      if (world.state.boss && world.state.boss.active && world.state.waveElapsed > 3.2) break;
    }
    composePlayShowcase(world);
    return {
      screen: SCREEN.PLAY,
      ui: { best: Math.max(48500, world.state.score), autoFire: true, muted: false, isNewBest: false, pointer: { x: 942, y: 328, active: true } },
    };
  }

  if (name === 'over') {
    const maxSteps = Math.round(120 / STEP);
    for (let i = 0; i < maxSteps; i += 1) {
      const ev = world.step(STEP, { moveX: 0, moveY: 0, aimActive: false, fire: false, dash: false, emp: false }, false);
      if (ev & EV_OVER) break;
    }
    world.state.waveBannerTimer = 0;
    return {
      screen: SCREEN.OVER,
      ui: { best: Math.max(3200, world.state.score), autoFire: false, muted: false, isNewBest: false, pointer: { x: 640, y: 360, active: false } },
    };
  }

  const maxVictorySteps = Math.round(210 / STEP);
  let won = false;
  for (let i = 0; i < maxVictorySteps; i += 1) {
    world.state.player.hp = Math.max(45, world.state.player.hp);
    const ev = world.step(STEP, tacticalAutopilot(world.state), false);
    if (ev & EV_UPGRADE && world.state.upgradeChoices.length > 0) {
      world.applyUpgrade(chooseBestUpgradeIndex(world.state.upgradeChoices, world.state.upgrades));
    }
    if (ev & EV_VICTORY) { won = true; break; }
  }
  if (!world.state.upgrades.twin_bolts) world.state.upgrades.twin_bolts = 2;
  if (!world.state.upgrades.rapid_cycle) world.state.upgrades.rapid_cycle = 1;
  const vicSyn = evaluateSynergies(world.state.upgrades);
  world.state.synergies = vicSyn.active;
  world.state.synergyFlags = vicSyn.flags;
  won = true;
  // Stage celebratory orbital firework bursts around the Victory panel margins.
  world.state.waveBannerTimer = 0;
  world.state.shake = 0;
  world.state.player.x = 135;
  world.state.player.y = 365;
  world.state.player.aimAngle = -0.3;
  world.state.player.drones = Math.max(2, world.state.player.drones);
  for (let i = 0; i < world.state.pylons.length; i += 1) {
    world.state.pylons[i].active = true;
    world.state.pylons[i].hp = 85;
    world.state.pylons[i].flash = 0.06;
  }
  world.state.arcs = [
    { x1: 247, y1: 240, x2: 135, y2: 365, color: '#67e8f9', life: 0.3, maxLife: 0.34 },
    { x1: 1033, y1: 240, x2: 1150, y2: 210, color: '#fbbf24', life: 0.3, maxLife: 0.34 },
    { x1: 1033, y1: 534, x2: 1140, y2: 520, color: '#38bdf8', life: 0.3, maxLife: 0.34 },
  ];
  const pools = world.state.pools;
  for (let i = 0; i < pools.enemies.length; i += 1) pools.enemies[i].active = false;
  for (let i = 0; i < pools.enemyBolts.length; i += 1) pools.enemyBolts[i].active = false;
  for (let i = 0; i < pools.mortars.length; i += 1) pools.mortars[i].active = false;
  for (let i = 0; i < pools.rings.length; i += 1) pools.rings[i].active = false;
  spawnParticleCluster(pools, 130, 190, '#fbbf24', 18, 12, 52);
  spawnParticleCluster(pools, 1150, 210, '#38bdf8', 18, 12, 52);
  spawnParticleCluster(pools, 1140, 520, '#fbbf24', 18, 12, 52);
  spawnParticleCluster(pools, 140, 540, '#2dd4bf', 16, 12, 48);
  const rA = acquire(pools.rings);
  if (rA) { rA.active = true; rA.x = 1150; rA.y = 210; rA.radius = 58; rA.maxRadius = 110; rA.life = 0.32; rA.maxLife = 0.45; rA.color = '#fbbf24'; rA.lineWidth = 3.5; }
  const rB = acquire(pools.rings);
  if (rB) { rB.active = true; rB.x = 130; rB.y = 190; rB.radius = 54; rB.maxRadius = 100; rA.life = 0.32; rB.life = 0.32; rB.maxLife = 0.45; rB.color = '#38bdf8'; rB.lineWidth = 3.5; }
  const rC = acquire(pools.rings);
  if (rC) { rC.active = true; rC.x = 1140; rC.y = 520; rC.radius = 52; rC.maxRadius = 96; rC.life = 0.32; rC.maxLife = 0.45; rC.color = '#34d399'; rC.lineWidth = 3; }

  return {
    screen: won ? SCREEN.VICTORY : SCREEN.OVER,
    ui: { best: world.state.score, autoFire: true, muted: false, isNewBest: won, pointer: { x: 640, y: 360, active: false } },
  };
}
