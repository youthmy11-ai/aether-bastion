/**
 * Deterministic screenshot scene stager (?shot=play|title|upgrade|victory&seed=N)
 * and tactical autopilot used to advance deterministic combat states.
 */

import { acquire, ENEMY_CFG, SCREEN, STEP } from '../config/constants.js';
import { evaluateSynergies, findReadySynergyHint, rollUpgradeChoices } from '../sim/synergies.js';
import { updateSolarRefraction } from '../sim/sun.js';
import { EV_OVER, EV_UPGRADE, EV_VICTORY } from '../sim/world.js';

const PRIO = { twin_bolts: 100, heavy_plasma: 95, rapid_cycle: 90, orbital_drone: 88, pierce_rail: 84, aegis_matrix: 78, emp_overcharge: 70, phase_thrusters: 66, nano_plating: 60, magnet_core: 54 };

function pickBest(choices, upgrades) {
  let b = 0; let br = -1;
  for (let i = 0; i < choices.length; i += 1) {
    const r = (PRIO[choices[i].id] || 0) + (findReadySynergyHint(upgrades, choices[i].id) ? 35 : 0);
    if (r > br) { br = r; b = i; }
  }
  return b;
}

/** Computes steering, aiming, and ability inputs for deterministic simulation runs. */
export function tacticalAutopilot(state) {
  const p = state.player;
  let fx = -p.x * 0.08; let fz = -p.z * 0.08; let near = null; let nd = Infinity; let th = 0; let urg = false;
  for (const e of state.pools.enemies) {
    if (!e.active) continue;
    const dx = p.x - e.x; const dz = p.z - e.z; const d = Math.hypot(dx, dz) || 1;
    if (d < nd) { nd = d; near = e; }
    if (d < p.empRadius * 0.85) th += 1;
    if (d < e.radius + p.radius + 3.6) {
      const w = (5.5 / d) * (e.isBoss ? 2.2 : 1.3);
      fx += (dx / d) * w; fz += (dz / d) * w;
      if (d < e.radius + p.radius + 1.8) urg = true;
    }
  }
  for (const m of state.pools.mortars) {
    if (!m.active) continue;
    const dx = p.x - m.x; const dz = p.z - m.z; const d = Math.hypot(dx, dz) || 1;
    if (d < m.radius + 1.5) { fx += (dx / d) * 3.5; fz += (dz / d) * 3.5; if (m.elapsed / m.duration > 0.65) urg = true; }
  }
  if (near) { const a = Math.atan2(near.z - p.z, near.x - p.x) + Math.PI / 2; fx += Math.cos(a) * 0.65; fz += Math.sin(a) * 0.65; }
  const len = Math.hypot(fx, fz) || 1;
  return {
    moveX: fx / len, moveZ: fz / len, aimX: near ? near.x : 0, aimZ: near ? near.z : 0, aimActive: true, fire: true,
    dash: urg && p.dashTimer <= 0, emp: (th >= 3 || urg) && p.empTimer <= 0,
    buildKind: state.shards >= 35 && state.turretsBuilt < 4 ? (state.turretsBuilt % 2 === 0 ? 'prism' : 'tesla') : null,
  };
}

const clearPools = (pools) => { for (const k of Object.keys(pools)) for (const o of pools[k]) o.active = false; };
const addBeam = (pools, x1, y1, z1, x2, y2, z2, color, width = 0.16) => {
  const b = acquire(pools.beams); if (b) Object.assign(b, { active: true, x1, y1, z1, x2, y2, z2, color, width, life: 0.24, maxLife: 0.24 });
};
const addBurst = (pools, x, z, color, n) => {
  for (let i = 0; i < n; i += 1) {
    const pt = acquire(pools.particles); if (!pt) break;
    const a = (i / n) * Math.PI * 2;
    Object.assign(pt, { active: true, x, y: 0.85, z, vx: Math.cos(a) * 4.5, vy: 2.4, vz: Math.sin(a) * 4.5, size: 0.22, life: 0.35, maxLife: 0.42, color });
  }
};
const addEnemy = (pools, kind, x, z, angle, hpF = 0.78, tel = 0) => {
  const e = acquire(pools.enemies); if (!e) return;
  const c = ENEMY_CFG[kind];
  Object.assign(e, { active: true, kind, isBoss: false, x, z, radius: c.radius, maxHp: c.hp, hp: Math.round(c.hp * hpF), angle, aimAngle: angle, telegraph: tel, revealed: kind === 'stalker' ? 3 : 0, chill: x < 0 && z > 0 ? 0.5 : 0 });
};

