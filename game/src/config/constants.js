/**
 * Central configuration tables, 3D arena bounds, unit specs, upgrades, synergies,
 * deterministic Mulberry32 PRNG, and pre-allocated object pool factories.
 */

export const STEP = 1 / 60;
export const SCREEN = { TITLE: 'title', PLAY: 'play', PAUSED: 'paused', UPGRADE: 'upgrade', VICTORY: 'victory', OVER: 'over' };
export const ARENA = { halfX: 24.5, halfZ: 14.8, flightY: 0.95, coreRadius: 2.4 };

export const PYLON_ANCHORS = [
  { id: 0, x: -14.5, z: -9.2, label: 'NW' }, { id: 1, x: 14.5, z: -9.2, label: 'NE' },
  { id: 2, x: -14.5, z: 9.2, label: 'SW' }, { id: 3, x: 14.5, z: 9.2, label: 'SE' },
];

export const BUILD_SOCKETS = [
  { id: 0, x: -7.2, z: -5.6, label: 'NW Bastion' }, { id: 1, x: 7.2, z: -5.6, label: 'NE Bastion' },
  { id: 2, x: -11.2, z: 0, label: 'West Gate' }, { id: 3, x: 11.2, z: 0, label: 'East Gate' },
  { id: 4, x: -7.2, z: 5.6, label: 'SW Bastion' }, { id: 5, x: 7.2, z: 5.6, label: 'SE Bastion' },
];

export const DIFFICULTIES = {
  cadet: { id: 'cadet', label: 'CADET', desc: 'Reduced pressure · fast shield', enemyHp: .8, enemySpeed: .88, enemyFire: .84, scoreMult: .85 },
  vanguard: { id: 'vanguard', label: 'VANGUARD', desc: 'Standard tactical engagement', enemyHp: 1, enemySpeed: 1, enemyFire: 1, scoreMult: 1 },
  overdrive: { id: 'overdrive', label: 'OVERDRIVE', desc: 'High-velocity · +35% score', enemyHp: 1.25, enemySpeed: 1.13, enemyFire: 1.18, scoreMult: 1.35 },
};
export const DIFFICULTY_ORDER = ['cadet', 'vanguard', 'overdrive'];

export const PLAYER_CFG = {
  radius: .82, maxHp: 100, maxShield: 60, shieldRegen: 9, shieldDelay: 3.1, speed: 14.8,
  fireInterval: .175, boltSpeed: 35, boltDamage: 18, critChance: .12, critMult: 1.75,
  dashCooldown: 2.2, dashDuration: .19, dashSpeed: 40, dashInvuln: .28,
  empCooldown: 7.2, empRadius: 9.4, empDamage: 52, empStun: 1.8,
  pickupRadius: 6.4, hitInvuln: .5, overchargeDuration: 7.5, startShards: 45,
};

export const PYLON_CFG = { hp: 90, radius: 1.15, blastRadius: 8.6, blastDamage: 92, respawnTime: 12, scoreBonus: 320, beamRange: 14.5, beamDps: 24 };
export const SUN_CFG = { startAzimuth: .62, sweepRate: .19, corridorHalfWidth: 5.8, solarBonusMult: 1.65, shieldBurnMult: 2.3, linkMaxDist: 19.5 };

export const TURRET_CFG = {
  prism: { id: 'prism', key: '1', name: 'Prism Mirror Spire', short: 'Prism Spire', cost: 25, range: 14.5, dps: 28, color: '#38bdf8', desc: 'Refracts sunlit beams (+65% DMG)' },
  tesla: { id: 'tesla', key: '2', name: 'Tesla Arc Tower', short: 'Tesla Tower', cost: 35, range: 13.5, cooldown: .68, damage: 26, chains: 3, color: '#fbbf24', desc: 'Chain lightning across 3 hostiles' },
  cryo: { id: 'cryo', key: '3', name: 'Cryo Ward', short: 'Cryo Ward', cost: 30, range: 9.2, slow: .42, critBoost: .15, color: '#67e8f9', desc: 'Slows hostiles 42% & boosts crit' },
};
export const TURRET_ORDER = ['prism', 'tesla', 'cryo'];

