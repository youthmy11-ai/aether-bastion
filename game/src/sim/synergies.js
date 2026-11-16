/**
 * Relic Synergy evaluator, upgrade card choice generator, and Solar Overcharge meter state.
 */

import { PLAYER_CFG, RELIC_SYNERGIES, UPGRADES } from '../config/constants.js';

/**
 * Computes active relic synergies and fast boolean flags from installed upgrade stacks.
 * @param {Record<string, number>} upgrades
 */
export function evaluateSynergies(upgrades) {
  const active = [];
  const flags = {
    solarStorm: false,
    singularityRail: false,
    aegisNexus: false,
    phaseOverdrive: false,
  };
  for (let i = 0; i < RELIC_SYNERGIES.length; i += 1) {
    const syn = RELIC_SYNERGIES[i];
    if ((upgrades[syn.requires[0]] || 0) > 0 && (upgrades[syn.requires[1]] || 0) > 0) {
      active.push(syn);
      if (syn.id === 'solar_storm') flags.solarStorm = true;
      else if (syn.id === 'singularity_rail') flags.singularityRail = true;
      else if (syn.id === 'aegis_nexus') flags.aegisNexus = true;
      else if (syn.id === 'phase_overdrive') flags.phaseOverdrive = true;
    }
  }
  return { active, flags };
}

/**
 * Returns the synergy unlocked if the player selects candidateId, or null.
 * @param {Record<string, number>} upgrades
 * @param {string} candidateId
 */
export function findReadySynergyHint(upgrades, candidateId) {
  for (let i = 0; i < RELIC_SYNERGIES.length; i += 1) {
    const syn = RELIC_SYNERGIES[i];
    const [a, b] = syn.requires;
    if (a === candidateId && (upgrades[b] || 0) > 0 && (upgrades[a] || 0) === 0) return syn;
    if (b === candidateId && (upgrades[a] || 0) > 0 && (upgrades[b] || 0) === 0) return syn;
  }
  return null;
}

/**
 * Returns the relic synergy associated with a given upgrade card, if any.
 * @param {string} candidateId
 */
export function findAssociatedSynergy(candidateId) {
  for (let i = 0; i < RELIC_SYNERGIES.length; i += 1) {
    const syn = RELIC_SYNERGIES[i];
    if (syn.requires[0] === candidateId || syn.requires[1] === candidateId) return syn;
  }
  return null;
}

/**
 * Picks up to 3 eligible upgrades not yet at maxStacks using seeded PRNG.
 * @param {Record<string, number>} upgrades
 * @param {Function} random
 */
export function rollUpgradeChoices(upgrades, random) {
  const pool = [];
  for (let i = 0; i < UPGRADES.length; i += 1) {
    const u = UPGRADES[i];
    if ((upgrades[u.id] || 0) < u.maxStacks) pool.push(u);
  }
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  return pool.slice(0, 3);
}

/**
 * Updates Solar Overcharge gauge and returns true on the exact tick Overcharge activates.
 * @param {object} state
 * @param {number} dt
 * @param {number} comboGain
 */
export function updateOverchargeState(state, dt, comboGain) {
  if (state.overchargeTimer > 0) {
    state.overchargeTimer = Math.max(0, state.overchargeTimer - dt);
    state.overchargeMeter = (state.overchargeTimer / PLAYER_CFG.overchargeDuration) * 100;
    return false;
  }
  if (comboGain > 0) {
    state.overchargeMeter = Math.min(100, state.overchargeMeter + comboGain);
    if (state.overchargeMeter >= 100) {
      state.overchargeTimer = PLAYER_CFG.overchargeDuration;
      return true;
    }
  } else if (state.overchargeMeter > 0) {
    state.overchargeMeter = Math.max(0, state.overchargeMeter - dt * 4.5);
  }
  return false;
}
