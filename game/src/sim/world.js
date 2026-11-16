/**
 * Fixed-timestep 3D game world coordinator: player interceptor physics, plasma weapons,
 * Sentinel drones, crystal/shard harvesting, combat resolution, and event dispatch.
 */

import { acquire, ARENA, BOSS_CFG, createPools, DIFFICULTIES, ENEMY_CFG, PLAYER_CFG, PYLON_CFG, TURRET_CFG } from '../config/constants.js';
import { createSunState, resetSunState, stepSunState, updateSolarRefraction } from './sun.js';
import { createPylons, createTurrets, damagePylonFromPlayerBolt, deployTurret, interceptEnemyBoltWithPylons, resetStructures, updateStructures } from './turrets.js';
import { evaluateSynergies, rollUpgradeChoices, updateOverchargeState } from './synergies.js';
import { handleEnemyDeathSplit, isBastionShieldBlocked, stepEnemyAI, updateMortars } from './enemies.js';
import { stepArchonBoss } from './boss.js';
import { updateWaveDirector } from './waves.js';

export const EV_SHOOT = 1; export const EV_CRIT = 2; export const EV_DEFLECT = 4; export const EV_KILL = 8;
export const EV_CRYSTAL = 16; export const EV_DASH = 32; export const EV_EMP = 64; export const EV_PYLON = 128;
export const EV_OVERCHARGE = 256; export const EV_HIT = 512; export const EV_SNIPER_WARN = 1024; export const EV_BOSS = 2048;
export const EV_UPGRADE = 4096; export const EV_VICTORY = 8192; export const EV_OVER = 16384; export const EV_BUILD = 32768;

const mkPlayer = () => ({
  x: 0, z: 4.5, vx: 0, vz: 0, aimAngle: -Math.PI / 2, bank: 0, radius: PLAYER_CFG.radius,
  hp: PLAYER_CFG.maxHp, maxHp: PLAYER_CFG.maxHp, shield: PLAYER_CFG.maxShield, maxShield: PLAYER_CFG.maxShield,
  shieldRegen: PLAYER_CFG.shieldRegen, shieldDelayTimer: 0, speed: PLAYER_CFG.speed, fireTimer: 0, fireInterval: PLAYER_CFG.fireInterval,
  boltSpeed: PLAYER_CFG.boltSpeed, boltDamage: PLAYER_CFG.boltDamage, critChance: PLAYER_CFG.critChance, boltCount: 1, pierce: 0, volleyCounter: 0,
  dashCooldown: PLAYER_CFG.dashCooldown, dashTimer: 0, dashActiveTimer: 0, dashInvulnTimer: 0, dashVx: 0, dashVz: 0, dashWake: 0,
  empCooldown: PLAYER_CFG.empCooldown, empTimer: 0, empRadius: PLAYER_CFG.empRadius, empDamage: PLAYER_CFG.empDamage, empStun: PLAYER_CFG.empStun,
  pickupRadius: PLAYER_CFG.pickupRadius, yieldMult: 1, hitInvulnTimer: 0, flash: 0, drones: 0, droneAngle: 0, droneFireTimer: 0,
});

