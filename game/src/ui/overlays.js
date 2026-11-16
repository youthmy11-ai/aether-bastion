/**
 * Frosted-glass UI overlays: Left-docked Title Card, 3-Card Relic Evolution Armory,
 * 3-Star Victory & Telemetry Debrief, Pause Menu, and Tactical Guide Modal.
 */

import { DIFFICULTIES, DIFFICULTY_ORDER, SCREEN, TURRET_CFG } from '../config/constants.js';
import { findAssociatedSynergy, findReadySynergyHint } from '../sim/synergies.js';

function iconSvg(kind, c) {
  const m = {
    spread: `<path d="M12 36L24 10L36 36M24 10V40" stroke="${c}" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="24" cy="10" r="3" fill="#fde68a"/>`,
    bolt: `<path d="M26 6L12 26H23L21 42L36 21H25Z" fill="${c}" stroke="#fef3c7" stroke-width="1.5"/>`,
    star: `<polygon points="24,6 29,18 42,19 32,27 35,40 24,33 13,40 16,27 6,19 19,18" fill="${c}" stroke="#fef3c7" stroke-width="1.5"/>`,
    pierce: `<path d="M8 38L38 8M25 8H38V21" stroke="${c}" stroke-width="3.2" fill="none" stroke-linecap="round"/><circle cx="23" cy="23" r="5" fill="none" stroke="#fde68a" stroke-width="2"/>`,
    shield: `<path d="M24 7L38 13V24C38 33 31 39 24 42C17 39 10 33 10 24V13Z" fill="rgba(56,189,248,.22)" stroke="${c}" stroke-width="2.6"/>`,
    dash: `<path d="M8 18H30L24 12M12 26H38L31 20M8 34H26" stroke="${c}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    emp: `<circle cx="24" cy="24" r="15" fill="none" stroke="${c}" stroke-width="2.4" stroke-dasharray="5 3"/><circle cx="24" cy="24" r="6" fill="#fde68a"/>`,
    drone: `<polygon points="24,9 36,24 24,39 12,24" fill="rgba(45,212,191,.2)" stroke="${c}" stroke-width="2.5"/><circle cx="24" cy="24" r="4" fill="#fde68a"/>`,
    hull: `<rect x="11" y="11" width="26" height="26" rx="6" fill="rgba(74,222,128,.2)" stroke="${c}" stroke-width="2.6"/><path d="M24 17V31M17 24H31" stroke="#fef3c7" stroke-width="3" stroke-linecap="round"/>`,
    magnet: `<path d="M14 14V26A10 10 0 0 0 34 26V14" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round"/><circle cx="24" cy="14" r="3" fill="#fde68a"/>`,
  };
  return `<svg width="40" height="40" viewBox="0 0 48 48">${m[kind] || m.star}</svg>`;
}

const starSvg = (on) => `<svg width="28" height="28" viewBox="0 0 24 24"><polygon points="12,2 15,8.6 22,9.3 16.8,14 18.3,21 12,17.4 5.7,21 7.2,14 2,9.3 9,8.6" fill="${on ? '#fbbf24' : 'rgba(148,163,184,.22)'}" stroke="${on ? '#fef3c7' : 'rgba(148,163,184,.4)'}" stroke-width="1.3"/></svg>`;
const statBox = (lbl, val, col = '#f8fafc') => `<div class="stat-box"><div style="font-size:10px;color:#94a3b8">${lbl}</div><div class="mono" style="font-size:16px;font-weight:800;color:${col};margin-top:3px">${val}</div></div>`;

