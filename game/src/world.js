// Pure deterministic arena simulation engine (zero DOM/Canvas/WebAudio dependencies).
import {
  BOSS_CFG,
  DIFFICULTIES,
  ENEMY_CFG,
  FIELD,
  PLAYER_CFG,
  UPGRADES,
  WAVES,
} from './config.js';
import { acquire, createPlayer, createPools, createStars } from './entities.js';

export const EV_SHOOT = 1;
export const EV_CRIT = 2;
export const EV_DEFLECT = 4;
export const EV_KILL = 8;
export const EV_CRYSTAL = 16;
export const EV_DASH = 32;
export const EV_EMP = 64;
export const EV_HIT = 128;
export const EV_UPGRADE = 256;
export const EV_BOSS = 512;
export const EV_VICTORY = 1024;
export const EV_OVER = 2048;
export const EV_SNIPER_WARN = 4096;

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function moveTowardAngle(current, target, maxStep) {
  const diff = wrapAngle(target - current);
  if (Math.abs(diff) <= maxStep) return target;
  return wrapAngle(current + Math.sign(diff) * maxStep);
}

function distToSegmentSq(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  if (lenSq <= 0.0001) return (px - ax) ** 2 + (py - ay) ** 2;
  const t = clamp(((px - ax) * abx + (py - ay) * aby) / lenSq, 0, 1);
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  return (px - cx) ** 2 + (py - cy) ** 2;
}