export const ENEMY_CFG = {
  swarmer: { hp: 30, radius: .72, speed: 8.2, score: 90, xp: 16, shards: 3, contactDmg: 16, color: '#fb7185' },
  sniper: { hp: 48, radius: .82, speed: 4.8, score: 160, xp: 24, shards: 5, chargeTime: 1.05, cooldown: 2.35, boltSpeed: 37, dmg: 22, color: '#fbbf24' },
  bastion: { hp: 112, radius: 1.15, speed: 3.5, score: 220, xp: 34, shards: 6, cooldown: 2.1, boltSpeed: 13.5, dmg: 16, shieldArc: 1.35, color: '#38bdf8' },
  mortar: { hp: 72, radius: .98, speed: 3.8, score: 200, xp: 30, shards: 5, cooldown: 2.75, fuseTime: 1.35, blastRadius: 3.1, dmg: 24, color: '#f97316' },
  splitter: { hp: 78, radius: .95, speed: 5.5, score: 210, xp: 32, shards: 6, cooldown: 1.8, boltSpeed: 14, dmg: 14, color: '#a855f7' },
  shard: { hp: 20, radius: .5, speed: 9.8, score: 55, xp: 10, shards: 2, contactDmg: 12, color: '#d946ef' },
  stalker: { hp: 58, radius: .78, speed: 7.4, score: 185, xp: 28, shards: 5, contactDmg: 18, cloakRange: 10.5, color: '#818cf8' },
};

export const BOSS_CFG = { name: 'ARCHON SOVEREIGN', hp: 2100, radius: 2.25, speed: 4.8, score: 2800, contactDmg: 24, color: '#f43f5e' };

export const WAVES = [
  { id: 1, title: 'SECTOR 1 · SUNLIT PERIMETER', duration: 22, spawnInterval: 1.4, weights: [['swarmer', .56], ['sniper', .24], ['bastion', .2]] },
  { id: 2, title: 'SECTOR 2 · SIEGE CITADEL', duration: 25, spawnInterval: 1.15, weights: [['swarmer', .3], ['sniper', .2], ['bastion', .22], ['mortar', .16], ['stalker', .12]] },
  { id: 3, title: 'SECTOR 3 · PRISM VORTEX', duration: 28, spawnInterval: .98, weights: [['swarmer', .22], ['sniper', .18], ['bastion', .16], ['mortar', .15], ['splitter', .15], ['stalker', .14]] },
  { id: 4, title: 'FINAL SECTOR · ARCHON SOVEREIGN', duration: 0, spawnInterval: 3.6, boss: true, weights: [['swarmer', .45], ['sniper', .22], ['mortar', .18], ['stalker', .15]] },
];

export const UPGRADES = [
  { id: 'twin_bolts', name: 'Twin-Linked Array', tier: 'TACTICAL', color: '#38bdf8', icon: 'spread', maxStacks: 3, tag: '+1 BOLT · -6% SPREAD', desc: 'Adds +1 parallel plasma bolt per volley with tighter spread.' },
  { id: 'rapid_cycle', name: 'Overclocked Coils', tier: 'CORE', color: '#22d3ee', icon: 'bolt', maxStacks: 4, tag: '+22% ROF · +14% SPD', desc: 'Boosts fire rate by 22% and bolt velocity by 14%.' },
  { id: 'heavy_plasma', name: 'Plasma Core Payload', tier: 'CORE', color: '#fbbf24', icon: 'star', maxStacks: 4, tag: '+28% DMG · +12% CRIT', desc: 'Amplifies bolt damage by 28% and crit chance by 12%.' },
  { id: 'pierce_rail', name: 'Sabot Piercing Rail', tier: 'APEX', color: '#f472b6', icon: 'pierce', maxStacks: 3, tag: '+1 PIERCE · +15% DMG', desc: 'Bolts pierce +1 hostile hull and deal +15% damage.' },
  { id: 'aegis_matrix', name: 'Aegis Capacitor', tier: 'CORE', color: '#60a5fa', icon: 'shield', maxStacks: 4, tag: '+35 SHIELD · +35% REGEN', desc: 'Adds +35 Max Shield, restores barrier, speeds recharge.' },
  { id: 'phase_thrusters', name: 'Phase Thrusters', tier: 'TACTICAL', color: '#34d399', icon: 'dash', maxStacks: 3, tag: '+14% MOVE · WAKE BLAST', desc: 'Raises speed 14%, cuts Dash CD, emits plasma wake.' },
  { id: 'emp_overcharge', name: 'EMP Overload', tier: 'TACTICAL', color: '#a78bfa', icon: 'emp', maxStacks: 3, tag: '+28% EMP · +36 DMG', desc: 'Expands EMP Nova radius 28% and cuts cooldown.' },
  { id: 'orbital_drone', name: 'Orbital Sentinel', tier: 'APEX', color: '#2dd4bf', icon: 'drone', maxStacks: 3, tag: '+1 AUTO-TURRET DRONE', desc: 'Deploys an orbiting sentinel drone that targets threats.' },
  { id: 'nano_plating', name: 'Nanite Hull Repair', tier: 'CORE', color: '#4ade80', icon: 'hull', maxStacks: 4, tag: '+35 MAX HP · +45 REPAIR', desc: 'Reinforces Max Hull by +35 and repairs 45 Hull HP.' },
  { id: 'magnet_core', name: 'Aether Harvester', tier: 'TACTICAL', color: '#facc15', icon: 'magnet', maxStacks: 3, tag: '+70% MAGNET · +25% SHARDS', desc: 'Widens magnet range 70% and boosts Shards & Score.' },
];

