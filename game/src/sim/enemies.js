/**
 * AI behaviors for the 6 Citadel enemy archetypes (Swarmer, Rail Sniper, Shielded Bastion,
 * Mortar Walker, Void Splitter + Shards, Stealth Void-Stalker) and mortar strike zones.
 */

import { acquire, ARENA, ENEMY_CFG, TURRET_CFG } from '../config/constants.js';
import { spawnEnemy } from './waves.js';

/** Normalizes an angle into [-PI, PI]. */
export function wrapAngle(a) {
  let x = a;
  while (x > Math.PI) x -= Math.PI * 2;
  while (x < -Math.PI) x += Math.PI * 2;
  return x;
}

/** Checks whether a frontal Bastion shield arc deflects an incoming player bolt. */
export function isBastionShieldBlocked(enemy, bolt) {
  if (enemy.kind !== 'bastion' || enemy.stun > 0) return false;
  return Math.abs(wrapAngle(Math.atan2(bolt.z - enemy.z, bolt.x - enemy.x) - enemy.angle)) <= ENEMY_CFG.bastion.shieldArc * 0.52;
}

/** Fires an enemy projectile into the pre-allocated enemy bolt pool. */
export function spawnEnemyBolt(state, x, z, angle, speed, damage, color, isRail = false) {
  const b = acquire(state.pools.enemyBolts);
  if (b) Object.assign(b, { active: true, x, z, vx: Math.cos(angle) * speed, vz: Math.sin(angle) * speed, radius: isRail ? 0.28 : 0.23, damage, life: isRail ? 1.8 : 3.4, color, isRail });
}

/** Spawns a parabolic ground mortar telegraph ring onto (tx, tz). */
export function spawnMortarStrike(state, sx, sz, tx, tz, radius, damage) {
  const m = acquire(state.pools.mortars);
  if (m) Object.assign(m, { active: true, sx, sz, x: Math.max(-ARENA.halfX + 1.5, Math.min(ARENA.halfX - 1.5, tx)), z: Math.max(-ARENA.halfZ + 1.5, Math.min(ARENA.halfZ - 1.5, tz)), radius, elapsed: 0, duration: ENEMY_CFG.mortar.fuseTime, damage });
}

