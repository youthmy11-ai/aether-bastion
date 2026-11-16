// Central tuning tables, difficulty curves, upgrades, relic synergies, pylons, and palette.
export const FIELD = {
  width: 1280,
  height: 720,
  arenaLeft: 26,
  arenaRight: 1254,
  arenaTop: 80,
  arenaBottom: 694,
};

export const STEP = 1 / 60;

export const SCREEN = {
  TITLE: 'title',
  PLAY: 'play',
  PAUSED: 'paused',
  UPGRADE: 'upgrade',
  VICTORY: 'victory',
  OVER: 'over',
};

export const DIFFICULTIES = {
  cadet: {
    id: 'cadet',
    label: 'CADET',
    desc: 'Reduced enemy pressure · faster shield recovery',
    enemyHp: 0.8,
    enemySpeed: 0.88,
    enemyFire: 0.84,
    scoreMult: 0.85,
  },
  vanguard: {
    id: 'vanguard',
    label: 'VANGUARD',
    desc: 'Standard tactical engagement · balanced waves',
    enemyHp: 1.0,
    enemySpeed: 1.0,
    enemyFire: 1.0,
    scoreMult: 1.0,
  },
  overdrive: {
    id: 'overdrive',
    label: 'OVERDRIVE',
    desc: 'High-velocity hostiles · +35% score multiplier',
    enemyHp: 1.25,
    enemySpeed: 1.13,
    enemyFire: 1.18,
    scoreMult: 1.35,
  },
};

export const DIFFICULTY_ORDER = ['cadet', 'vanguard', 'overdrive'];

export const PLAYER_CFG = {
  radius: 16,
  maxHp: 100,
  maxShield: 60,
  shieldRegen: 9,
  shieldDelay: 3.2,
  speed: 345,
  fireInterval: 0.175,
  boltSpeed: 780,
  boltDamage: 18,
  critChance: 0.1,
  critMult: 1.75,
  dashCooldown: 2.3,
  dashDuration: 0.19,
  dashSpeed: 980,
  dashInvuln: 0.28,
  empCooldown: 7.5,
  empRadius: 215,
  empDamage: 48,
  empStun: 1.7,
  pickupRadius: 125,
  hitInvuln: 0.5,
  overchargeDuration: 7.5,
};

export const PYLON_CFG = {
  hp: 85,
  radius: 22,
  blastRadius: 185,
  blastDamage: 88,
  respawnTime: 13,
  scoreBonus: 320,
};

export const ENEMY_CFG = {
  swarmer: { hp: 30, radius: 14, speed: 195, score: 90, xp: 16, contactDmg: 16, color: '#ff4d6d' },
  sniper: { hp: 46, radius: 16, speed: 115, score: 160, xp: 24, chargeTime: 1.05, cooldown: 2.35, boltSpeed: 880, dmg: 22, color: '#ffb703' },
  bastion: { hp: 105, radius: 22, speed: 82, score: 220, xp: 34, cooldown: 2.1, boltSpeed: 310, dmg: 16, shieldArc: 1.35, color: '#38bdf8' },
  mortar: { hp: 68, radius: 19, speed: 92, score: 200, xp: 30, cooldown: 2.75, fuseTime: 1.35, blastRadius: 68, dmg: 24, color: '#fb7185' },
  splitter: { hp: 76, radius: 19, speed: 132, score: 210, xp: 32, cooldown: 1.8, boltSpeed: 330, dmg: 14, color: '#a855f7' },
  shard: { hp: 20, radius: 10, speed: 230, score: 55, xp: 10, contactDmg: 12, color: '#d946ef' },
};

export const BOSS_CFG = {
  name: 'ARCHON SOVEREIGN',
  hp: 1850,
  radius: 44,
  speed: 112,
  score: 2500,
  contactDmg: 24,
  color: '#f43f5e',
};

export const WAVES = [
  { id: 1, title: 'SECTOR 1 · PERIMETER BREACH', duration: 24, spawnInterval: 1.45, weights: [['swarmer', 0.62], ['sniper', 0.25], ['bastion', 0.13]] },
  { id: 2, title: 'SECTOR 2 · SIEGE LINE', duration: 28, spawnInterval: 1.18, weights: [['swarmer', 0.34], ['sniper', 0.22], ['bastion', 0.24], ['mortar', 0.2]] },
  { id: 3, title: 'SECTOR 3 · PRISM VORTEX', duration: 30, spawnInterval: 1.0, weights: [['swarmer', 0.24], ['sniper', 0.2], ['bastion', 0.18], ['mortar', 0.18], ['splitter', 0.2]] },
  { id: 4, title: 'FINAL SECTOR · ARCHON SOVEREIGN', duration: 0, spawnInterval: 3.8, boss: true, weights: [['swarmer', 0.55], ['sniper', 0.25], ['mortar', 0.2]] },
];

