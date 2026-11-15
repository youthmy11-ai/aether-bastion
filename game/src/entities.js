// Pre-allocated entity pools for zero per-frame garbage collection churn.
import { FIELD, PLAYER_CFG, POOLS } from './config.js';

function makePool(count, factory) {
  const arr = [];
  for (let i = 0; i < count; i += 1) arr.push(factory());
  return arr;
}

export function acquire(pool) {
  for (let i = 0; i < pool.length; i += 1) {
    if (!pool[i].active) return pool[i];
  }
  return null;
}

export function createPools() {
  return {
    enemies: makePool(POOLS.enemies, () => ({
      active: false,
      kind: 'swarmer',
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 14,
      angle: 0,
      hp: 0,
      maxHp: 0,
      speed: 0,
      timer: 0,
      phaseTimer: 0,
      telegraph: 0,
      aimAngle: 0,
      flash: 0,
      stun: 0,
      orbitDir: 1,
      isBoss: false,
      bossPhase: 1,
      dashVx: 0,
      dashVy: 0,
    })),
    playerBolts: makePool(POOLS.playerBolts, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 4,
      damage: 18,
      crit: false,
      pierce: 0,
      life: 0,
      color: '#67e8f9',
      lastHitIndex: -1,
    })),
    enemyBolts: makePool(POOLS.enemyBolts, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 5,
      damage: 14,
      life: 0,
      color: '#fb7185',
      isRail: false,
    })),
    crystals: makePool(POOLS.crystals, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      value: 16,
      life: 0,
      pulse: 0,
    })),
    mortars: makePool(POOLS.mortars, () => ({
      active: false,
      x: 0,
      y: 0,
      radius: 68,
      elapsed: 0,
      duration: 1.35,
      damage: 24,
    })),
    particles: makePool(POOLS.particles, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      size: 3,
      life: 0,
      maxLife: 0.4,
      color: '#38bdf8',
      kind: 'spark',
    })),
    rings: makePool(POOLS.rings, () => ({
      active: false,
      x: 0,
      y: 0,
      radius: 10,
      maxRadius: 200,
      life: 0,
      maxLife: 0.4,
      color: '#38bdf8',
      lineWidth: 4,
    })),
    texts: makePool(POOLS.texts, () => ({
      active: false,
      x: 0,
      y: 0,
      vy: -36,
      life: 0,
      maxLife: 0.75,
      text: '',
      color: '#f1f5f9',
      size: 15,
    })),
  };
}

export function createStars(random) {
  const stars = [];
  for (let i = 0; i < 110; i += 1) {
    const layer = i < 55 ? 0 : i < 90 ? 1 : 2;
    stars.push({
      x: random.range(0, FIELD.width),
      y: random.range(0, FIELD.height),
      size: layer === 0 ? 1.1 : layer === 1 ? 1.7 : 2.3,
      alpha: layer === 0 ? 0.24 : layer === 1 ? 0.44 : 0.68,
      speed: layer === 0 ? 6 : layer === 1 ? 13 : 22,
      tint: i % 9 === 0 ? '#67e8f9' : i % 13 === 0 ? '#fbbf24' : '#cbd5e1',
    });
  }
  return stars;
}

export function createPlayer() {
  return {
    x: (FIELD.arenaLeft + FIELD.arenaRight) / 2,
    y: (FIELD.arenaTop + FIELD.arenaBottom) / 2 + 60,
    vx: 0,
    vy: 0,
    aimAngle: -Math.PI / 2,
    radius: PLAYER_CFG.radius,
    hp: PLAYER_CFG.maxHp,
    maxHp: PLAYER_CFG.maxHp,
    shield: PLAYER_CFG.maxShield,
    maxShield: PLAYER_CFG.maxShield,
    shieldRegen: PLAYER_CFG.shieldRegen,
    shieldDelayTimer: 0,
    speed: PLAYER_CFG.speed,
    fireTimer: 0,
    fireInterval: PLAYER_CFG.fireInterval,
    boltSpeed: PLAYER_CFG.boltSpeed,
    boltDamage: PLAYER_CFG.boltDamage,
    critChance: PLAYER_CFG.critChance,
    boltCount: 1,
    pierce: 0,
    dashCooldown: PLAYER_CFG.dashCooldown,
    dashTimer: 0,
    dashActiveTimer: 0,
    dashInvulnTimer: 0,
    dashVx: 0,
    dashVy: 0,
    dashWake: 0,
    empCooldown: PLAYER_CFG.empCooldown,
    empTimer: 0,
    empRadius: PLAYER_CFG.empRadius,
    empDamage: PLAYER_CFG.empDamage,
    empStun: PLAYER_CFG.empStun,
    pickupRadius: PLAYER_CFG.pickupRadius,
    yieldMult: 1,
    hitInvulnTimer: 0,
    flash: 0,
    drones: 0,
    droneAngle: 0,
    droneFireTimer: 0,
    trailTimer: 0,
  };
}
