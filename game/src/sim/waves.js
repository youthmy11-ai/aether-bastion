/**
 * Wave progression director, weighted hostile spawning along Citadel perimeter edges,
 * and Wave 4 Archon Sovereign deployment.
 */

import { acquire, ARENA, BOSS_CFG, ENEMY_CFG, WAVES } from '../config/constants.js';

/**
 * Computes a spawn position just outside the playable Citadel deck edge.
 * @param {Function} random
 */
export function pickPerimeterSpawn(random) {
  const side = random.int(0, 3);
  if (side === 0) return { x: random.range(-ARENA.halfX + 2, ARENA.halfX - 2), z: -ARENA.halfZ - 2.0 };
  if (side === 1) return { x: ARENA.halfX + 2.0, z: random.range(-ARENA.halfZ + 2, ARENA.halfZ - 2) };
  if (side === 2) return { x: random.range(-ARENA.halfX + 2, ARENA.halfX - 2), z: ARENA.halfZ + 2.0 };
  return { x: -ARENA.halfX - 2.0, z: random.range(-ARENA.halfZ + 2, ARENA.halfZ - 2) };
}

/**
 * Selects an enemy archetype from a wave's weighted distribution.
 * @param {Array<[string, number]>} weights
 * @param {Function} random
 */
export function pickWeightedEnemy(weights, random) {
  const r = random();
  let acc = 0;
  for (let i = 0; i < weights.length; i += 1) {
    acc += weights[i][1];
    if (r <= acc) return weights[i][0];
  }
  return weights[weights.length - 1][0];
}

/**
 * Spawns an enemy instance of `kind` at `(x, z)` scaled by difficulty.
 * @param {object} state
 * @param {string} kind
 * @param {number} x
 * @param {number} z
 */
export function spawnEnemy(state, kind, x, z) {
  const e = acquire(state.pools.enemies);
  if (!e) return null;
  const cfg = ENEMY_CFG[kind];
  const d = state.difficulty;
  e.active = true;
  e.kind = kind;
  e.isBoss = false;
  e.bossPhase = 1;
  e.x = x;
  e.z = z;
  e.vx = 0;
  e.vz = 0;
  e.radius = cfg.radius;
  e.maxHp = Math.round(cfg.hp * d.enemyHp);
  e.hp = e.maxHp;
  e.speed = cfg.speed * d.enemySpeed;
  e.timer = state.random.range(0.35, 1.15);
  e.phaseTimer = 0;
  e.telegraph = 0;
  e.flash = 0;
  e.stun = 0;
  e.chill = 0;
  e.revealed = 0;
  e.orbitDir = state.random.chance(0.5) ? 1 : -1;
  e.angle = Math.atan2(state.player.z - z, state.player.x - x);
  e.aimAngle = e.angle;
  return e;
}

/**
 * Spawns the Wave 4 Archon Sovereign dreadnought boss.
 * @param {object} state
 */
export function spawnArchonBoss(state) {
  const b = acquire(state.pools.enemies);
  if (!b) return null;
  const d = state.difficulty;
  b.active = true;
  b.kind = 'boss';
  b.isBoss = true;
  b.bossPhase = 1;
  b.x = 0;
  b.z = -ARENA.halfZ - 2.8;
  b.vx = 0;
  b.vz = 0;
  b.radius = BOSS_CFG.radius;
  b.maxHp = Math.round(BOSS_CFG.hp * d.enemyHp);
  b.hp = b.maxHp;
  b.speed = BOSS_CFG.speed * d.enemySpeed;
  b.timer = 1.1;
  b.phaseTimer = 0;
  b.telegraph = 0;
  b.flash = 0;
  b.stun = 0;
  b.chill = 0;
  b.revealed = 1;
  b.orbitDir = 1;
  b.angle = Math.PI / 2;
  b.aimAngle = b.angle;
  state.boss = b;
  return b;
}

/**
 * Advances wave timer, spawns paced reinforcements, and transitions sectors.
 * @param {object} state
 * @param {number} dt
 * @param {boolean} attractMode
 */
export function updateWaveDirector(state, dt, attractMode) {
  const wave = WAVES[state.waveIndex];
  state.waveElapsed += dt;
  state.spawnTimer -= dt;

  if (state.spawnTimer <= 0) {
    const pos = pickPerimeterSpawn(state.random);
    const kind = pickWeightedEnemy(wave.weights, state.random);
    spawnEnemy(state, kind, pos.x, pos.z);
    if (!attractMode && state.waveIndex >= 1 && state.random.chance(0.32)) {
      const flank = pickPerimeterSpawn(state.random);
      spawnEnemy(state, 'swarmer', flank.x, flank.z);
    }
    state.spawnTimer = wave.spawnInterval * (attractMode ? 1.5 : 1) / state.difficulty.enemyFire;
  }

  if (!attractMode && !wave.boss && state.waveElapsed >= wave.duration) {
    state.waveIndex = Math.min(WAVES.length - 1, state.waveIndex + 1);
    state.waveElapsed = 0;
    const nextWave = WAVES[state.waveIndex];
    state.waveBannerTimer = 2.6;
    if (nextWave.boss && !state.boss) {
      spawnArchonBoss(state);
      return true;
    }
  }
  return false;
}