export function createWorld(random) {
  const pools = createPools();
  const stars = createStars(random);
  const player = createPlayer();

  const state = {
    difficultyId: 'vanguard',
    difficulty: DIFFICULTIES.vanguard,
    player,
    pools,
    stars,
    waveIndex: 0,
    waveElapsed: 0,
    waveBannerTimer: 0,
    waveBannerText: '',
    spawnTimer: 0.7,
    elapsed: 0,
    score: 0,
    xp: 0,
    xpNext: 105,
    playerLevel: 1,
    combo: 1,
    comboTimer: 0,
    peakCombo: 1,
    kills: 0,
    shotsFired: 0,
    shotsHit: 0,
    damageDealt: 0,
    shake: 0,
    gridPulse: 0,
    gridPulseX: FIELD.width / 2,
    gridPulseY: FIELD.height / 2,
    upgrades: {},
    upgradeChoices: [],
    boss: null,
    afterimages: [],
    totalWaveCount: WAVES.length,
  };

  function spawnParticle(x, y, vx, vy, size, maxLife, color, kind = 'spark') {
    const p = acquire(pools.particles);
    if (!p) return;
    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.size = size;
    p.life = maxLife;
    p.maxLife = maxLife;
    p.color = color;
    p.kind = kind;
  }

  function spawnBurst(x, y, color, count, speedMin = 60, speedMax = 240, size = 3) {
    for (let i = 0; i < count; i += 1) {
      const a = random.range(0, Math.PI * 2);
      const sp = random.range(speedMin, speedMax);
      spawnParticle(x, y, Math.cos(a) * sp, Math.sin(a) * sp, size * random.range(0.7, 1.3), random.range(0.22, 0.52), color);
    }
  }

  function spawnRing(x, y, maxRadius, maxLife, color, lineWidth = 4) {
    const r = acquire(pools.rings);
    if (!r) return;
    r.active = true;
    r.x = x;
    r.y = y;
    r.radius = 8;
    r.maxRadius = maxRadius;
    r.life = maxLife;
    r.maxLife = maxLife;
    r.color = color;
    r.lineWidth = lineWidth;
  }

  function spawnText(x, y, text, color = '#f1f5f9', size = 14) {
    const t = acquire(pools.texts);
    if (!t) return;
    t.active = true;
    t.x = x;
    t.y = y;
    t.vy = -42;
    t.life = 0.72;
    t.maxLife = 0.72;
    t.text = text;
    t.color = color;
    t.size = size;
  }

  function spawnCrystal(x, y, value) {
    const c = acquire(pools.crystals);
    if (!c) return;
    const a = random.range(0, Math.PI * 2);
    const sp = random.range(45, 115);
    c.active = true;
    c.x = x;
    c.y = y;
    c.vx = Math.cos(a) * sp;
    c.vy = Math.sin(a) * sp;
    c.value = value;
    c.life = 14;
    c.pulse = random.range(0, Math.PI * 2);
  }

  function spawnEnemyBolt(x, y, angle, speed, damage, color, radius = 5, isRail = false) {
    const b = acquire(pools.enemyBolts);
    if (!b) return;
    b.active = true;
    b.x = x;
    b.y = y;
    b.vx = Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
    b.radius = radius;
    b.damage = damage;
    b.life = isRail ? 2.2 : 5.5;
    b.color = color;
    b.isRail = isRail;
  }

  function spawnPlayerBolt(x, y, angle, speed, damage, crit, pierce, color = '#67e8f9', radius = 4.2) {
    const b = acquire(pools.playerBolts);
    if (!b) return;
    b.active = true;
    b.x = x;
    b.y = y;
    b.vx = Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
    b.radius = crit ? radius * 1.25 : radius;
    b.damage = damage;
    b.crit = crit;
    b.pierce = pierce;
    b.life = 1.9;
    b.color = crit ? '#fbbf24' : color;
    b.lastHitIndex = -1;
  }

  function pickWeightedEnemy(wave) {
    let roll = random();
    for (let i = 0; i < wave.weights.length; i += 1) {
      roll -= wave.weights[i][1];
      if (roll <= 0) return wave.weights[i][0];
    }
    return wave.weights[0][0];
  }

  function spawnPositionOnEdge(margin = 22) {
    const edge = random.int(0, 3);
    if (edge === 0) return { x: random.range(FIELD.arenaLeft + margin, FIELD.arenaRight - margin), y: FIELD.arenaTop + margin };
    if (edge === 1) return { x: FIELD.arenaRight - margin, y: random.range(FIELD.arenaTop + margin, FIELD.arenaBottom - margin) };
    if (edge === 2) return { x: random.range(FIELD.arenaLeft + margin, FIELD.arenaRight - margin), y: FIELD.arenaBottom - margin };
    return { x: FIELD.arenaLeft + margin, y: random.range(FIELD.arenaTop + margin, FIELD.arenaBottom - margin) };
  }

  function spawnEnemy(kind, customX = null, customY = null) {
    const e = acquire(pools.enemies);
    if (!e) return null;
    const cfg = ENEMY_CFG[kind];
    const diff = state.difficulty;
    const waveScale = 1 + state.waveIndex * 0.12;
    const pos = customX !== null && customY !== null ? { x: customX, y: customY } : spawnPositionOnEdge(cfg.radius + 8);
    e.active = true;
    e.kind = kind;
    e.x = clamp(pos.x, FIELD.arenaLeft + cfg.radius, FIELD.arenaRight - cfg.radius);
    e.y = clamp(pos.y, FIELD.arenaTop + cfg.radius, FIELD.arenaBottom - cfg.radius);
    e.vx = 0;
    e.vy = 0;
    e.radius = cfg.radius;
    e.hp = Math.round(cfg.hp * diff.enemyHp * waveScale);
    e.maxHp = e.hp;
    e.speed = cfg.speed * diff.enemySpeed;
    e.angle = Math.atan2(player.y - e.y, player.x - e.x);
    e.aimAngle = e.angle;
    e.timer = random.range(0.55, 1.35);
    e.phaseTimer = 0;
    e.telegraph = 0;
    e.flash = 0;
    e.stun = 0;
    e.orbitDir = random.chance(0.5) ? 1 : -1;
    e.isBoss = false;
    e.bossPhase = 1;
    e.dashVx = 0;
    e.dashVy = 0;
    spawnRing(e.x, e.y, cfg.radius * 2.1, 0.28, cfg.color, 2);
    return e;
  }

  function spawnBoss() {
    const e = acquire(pools.enemies);
    if (!e) return null;
    const diff = state.difficulty;
    e.active = true;
    e.kind = 'boss';
    e.isBoss = true;
    e.bossPhase = 1;
    e.x = (FIELD.arenaLeft + FIELD.arenaRight) / 2;
    e.y = FIELD.arenaTop + 108;
    e.vx = 0;
    e.vy = 0;
    e.radius = BOSS_CFG.radius;
    e.hp = Math.round(BOSS_CFG.hp * diff.enemyHp);
    e.maxHp = e.hp;
    e.speed = BOSS_CFG.speed * diff.enemySpeed;
    e.angle = Math.PI / 2;
    e.aimAngle = Math.PI / 2;
    e.timer = 1.2;
    e.phaseTimer = 0;
    e.telegraph = 0;
    e.flash = 0;
    e.stun = 0;
    e.orbitDir = 1;
    e.dashVx = 0;
    e.dashVy = 0;
    state.boss = e;
    spawnRing(e.x, e.y, 180, 0.6, '#f43f5e', 5);
    spawnBurst(e.x, e.y, '#fbbf24', 28, 90, 290, 4);
    state.shake = Math.max(state.shake, 11);
    return e;
  }

  function setDifficulty(id) {
    if (DIFFICULTIES[id]) {
      state.difficultyId = id;
      state.difficulty = DIFFICULTIES[id];
    }
  }

  function reset(diffId = state.difficultyId) {
    setDifficulty(diffId);
    Object.assign(player, createPlayer());
    for (const key of Object.keys(pools)) {
      const list = pools[key];
      for (let i = 0; i < list.length; i += 1) list[i].active = false;
    }
    state.waveIndex = 0;
    state.waveElapsed = 0;
    state.waveBannerTimer = 2.4;
    state.waveBannerText = WAVES[0].title;
    state.spawnTimer = 0.55;
    state.elapsed = 0;
    state.score = 0;
    state.xp = 0;
    state.xpNext = 95;
    state.playerLevel = 1;
    state.combo = 1;
    state.comboTimer = 0;
    state.peakCombo = 1;
    state.kills = 0;
    state.shotsFired = 0;
    state.shotsHit = 0;
    state.damageDealt = 0;
    state.shake = 0;
    state.gridPulse = 0;
    state.upgrades = {};
    state.upgradeChoices = [];
    state.boss = null;
    state.afterimages.length = 0;

    // Seed initial opening skirmish immediately so arena is active on frame 1.
    spawnEnemy('swarmer');
    spawnEnemy('swarmer');
    spawnEnemy('sniper');
  }

  function rollUpgrades() {
    const eligible = [];
    for (let i = 0; i < UPGRADES.length; i += 1) {
      const u = UPGRADES[i];
      const count = state.upgrades[u.id] || 0;
      if (count < u.maxStacks) eligible.push(u);
    }
    const pool = eligible.slice();
    const chosen = [];
    while (chosen.length < 3 && pool.length > 0) {
      const idx = Math.floor(random() * pool.length);
      chosen.push(pool.splice(idx, 1)[0]);
    }
    state.upgradeChoices = chosen;
  }

  function applyUpgrade(choiceIndex) {
    const picked = state.upgradeChoices[choiceIndex];
    if (!picked) return null;
    state.upgrades[picked.id] = (state.upgrades[picked.id] || 0) + 1;
    if (picked.id === 'twin_bolts') {
      player.boltCount += 1;
    } else if (picked.id === 'rapid_cycle') {
      player.fireInterval *= 0.82;
      player.boltSpeed *= 1.14;
    } else if (picked.id === 'heavy_plasma') {
      player.boltDamage *= 1.28;
      player.critChance = Math.min(0.65, player.critChance + 0.12);
    } else if (picked.id === 'pierce_rail') {
      player.pierce += 1;
      player.boltDamage *= 1.15;
    } else if (picked.id === 'aegis_matrix') {
      player.maxShield += 35;
      player.shield = player.maxShield;
      player.shieldRegen *= 1.35;
    } else if (picked.id === 'phase_thrusters') {
      player.speed *= 1.14;
      player.dashCooldown *= 0.78;
      player.dashWake += 1;
    } else if (picked.id === 'emp_overcharge') {
      player.empRadius *= 1.28;
      player.empDamage += 36;
      player.empCooldown *= 0.8;
    } else if (picked.id === 'orbital_drone') {
      player.drones += 1;
    } else if (picked.id === 'nano_plating') {
      player.maxHp += 35;
      player.hp = Math.min(player.maxHp, player.hp + 45);
    } else if (picked.id === 'magnet_core') {
      player.pickupRadius *= 1.7;
      player.yieldMult *= 1.2;
    }
    state.upgradeChoices = [];
    spawnRing(player.x, player.y, 130, 0.45, picked.color, 4);
    spawnText(player.x, player.y - 26, picked.name.toUpperCase(), picked.color, 16);
    return picked;
  }

  function damagePlayer(amount, harmless) {
    if (harmless) return 0;
    if (player.dashInvulnTimer > 0 || player.hitInvulnTimer > 0) return 0;
    let remaining = amount;
    if (player.shield > 0) {
      const absorbed = Math.min(player.shield, remaining);
      player.shield -= absorbed;
      remaining -= absorbed;
    }
    if (remaining > 0) {
      player.hp = Math.max(0, player.hp - remaining);
      state.combo = Math.max(1, Math.floor((state.combo * 0.65) * 4) / 4);
    }
    player.shieldDelayTimer = state.difficultyId === 'cadet' ? 2.3 : PLAYER_CFG.shieldDelay;
    player.hitInvulnTimer = PLAYER_CFG.hitInvuln;
    player.flash = 0.22;
    state.shake = Math.max(state.shake, 9.5);
    spawnBurst(player.x, player.y, remaining > 0 ? '#f43f5e' : '#38bdf8', 14, 70, 220, 3.2);
    spawnText(player.x, player.y - 22, `-${Math.round(amount)}`, remaining > 0 ? '#fb7185' : '#60a5fa', 16);
    return player.hp <= 0 ? (EV_HIT | EV_OVER) : EV_HIT;
  }

  function killEnemy(e, index, harmless) {
    e.active = false;
    if (e.isBoss) {
      state.boss = null;
      const bossScore = Math.round(BOSS_CFG.score * state.difficulty.scoreMult * state.combo * player.yieldMult);
      if (!harmless) {
        state.score += bossScore;
        state.kills += 1;
      }
      spawnRing(e.x, e.y, 260, 0.75, '#fbbf24', 6);
      spawnRing(e.x, e.y, 190, 0.55, '#f43f5e', 4);
      spawnBurst(e.x, e.y, '#fbbf24', 45, 90, 360, 4.5);
      spawnBurst(e.x, e.y, '#38bdf8', 25, 60, 280, 3.5);
      spawnText(e.x, e.y - 20, `+${bossScore}`, '#fbbf24', 24);
      state.shake = 16;
      state.gridPulse = 1;
      state.gridPulseX = e.x;
      state.gridPulseY = e.y;
      return EV_KILL | EV_VICTORY;
    }

    const cfg = ENEMY_CFG[e.kind];
    state.kills += harmless ? 0 : 1;
    state.combo = Math.min(8, Math.round((state.combo + 0.25) * 100) / 100);
    state.comboTimer = 3.8;
    if (state.combo > state.peakCombo) state.peakCombo = state.combo;

    const gained = Math.round(cfg.score * state.difficulty.scoreMult * state.combo * player.yieldMult);
    if (!harmless) state.score += gained;

    spawnBurst(e.x, e.y, cfg.color, 16, 65, 230, 3.1);
    spawnRing(e.x, e.y, e.radius * 2.5, 0.3, cfg.color, 2.5);
    if (!harmless) spawnText(e.x, e.y - 12, `+${gained}`, '#f1f5f9', 13);

    const crystalCount = e.kind === 'bastion' || e.kind === 'splitter' ? 2 : 1;
    const perXp = Math.round((cfg.xp * player.yieldMult) / crystalCount);
    for (let c = 0; c < crystalCount; c += 1) spawnCrystal(e.x, e.y, perXp);

    if (e.kind === 'splitter') {
      for (let s = -1; s <= 1; s += 2) {
        const shard = spawnEnemy('shard', e.x + s * 16, e.y + s * 8);
        if (shard) {
          shard.vx = s * 140;
          shard.vy = -s * 90;
        }
      }
    }
    return EV_KILL;
  }

  function damageEnemy(e, index, rawDmg, hitAngle, crit, bypassShield, harmless) {
    let dmg = rawDmg;
    let events = 0;
    if (e.kind === 'bastion' && !bypassShield) {
      const incomingAngle = wrapAngle(hitAngle + Math.PI);
      const diff = Math.abs(wrapAngle(incomingAngle - e.angle));
      if (diff <= ENEMY_CFG.bastion.shieldArc * 0.52) {
        dmg *= 0.3;
        events |= EV_DEFLECT;
        spawnBurst(
          e.x + Math.cos(e.angle) * e.radius,
          e.y + Math.sin(e.angle) * e.radius,
          '#67e8f9',
          5,
          80,
          170,
          2.2,
        );
        spawnText(e.x, e.y - e.radius - 6, 'BLOCK', '#67e8f9', 11);
      }
    }
    const dealt = Math.round(dmg);
    e.hp -= dealt;
    e.flash = 0.09;
    state.damageDealt += dealt;
    state.shotsHit += 1;
    if (crit) {
      events |= EV_CRIT;
      spawnText(e.x + random.range(-8, 8), e.y - e.radius - 4, `${dealt}!`, '#fbbf24', 16);
    } else if (dealt >= 12) {
      spawnText(e.x + random.range(-6, 6), e.y - e.radius, `${dealt}`, '#e2e8f0', 12);
    }
    if (e.hp <= 0) events |= killEnemy(e, index, harmless);
    return events;
  }

  function stepBoss(e, dt, harmless) {
    let events = 0;
    const hpRatio = e.hp / e.maxHp;
    const targetPhase = hpRatio <= 0.33 ? 3 : hpRatio <= 0.66 ? 2 : 1;
    if (targetPhase > e.bossPhase) {
      e.bossPhase = targetPhase;
      e.telegraph = 0;
      e.timer = 0.9;
      spawnRing(e.x, e.y, 240, 0.55, '#fbbf24', 5);
      spawnBurst(e.x, e.y, '#f43f5e', 26, 90, 280, 4);
      state.shake = Math.max(state.shake, 11);
      state.waveBannerText = targetPhase === 2 ? 'ARCHON PHASE II · SIEGE BARRAGE' : 'ARCHON PHASE III · OVERDRIVE';
      state.waveBannerTimer = 2.0;
      // Clear immediate overlapping enemy bolts during phase shift for fairness.
      for (let i = 0; i < pools.enemyBolts.length; i += 1) {
        if (pools.enemyBolts[i].active) pools.enemyBolts[i].active = false;
      }
    }

    e.phaseTimer += dt;
    const toPlayer = Math.atan2(player.y - e.y, player.x - e.x);
    e.angle = moveTowardAngle(e.angle, toPlayer, 2.2 * dt);

    // Boss dash surge in Phase 3 or orbital weave otherwise.
    if (e.dashVx !== 0 || e.dashVy !== 0) {
      e.x += e.dashVx * dt;
      e.y += e.dashVy * dt;
      e.dashVx *= Math.pow(0.08, dt);
      e.dashVy *= Math.pow(0.08, dt);
      if (Math.hypot(e.dashVx, e.dashVy) < 28) {
        e.dashVx = 0;
        e.dashVy = 0;
      }
    } else {
      const targetX = (FIELD.arenaLeft + FIELD.arenaRight) / 2 + Math.cos(e.phaseTimer * 0.72) * 340;
      const targetY = FIELD.arenaTop + 145 + Math.sin(e.phaseTimer * 1.15) * 65;
      const dx = targetX - e.x;
      const dy = targetY - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const moveSp = e.speed * (e.bossPhase === 3 ? 1.35 : 1.0);
      e.x += (dx / d) * Math.min(d, moveSp * dt);
      e.y += (dy / d) * Math.min(d, moveSp * dt);
    }

    e.x = clamp(e.x, FIELD.arenaLeft + e.radius + 10, FIELD.arenaRight - e.radius - 10);
    e.y = clamp(e.y, FIELD.arenaTop + e.radius + 10, FIELD.arenaBottom - e.radius - 10);

    if (e.telegraph > 0) {
      const prev = e.telegraph;
      e.telegraph = Math.max(0, e.telegraph - dt);
      if (e.telegraph > 0.25) e.aimAngle = toPlayer;
      if (prev > 0 && e.telegraph === 0) {
        if (e.bossPhase === 3 && random.chance(0.45)) {
          e.dashVx = Math.cos(e.aimAngle) * 690;
          e.dashVy = Math.sin(e.aimAngle) * 690;
          spawnRing(e.x, e.y, 110, 0.35, '#fbbf24', 3);
        } else {
          for (let s = -1; s <= 1; s += 2) {
            spawnEnemyBolt(
              e.x + Math.cos(e.aimAngle + s * 0.14) * 34,
              e.y + Math.sin(e.aimAngle + s * 0.14) * 34,
              e.aimAngle + s * 0.06,
              760,
              20,
              '#fbbf24',
              6.5,
              true,
            );
          }
          spawnBurst(e.x, e.y, '#fbbf24', 10, 80, 210, 3);
        }
      }
      return events;
    }

    e.timer -= dt * state.difficulty.enemyFire;
    if (e.timer <= 0) {
      const pattern = Math.floor(e.phaseTimer * 1.4) % (e.bossPhase === 1 ? 2 : 3);
      if (pattern === 0) {
        const count = e.bossPhase === 1 ? 10 : e.bossPhase === 2 ? 12 : 14;
        const offset = e.phaseTimer * 0.9;
        for (let k = 0; k < count; k += 1) {
          const a = offset + (Math.PI * 2 * k) / count;
          spawnEnemyBolt(e.x, e.y, a, 275 + e.bossPhase * 22, 15, '#f43f5e', 5.5);
        }
        e.timer = e.bossPhase === 3 ? 1.15 : 1.55;
      } else if (pattern === 1) {
        e.telegraph = 0.85;
        e.aimAngle = toPlayer;
        e.timer = 1.6;
        events |= EV_SNIPER_WARN;
      } else {
        // Phase 2/3 mortar barrage near player.
        const count = e.bossPhase === 3 ? 3 : 2;
        for (let m = 0; m < count; m += 1) {
          const mortar = acquire(pools.mortars);
          if (!mortar) break;
          mortar.active = true;
          mortar.x = clamp(player.x + random.range(-125, 125), FIELD.arenaLeft + 70, FIELD.arenaRight - 70);
          mortar.y = clamp(player.y + random.range(-95, 95), FIELD.arenaTop + 70, FIELD.arenaBottom - 70);
          mortar.radius = 66;
          mortar.elapsed = 0;
          mortar.duration = 1.3;
          mortar.damage = 22;
        }
        e.timer = 1.65;
      }
    }
    return events;
  }

  function stepEnemy(e, dt, harmless) {
    if (e.flash > 0) e.flash = Math.max(0, e.flash - dt);
    if (e.stun > 0) {
      e.stun = Math.max(0, e.stun - dt);
      return 0;
    }
    if (e.isBoss) return stepBoss(e, dt, harmless);

    let events = 0;
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const toPlayer = Math.atan2(dy, dx);

    if (e.kind === 'swarmer' || e.kind === 'shard') {
      e.angle = toPlayer;
      if (e.kind === 'swarmer' && e.telegraph > 0) {
        e.telegraph = Math.max(0, e.telegraph - dt);
        if (e.telegraph === 0) {
          e.dashVx = Math.cos(e.aimAngle) * e.speed * 2.4;
          e.dashVy = Math.sin(e.aimAngle) * e.speed * 2.4;
          e.phaseTimer = 0.36;
        }
      } else if (e.phaseTimer > 0) {
        e.phaseTimer = Math.max(0, e.phaseTimer - dt);
        e.x += e.dashVx * dt;
        e.y += e.dashVy * dt;
      } else {
        const flank = Math.sin(state.elapsed * 3.1 + e.radius) * 0.35 * e.orbitDir;
        e.x += Math.cos(toPlayer + flank) * e.speed * dt;
        e.y += Math.sin(toPlayer + flank) * e.speed * dt;
        if (e.kind === 'swarmer') {
          e.timer -= dt;
          if (e.timer <= 0 && dist < 245 && dist > 65) {
            e.telegraph = 0.35;
            e.aimAngle = toPlayer;
            e.timer = 2.4;
          }
        }
      }
    } else if (e.kind === 'sniper') {
      if (e.telegraph > 0) {
        const prev = e.telegraph;
        e.telegraph = Math.max(0, e.telegraph - dt);
        if (e.telegraph > 0.24) e.aimAngle = toPlayer;
        e.angle = e.aimAngle;
        if (prev > 0 && e.telegraph === 0) {
          spawnEnemyBolt(
            e.x + Math.cos(e.aimAngle) * (e.radius + 6),
            e.y + Math.sin(e.aimAngle) * (e.radius + 6),
            e.aimAngle,
            ENEMY_CFG.sniper.boltSpeed,
            ENEMY_CFG.sniper.dmg,
            '#ffb703',
            5.5,
            true,
          );
          spawnBurst(e.x + Math.cos(e.aimAngle) * 16, e.y + Math.sin(e.aimAngle) * 16, '#ffb703', 6, 70, 170, 2.5);
        }
      } else {
        e.angle = toPlayer;
        const desired = 360;
        const radial = dist < desired - 45 ? -1 : dist > desired + 65 ? 1 : 0;
        const strafeAngle = toPlayer + (Math.PI / 2) * e.orbitDir;
        e.x += (Math.cos(toPlayer) * radial * 0.75 + Math.cos(strafeAngle) * 0.65) * e.speed * dt;
        e.y += (Math.sin(toPlayer) * radial * 0.75 + Math.sin(strafeAngle) * 0.65) * e.speed * dt;
        e.timer -= dt * state.difficulty.enemyFire;
        if (e.timer <= 0 && !harmless) {
          e.telegraph = ENEMY_CFG.sniper.chargeTime;
          e.aimAngle = toPlayer;
          e.timer = ENEMY_CFG.sniper.cooldown;
          events |= EV_SNIPER_WARN;
        }
      }
    } else if (e.kind === 'bastion') {
      e.angle = moveTowardAngle(e.angle, toPlayer, 1.85 * dt);
      if (dist > 155) {
        e.x += Math.cos(toPlayer) * e.speed * dt;
        e.y += Math.sin(toPlayer) * e.speed * dt;
      }
      e.timer -= dt * state.difficulty.enemyFire;
      if (e.timer <= 0 && !harmless) {
        e.timer = ENEMY_CFG.bastion.cooldown;
        for (let s = -1; s <= 1; s += 1) {
          spawnEnemyBolt(
            e.x + Math.cos(e.angle) * (e.radius + 4),
            e.y + Math.sin(e.angle) * (e.radius + 4),
            e.angle + s * 0.25,
            ENEMY_CFG.bastion.boltSpeed,
            ENEMY_CFG.bastion.dmg,
            '#38bdf8',
            5.2,
          );
        }
      }
    } else if (e.kind === 'mortar') {
      e.angle = toPlayer;
      const desired = 330;
      const radial = dist < desired - 40 ? -0.8 : dist > desired + 60 ? 0.8 : 0;
      const strafe = toPlayer + (Math.PI / 2) * e.orbitDir;
      e.x += (Math.cos(toPlayer) * radial + Math.cos(strafe) * 0.7) * e.speed * dt;
      e.y += (Math.sin(toPlayer) * radial + Math.sin(strafe) * 0.7) * e.speed * dt;
      e.timer -= dt * state.difficulty.enemyFire;
      if (e.timer <= 0 && !harmless) {
        e.timer = ENEMY_CFG.mortar.cooldown;
        const m = acquire(pools.mortars);
        if (m) {
          m.active = true;
          m.x = clamp(player.x + player.vx * 0.28 + random.range(-48, 48), FIELD.arenaLeft + 68, FIELD.arenaRight - 68);
          m.y = clamp(player.y + player.vy * 0.28 + random.range(-48, 48), FIELD.arenaTop + 68, FIELD.arenaBottom - 68);
          m.radius = ENEMY_CFG.mortar.blastRadius;
          m.elapsed = 0;
          m.duration = ENEMY_CFG.mortar.fuseTime;
          m.damage = ENEMY_CFG.mortar.dmg;
        }
      }
    } else if (e.kind === 'splitter') {
      e.phaseTimer += dt * 2.8;
      e.angle += dt * 2.1;
      const desired = 250;
      const radial = dist < desired - 35 ? -0.75 : dist > desired + 45 ? 0.85 : 0;
      const strafe = toPlayer + (Math.PI / 2) * e.orbitDir;
      e.x += (Math.cos(toPlayer) * radial + Math.cos(strafe) * 0.85) * e.speed * dt;
      e.y += (Math.sin(toPlayer) * radial + Math.sin(strafe) * 0.85) * e.speed * dt;
      e.timer -= dt * state.difficulty.enemyFire;
      if (e.timer <= 0 && !harmless) {
        e.timer = ENEMY_CFG.splitter.cooldown;
        for (let s = -1; s <= 1; s += 2) {
          spawnEnemyBolt(e.x, e.y, toPlayer + s * 0.16, ENEMY_CFG.splitter.boltSpeed, ENEMY_CFG.splitter.dmg, '#d946ef', 5);
        }
      }
    }

    e.x = clamp(e.x, FIELD.arenaLeft + e.radius, FIELD.arenaRight - e.radius);
    e.y = clamp(e.y, FIELD.arenaTop + e.radius, FIELD.arenaBottom - e.radius);
    return events;
  }

  function step(dt, ctrl, harmless = false) {
    let events = 0;
    state.elapsed += dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 28);
    if (state.gridPulse > 0) state.gridPulse = Math.max(0, state.gridPulse - dt * 2.1);
    if (state.waveBannerTimer > 0) state.waveBannerTimer = Math.max(0, state.waveBannerTimer - dt);

    // Parallax starfield drift.
    for (let i = 0; i < stars.length; i += 1) {
      const s = stars[i];
      s.y += s.speed * dt;
      if (s.y > FIELD.height) {
        s.y = -2;
        s.x = random.range(0, FIELD.width);
      }
    }

    // Combo decay.
    if (state.combo > 1) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) {
        state.combo = 1;
        state.comboTimer = 0;
      }
    }

    // Cooldowns & shield recovery.
    if (player.fireTimer > 0) player.fireTimer = Math.max(0, player.fireTimer - dt);
    if (player.dashTimer > 0) player.dashTimer = Math.max(0, player.dashTimer - dt);
    if (player.dashInvulnTimer > 0) player.dashInvulnTimer = Math.max(0, player.dashInvulnTimer - dt);
    if (player.hitInvulnTimer > 0) player.hitInvulnTimer = Math.max(0, player.hitInvulnTimer - dt);
    if (player.empTimer > 0) player.empTimer = Math.max(0, player.empTimer - dt);
    if (player.flash > 0) player.flash = Math.max(0, player.flash - dt);

    if (player.shieldDelayTimer > 0) {
      player.shieldDelayTimer = Math.max(0, player.shieldDelayTimer - dt);
    } else if (player.shield < player.maxShield) {
      const regenMult = state.difficultyId === 'cadet' ? 1.3 : 1;
      player.shield = Math.min(player.maxShield, player.shield + player.shieldRegen * regenMult * dt);
    }

    // Gentle scenic pilot when on title screen.
    let moveX = ctrl.moveX || 0;
    let moveY = ctrl.moveY || 0;
    if (harmless) {
      const cx = (FIELD.arenaLeft + FIELD.arenaRight) / 2 + Math.cos(state.elapsed * 0.7) * 260;
      const cy = (FIELD.arenaTop + FIELD.arenaBottom) / 2 + Math.sin(state.elapsed * 1.1) * 145;
      const dx = cx - player.x;
      const dy = cy - player.y;
      const d = Math.hypot(dx, dy) || 1;
      moveX = dx / d;
      moveY = dy / d;
    }

    // Dash trigger.
    if (!harmless && ctrl.dash && player.dashTimer === 0 && player.dashActiveTimer === 0) {
      const dashAngle = moveX !== 0 || moveY !== 0 ? Math.atan2(moveY, moveX) : player.aimAngle;
      player.dashVx = Math.cos(dashAngle) * PLAYER_CFG.dashSpeed;
      player.dashVy = Math.sin(dashAngle) * PLAYER_CFG.dashSpeed;
      player.dashActiveTimer = PLAYER_CFG.dashDuration;
      player.dashInvulnTimer = PLAYER_CFG.dashInvuln;
      player.dashTimer = player.dashCooldown;
      events |= EV_DASH;
      spawnBurst(player.x, player.y, '#67e8f9', 12, 60, 190, 2.8);
      if (player.dashWake > 0) {
        const wakeRad = 95 + player.dashWake * 20;
        spawnRing(player.x, player.y, wakeRad, 0.34, '#34d399', 3.5);
        for (let i = 0; i < pools.enemies.length; i += 1) {
          const e = pools.enemies[i];
          if (!e.active) continue;
          if (Math.hypot(e.x - player.x, e.y - player.y) <= wakeRad + e.radius) {
            events |= damageEnemy(e, i, 26 * player.dashWake, Math.atan2(e.y - player.y, e.x - player.x), false, true, harmless);
          }
        }
      }
    }

    // Player movement.
    if (player.dashActiveTimer > 0) {
      player.dashActiveTimer = Math.max(0, player.dashActiveTimer - dt);
      player.vx = player.dashVx;
      player.vy = player.dashVy;
      player.trailTimer -= dt;
      if (player.trailTimer <= 0) {
        player.trailTimer = 0.025;
        state.afterimages.push({ x: player.x, y: player.y, angle: player.aimAngle, life: 0.22 });
      }
    } else {
      player.vx = moveX * player.speed;
      player.vy = moveY * player.speed;
    }
    player.x = clamp(player.x + player.vx * dt, FIELD.arenaLeft + player.radius, FIELD.arenaRight - player.radius);
    player.y = clamp(player.y + player.vy * dt, FIELD.arenaTop + player.radius, FIELD.arenaBottom - player.radius);

    // Update dash afterimages.
    for (let i = state.afterimages.length - 1; i >= 0; i -= 1) {
      state.afterimages[i].life -= dt;
      if (state.afterimages[i].life <= 0) state.afterimages.splice(i, 1);
    }

    // Aiming (cursor if active, else nearest threat).
    if (ctrl.aimActive && !harmless) {
      player.aimAngle = Math.atan2(ctrl.aimY - player.y, ctrl.aimX - player.x);
    } else {
      let nearest = null;
      let bestDistSq = Infinity;
      for (let i = 0; i < pools.enemies.length; i += 1) {
        const e = pools.enemies[i];
        if (!e.active) continue;
        const dSq = (e.x - player.x) ** 2 + (e.y - player.y) ** 2;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          nearest = e;
        }
      }
      if (nearest) player.aimAngle = Math.atan2(nearest.y - player.y, nearest.x - player.x);
      else if (moveX !== 0 || moveY !== 0) player.aimAngle = Math.atan2(moveY, moveX);
    }

    // EMP Nova ability.
    if (!harmless && ctrl.emp && player.empTimer === 0) {
      player.empTimer = player.empCooldown;
      events |= EV_EMP;
      state.shake = Math.max(state.shake, 10);
      state.gridPulse = 1;
      state.gridPulseX = player.x;
      state.gridPulseY = player.y;
      spawnRing(player.x, player.y, player.empRadius, 0.44, '#a78bfa', 5);
      spawnRing(player.x, player.y, player.empRadius * 0.72, 0.34, '#38bdf8', 3);

      for (let i = 0; i < pools.enemyBolts.length; i += 1) {
        const b = pools.enemyBolts[i];
        if (!b.active) continue;
        if (Math.hypot(b.x - player.x, b.y - player.y) <= player.empRadius) {
          b.active = false;
          spawnParticle(b.x, b.y, random.range(-70, 70), random.range(-70, 70), 2.4, 0.25, '#a78bfa');
        }
      }
      for (let i = 0; i < pools.enemies.length; i += 1) {
        const e = pools.enemies[i];
        if (!e.active) continue;
        if (Math.hypot(e.x - player.x, e.y - player.y) <= player.empRadius + e.radius) {
          if (!e.isBoss) e.stun = Math.max(e.stun, player.empStun);
          events |= damageEnemy(e, i, player.empDamage, Math.atan2(e.y - player.y, e.x - player.x), false, true, harmless);
        }
      }
    }

    // Primary weapon firing.
    if ((ctrl.fire || harmless) && player.fireTimer === 0) {
      player.fireTimer = harmless ? 0.34 : player.fireInterval;
      const count = player.boltCount;
      const spreadStep = count === 1 ? 0 : Math.max(0.055, 0.095 - (count - 2) * 0.012);
      const startAngle = player.aimAngle - ((count - 1) * spreadStep) / 2;
      for (let k = 0; k < count; k += 1) {
        const a = startAngle + k * spreadStep;
        const crit = !harmless && random.chance(player.critChance);
        const dmg = player.boltDamage * (crit ? PLAYER_CFG.critMult : 1);
        const mx = player.x + Math.cos(a) * (player.radius + 7);
        const my = player.y + Math.sin(a) * (player.radius + 7);
        spawnPlayerBolt(mx, my, a, player.boltSpeed, dmg, crit, player.pierce);
        if (!harmless) state.shotsFired += 1;
      }
      if (!harmless) events |= EV_SHOOT;
    }

    // Autonomous Orbital Sentinel drones.
    if (player.drones > 0) {
      player.droneAngle = wrapAngle(player.droneAngle + dt * 2.5);
      player.droneFireTimer -= dt;
      if (player.droneFireTimer <= 0) {
        player.droneFireTimer = Math.max(0.24, 0.56 - player.drones * 0.09);
        let target = null;
        let minD = 420 * 420;
        for (let i = 0; i < pools.enemies.length; i += 1) {
          const e = pools.enemies[i];
          if (!e.active) continue;
          const dSq = (e.x - player.x) ** 2 + (e.y - player.y) ** 2;
          if (dSq < minD) {
            minD = dSq;
            target = e;
          }
        }
        if (target) {
          for (let d = 0; d < player.drones; d += 1) {
            const da = player.droneAngle + (Math.PI * 2 * d) / player.drones;
            const dx = player.x + Math.cos(da) * 42;
            const dy = player.y + Math.sin(da) * 42;
            const aim = Math.atan2(target.y - dy, target.x - dx);
            spawnPlayerBolt(dx, dy, aim, player.boltSpeed * 0.95, player.boltDamage * 0.72, false, 0, '#2dd4bf', 3.4);
          }
        }
      }
    }

    // Wave progression & spawning.
    const wave = WAVES[state.waveIndex];
    state.waveElapsed += dt;
    state.spawnTimer -= dt;
    let activeEnemies = 0;
    for (let i = 0; i < pools.enemies.length; i += 1) if (pools.enemies[i].active) activeEnemies += 1;

    if (harmless) {
      if (state.spawnTimer <= 0 && activeEnemies < 9) {
        spawnEnemy(pickWeightedEnemy(WAVES[1]));
        state.spawnTimer = 1.4;
      }
    } else if (!wave.boss) {
      if (state.waveElapsed < wave.duration) {
        if (state.spawnTimer <= 0 && activeEnemies < 22) {
          spawnEnemy(pickWeightedEnemy(wave));
          if (state.waveIndex >= 1 && random.chance(0.45)) spawnEnemy(pickWeightedEnemy(wave));
          state.spawnTimer = wave.spawnInterval;
        }
      } else if ((activeEnemies <= 2 || state.waveElapsed >= wave.duration + 18) && state.waveIndex < WAVES.length - 1) {
        state.waveIndex += 1;
        state.waveElapsed = 0;
        const nextWave = WAVES[state.waveIndex];
        state.waveBannerText = nextWave.title;
        state.waveBannerTimer = 2.8;
        state.spawnTimer = 1.1;
        if (nextWave.boss) {
          spawnBoss();
          events |= EV_BOSS;
        }
      }
    } else if (state.boss && state.boss.active) {
      if (state.spawnTimer <= 0 && activeEnemies < 6) {
        spawnEnemy(pickWeightedEnemy(wave));
        state.spawnTimer = wave.spawnInterval;
      }
    }

    // Update player bolts.
    for (let i = 0; i < pools.playerBolts.length; i += 1) {
      const b = pools.playerBolts[i];
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (
        b.life <= 0 ||
        b.x < FIELD.arenaLeft ||
        b.x > FIELD.arenaRight ||
        b.y < FIELD.arenaTop ||
        b.y > FIELD.arenaBottom
      ) {
        b.active = false;
        continue;
      }
      for (let j = 0; j < pools.enemies.length; j += 1) {
        if (j === b.lastHitIndex) continue;
        const e = pools.enemies[j];
        if (!e.active) continue;
        const hitR = e.radius + b.radius;
        if ((b.x - e.x) ** 2 + (b.y - e.y) ** 2 <= hitR * hitR) {
          b.lastHitIndex = j;
          events |= damageEnemy(e, j, b.damage, Math.atan2(b.vy, b.vx), b.crit, false, harmless);
          spawnBurst(b.x, b.y, b.color, 4, 40, 130, 2);
          if (b.pierce > 0) {
            b.pierce -= 1;
          } else {
            b.active = false;
            break;
          }
        }
      }
    }

    // Update enemies + enemy-player contact.
    for (let i = 0; i < pools.enemies.length; i += 1) {
      const e = pools.enemies[i];
      if (!e.active) continue;
      events |= stepEnemy(e, dt, harmless);
      if (!harmless) {
        const hitR = e.radius + player.radius - 2;
        if ((e.x - player.x) ** 2 + (e.y - player.y) ** 2 <= hitR * hitR) {
          const contact = e.isBoss ? BOSS_CFG.contactDmg : (ENEMY_CFG[e.kind].contactDmg || 14);
          events |= damagePlayer(contact, harmless);
        }
      }
    }

    // Update enemy bolts.
    for (let i = 0; i < pools.enemyBolts.length; i += 1) {
      const b = pools.enemyBolts[i];
      if (!b.active) continue;
      const prevX = b.x;
      const prevY = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (
        b.life <= 0 ||
        b.x < FIELD.arenaLeft - 10 ||
        b.x > FIELD.arenaRight + 10 ||
        b.y < FIELD.arenaTop - 10 ||
        b.y > FIELD.arenaBottom + 10
      ) {
        b.active = false;
        continue;
      }
      if (!harmless) {
        const hitR = player.radius + b.radius - 2;
        if (distToSegmentSq(player.x, player.y, prevX, prevY, b.x, b.y) <= hitR * hitR) {
          b.active = false;
          events |= damagePlayer(b.damage, harmless);
        }
      }
    }

    // Update mortar hazard rings.
    for (let i = 0; i < pools.mortars.length; i += 1) {
      const m = pools.mortars[i];
      if (!m.active) continue;
      m.elapsed += dt;
      if (m.elapsed >= m.duration) {
        m.active = false;
        spawnRing(m.x, m.y, m.radius * 1.15, 0.35, '#fb7185', 4);
        spawnBurst(m.x, m.y, '#fb7185', 18, 80, 240, 3.2);
        state.shake = Math.max(state.shake, 5.5);
        if (!harmless && Math.hypot(player.x - m.x, player.y - m.y) <= m.radius + player.radius * 0.65) {
          events |= damagePlayer(m.damage, harmless);
        }
      }
    }

    // Update XP crystals + magnet pickup.
    for (let i = 0; i < pools.crystals.length; i += 1) {
      const c = pools.crystals[i];
      if (!c.active) continue;
      c.life -= dt;
      c.pulse += dt * 5;
      if (c.life <= 0) {
        c.active = false;
        continue;
      }
      c.vx *= Math.pow(0.05, dt);
      c.vy *= Math.pow(0.05, dt);
      const dx = player.x - c.x;
      const dy = player.y - c.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d <= player.pickupRadius) {
        const pull = 540 * (1 - d / (player.pickupRadius * 1.15)) + 210;
        c.vx = (dx / d) * pull;
        c.vy = (dy / d) * pull;
      }
      c.x = clamp(c.x + c.vx * dt, FIELD.arenaLeft + 8, FIELD.arenaRight - 8);
      c.y = clamp(c.y + c.vy * dt, FIELD.arenaTop + 8, FIELD.arenaBottom - 8);
      if (d <= player.radius + 14) {
        c.active = false;
        if (!harmless) {
          state.xp += c.value;
          state.score += Math.round(12 * state.combo * state.difficulty.scoreMult * player.yieldMult);
          state.combo = Math.min(8, Math.round((state.combo + 0.08) * 100) / 100);
          state.comboTimer = Math.max(state.comboTimer, 3.2);
          if (state.combo > state.peakCombo) state.peakCombo = state.combo;
          events |= EV_CRYSTAL;
          if (state.xp >= state.xpNext) {
            state.xp -= state.xpNext;
            state.playerLevel += 1;
            state.xpNext = Math.round(95 + state.playerLevel * 52 + state.playerLevel * state.playerLevel * 10);
            rollUpgrades();
            if (state.upgradeChoices.length > 0) events |= EV_UPGRADE;
          }
        }
      }
    }

    // Update particles, rings, floating text.
    for (let i = 0; i < pools.particles.length; i += 1) {
      const p = pools.particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(0.14, dt);
      p.vy *= Math.pow(0.14, dt);
    }

    for (let i = 0; i < pools.rings.length; i += 1) {
      const r = pools.rings[i];
      if (!r.active) continue;
      r.life -= dt;
      if (r.life <= 0) {
        r.active = false;
        continue;
      }
      const t = 1 - r.life / r.maxLife;
      r.radius = 8 + (r.maxRadius - 8) * (1 - (1 - t) * (1 - t));
    }

    for (let i = 0; i < pools.texts.length; i += 1) {
      const t = pools.texts[i];
      if (!t.active) continue;
      t.life -= dt;
      if (t.life <= 0) {
        t.active = false;
        continue;
      }
      t.y += t.vy * dt;
    }

    return events;
  }

  reset('vanguard');
  return { state, reset, setDifficulty, applyUpgrade, step };
}