export const UPGRADES = [
  { id: 'twin_bolts', name: 'Twin-Linked Array', tier: 'TACTICAL', color: '#38bdf8', icon: 'spread', maxStacks: 3, tag: '+1 BOLT · -6% SPREAD', desc: 'Adds +1 parallel plasma bolt per volley with tighter spread.' },
  { id: 'rapid_cycle', name: 'Overclocked Coils', tier: 'CORE', color: '#22d3ee', icon: 'bolt', maxStacks: 4, tag: '+22% ROF · +14% SPD', desc: 'Boosts weapon fire rate by 22% and bolt velocity by 14%.' },
  { id: 'heavy_plasma', name: 'Plasma Core Payload', tier: 'CORE', color: '#fbbf24', icon: 'star', maxStacks: 4, tag: '+28% DMG · +12% CRIT', desc: 'Amplifies plasma bolt damage by 28% and critical chance by 12%.' },
  { id: 'pierce_rail', name: 'Sabot Piercing Rail', tier: 'APEX', color: '#f472b6', icon: 'pierce', maxStacks: 3, tag: '+1 PIERCE · +15% DMG', desc: 'Bolts pierce through +1 hostile hull and deal +15% damage.' },
  { id: 'aegis_matrix', name: 'Aegis Capacitor', tier: 'CORE', color: '#60a5fa', icon: 'shield', maxStacks: 4, tag: '+35 SHIELD · +35% REGEN', desc: 'Adds +35 Max Shield, restores full barrier, and speeds recharge.' },
  { id: 'phase_thrusters', name: 'Phase Thrusters', tier: 'TACTICAL', color: '#34d399', icon: 'dash', maxStacks: 3, tag: '+14% MOVE · WAKE BLAST', desc: 'Raises speed 14%, cuts Dash cooldown, and emits plasma wake.' },
  { id: 'emp_overcharge', name: 'EMP Overload', tier: 'TACTICAL', color: '#a78bfa', icon: 'emp', maxStacks: 3, tag: '+28% EMP · +36 DMG', desc: 'Expands EMP Nova radius 28%, boosts blast damage, and cuts CD.' },
  { id: 'orbital_drone', name: 'Orbital Sentinel', tier: 'APEX', color: '#2dd4bf', icon: 'drone', maxStacks: 3, tag: '+1 AUTO-TURRET DRONE', desc: 'Deploys an autonomous orbiting turret drone that fires at threats.' },
  { id: 'nano_plating', name: 'Nanite Hull Repair', tier: 'CORE', color: '#4ade80', icon: 'hull', maxStacks: 4, tag: '+35 MAX HP · +45 REPAIR', desc: 'Reinforces Max Hull by +35 and repairs 45 Hull HP immediately.' },
  { id: 'magnet_core', name: 'Aether Harvester', tier: 'TACTICAL', color: '#facc15', icon: 'magnet', maxStacks: 3, tag: '+70% MAGNET · +20% YIELD', desc: 'Widens crystal magnet range by 70% and boosts XP & Score by 20%.' },
];

export const RELIC_SYNERGIES = [
  { id: 'solar_storm', name: 'SOLAR STORM', requires: ['twin_bolts', 'rapid_cycle'], color: '#38bdf8', bonus: 'Every 4th volley unleashes bonus fan bolts' },
  { id: 'singularity_rail', name: 'SINGULARITY RAIL', requires: ['heavy_plasma', 'pierce_rail'], color: '#fbbf24', bonus: 'Critical hits detonate plasma shockwaves' },
  { id: 'aegis_nexus', name: 'AEGIS NEXUS', requires: ['orbital_drone', 'emp_overcharge'], color: '#2dd4bf', bonus: 'Drones arc lightning & EMP lasts longer' },
  { id: 'phase_overdrive', name: 'PHASE OVERDRIVE', requires: ['phase_thrusters', 'aegis_matrix'], color: '#34d399', bonus: 'Dashing restores +14 Aegis Shield' },
];

export const PALETTE = {
  bg: '#050812',
  arenaBg: '#080e1d',
  grid: 'rgba(56, 189, 248, 0.085)',
  border: '#1e3a5f',
  borderGlow: '#38bdf8',
  panel: 'rgba(7, 13, 27, 0.90)',
  card: 'rgba(13, 21, 40, 0.94)',
  cyan: '#38bdf8',
  cyanBright: '#67e8f9',
  amber: '#fbbf24',
  crimson: '#fb7185',
  danger: '#f43f5e',
  emerald: '#34d399',
  violet: '#a78bfa',
  text: '#f8fafc',
  muted: '#94a3b8',
};

export const FONT_UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const FONT_MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

export const STORAGE_KEYS = { best: 'aether-bastion.best.v1', muted: 'aether-bastion.muted.v1' };

export const POOLS = {
  enemies: 72,
  playerBolts: 150,
  enemyBolts: 190,
  crystals: 120,
  mortars: 24,
  particles: 300,
  rings: 28,
  texts: 48,
};