/** Manages modal overlay rendering and user button actions without frame thrash. */
export function createOverlays(root, callbacks) {
  let lastKey = '';
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (b) callbacks.onAction(b.getAttribute('data-act'), b.getAttribute('data-val') || undefined);
  });

  function render(state, screen, ui) {
    const mode = ui.guideOpen ? 'guide' : screen;
    const key = `${mode}|${state.difficultyId}|${ui.best}|${state.playerLevel}|${state.upgradeChoices.map((u) => u.id).join(',')}|${state.score}`;
    if (key === lastKey) return;
    lastKey = key;

    if (mode === SCREEN.PLAY) { root.innerHTML = ''; return; }

    if (mode === SCREEN.TITLE) {
      const diffs = DIFFICULTY_ORDER.map((id) => {
        const d = DIFFICULTIES[id]; const act = state.difficultyId === id ? 'active' : '';
        return `<button class="diff-btn ${act}" data-act="diff" data-val="${id}"><div style="font-size:11px;font-weight:800;color:${act ? '#fbbf24' : '#f8fafc'}">${d.label}</div><div style="font-size:10px;color:#94a3b8;margin-top:3px">${id === 'overdrive' ? '+35% Score' : id === 'cadet' ? '20% Lighter' : 'Balanced'}</div></button>`;
      }).join('');
      root.innerHTML = `<div class="title-dock"><div class="title-card"><div class="eyebrow">SUNLIT ORBITAL CITADEL · 3D TACTICAL DEFENSE</div><h1 class="h-title">AETHER BASTION</h1><div style="font-size:12px;font-weight:700;color:#67e8f9;letter-spacing:.14em;margin-top:2px">SOLAR CITADEL</div><p class="sub-copy">Pilot your Aether Interceptor across the sky bastion. Harness the sweeping Golden Sun to refract solar laser links across Prism Spires, deploy tactical turrets, and shatter the Archon Sovereign.</p><div class="diff-grid">${diffs}</div><div style="display:flex;gap:10px;margin-bottom:14px"><button class="primary-btn" style="flex:1" data-act="start">Launch Sortie</button><button class="sec-btn" data-act="guide">Guide [H]</button></div><div style="display:flex;justify-content:space-between;padding-top:10px;border-top:1px solid rgba(148,163,184,.22);font-size:11px;color:#cbd5e1"><span>WASD Move · Mouse Aim · Space Dash · Q EMP · 1/2/3 Turrets</span><span class="mono" style="color:#fbbf24;font-weight:800">BEST ${ui.best.toLocaleString('en-US')}</span></div></div></div>`;
      return;
    }

    if (mode === SCREEN.UPGRADE) {
      const syn = state.synergies.map((s) => `<span class="pill" style="border-color:${s.color};color:${s.color}">★ ${s.name}</span>`).join('');
      const tur = state.turrets.filter((t) => t.active).map((t) => `<span class="pill" style="border-color:${TURRET_CFG[t.kind].color};color:${TURRET_CFG[t.kind].color}">${TURRET_CFG[t.kind].short} T${t.level}</span>`).join('');
      const cards = state.upgradeChoices.map((u, idx) => {
        const st = state.upgrades[u.id] || 0; const rSyn = findReadySynergyHint(state.upgrades, u.id); const aSyn = findAssociatedSynergy(u.id);
        const badge = rSyn ? `<div style="font-size:10px;font-weight:800;padding:5px 8px;border-radius:6px;background:rgba(251,191,36,.16);border:1px solid #fbbf24;color:#fde68a">SYN-READY: ${rSyn.name} — ${rSyn.bonus}</div>` : aSyn ? `<div style="font-size:10px;color:#94a3b8">Synergy Pair: ${aSyn.name}</div>` : '';
        return `<button class="upg-card" data-act="pick" data-val="${idx}"><div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:10px;font-weight:800;padding:2px 7px;border-radius:5px;background:rgba(56,189,248,.16);color:${u.color};border:1px solid ${u.color}">${u.tier} · MK ${st + 1}/${u.maxStacks}</span><span class="mono" style="font-size:12px;font-weight:800;color:#fbbf24">[${idx + 1}]</span></div><div style="display:flex;gap:10px;align-items:center">${iconSvg(u.icon, u.color)}<div><div style="font-size:15px;font-weight:800">${u.name}</div><div class="mono" style="font-size:11px;font-weight:700;color:${u.color};margin-top:2px">${u.tag}</div></div></div><div style="font-size:12px;color:#cbd5e1;line-height:1.4;flex:1">${u.desc}</div>${badge}</button>`;
      }).join('');
      root.innerHTML = `<div class="overlay-backdrop"><div class="armory-panel"><div style="display:flex;justify-content:space-between;align-items:flex-end"><div><div class="eyebrow">LEVEL ${state.playerLevel} · RELIC EVOLUTION ARMORY</div><div style="font-size:21px;font-weight:900">Select Tactical System Evolution</div></div><div style="font-size:12px;color:#cbd5e1">Press <span class="mono" style="color:#fbbf24">1 / 2 / 3</span> or click card</div></div><div class="armory-grid">${cards}</div><div style="display:flex;justify-content:space-between;padding-top:10px;border-top:1px solid rgba(148,163,184,.2)"><div class="pill-row">${syn || '<span style="font-size:11px;color:#94a3b8">Pair two upgrades to unlock Relic Synergies</span>'}</div><div class="pill-row">${tur}</div></div></div></div>`;
      return;
    }

    if (mode === SCREEN.VICTORY || mode === SCREEN.OVER) {
      const vic = mode === SCREEN.VICTORY;
      const tm = `${Math.floor(state.elapsed / 60)}:${Math.floor(state.elapsed % 60).toString().padStart(2, '0')}`;
      const acc = state.shotsFired > 0 ? Math.round((state.crits / Math.max(1, state.shotsHit)) * 100) : 0;
      const stars = vic ? (state.player.hp >= 65 ? 3 : 2) : (state.waveIndex >= 2 ? 1 : 0);
      root.innerHTML = `<div class="overlay-backdrop"><div class="victory-panel"><div class="eyebrow" style="color:${vic ? '#fbbf24' : '#fb7185'}">${vic ? 'CITADEL SECURED · ARCHON VANQUISHED' : 'CITADEL BREACHED · INTERCEPTOR DOWN'}</div><h2 style="margin:4px 0 10px;font-size:28px;font-weight:900">${vic ? 'SOLAR CITADEL TRIUMPH' : 'SORTIE TERMINATED'}</h2><div style="display:flex;justify-content:center;gap:8px;margin-bottom:6px">${[1, 2, 3].map((n) => starSvg(n <= stars)).join('')}</div>${ui.isNewBest ? '<div style="font-size:11px;font-weight:800;color:#34d399;letter-spacing:.1em">NEW SECTOR RECORD</div>' : ''}<div class="stats-grid">${statBox('FINAL SCORE', state.score.toLocaleString('en-US'), '#fbbf24')}${statBox('TIME', tm)}${statBox('HOSTILES PURGED', state.kills, '#67e8f9')}${statBox('CRIT PRECISION', `${acc}%`, '#34d399')}${statBox('SYN & TURRETS', `${state.synergies.length} / ${state.turretsBuilt}`, '#fde68a')}</div><div class="pill-row" style="justify-content:center;margin-bottom:16px">${state.synergies.map((s) => `<span class="pill" style="border-color:${s.color};color:${s.color}">★ ${s.name}</span>`).join('')}<span class="pill">BEST ${ui.best.toLocaleString('en-US')}</span></div><div style="display:flex;justify-content:center;gap:12px"><button class="primary-btn" data-act="restart">Play Again</button><button class="sec-btn" data-act="title">Main Title</button></div></div></div>`;
      return;
    }

    if (mode === 'guide') {
      root.innerHTML = `<div class="overlay-backdrop"><div class="armory-panel" style="width:640px"><div class="eyebrow">TACTICAL FIELD MANUAL</div><h2 style="margin:2px 0 12px;font-size:22px;font-weight:900">Solar Refraction & Turret Command</h2><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:12px;line-height:1.45;color:#cbd5e1;margin-bottom:16px"><div class="stat-box" style="padding:12px;text-align:left"><div style="font-weight:800;color:#fbbf24;margin-bottom:4px">SUNLIGHT & REFRACTION</div>The Golden Sun sweeps around the Citadel each wave. Sunlit Prism Pylons and Prism Spires refract amplified laser links (+65% DMG), melt Bastion shields, and uncloak Void-Stalkers. Shoot Pylons to trigger overload blasts.</div><div class="stat-box" style="padding:12px;text-align:left"><div style="font-weight:800;color:#67e8f9;margin-bottom:4px">FLIGHT & TURRETS</div>WASD / Arrows move · Mouse aims · LMB or F fires · Space Phase Dash · Q / RMB EMP Nova. Press 1 (Prism Spire), 2 (Tesla Tower), or 3 (Cryo Ward) to deploy on the highlighted socket.</div></div><div style="display:flex;justify-content:flex-end"><button class="primary-btn" data-act="closeGuide">Resume</button></div></div></div>`;
      return;
    }

    if (mode === SCREEN.PAUSED) {
      root.innerHTML = `<div class="overlay-backdrop"><div class="victory-panel" style="width:420px"><div class="eyebrow">SORTIE SUSPENDED</div><h2 style="margin:4px 0 14px;font-size:24px;font-weight:900">CITADEL PAUSED</h2><div style="display:flex;justify-content:center;gap:10px"><button class="primary-btn" data-act="resume">Resume</button><button class="sec-btn" data-act="restart">Restart</button><button class="sec-btn" data-act="title">Title</button></div></div></div>`;
    }
  }

  return { render };
}
