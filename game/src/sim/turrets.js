/**
 * Solar Prism Pylons (defensive cover & chain overcharge blasts) and
 * Tactical Build Sockets for Prism Mirror Spires, Tesla Arc Towers, and Cryo Wards.
 */

import { acquire, BUILD_SOCKETS, PYLON_ANCHORS, PYLON_CFG, TURRET_CFG } from '../config/constants.js';

/** Allocates the 4 cardinal Solar Prism Pylons. */
export function createPylons() {
  return PYLON_ANCHORS.map((a) => ({
    id: a.id, x: a.x, z: a.z, label: a.label, radius: PYLON_CFG.radius, hp: PYLON_CFG.hp, maxHp: PYLON_CFG.hp,
    active: true, sunlit: true, solarCharge: 1, respawnTimer: 0, beamTimer: 0, pulse: a.id * 1.4, flash: 0,
  }));
}

/** Allocates the 6 Build Socket turret slots. */
export function createTurrets() {
  return BUILD_SOCKETS.map((s) => ({
    id: s.id, x: s.x, z: s.z, label: s.label, active: false, kind: 'prism', level: 1,
    sunlit: false, linked: false, solarCharge: 0, cooldown: 0, aimAngle: 0, pulse: s.id * 0.9, flash: 0,
  }));
}

/** Resets all Pylons and Turret Sockets at the start of a run. */
export function resetStructures(pylons, turrets) {
  for (const p of pylons) Object.assign(p, { active: true, hp: PYLON_CFG.hp, maxHp: PYLON_CFG.hp, respawnTimer: 0, beamTimer: 0, flash: 0, sunlit: true, solarCharge: 1 });
  for (const t of turrets) Object.assign(t, { active: false, kind: 'prism', level: 1, cooldown: 0, flash: 0, sunlit: false, linked: false, solarCharge: 0 });
}

/** Selects the nearest open socket (or upgradable same-kind socket) to the player. */
export function findTargetSocket(state, preferredKind = null) {
  const { player, turrets } = state;
  let open = null; let openD = Infinity; let upg = null; let upgD = Infinity;
  for (const t of turrets) {
    const d = Math.hypot(t.x - player.x, t.z - player.z);
    if (!t.active) { if (d < openD) { openD = d; open = t; } }
    else if (preferredKind && t.kind === preferredKind && t.level < 3 && d < upgD) { upgD = d; upg = t; }
  }
  return open || upg;
}

/** Computes build or upgrade shard cost for a socket & turret kind. */
export function getTurretCost(socket, kind) {
  const base = TURRET_CFG[kind].cost;
  return !socket || !socket.active ? base : base + socket.level * 15;
}

/** Builds or upgrades a turret on the currently targeted Build Socket. */
export function deployTurret(state, kind) {
  const cfg = TURRET_CFG[kind];
  if (!cfg) return { ok: false };
  const target = findTargetSocket(state, kind);
  if (!target) return { ok: false };
  const cost = getTurretCost(target, kind);
  if (state.shards < cost) return { ok: false };
  state.shards -= cost;
  if (!target.active) {
    Object.assign(target, { active: true, kind, level: 1, cooldown: 0.05, flash: 0.25 });
    state.turretsBuilt += 1;
    state.emitText(target.x, target.z, `${cfg.short.toUpperCase()} DEPLOYED`, cfg.color, 14);
  } else {
    target.level = Math.min(3, target.level + 1); target.flash = 0.25;
    state.emitText(target.x, target.z, `${cfg.short.toUpperCase()} TIER ${target.level}`, cfg.color, 14);
  }
  const r = acquire(state.pools.rings);
  if (r) Object.assign(r, { active: true, x: target.x, y: 0.22, z: target.z, radius: 0.6, maxRadius: 4.2, life: 0.34, maxLife: 0.34, color: cfg.color });
  return { ok: true, target };
}