/** Updates one non-boss hostile unit for one fixed step. */
export function stepEnemyAI(state, e, dt, attractMode) {
  const { player, difficulty } = state;
  const dist = Math.hypot(player.x - e.x, player.z - e.z) || 1;
  const toPlayer = Math.atan2(player.z - e.z, player.x - e.x);
  const chillScale = e.chill > 0 ? 1 - TURRET_CFG.cryo.slow : 1;
  const spd = e.speed * chillScale;

  if (e.flash > 0) e.flash = Math.max(0, e.flash - dt);
  if (e.revealed > 0) e.revealed = Math.max(0, e.revealed - dt);
  if (e.stun > 0) {
    e.stun = Math.max(0, e.stun - dt); e.vx *= 0.85; e.vz *= 0.85;
    e.x += e.vx * dt; e.z += e.vz * dt; return false;
  }

  let sniperWarn = false;
  e.timer -= dt * difficulty.enemyFire * chillScale;

  if (e.kind === 'swarmer' || e.kind === 'shard') {
    const a = toPlayer + Math.sin(state.elapsed * 5 + e.phaseTimer) * 0.45 * e.orbitDir;
    e.vx = Math.cos(a) * spd; e.vz = Math.sin(a) * spd; e.angle = Math.atan2(e.vz, e.vx);
  } else if (e.kind === 'stalker') {
    const a = toPlayer + (dist < 6 ? 0.15 : 0.65 * e.orbitDir);
    const b = e.revealed > 0 ? 0.82 : 1.12;
    e.vx = Math.cos(a) * spd * b; e.vz = Math.sin(a) * spd * b; e.angle = Math.atan2(e.vz, e.vx);
    if (dist < 4.0) e.revealed = Math.max(e.revealed, 0.5);
  } else if (e.kind === 'sniper') {
    if (e.telegraph > 0) {
      e.telegraph -= dt; e.vx *= 0.82; e.vz *= 0.82;
      if (e.telegraph <= 0 && !attractMode) {
        const cfg = ENEMY_CFG.sniper;
        spawnEnemyBolt(state, e.x, e.z, e.aimAngle, cfg.boltSpeed, cfg.dmg, '#fde047', true);
        e.timer = cfg.cooldown;
      }
    } else {
      const pull = dist < 11 ? -0.85 : dist > 16.5 ? 0.75 : 0;
      const st = toPlayer + Math.PI * 0.5 * e.orbitDir;
      e.vx = Math.cos(toPlayer) * spd * pull + Math.cos(st) * spd * 0.55;
      e.vz = Math.sin(toPlayer) * spd * pull + Math.sin(st) * spd * 0.55;
      e.angle = toPlayer;
      if (e.timer <= 0 && dist < 24) { e.aimAngle = toPlayer; e.telegraph = ENEMY_CFG.sniper.chargeTime; sniperWarn = true; }
    }
  } else if (e.kind === 'bastion') {
    e.angle += Math.max(-1.6 * dt, Math.min(1.6 * dt, wrapAngle(toPlayer - e.angle)));
    const push = dist > 5.5 ? 1 : 0.25;
    e.vx = Math.cos(e.angle) * spd * push; e.vz = Math.sin(e.angle) * spd * push;
    if (e.timer <= 0 && !attractMode && dist < 19) {
      const cfg = ENEMY_CFG.bastion;
      spawnEnemyBolt(state, e.x, e.z, e.angle - 0.14, cfg.boltSpeed, cfg.dmg, '#38bdf8');
      spawnEnemyBolt(state, e.x, e.z, e.angle + 0.14, cfg.boltSpeed, cfg.dmg, '#38bdf8');
      e.timer = cfg.cooldown;
    }
  } else if (e.kind === 'mortar') {
    const ap = dist > 13 ? 0.7 : dist < 7 ? -0.6 : 0.15;
    const st = toPlayer + Math.PI * 0.5 * e.orbitDir;
    e.vx = Math.cos(toPlayer) * spd * ap + Math.cos(st) * spd * 0.45;
    e.vz = Math.sin(toPlayer) * spd * ap + Math.sin(st) * spd * 0.45;
    e.angle = toPlayer;
    if (e.timer <= 0 && !attractMode && dist < 24) {
      spawnMortarStrike(state, e.x, e.z, player.x + player.vx * 0.45, player.z + player.vz * 0.45, ENEMY_CFG.mortar.blastRadius, ENEMY_CFG.mortar.dmg);
      e.timer = ENEMY_CFG.mortar.cooldown;
    }
  } else if (e.kind === 'splitter') {
    const st = toPlayer + Math.PI * 0.42 * e.orbitDir;
    e.vx = Math.cos(st) * spd; e.vz = Math.sin(st) * spd; e.angle = toPlayer;
    if (e.timer <= 0 && !attractMode && dist < 20) {
      const cfg = ENEMY_CFG.splitter;
      spawnEnemyBolt(state, e.x, e.z, toPlayer, cfg.boltSpeed, cfg.dmg, '#d946ef');
      e.timer = cfg.cooldown;
    }
  }

  e.x = Math.max(-ARENA.halfX - 2.5, Math.min(ARENA.halfX + 2.5, e.x + e.vx * dt));
  e.z = Math.max(-ARENA.halfZ - 2.5, Math.min(ARENA.halfZ + 2.5, e.z + e.vz * dt));
  return sniperWarn;
}

/** Splits a defeated Void Splitter into fast Void Shards. */
export function handleEnemyDeathSplit(state, e) {
  if (e.kind !== 'splitter') return;
  for (let i = 0; i < 2; i += 1) {
    const a = (i === 0 ? -0.6 : 0.6) + e.angle;
    const sh = spawnEnemy(state, 'shard', e.x + Math.cos(a) * 0.9, e.z + Math.sin(a) * 0.9);
    if (sh) sh.orbitDir = i === 0 ? 1 : -1;
  }
}

/** Updates active ground mortar strikes and detonates those reaching fuse completion. */
export function updateMortars(state, dt, damagePlayer) {
  const { mortars, rings, particles } = state.pools;
  const p = state.player;
  for (const m of mortars) {
    if (!m.active) continue;
    m.elapsed += dt;
    if (m.elapsed >= m.duration) {
      m.active = false;
      const r = acquire(rings);
      if (r) Object.assign(r, { active: true, x: m.x, y: 0.2, z: m.z, radius: 0.5, maxRadius: m.radius * 1.15, life: 0.36, maxLife: 0.36, color: '#f97316' });
      for (let k = 0; k < 10; k += 1) {
        const pt = acquire(particles); if (!pt) break;
        const a = (k / 10) * Math.PI * 2;
        Object.assign(pt, { active: true, x: m.x, y: 0.5, z: m.z, vx: Math.cos(a) * 6.2, vy: 3.5, vz: Math.sin(a) * 6.2, size: 0.22, life: 0.36, maxLife: 0.36, color: '#fb923c' });
      }
      if (Math.hypot(p.x - m.x, p.z - m.z) <= m.radius + p.radius * 0.6) damagePlayer(m.damage);
    }
  }
}
