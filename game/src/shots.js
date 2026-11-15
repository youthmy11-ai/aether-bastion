// Deterministic screenshot scene generator (?shot=title|play|upgrade|victory&seed=N)
// plus backward-compatible aliases (start->title, end->victory). Uses a tactical combat autopilot
// driving the real simulation in world.js so every screenshot accurately reflects live mechanics.
import { BOSS_CFG, ENEMY_CFG, FIELD, SCREEN, STEP } from './config.js';
import { acquire } from './entities.js';
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

function chooseBestUpgradeIndex(choices) {
  let bestIdx = 0;
  let bestRank = -1;
  for (let i = 0; i < choices.length; i += 1) {
    const rank = UPGRADE_PRIORITY[choices[i].id] || 0;
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

  // Repel from enemies & flank around Bastion shields.
  const enemies = state.pools.enemies;
  for (let i = 0; i < enemies.length; i += 1) {
    const e = enemies[i];
    if (!e.active) continue;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < nearestDist) {
      nearestDist = d;
      nearestEnemy = e;
    }
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

  // Dodge incoming enemy bolts.
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

  // Avoid mortar impact zones.
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

  // Seek nearby XP crystals when not in immediate danger.
  if (!urgentDanger) {
    let bestCrystal = null;
    let bestCScore = Infinity;
    const crystals = state.pools.crystals;
    for (let i = 0; i < crystals.length; i += 1) {
      const c = crystals[i];
      if (!c.active) continue;
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < bestCScore) {
        bestCScore = d;
        bestCrystal = c;
      }
    }
    if (bestCrystal && bestCScore < 340) {
      const d = bestCScore || 1;
      fx += ((bestCrystal.x - p.x) / d) * 0.95;
      fy += ((bestCrystal.y - p.y) / d) * 0.95;
    }
  }

  // Gentle orbital strafe around target so combat looks lively.
  if (nearestEnemy) {
    const toTarget = Math.atan2(nearestEnemy.y - p.y, nearestEnemy.x - p.x);
    const strafe = toTarget + Math.PI / 2;
    fx += Math.cos(strafe) * 0.55;
    fy += Math.sin(strafe) * 0.55;
  }

  const len = Math.hypot(fx, fy) || 1;
  const moveX = fx / len;
  const moveY = fy / len;

  // Aim slightly ahead of nearest threat.
  let aimX = cx;
  let aimY = cy;
  if (nearestEnemy) {
    aimX = nearestEnemy.x;
    aimY = nearestEnemy.y;
  }

  return {
    moveX,
    moveY,
    aimX,
    aimY,
    aimActive: true,
    fire: true,
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

function composePlayShowcase(world) {
  const s = world.state;
  const p = s.player;
  const pools = s.pools;

  // Center player on left-center with active dash trail, glowing thrusters & orbital drones.
  p.x = 305;
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

  s.waveBannerTimer = 0;
  s.shake = 0;
  s.gridPulse = 0.55;
  s.gridPulseX = 620;
  s.gridPulseY = 365;
  s.combo = Math.max(3.5, s.combo);
  s.comboTimer = 2.9;

  s.afterimages.length = 0;
  for (let i = 1; i <= 4; i += 1) {
    s.afterimages.push({
      x: p.x - i * 24,
      y: p.y + i * 8,
      angle: -0.1,
      life: 0.22 - i * 0.04,
    });
  }

  // Clear pools before staging crisp, non-overlapping in-viewport combat actors.
  for (const key of ['enemies', 'playerBolts', 'enemyBolts', 'crystals', 'mortars', 'particles', 'rings', 'texts']) {
    const list = pools[key];
    for (let i = 0; i < list.length; i += 1) list[i].active = false;
  }

  // Right-half Archon Sovereign Boss with Phase 2 telegraph laser + damaged HP bar.
  const boss = acquire(pools.enemies);
  boss.active = true;
  boss.kind = 'boss';
  boss.isBoss = true;
  boss.bossPhase = 2;
  boss.x = 935;
  boss.y = 325;
  boss.radius = BOSS_CFG.radius;
  boss.maxHp = Math.round(BOSS_CFG.hp * s.difficulty.enemyHp);
  boss.hp = Math.round(boss.maxHp * 0.54);
  boss.angle = Math.atan2(p.y - boss.y, p.x - boss.x);
  boss.aimAngle = Math.atan2(455 - boss.y, 285 - boss.x);
  boss.telegraph = 0.18;
  boss.flash = 0.04;
  boss.stun = 0;
  s.boss = boss;

  p.aimAngle = Math.atan2(boss.y - p.y, boss.x - p.x);

  // Diverse mid-arena enemy squad cleanly inside 1280x720 safe bounds.
  const escorts = [
    { kind: 'bastion', x: 640, y: 365, hpRatio: 0.64, telegraph: 0 },
    { kind: 'swarmer', x: 500, y: 235, hpRatio: 0.72, telegraph: 0.22 },
    { kind: 'swarmer', x: 555, y: 272, hpRatio: 0.55, telegraph: 0 },
    { kind: 'swarmer', x: 468, y: 505, hpRatio: 0.85, telegraph: 0 },
    { kind: 'mortar', x: 815, y: 505, hpRatio: 0.7, telegraph: 0 },
    { kind: 'sniper', x: 1060, y: 170, hpRatio: 0.8, telegraph: 0.48 },
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

  // Active player twin-linked plasma bolts + orbital sentinel shots.
  const aimA = p.aimAngle;
  const shotSpecs = [
    { x: 385, y: 368, a: aimA - 0.04, crit: false, col: '#67e8f9' },
    { x: 392, y: 384, a: aimA + 0.04, crit: true, col: '#fbbf24' },
    { x: 495, y: 356, a: aimA - 0.03, crit: false, col: '#67e8f9' },
    { x: 505, y: 372, a: aimA + 0.03, crit: false, col: '#67e8f9' },
    { x: 780, y: 334, a: aimA, crit: true, col: '#fbbf24' },
    { x: 425, y: 292, a: -0.22, crit: false, col: '#2dd4bf' },
  ];
  for (let i = 0; i < shotSpecs.length; i += 1) {
    const b = acquire(pools.playerBolts);
    if (!b) break;
    const sp = shotSpecs[i];
    b.active = true;
    b.x = sp.x;
    b.y = sp.y;
    b.vx = Math.cos(sp.a) * 760;
    b.vy = Math.sin(sp.a) * 760;
    b.radius = sp.crit ? 5.2 : 4.2;
    b.color = sp.col;
    b.life = 1.2;
  }

  // Boss spiral barrage + escort enemy projectiles.
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
    { x: 585, y: 356, a: Math.PI - 0.14, col: '#38bdf8' },
    { x: 585, y: 374, a: Math.PI + 0.14, col: '#38bdf8' },
    { x: 705, y: 215, a: Math.PI * 0.72, col: '#d946ef' },
  ];
  for (let i = 0; i < extraEnemyBolts.length; i += 1) {
    const b = acquire(pools.enemyBolts);
    if (!b) break;
    const eb = extraEnemyBolts[i];
    b.active = true;
    b.x = eb.x;
    b.y = eb.y;
    b.vx = Math.cos(eb.a) * 320;
    b.vy = Math.sin(eb.a) * 320;
    b.radius = 5.2;
    b.color = eb.col;
    b.isRail = false;
    b.life = 3;
  }

  // Pulsing Mortar danger target rings.
  const mortarSpots = [
    { x: 485, y: 432, r: 68, t: 0.96 },
    { x: 705, y: 255, r: 62, t: 0.58 },
  ];
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

  // Glowing XP crystals in mid-arena.
  const crystalSpots = [
    [418, 315],
    [448, 345],
    [582, 455],
    [708, 428],
    [608, 212],
    [755, 330],
  ];
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

  // Shockwave rings & explosion/deflect sparks.
  const ringSpots = [
    { x: 616, y: 365, r: 46, maxR: 85, col: '#67e8f9', lw: 3 },
    { x: 935, y: 325, r: 86, maxR: 150, col: '#fbbf24', lw: 3.5 },
  ];
  for (let i = 0; i < ringSpots.length; i += 1) {
    const r = acquire(pools.rings);
    if (!r) break;
    r.active = true;
    r.x = ringSpots[i].x;
    r.y = ringSpots[i].y;
    r.radius = ringSpots[i].r;
    r.maxRadius = ringSpots[i].maxR;
    r.life = 0.24;
    r.maxLife = 0.4;
    r.color = ringSpots[i].col;
    r.lineWidth = ringSpots[i].lw;
  }

  const sparkClusters = [
    { x: 614, y: 365, col: '#67e8f9', n: 10 },
    { x: 892, y: 332, col: '#fbbf24', n: 10 },
    { x: 505, y: 240, col: '#ff4d6d', n: 8 },
    { x: 268, y: 398, col: '#38bdf8', n: 8 },
  ];
  for (let c = 0; c < sparkClusters.length; c += 1) {
    const cl = sparkClusters[c];
    for (let k = 0; k < cl.n; k += 1) {
      const pt = acquire(pools.particles);
      if (!pt) break;
      const a = (k / cl.n) * Math.PI * 2 + c * 0.4;
      const r = 10 + (k % 3) * 10;
      pt.active = true;
      pt.x = cl.x + Math.cos(a) * r;
      pt.y = cl.y + Math.sin(a) * r;
      pt.vx = Math.cos(a) * 120;
      pt.vy = Math.sin(a) * 120;
      pt.size = 3.2;
      pt.life = 0.28;
      pt.maxLife = 0.4;
      pt.color = cl.col;
    }
  }

  // Floating combat damage & status text.
  const labels = [
    { x: 890, y: 274, txt: '128!', col: '#fbbf24', sz: 18 },
    { x: 612, y: 332, txt: 'BLOCK', col: '#67e8f9', sz: 13 },
    { x: 505, y: 204, txt: '42', col: '#f1f5f9', sz: 14 },
    { x: 582, y: 424, txt: '+240', col: '#fbbf24', sz: 14 },
    { x: 758, y: 144, txt: '68!', col: '#fbbf24', sz: 16 },
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
    return {
      screen: SCREEN.TITLE,
      ui: {
        best: 14850,
        autoFire: false,
        muted: false,
        isNewBest: false,
        pointer: { x: 640, y: 360, active: false },
      },
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
        world.applyUpgrade(chooseBestUpgradeIndex(world.state.upgradeChoices));
      }
      if (ev & EV_OVER) break;
    }
    if (world.state.upgradeChoices.length === 0) {
      world.state.xp = world.state.xpNext;
      world.step(STEP, tacticalAutopilot(world.state), false);
    }
    return {
      screen: SCREEN.UPGRADE,
      ui: {
        best: Math.max(4200, world.state.score),
        autoFire: true,
        muted: false,
        isNewBest: false,
        pointer: { x: 640, y: 360, active: true },
      },
    };
  }

  if (name === 'play') {
    // Run real OVERDRIVE simulation into Wave 4 Boss, then stage an unmistakable mid-viewport combat frame.
    world.reset('overdrive');
    const maxPlayTicks = Math.round(115 / STEP);
    for (let i = 0; i < maxPlayTicks; i += 1) {
      const ev = world.step(STEP, tacticalAutopilot(world.state), false);
      if (ev & EV_UPGRADE && world.state.upgradeChoices.length > 0) {
        world.applyUpgrade(chooseBestUpgradeIndex(world.state.upgradeChoices));
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
      ui: {
        best: Math.max(48500, world.state.score),
        autoFire: true,
        muted: false,
        isNewBest: false,
        pointer: { x: 935, y: 325, active: true },
      },
    };
  }

  if (name === 'over') {
    const maxSteps = Math.round(120 / STEP);
    for (let i = 0; i < maxSteps; i += 1) {
      const ev = world.step(STEP, { moveX: 0, moveY: 0, aimActive: false, fire: false, dash: false, emp: false }, false);
      if (ev & EV_OVER) break;
    }
    return {
      screen: SCREEN.OVER,
      ui: {
        best: Math.max(3200, world.state.score),
        autoFire: false,
        muted: false,
        isNewBest: false,
        pointer: { x: 640, y: 360, active: false },
      },
    };
  }

  // Victory shot: run full tactical autopilot through Waves 1..3 and Boss Wave 4.
  const maxVictorySteps = Math.round(210 / STEP);
  let won = false;
  for (let i = 0; i < maxVictorySteps; i += 1) {
    const ev = world.step(STEP, tacticalAutopilot(world.state), false);
    if (ev & EV_UPGRADE && world.state.upgradeChoices.length > 0) {
      world.applyUpgrade(chooseBestUpgradeIndex(world.state.upgradeChoices));
    }
    if (ev & EV_VICTORY) {
      won = true;
      break;
    }
    if (ev & EV_OVER) break;
  }
  return {
    screen: won ? SCREEN.VICTORY : SCREEN.OVER,
    ui: {
      best: world.state.score,
      autoFire: true,
      muted: false,
      isNewBest: won,
      pointer: { x: 640, y: 360, active: false },
    },
  };
}
