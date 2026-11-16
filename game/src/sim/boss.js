/**
 * 3-Phase Archon Sovereign boss encounter AI: radial plasma curtains, rail lock-ons,
 * mortar salvos, phase transitions, and escort reinforcements.
 */

import { acquire, ARENA } from '../config/constants.js';
import { spawnEnemyBolt, spawnMortarStrike } from './enemies.js';
import { spawnEnemy } from './waves.js';

/**
 * Updates the 3-phase Archon Sovereign boss for one fixed simulation step.
 * @param {object} state
 * @param {object} boss
 * @param {number} dt
 */
export function stepArchonBoss(state, boss, dt) {
  const { player, difficulty } = state;
  const hpRatio = boss.hp / Math.max(1, boss.maxHp);
  const nextPhase = hpRatio <= 0.33 ? 3 : hpRatio <= 0.66 ? 2 : 1;

  if (nextPhase > boss.bossPhase) {
    boss.bossPhase = nextPhase;
    boss.flash = 0.25;
    state.emitText(boss.x, boss.z, `ARCHON PHASE ${nextPhase}`, '#fbbf24', 18);
    const ring = acquire(state.pools.rings);
    if (ring) {
      ring.active = true;
      ring.x = boss.x;
      ring.y = 0.35;
      ring.z = boss.z;
      ring.radius = 1.2;
      ring.maxRadius = 9.5;
      ring.life = 0.55;
      ring.maxLife = 0.55;
      ring.color = '#fbbf24';
    }
    if (nextPhase === 2) {
      spawnEnemy(state, 'swarmer', boss.x - 3.5, boss.z + 1.5);
      spawnEnemy(state, 'stalker', boss.x + 3.5, boss.z + 1.5);
    } else if (nextPhase === 3) {
      spawnEnemy(state, 'sniper', -16, -9);
      spawnEnemy(state, 'sniper', 16, -9);
    }
  }

  if (boss.flash > 0) boss.flash = Math.max(0, boss.flash - dt);
  if (boss.stun > 0) boss.stun = Math.max(0, boss.stun - dt * 1.4);

  const dx = player.x - boss.x;
  const dz = player.z - boss.z;
  const dist = Math.hypot(dx, dz) || 1;
  const toPlayer = Math.atan2(dz, dx);
  boss.angle = toPlayer;

  const chillScale = boss.chill > 0 ? 0.72 : 1;
  const spd = boss.speed * (1 + (boss.bossPhase - 1) * 0.16) * chillScale;
  const desiredDist = boss.bossPhase === 3 ? 8.5 : 10.5;
  const pull = dist > desiredDist ? 0.8 : dist < 5.5 ? -0.6 : 0.1;
  const orbit = toPlayer + Math.PI * 0.48 * boss.orbitDir;

  boss.vx = Math.cos(toPlayer) * spd * pull + Math.cos(orbit) * spd * 0.65;
  boss.vz = Math.sin(toPlayer) * spd * pull + Math.sin(orbit) * spd * 0.65;
  boss.x = Math.max(-ARENA.halfX + 3, Math.min(ARENA.halfX - 3, boss.x + boss.vx * dt));
  boss.z = Math.max(-ARENA.halfZ + 3, Math.min(ARENA.halfZ - 3, boss.z + boss.vz * dt));

  let sniperWarn = false;
  if (boss.telegraph > 0) {
    boss.telegraph -= dt;
    if (boss.telegraph <= 0) {
      const bolts = boss.bossPhase === 3 ? 5 : 3;
      for (let i = 0; i < bolts; i += 1) {
        const off = (i - (bolts - 1) / 2) * 0.12;
        spawnEnemyBolt(state, boss.x, boss.z, boss.aimAngle + off, 32, 22, '#fde047', true);
      }
    }
    return false;
  }

  boss.timer -= dt * difficulty.enemyFire * chillScale;
  boss.phaseTimer += dt;

  if (boss.timer <= 0) {
    const cycle = Math.floor(boss.phaseTimer * 1.5) % 3;
    if (cycle === 0) {
      // Radial spiral curtain
      const count = 8 + boss.bossPhase * 3;
      const spin = boss.phaseTimer * 1.7;
      for (let k = 0; k < count; k += 1) {
        const a = spin + (k / count) * Math.PI * 2;
        spawnEnemyBolt(state, boss.x, boss.z, a, 11.5 + boss.bossPhase * 1.2, 16, k % 2 === 0 ? '#f43f5e' : '#fb7185');
      }
      boss.timer = boss.bossPhase === 3 ? 1.15 : 1.55;
    } else if (cycle === 1) {
      // Twin sniper rail lock telegraph
      boss.aimAngle = toPlayer;
      boss.telegraph = 0.72;
      boss.timer = 1.65;
      sniperWarn = true;
    } else {
      // Triple mortar barrage around player trajectory
      const shells = boss.bossPhase >= 2 ? 3 : 2;
      for (let s = 0; s < shells; s += 1) {
        const spreadA = (s - (shells - 1) / 2) * 0.9;
        const tx = player.x + player.vx * 0.4 + Math.cos(spreadA) * 3.4;
        const tz = player.z + player.vz * 0.4 + Math.sin(spreadA) * 3.4;
        spawnMortarStrike(state, boss.x, boss.z, tx, tz, 3.2, 24);
      }
      boss.timer = 1.8;
    }
  }
  return sniperWarn;
}