function composePlay(world) {
  const s = world.state; const p = s.player; const pools = s.pools; clearPools(pools);
  Object.assign(s, { waveIndex: 2, waveElapsed: 14.5, waveBannerTimer: 0, elapsed: 64.2, score: Math.max(46850, s.score), shards: 65, combo: 3.4, comboTimer: 3, kills: Math.max(92, s.kills), overchargeTimer: 4.8, overchargeMeter: 68 });
  s.sun.azimuth = 0.72; s.sun.dirX = Math.cos(0.72); s.sun.dirZ = Math.sin(0.72);
  s.upgrades = { twin_bolts: 1, rapid_cycle: 1, heavy_plasma: 1, orbital_drone: 2 };
  const syn = evaluateSynergies(s.upgrades); s.synergies = syn.active; s.synergyFlags = syn.flags;
  Object.assign(p, { x: -3.8, z: 2.6, vx: 9, vz: -3.2, aimAngle: -0.22, bank: -0.22, hp: 88, shield: 48, drones: 2, droneAngle: 0.75 });
  s.afterimages = [{ x: -4.9, z: 3.05, angle: -0.22, life: 0.18 }, { x: -6.0, z: 3.5, angle: -0.22, life: 0.12 }];
  for (const t of s.turrets) t.active = false;
  for (const [id, kind, level] of [[0, 'prism', 2], [1, 'tesla', 2], [3, 'prism', 2], [4, 'cryo', 1]]) Object.assign(s.turrets[id], { active: true, kind, level, sunlit: true });
  s.turretsBuilt = 4;

  for (const r of [
    ['bastion', 3.4, .2, 3, .62, 0], ['bastion', 9.2, -6.4, 2.36, .78, 0], ['swarmer', 1.2, -3.1, 2.4, .7, 0], ['swarmer', 4.6, -4.8, 2.5, .85, 0],
    ['swarmer', 2.4, 4.4, -2.5, .6, 0], ['swarmer', -9.8, -4.5, .4, .9, 0], ['swarmer', -11.4, 5.2, -.4, .8, 0], ['sniper', 17.5, -3.5, 2.92, .85, .42],
    ['sniper', 15.8, 8.6, 3.49, .9, .28], ['mortar', 12.2, 5.2, 3.34, .72, 0], ['mortar', -15.2, -8.2, .5, .8, 0], ['splitter', 7.8, -1.8, 3.14, .68, 0],
    ['splitter', -8.4, 8.8, -.8, .75, 0], ['shard', 6.5, 1.4, 2.8, .9, 0], ['shard', 9.5, .6, 2.9, .8, 0], ['stalker', 5.2, 7.6, -2.1, .65, 0],
    ['stalker', -1.8, -9.2, 1.4, .85, 0], ['swarmer', 13.8, -10.2, 2.6, .9, 0], ['swarmer', -16.8, 1.8, -.1, .8, 0],
  ]) addEnemy(pools, ...r);

  for (const [x, z, a, crit, color] of [[-2, 2.1, -.25, false, '#67e8f9'], [-1.8, 2.5, -.18, true, '#fbbf24'], [.8, 1.4, -.22, false, '#fde047'], [1.1, 1.8, -.14, false, '#67e8f9'], [-.5, .2, -.35, false, '#2dd4bf'], [5.8, -1.2, -.12, true, '#fbbf24']]) {
    const b = acquire(pools.playerBolts); if (b) Object.assign(b, { active: true, x, z, vx: Math.cos(a) * 34, vz: Math.sin(a) * 34, crit, color, life: 1.2 });
  }
  for (let i = 0; i < 6; i += 1) {
    const b = acquire(pools.enemyBolts); const a = Math.PI + (i - 2.5) * 0.22;
    if (b) Object.assign(b, { active: true, x: 7.8 + i * 0.6, z: -1.6 + (i % 3) * 1.4, vx: Math.cos(a) * 13, vz: Math.sin(a) * 13, color: i % 2 === 0 ? '#f43f5e' : '#38bdf8', life: 2 });
  }
  for (const [x, z, radius, elapsed] of [[-0.8, 4.6, 3.1, 0.95], [5.8, -6.8, 2.9, 0.62]]) {
    const m = acquire(pools.mortars); if (m) Object.assign(m, { active: true, sx: 12.2, sz: 5.2, x, z, radius, elapsed, duration: 1.35 });
  }
  updateSolarRefraction(s, 0.016, () => {});
  for (const b of [[-7.2, 2.1, -5.6, 1.2, .9, -3.1, '#67e8f9', .2], [1.2, .9, -3.1, 3.4, .9, .2, '#fbbf24', .16], [11.2, 2, 0, 7.8, .9, -1.8, '#67e8f9', .2], [7.2, 2, -5.6, 9.2, .9, -6.4, '#fbbf24', .15], [14.5, 1.7, 9.2, 12.2, .9, 5.2, '#fbbf24', .15]]) addBeam(pools, ...b);
  for (const [x, y, z, r0, r1, life, col] of [[3.4, .2, .2, .8, 4.2, .24, '#67e8f9'], [-14.5, .25, -9.2, 1.2, 7.8, .28, '#fbbf24']]) {
    const r = acquire(pools.rings); if (r) Object.assign(r, { active: true, x, y, z, radius: r0, maxRadius: r1, life, maxLife: 0.4, color: col });
  }
  addBurst(pools, 3.4, .2, '#67e8f9', 10); addBurst(pools, 7.8, -1.8, '#fbbf24', 10); addBurst(pools, -14.5, -9.2, '#fbbf24', 12);
  for (let i = 0; i < 4; i += 1) {
    const [x, z] = [[.5, 2.8], [4.2, 3.6], [-6.5, -1.4], [10.4, -3.2]][i];
    const c = acquire(pools.crystals); if (c) Object.assign(c, { active: true, x, z, pulse: i, life: 12 });
  }
  s.emitText(3.4, .2, 'CRIT 148!', '#fbbf24', 18); s.emitText(7.8, -1.8, 'SOLAR +65%', '#67e8f9', 15);
  s.emitText(-11.5, -5.8, 'PYLON OVERLOAD!', '#fbbf24', 16); s.emitText(5.2, 7.6, 'UNCLOAKED!', '#fde047', 14);
}