/** Updates Pylon respawn timers and Tesla/Cryo Turret behaviors. */
export function updateStructures(state, dt, hitEnemy) {
  const { pylons, turrets, pools } = state;
  const enemies = pools.enemies;
  for (const p of pylons) {
    p.pulse += dt * 2.5;
    if (p.flash > 0) p.flash = Math.max(0, p.flash - dt);
    if (!p.active) { p.respawnTimer -= dt; if (p.respawnTimer <= 0) { p.active = true; p.hp = PYLON_CFG.hp; p.respawnTimer = 0; } }
  }
  for (const e of enemies) if (e.active && e.chill > 0) e.chill = Math.max(0, e.chill - dt * 2.2);

  for (const t of turrets) {
    t.pulse += dt * 2.6;
    if (t.flash > 0) t.flash = Math.max(0, t.flash - dt);
    if (!t.active) continue;
    if (t.kind === 'cryo') {
      const rad = TURRET_CFG.cryo.range + (t.level - 1) * 1.4;
      for (const e of enemies) if (e.active && Math.hypot(e.x - t.x, e.z - t.z) <= rad) e.chill = 0.6;
      t.cooldown -= dt;
      if (t.cooldown <= 0) {
        t.cooldown = 1.65;
        const r = acquire(pools.rings);
        if (r) Object.assign(r, { active: true, x: t.x, y: 0.16, z: t.z, radius: 1, maxRadius: rad, life: 0.42, maxLife: 0.42, color: TURRET_CFG.cryo.color });
      }
    } else if (t.kind === 'tesla') {
      const tesla = TURRET_CFG.tesla;
      t.cooldown -= dt; if (t.cooldown > 0) continue;
      const range = tesla.range + (t.level - 1) * 1.5;
      let first = null; let bestD = Infinity;
      for (const e of enemies) {
        if (!e.active) continue;
        const d = Math.hypot(e.x - t.x, e.z - t.z);
        if (d <= range && d < bestD) { bestD = d; first = e; }
      }
      if (!first) { t.cooldown = 0.12; continue; }
      t.cooldown = tesla.cooldown * (t.level === 3 ? 0.78 : 1);
      t.aimAngle = Math.atan2(first.z - t.z, first.x - t.x);
      let px = t.x; let pz = t.z; let cur = first; const seen = [];
      for (let c = 0; c < tesla.chains + (t.level - 1) && cur; c += 1) {
        seen.push(cur);
        const bm = acquire(pools.beams);
        if (bm) Object.assign(bm, { active: true, x1: px, y1: c === 0 ? 1.55 : 0.95, z1: pz, x2: cur.x, y2: 0.95, z2: cur.z, color: '#fbbf24', width: 0.12, life: 0.2, maxLife: 0.2 });
        hitEnemy(cur, tesla.damage * (1 + (t.level - 1) * 0.3) * (c === 0 ? 1 : 0.78), false, false);
        px = cur.x; pz = cur.z; cur = null; let nd = Infinity;
        for (const cand of enemies) {
          if (!cand.active || seen.includes(cand)) continue;
          const d = Math.hypot(cand.x - px, cand.z - pz);
          if (d <= 6.8 && d < nd) { nd = d; cur = cand; }
        }
      }
    }
  }
}

/** Checks whether an enemy bolt collides with an active Pylon. */
export function interceptEnemyBoltWithPylons(pylons, bolt) {
  for (const p of pylons) {
    if (!p.active) continue;
    const hr = p.radius + bolt.radius;
    if ((bolt.x - p.x) ** 2 + (bolt.z - p.z) ** 2 <= hr * hr) { p.flash = 0.08; return p; }
  }
  return null;
}

/** Applies player plasma hit to an active Pylon; returns detonation info when overcharged. */
export function damagePylonFromPlayerBolt(pylons, bolt) {
  for (const p of pylons) {
    if (!p.active) continue;
    const hr = p.radius + bolt.radius;
    if ((bolt.x - p.x) ** 2 + (bolt.z - p.z) ** 2 <= hr * hr) {
      p.hp -= bolt.damage; p.flash = 0.1;
      if (p.hp <= 0) { p.active = false; p.respawnTimer = PYLON_CFG.respawnTime; return { pylon: p, detonated: true }; }
      return { pylon: p, detonated: false };
    }
  }
  return null;
}
