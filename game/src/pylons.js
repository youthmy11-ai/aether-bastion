// Interactive Arena Energy Pylons: block enemy fire and detonate in chain blasts when overcharged.
import { FIELD, PYLON_CFG } from './config.js';

const ANCHORS = [
  { xFrac: 0.18, yFrac: 0.26 },
  { xFrac: 0.82, yFrac: 0.26 },
  { xFrac: 0.18, yFrac: 0.74 },
  { xFrac: 0.82, yFrac: 0.74 },
];

export function createArenaPylons() {
  const w = FIELD.arenaRight - FIELD.arenaLeft;
  const h = FIELD.arenaBottom - FIELD.arenaTop;
  return ANCHORS.map((a, idx) => ({
    id: idx,
    x: Math.round(FIELD.arenaLeft + w * a.xFrac),
    y: Math.round(FIELD.arenaTop + h * a.yFrac),
    radius: PYLON_CFG.radius,
    hp: PYLON_CFG.hp,
    maxHp: PYLON_CFG.hp,
    active: true,
    respawnTimer: 0,
    pulse: idx * 1.4,
    flash: 0,
  }));
}

export function resetArenaPylons(pylons) {
  for (let i = 0; i < pylons.length; i += 1) {
    const p = pylons[i];
    p.active = true;
    p.hp = PYLON_CFG.hp;
    p.maxHp = PYLON_CFG.hp;
    p.respawnTimer = 0;
    p.flash = 0;
  }
}

export function updateArenaPylons(pylons, dt) {
  for (let i = 0; i < pylons.length; i += 1) {
    const p = pylons[i];
    p.pulse += dt * 2.4;
    if (p.flash > 0) p.flash = Math.max(0, p.flash - dt);
    if (!p.active) {
      p.respawnTimer -= dt;
      if (p.respawnTimer <= 0) {
        p.active = true;
        p.hp = PYLON_CFG.hp;
        p.respawnTimer = 0;
      }
    }
  }
}

export function interceptEnemyBoltWithPylons(pylons, bolt) {
  for (let i = 0; i < pylons.length; i += 1) {
    const p = pylons[i];
    if (!p.active) continue;
    const hitR = p.radius + bolt.radius;
    if ((bolt.x - p.x) ** 2 + (bolt.y - p.y) ** 2 <= hitR * hitR) {
      p.flash = 0.08;
      return p;
    }
  }
  return null;
}

export function damagePylonFromPlayerBolt(pylons, bolt) {
  for (let i = 0; i < pylons.length; i += 1) {
    const p = pylons[i];
    if (!p.active) continue;
    const hitR = p.radius + bolt.radius;
    if ((bolt.x - p.x) ** 2 + (bolt.y - p.y) ** 2 <= hitR * hitR) {
      p.hp -= bolt.damage;
      p.flash = 0.1;
      if (p.hp <= 0) {
        p.active = false;
        p.respawnTimer = PYLON_CFG.respawnTime;
        return { pylon: p, detonated: true };
      }
      return { pylon: p, detonated: false };
    }
  }
  return null;
}