/** Normalizes query parameter shot names. */
export function normalizeShotName(raw) {
  const n = (raw || 'title').toLowerCase();
  return n === 'play' || n === 'upgrade' || n === 'over' ? n : (n === 'victory' || n === 'end') ? 'victory' : 'title';
}

/** Stages a deterministic scene and returns screen + UI descriptor for capture. */
export function stageShot(rawName, world) {
  const name = normalizeShotName(rawName); world.reset('vanguard');
  const ui = { best: 48950, autoFire: true, muted: false, isNewBest: false, guideOpen: false, pointer: { active: false } };

  if (name === 'title') {
    const s = world.state; clearPools(s.pools);
    s.elapsed = 12.4; s.sun.azimuth = 0.58; s.sun.dirX = Math.cos(0.58); s.sun.dirZ = Math.sin(0.58);
    Object.assign(s.player, { x: -1.2, z: 2.8, aimAngle: -0.35, drones: 2 });
    Object.assign(s.turrets[0], { active: true, kind: 'prism', level: 2, sunlit: true });
    Object.assign(s.turrets[1], { active: true, kind: 'prism', level: 2, sunlit: true });
    Object.assign(s.turrets[3], { active: true, kind: 'tesla', level: 2 });
    updateSolarRefraction(s, 0.016, () => {});
    addEnemy(s.pools, 'bastion', 9.5, -2.5, 3.14, .85, 0); addEnemy(s.pools, 'swarmer', 12.4, 3.8, 3.14, .9, 0); addEnemy(s.pools, 'sniper', 15.2, -7.2, 3.14, .9, .5);
    addBeam(s.pools, 7.2, 2, -5.6, 9.5, .9, -2.5, '#67e8f9', .18); addBeam(s.pools, 14.5, 1.7, -9.2, 15.2, .9, -7.2, '#fbbf24', .16);
    return { screen: SCREEN.TITLE, ui: { ...ui, autoFire: false } };
  }
  if (name === 'play') {
    world.reset('overdrive');
    for (let i = 0; i < Math.round(45 / STEP); i += 1) {
      const ev = world.step(STEP, tacticalAutopilot(world.state), false);
      if (ev & EV_UPGRADE && world.state.upgradeChoices.length) world.applyUpgrade(pickBest(world.state.upgradeChoices, world.state.upgrades));
      if (ev & EV_OVER) world.reset('overdrive');
    }
    composePlay(world);
    return { screen: SCREEN.PLAY, ui: { ...ui, best: 46850 } };
  }
  if (name === 'upgrade') {
    composePlay(world);
    const s = world.state; s.upgrades = { rapid_cycle: 1, heavy_plasma: 1 };
    const syn = evaluateSynergies(s.upgrades); s.synergies = syn.active; s.synergyFlags = syn.flags;
    s.upgradeChoices = rollUpgradeChoices(s.upgrades, s.random);
    if (!s.upgradeChoices.some((u) => u.id === 'twin_bolts')) {
      s.upgradeChoices[0] = { id: 'twin_bolts', name: 'Twin-Linked Array', tier: 'TACTICAL', color: '#38bdf8', icon: 'spread', maxStacks: 3, tag: '+1 BOLT · -6% SPREAD', desc: 'Adds +1 parallel plasma bolt per volley with tighter spread.' };
    }
    s.playerLevel = 4;
    return { screen: SCREEN.UPGRADE, ui: { ...ui, best: 46850 } };
  }
  for (let i = 0; i < Math.round(140 / STEP); i += 1) {
    world.state.player.hp = Math.max(72, world.state.player.hp);
    const ev = world.step(STEP, tacticalAutopilot(world.state), false);
    if (ev & EV_UPGRADE && world.state.upgradeChoices.length) world.applyUpgrade(pickBest(world.state.upgradeChoices, world.state.upgrades));
    if (ev & EV_VICTORY) break;
  }
  composePlay(world); clearPools(world.state.pools);
  const s = world.state; s.upgrades = { twin_bolts: 2, rapid_cycle: 2, heavy_plasma: 2, pierce_rail: 1, orbital_drone: 2 };
  const syn = evaluateSynergies(s.upgrades); s.synergies = syn.active; s.synergyFlags = syn.flags;
  Object.assign(s, { score: 68420, kills: 148, shotsFired: 420, shotsHit: 310, crits: 138, elapsed: 136, turretsBuilt: 5 });
  addBurst(s.pools, -14.5, -9.2, '#fbbf24', 16); addBurst(s.pools, 14.5, -9.2, '#67e8f9', 16); addBurst(s.pools, 14.5, 9.2, '#34d399', 16);
  return { screen: SCREEN.VICTORY, ui: { ...ui, best: 68420, isNewBest: true } };
}
