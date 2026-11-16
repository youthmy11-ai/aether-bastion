/**
 * Dynamic golden-hour Sun azimuth state and Solar Laser Refraction simulation.
 * Sunlit Prism Pylons and deployed Prism Mirror Spires refract amplified solar beams
 * across hostiles, burning shields and breaking stealth cloaks.
 */

import { acquire, PYLON_CFG, SUN_CFG, TURRET_CFG } from '../config/constants.js';

/** Creates initial dynamic sun state. */
export function createSunState() {
  const az = SUN_CFG.startAzimuth;
  return { azimuth: az, elevation: 0.68, dirX: Math.cos(az), dirZ: Math.sin(az), pulse: 0, activeLinks: 0, solarLinks: [] };
}

/** Resets sun azimuth deterministically at the start of a run. */
export function resetSunState(sun) {
  sun.azimuth = SUN_CFG.startAzimuth; sun.dirX = Math.cos(sun.azimuth); sun.dirZ = Math.sin(sun.azimuth);
  sun.pulse = 0; sun.activeLinks = 0; sun.solarLinks.length = 0;
}

/** Checks whether deck coordinates (x, z) fall inside direct sun or solar corridors. */
export function isPointSunlit(sun, x, z) {
  return x * sun.dirX + z * sun.dirZ >= -2.5 || Math.abs(-x * sun.dirZ + z * sun.dirX) <= SUN_CFG.corridorHalfWidth;
}

/** Advances sun azimuth around the Citadel across waves. */
export function stepSunState(sun, dt, waveIndex) {
  sun.azimuth = (sun.azimuth + dt * SUN_CFG.sweepRate * (1 + waveIndex * 0.14)) % (Math.PI * 2);
  sun.dirX = Math.cos(sun.azimuth); sun.dirZ = Math.sin(sun.azimuth); sun.pulse += dt * 3.1;
}

function pushSolarBeam(state, x1, z1, x2, z2, color, width) {
  const b = acquire(state.pools.beams);
  if (b) Object.assign(b, { active: true, x1, y1: 1.65, z1, x2, y2: 1.1, z2, color, width, life: 0.24, maxLife: 0.24 });
}

/** Updates sunlit charge, builds Pylon-to-Spire links, and fires refracted Solar Laser damage. */
export function updateSolarRefraction(state, dt, hitEnemy) {
  const { sun, pylons, turrets, pools } = state;
  const enemies = pools.enemies;
  sun.solarLinks.length = 0; sun.activeLinks = 0;

  for (const py of pylons) {
    if (!py.active) { py.sunlit = false; py.solarCharge = 0; continue; }
    py.sunlit = isPointSunlit(sun, py.x, py.z);
    py.solarCharge += ((py.sunlit ? 1 : 0.15) - py.solarCharge) * Math.min(1, dt * 4);
    py.beamTimer = (py.beamTimer || 0) - dt;
  }

  for (const t of turrets) {
    if (!t.active) continue;
    const direct = isPointSunlit(sun, t.x, t.z);
    let linked = false;
    if (t.kind === 'prism') {
      for (const py of pylons) {
        if (py.active && py.sunlit && Math.hypot(t.x - py.x, t.z - py.z) <= SUN_CFG.linkMaxDist) {
          linked = true; sun.solarLinks.push({ x1: py.x, z1: py.z, x2: t.x, z2: t.z, color: '#fbbf24' }); sun.activeLinks += 1; break;
        }
      }
    }
    t.sunlit = direct || linked; t.linked = linked;
    t.solarCharge += ((t.sunlit ? 1 : 0.2) - t.solarCharge) * Math.min(1, dt * 5);
  }

  for (const py of pylons) {
    if (!py.active || !py.sunlit || py.beamTimer > 0) continue;
    let best = null; let bestScore = Infinity;
    for (const e of enemies) {
      if (!e.active) continue;
      const d = Math.hypot(e.x - py.x, e.z - py.z);
      if (d <= PYLON_CFG.beamRange) {
        const prio = e.kind === 'stalker' || e.kind === 'bastion' ? d * 0.65 : d;
        if (prio < bestScore) { bestScore = prio; best = e; }
      }
    }
    if (best) {
      py.beamTimer = 0.36;
      const dmg = PYLON_CFG.beamDps * 0.36 * (best.kind === 'bastion' ? SUN_CFG.shieldBurnMult : SUN_CFG.solarBonusMult);
      if (best.kind === 'stalker' && best.revealed <= 0) state.emitText(best.x, best.z, 'UNCLOAKED!', '#fbbf24', 13);
      if (best.kind === 'stalker') best.revealed = 3.2;
      pushSolarBeam(state, py.x, py.z, best.x, best.z, '#fbbf24', 0.14);
      hitEnemy(best, dmg, false, true);
    } else py.beamTimer = 0.12;
  }

  const pCfg = TURRET_CFG.prism;
  for (const t of turrets) {
    if (!t.active || t.kind !== 'prism') continue;
    t.cooldown -= dt; if (t.cooldown > 0) continue;
    let pri = null; let bestD = Infinity; const range = pCfg.range + (t.level - 1) * 1.6;
    for (const e of enemies) {
      if (!e.active) continue;
      const d = Math.hypot(e.x - t.x, e.z - t.z);
      if (d <= range && d < bestD) { bestD = d; pri = e; }
    }
    if (!pri) { t.cooldown = 0.12; continue; }
    t.cooldown = 0.28; t.aimAngle = Math.atan2(pri.z - t.z, pri.x - t.x);
    const dmg = pCfg.dps * 0.28 * (1 + (t.level - 1) * 0.35) * (t.sunlit ? SUN_CFG.solarBonusMult : 1) * (pri.kind === 'bastion' ? SUN_CFG.shieldBurnMult : 1);
    if (pri.kind === 'stalker') pri.revealed = 3.5;
    pushSolarBeam(state, t.x, t.z, pri.x, pri.z, t.sunlit ? '#67e8f9' : '#38bdf8', t.sunlit ? 0.18 : 0.11);
    hitEnemy(pri, dmg, t.sunlit && pri.chill > 0, true);
    if (t.sunlit) {
      let sec = null; let secD = Infinity;
      for (const e of enemies) {
        if (!e.active || e === pri) continue;
        const d = Math.hypot(e.x - pri.x, e.z - pri.z);
        if (d <= 7.5 && d < secD) { secD = d; sec = e; }
      }
      if (sec) {
        if (sec.kind === 'stalker') sec.revealed = 3.5;
        pushSolarBeam(state, pri.x, pri.z, sec.x, sec.z, '#fbbf24', 0.13);
        hitEnemy(sec, dmg * 0.78, false, true);
      }
    }
  }
}