export const RELIC_SYNERGIES = [
  { id: 'solar_storm', name: 'SOLAR STORM', requires: ['twin_bolts', 'rapid_cycle'], color: '#38bdf8', bonus: 'Every 4th volley fires bonus fan bolts' },
  { id: 'singularity_rail', name: 'SINGULARITY RAIL', requires: ['heavy_plasma', 'pierce_rail'], color: '#fbbf24', bonus: 'Crits detonate plasma shockwaves' },
  { id: 'aegis_nexus', name: 'AEGIS NEXUS', requires: ['orbital_drone', 'emp_overcharge'], color: '#2dd4bf', bonus: 'Drones arc & EMP stuns longer' },
  { id: 'phase_overdrive', name: 'PHASE OVERDRIVE', requires: ['phase_thrusters', 'aegis_matrix'], color: '#34d399', bonus: 'Dashing restores +14 Aegis Shield' },
];

export const STORAGE_KEYS = { best: 'aether-bastion.best.v2', muted: 'aether-bastion.muted.v2' };
export const POOLS = { enemies: 72, playerBolts: 150, enemyBolts: 190, crystals: 120, mortars: 24, particles: 260, rings: 28, beams: 36, texts: 48 };

/** Creates a deterministic Mulberry32 PRNG seeded with an integer. */
export function createRandom(seed) {
  let s = seed | 0;
  function next() {
    s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  next.range = (a, b) => a + next() * (b - a); next.int = (a, b) => Math.floor(a + next() * (b - a + 1));
  next.chance = (p) => next() < p; next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  return next;
}

/** Acquires the first inactive slot from a pre-allocated pool. */
export function acquire(pool) { for (let i = 0; i < pool.length; i += 1) if (!pool[i].active) return pool[i]; return null; }

const makePool = (n, fn) => Array.from({ length: n }, fn);

/** Allocates all fixed-size simulation and VFX pools upfront. */
export function createPools() {
  return {
    enemies: makePool(POOLS.enemies, () => ({ active: false, kind: 'swarmer', x: 0, z: 0, vx: 0, vz: 0, radius: .72, angle: 0, hp: 0, maxHp: 0, speed: 0, timer: 0, phaseTimer: 0, telegraph: 0, aimAngle: 0, flash: 0, stun: 0, chill: 0, revealed: 0, orbitDir: 1, isBoss: false, bossPhase: 1 })),
    playerBolts: makePool(POOLS.playerBolts, () => ({ active: false, x: 0, z: 0, vx: 0, vz: 0, radius: .22, damage: 18, crit: false, pierce: 0, life: 0, color: '#67e8f9', lastHitIndex: -1 })),
    enemyBolts: makePool(POOLS.enemyBolts, () => ({ active: false, x: 0, z: 0, vx: 0, vz: 0, radius: .24, damage: 14, life: 0, color: '#fb7185', isRail: false })),
    crystals: makePool(POOLS.crystals, () => ({ active: false, x: 0, z: 0, vx: 0, vz: 0, value: 16, shards: 3, life: 0, pulse: 0 })),
    mortars: makePool(POOLS.mortars, () => ({ active: false, x: 0, z: 0, sx: 0, sz: 0, radius: 3.1, elapsed: 0, duration: 1.35, damage: 24 })),
    particles: makePool(POOLS.particles, () => ({ active: false, x: 0, y: .6, z: 0, vx: 0, vy: 0, vz: 0, size: .18, life: 0, maxLife: .4, color: '#38bdf8' })),
    rings: makePool(POOLS.rings, () => ({ active: false, x: 0, y: .15, z: 0, radius: .5, maxRadius: 8, life: 0, maxLife: .4, color: '#38bdf8' })),
    beams: makePool(POOLS.beams, () => ({ active: false, x1: 0, y1: 1.2, z1: 0, x2: 0, y2: 1.2, z2: 0, color: '#67e8f9', width: .12, life: 0, maxLife: .25 })),
    texts: makePool(POOLS.texts, () => ({ active: false, x: 0, y: 1.8, z: 0, vy: 1.6, life: 0, maxLife: .75, text: '', color: '#f8fafc', size: 15 })),
  };
}