/** Instantiates the complete simulation world bound to a deterministic PRNG. */
export function createWorld(random) {
  const pools = createPools(); const pylons = createPylons(); const turrets = createTurrets(); const sun = createSunState();
  const state = {
    random, difficultyId: 'vanguard', difficulty: DIFFICULTIES.vanguard, elapsed: 0, waveIndex: 0, waveElapsed: 0, waveBannerTimer: 0, spawnTimer: 0.7,
    score: 0, shards: PLAYER_CFG.startShards, combo: 1, comboTimer: 0, xp: 0, xpNext: 70, playerLevel: 1, kills: 0, shotsFired: 0, shotsHit: 0, crits: 0, turretsBuilt: 0,
    overchargeMeter: 0, overchargeTimer: 0, shake: 0, boss: null, player: mkPlayer(), pylons, turrets, sun, pools,
    upgrades: {}, upgradeChoices: [], synergies: [], synergyFlags: { solarStorm: false, singularityRail: false, aegisNexus: false, phaseOverdrive: false }, afterimages: [],
    emitText(x, z, text, color = '#f8fafc', size = 15) {
      const t = acquire(pools.texts);
      if (t) Object.assign(t, { active: true, x, y: 1.65, z, vy: 1.8, life: 0.72, maxLife: 0.72, text, color, size });
    },
  };

  const burst = (x, z, color, count, speed = 5.5, y = 0.75) => {
    for (let i = 0; i < count; i += 1) {
      const pt = acquire(pools.particles); if (!pt) break;
      const a = state.random.range(0, Math.PI * 2); const sp = state.random.range(speed * 0.4, speed * 1.15); const life = state.random.range(0.24, 0.48);
      Object.assign(pt, { active: true, x, y, z, vx: Math.cos(a) * sp, vy: state.random.range(1.2, 4.4), vz: Math.sin(a) * sp, size: state.random.range(0.14, 0.28), life, maxLife: life, color });
    }
  };
  const ring = (x, z, maxRadius, color, y = 0.2) => {
    const r = acquire(pools.rings);
    if (r) Object.assign(r, { active: true, x, y, z, radius: 0.45, maxRadius, life: 0.38, maxLife: 0.38, color });
  };
  const setDifficulty = (id) => { if (DIFFICULTIES[id]) { state.difficultyId = id; state.difficulty = DIFFICULTIES[id]; } };
  const addScore = (base) => { state.score += Math.round(base * state.combo * state.difficulty.scoreMult * state.player.yieldMult); };

  function reset(diffId = state.difficultyId) {
    setDifficulty(diffId);
    for (const k of Object.keys(pools)) for (const o of pools[k]) o.active = false;
    resetStructures(pylons, turrets); resetSunState(sun);
    Object.assign(state, {
      elapsed: 0, waveIndex: 0, waveElapsed: 0, waveBannerTimer: 2, spawnTimer: 0.55, score: 0, shards: PLAYER_CFG.startShards,
      combo: 1, comboTimer: 0, xp: 0, xpNext: 70, playerLevel: 1, kills: 0, shotsFired: 0, shotsHit: 0, crits: 0, turretsBuilt: 0,
      overchargeMeter: 0, overchargeTimer: 0, shake: 0, boss: null, upgrades: {}, upgradeChoices: [], synergies: [],
      synergyFlags: { solarStorm: false, singularityRail: false, aegisNexus: false, phaseOverdrive: false },
    });
    state.afterimages.length = 0; Object.assign(state.player, mkPlayer());
    if (diffId === 'cadet') state.player.shieldDelay = 2.1;
  }

  function hurtPlayer(amt) {
    const p = state.player;
    if (p.hitInvulnTimer > 0 || p.dashInvulnTimer > 0) return false;
    p.hitInvulnTimer = PLAYER_CFG.hitInvuln; p.shieldDelayTimer = state.difficultyId === 'cadet' ? 2.1 : PLAYER_CFG.shieldDelay;
    p.flash = 0.22; state.shake = Math.max(state.shake, 0.34);
    const abs = Math.min(p.shield, amt); p.shield -= abs;
    if (amt > abs) p.hp = Math.max(0, p.hp - (amt - abs));
    burst(p.x, p.z, '#fb7185', 10, 6.5, 1);
    return true;
  }

  let evFlags = 0;

  function hitEnemy(e, dmg, crit, solar = false) {
    if (!e || !e.active) return;
    e.hp -= dmg; e.flash = 0.1;
    if (crit) {
      state.crits += 1; evFlags |= EV_CRIT; state.emitText(e.x, e.z, `${Math.round(dmg)}! CRIT`, '#fbbf24', 16);
      if (state.synergyFlags.singularityRail) {
        ring(e.x, e.z, 3.2, '#fbbf24');
        for (const o of pools.enemies) if (o.active && o !== e && Math.hypot(o.x - e.x, o.z - e.z) <= 3.2) { o.hp -= dmg * 0.45; o.flash = 0.08; }
      }
    } else if (solar && state.random.chance(0.22)) state.emitText(e.x, e.z, `SOLAR ${Math.round(dmg)}`, '#67e8f9', 13);

    if (e.hp <= 0) {
      e.active = false; state.kills += 1; evFlags |= EV_KILL;
      const cfg = e.isBoss ? BOSS_CFG : ENEMY_CFG[e.kind];
      state.combo = Math.min(5, +(state.combo + 0.12).toFixed(2)); state.comboTimer = 3.5; addScore(cfg.score);
      if (updateOverchargeState(state, 0, e.isBoss ? 100 : 12)) { evFlags |= EV_OVERCHARGE; state.emitText(state.player.x, state.player.z, 'OVERCHARGE!', '#fbbf24', 18); }
      const c = acquire(pools.crystals);
      if (c) Object.assign(c, { active: true, x: e.x, z: e.z, vx: state.random.range(-2, 2), vz: state.random.range(-2, 2), value: cfg.xp || 20, shards: cfg.shards || 6, life: 14, pulse: state.random.range(0, 6) });
      burst(e.x, e.z, cfg.color, e.isBoss ? 30 : 10, e.isBoss ? 9.5 : 5.6); ring(e.x, e.z, e.isBoss ? 10.5 : e.radius * 2.8, cfg.color);
      handleEnemyDeathSplit(state, e);
      if (e.isBoss) { state.boss = null; evFlags |= EV_VICTORY; addScore(1800); }
    }
  }

  function fireVolley() {
    const p = state.player; const over = state.overchargeTimer > 0; p.volleyCounter += 1;
    const count = p.boltCount + (state.synergyFlags.solarStorm && p.volleyCounter % 4 === 0 ? 2 : 0);
    const spread = Math.max(0.055, 0.12 - (state.upgrades.twin_bolts || 0) * 0.015);
    for (let i = 0; i < count; i += 1) {
      const b = acquire(pools.playerBolts); if (!b) break;
      const a = p.aimAngle + (i - (count - 1) / 2) * spread;
      const crit = state.random.chance(Math.min(0.65, p.critChance)); const spd = p.boltSpeed * (over ? 1.2 : 1);
      Object.assign(b, { active: true, x: p.x + Math.cos(a) * 1.1, z: p.z + Math.sin(a) * 1.1, vx: Math.cos(a) * spd, vz: Math.sin(a) * spd, radius: crit ? 0.28 : 0.21, damage: p.boltDamage * (crit ? PLAYER_CFG.critMult : 1) * (over ? 1.18 : 1), crit, pierce: p.pierce, life: 1.45, color: crit ? '#fbbf24' : over ? '#fde047' : '#67e8f9', lastHitIndex: -1 });
      state.shotsFired += 1;
    }
    evFlags |= EV_SHOOT;
  }

  function applyUpgrade(index) {
    const c = state.upgradeChoices[index]; if (!c) return null;
    const p = state.player; state.upgrades[c.id] = (state.upgrades[c.id] || 0) + 1; state.upgradeChoices = [];
    const ops = {
      twin_bolts: () => { p.boltCount += 1; },
      rapid_cycle: () => { p.fireInterval *= 0.82; p.boltSpeed *= 1.14; },
      heavy_plasma: () => { p.boltDamage *= 1.28; p.critChance = Math.min(0.65, p.critChance + 0.12); },
      pierce_rail: () => { p.pierce += 1; p.boltDamage *= 1.15; },
      aegis_matrix: () => { p.maxShield += 35; p.shield = p.maxShield; p.shieldRegen *= 1.35; },
      phase_thrusters: () => { p.speed *= 1.14; p.dashCooldown *= 0.8; p.dashWake += 1; },
      emp_overcharge: () => { p.empRadius *= 1.28; p.empDamage += 36; p.empCooldown *= 0.84; },
      orbital_drone: () => { p.drones += 1; },
      nano_plating: () => { p.maxHp += 35; p.hp = Math.min(p.maxHp, p.hp + 45); },
      magnet_core: () => { p.pickupRadius *= 1.55; p.yieldMult += 0.25; },
    };
    if (ops[c.id]) ops[c.id]();
    const syn = evaluateSynergies(state.upgrades); state.synergies = syn.active; state.synergyFlags = syn.flags;
    return c;
  }

  function step(dt, input, attractMode = false) {
    evFlags = 0; state.elapsed += dt;
    if (state.waveBannerTimer > 0) state.waveBannerTimer = Math.max(0, state.waveBannerTimer - dt);
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 1.4);
    if (state.comboTimer > 0) { state.comboTimer -= dt; if (state.comboTimer <= 0) state.combo = 1; }

    const p = state.player; stepSunState(sun, dt, state.waveIndex);
    if (!attractMode && input.buildKind && deployTurret(state, input.buildKind).ok) evFlags |= EV_BUILD;

    if (!attractMode) {
      for (const k of ['hitInvulnTimer', 'flash', 'dashTimer', 'dashInvulnTimer', 'empTimer']) if (p[k] > 0) p[k] = Math.max(0, p[k] - dt);
      if (p.shieldDelayTimer > 0) p.shieldDelayTimer = Math.max(0, p.shieldDelayTimer - dt);
      else if (p.shield < p.maxShield) p.shield = Math.min(p.maxShield, p.shield + p.shieldRegen * dt);

      if (input.dash && p.dashTimer <= 0) {
        const mx = input.moveX || Math.cos(p.aimAngle); const mz = input.moveZ || Math.sin(p.aimAngle); const len = Math.hypot(mx, mz) || 1;
        Object.assign(p, { dashVx: (mx / len) * PLAYER_CFG.dashSpeed, dashVz: (mz / len) * PLAYER_CFG.dashSpeed, dashActiveTimer: PLAYER_CFG.dashDuration, dashInvulnTimer: PLAYER_CFG.dashInvuln, dashTimer: p.dashCooldown });
        evFlags |= EV_DASH;
        if (state.synergyFlags.phaseOverdrive) p.shield = Math.min(p.maxShield, p.shield + 14);
        if (p.dashWake > 0) ring(p.x, p.z, 3.6, '#34d399');
      }
      if (input.emp && p.empTimer <= 0) {
        p.empTimer = p.empCooldown; evFlags |= EV_EMP; state.shake = Math.max(state.shake, 0.42);
        ring(p.x, p.z, p.empRadius, '#67e8f9', 0.25); burst(p.x, p.z, '#38bdf8', 22, 9, 1);
        for (const b of pools.enemyBolts) if (b.active && Math.hypot(b.x - p.x, b.z - p.z) <= p.empRadius) b.active = false;
        const stun = p.empStun * (state.synergyFlags.aegisNexus ? 1.4 : 1);
        for (const e of pools.enemies) if (e.active && Math.hypot(e.x - p.x, e.z - p.z) <= p.empRadius + e.radius) {
          e.stun = Math.max(e.stun, stun); if (e.kind === 'stalker') e.revealed = 4.5; hitEnemy(e, p.empDamage, false, false);
        }
      }

      if (p.dashActiveTimer > 0) { p.dashActiveTimer = Math.max(0, p.dashActiveTimer - dt); p.vx = p.dashVx; p.vz = p.dashVz; state.afterimages.push({ x: p.x, z: p.z, angle: p.aimAngle, life: 0.22 }); }
      else { p.vx += (input.moveX * p.speed - p.vx) * Math.min(1, dt * 14); p.vz += (input.moveZ * p.speed - p.vz) * Math.min(1, dt * 14); }
      p.x = Math.max(-ARENA.halfX + 1.1, Math.min(ARENA.halfX - 1.1, p.x + p.vx * dt));
      p.z = Math.max(-ARENA.halfZ + 1.1, Math.min(ARENA.halfZ - 1.1, p.z + p.vz * dt));
      if (input.aimActive) p.aimAngle = Math.atan2(input.aimZ - p.z, input.aimX - p.x);
      else if (Math.hypot(p.vx, p.vz) > 1.2) p.aimAngle = Math.atan2(p.vz, p.vx);
      const cross = Math.cos(p.aimAngle) * p.vz - Math.sin(p.aimAngle) * p.vx;
      p.bank += (Math.max(-0.52, Math.min(0.52, cross * 0.036)) - p.bank) * Math.min(1, dt * 10);

      p.fireTimer = Math.max(0, p.fireTimer - dt);
      if (input.fire && p.fireTimer <= 0) { fireVolley(); p.fireTimer = p.fireInterval * (state.overchargeTimer > 0 ? 0.72 : 1); }

      if (p.drones > 0) {
        p.droneAngle += dt * 2.4; p.droneFireTimer -= dt;
        if (p.droneFireTimer <= 0) {
          p.droneFireTimer = 0.55; let tgt = null; let bd = 16;
          for (const e of pools.enemies) if (e.active) { const d = Math.hypot(e.x - p.x, e.z - p.z); if (d < bd) { bd = d; tgt = e; } }
          if (tgt) for (let k = 0; k < p.drones; k += 1) {
            const oa = p.droneAngle + (k * Math.PI * 2) / p.drones; const dx = p.x + Math.cos(oa) * 1.95; const dz = p.z + Math.sin(oa) * 1.95;
            const ang = Math.atan2(tgt.z - dz, tgt.x - dx); const b = acquire(pools.playerBolts);
            if (b) Object.assign(b, { active: true, x: dx, z: dz, vx: Math.cos(ang) * 32, vz: Math.sin(ang) * 32, radius: 0.18, damage: p.boltDamage * 0.75, crit: false, pierce: 0, life: 1.1, color: '#2dd4bf', lastHitIndex: -1 });
          }
        }
      }
    } else { p.aimAngle = Math.sin(state.elapsed * 0.65) * 0.45 - 0.1; p.droneAngle += dt * 2; }

    for (let i = state.afterimages.length - 1; i >= 0; i -= 1) if ((state.afterimages[i].life -= dt) <= 0) state.afterimages.splice(i, 1);
    updateOverchargeState(state, dt, 0);
    if (updateWaveDirector(state, dt, attractMode)) evFlags |= EV_BOSS;
    updateStructures(state, dt, hitEnemy);
    updateSolarRefraction(state, dt, hitEnemy);

    for (const e of pools.enemies) {
      if (!e.active) continue;
      if (e.isBoss ? stepArchonBoss(state, e, dt) : stepEnemyAI(state, e, dt, attractMode)) evFlags |= EV_SNIPER_WARN;
      if (!attractMode && Math.hypot(e.x - p.x, e.z - p.z) <= e.radius + p.radius * 0.85 && hurtPlayer(e.isBoss ? BOSS_CFG.contactDmg : (ENEMY_CFG[e.kind].contactDmg || 14))) evFlags |= EV_HIT;
    }
    updateMortars(state, dt, (d) => { if (hurtPlayer(d)) evFlags |= EV_HIT; });

    for (const b of pools.playerBolts) {
      if (!b.active) continue;
      b.x += b.vx * dt; b.z += b.vz * dt; b.life -= dt;
      if (b.life <= 0 || Math.abs(b.x) > ARENA.halfX + 4 || Math.abs(b.z) > ARENA.halfZ + 4) { b.active = false; continue; }
      const pyHit = damagePylonFromPlayerBolt(pylons, b);
      if (pyHit) {
        b.active = false;
        if (pyHit.detonated) {
          const py = pyHit.pylon; evFlags |= EV_PYLON; state.shake = Math.max(state.shake, 0.35);
          ring(py.x, py.z, PYLON_CFG.blastRadius, '#fbbf24', 0.28); burst(py.x, py.z, '#fbbf24', 20, 8.5, 1.4);
          state.emitText(py.x, py.z, 'PYLON OVERLOAD!', '#fbbf24', 16); addScore(PYLON_CFG.scoreBonus);
          for (const e of pools.enemies) if (e.active && Math.hypot(e.x - py.x, e.z - py.z) <= PYLON_CFG.blastRadius + e.radius) {
            if (e.kind === 'stalker') e.revealed = 4;
            const bm = acquire(pools.beams); if (bm) Object.assign(bm, { active: true, x1: py.x, y1: 1.6, z1: py.z, x2: e.x, y2: 0.9, z2: e.z, color: '#fbbf24', width: 0.16, life: 0.28, maxLife: 0.28 });
            hitEnemy(e, PYLON_CFG.blastDamage, true, true);
          }
        }
        continue;
      }
      for (let j = 0; j < pools.enemies.length; j += 1) {
        const e = pools.enemies[j]; if (!e.active || b.lastHitIndex === j) continue;
        if ((b.x - e.x) ** 2 + (b.z - e.z) ** 2 <= (e.radius + b.radius) ** 2) {
          state.shotsHit += 1;
          if (isBastionShieldBlocked(e, b)) { b.active = false; evFlags |= EV_DEFLECT; burst(b.x, b.z, '#38bdf8', 4, 4); state.emitText(e.x, e.z, 'BLOCK', '#67e8f9', 12); break; }
          hitEnemy(e, b.damage * (e.kind === 'stalker' && e.revealed > 0 ? 1.35 : 1) * (e.chill > 0 ? 1 + TURRET_CFG.cryo.critBoost : 1), b.crit, false);
          b.lastHitIndex = j; if (b.pierce > 0) b.pierce -= 1; else { b.active = false; break; }
        }
      }
    }

    for (const b of pools.enemyBolts) {
      if (!b.active) continue;
      b.x += b.vx * dt; b.z += b.vz * dt; b.life -= dt;
      if (b.life <= 0 || Math.abs(b.x) > ARENA.halfX + 5 || Math.abs(b.z) > ARENA.halfZ + 5) { b.active = false; continue; }
      if (interceptEnemyBoltWithPylons(pylons, b)) { b.active = false; burst(b.x, b.z, '#38bdf8', 3, 3); continue; }
      if (!attractMode && (b.x - p.x) ** 2 + (b.z - p.z) ** 2 <= (b.radius + p.radius * 0.78) ** 2) { b.active = false; if (hurtPlayer(b.damage)) evFlags |= EV_HIT; }
    }

    for (const c of pools.crystals) {
      if (!c.active) continue;
      c.life -= dt; c.pulse += dt * 4; if (c.life <= 0) { c.active = false; continue; }
      c.x += c.vx * dt; c.z += c.vz * dt; c.vx *= 0.92; c.vz *= 0.92;
      const dx = p.x - c.x; const dz = p.z - c.z; const d = Math.hypot(dx, dz) || 1;
      if (!attractMode && d <= p.pickupRadius) { const pl = 18 * (1 - d / (p.pickupRadius + 0.5)) + 7; c.x += (dx / d) * pl * dt; c.z += (dz / d) * pl * dt; }
      if (!attractMode && d <= p.radius + 0.75) {
        c.active = false; evFlags |= EV_CRYSTAL;
        state.xp += Math.round(c.value * p.yieldMult); state.shards += Math.max(1, Math.round(c.shards * p.yieldMult)); addScore(35);
        if (state.xp >= state.xpNext) {
          state.xp -= state.xpNext; state.playerLevel += 1; state.xpNext = Math.round(state.xpNext * 1.32 + 25);
          state.upgradeChoices = rollUpgradeChoices(state.upgrades, state.random);
          if (state.upgradeChoices.length) evFlags |= EV_UPGRADE;
        }
      }
    }

    for (const pt of pools.particles) if (pt.active) { pt.x += pt.vx * dt; pt.y = Math.max(0.1, pt.y + pt.vy * dt); pt.vy -= 9.5 * dt; pt.z += pt.vz * dt; if ((pt.life -= dt) <= 0) pt.active = false; }
    for (const k of ['rings', 'beams', 'texts']) for (const o of pools[k]) if (o.active) { if (k === 'texts') o.y += o.vy * dt; if ((o.life -= dt) <= 0) o.active = false; }
    if (!attractMode && p.hp <= 0) evFlags |= EV_OVER;
    return evFlags;
  }

  return { state, reset, setDifficulty, applyUpgrade, step };
}
