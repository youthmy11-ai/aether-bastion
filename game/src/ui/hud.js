/**
 * Corner HUD manager and transparent 2D overlay renderer for floating world-projected
 * damage popups, tactical radar minimap, and crosshair reticle.
 */

import { ARENA, BOSS_CFG, TURRET_CFG, TURRET_ORDER, WAVES } from '../config/constants.js';
import { findTargetSocket, getTurretCost } from '../sim/turrets.js';

const _proj = { x: 0, y: 0, visible: false };

/** Initializes the corner HUD DOM skeleton and 2D popup/minimap canvas. */
export function createHud(hudRoot, overlayCanvas, callbacks) {
  const ctx = overlayCanvas.getContext('2d');
  hudRoot.innerHTML = `
    <div class="hud-card hud-tl">
      <div class="bar-row"><span>HULL</span><span class="mono" data-k="hpT">100/100</span></div>
      <div class="bar-track"><div class="bar-fill" data-k="hpB" style="width:100%;background:linear-gradient(90deg,#fb7185,#34d399)"></div></div>
      <div class="bar-row"><span>AEGIS SHIELD</span><span class="mono" data-k="shT">60/60</span></div>
      <div class="bar-track"><div class="bar-fill" data-k="shB" style="width:100%;background:linear-gradient(90deg,#38bdf8,#67e8f9)"></div></div>
      <div class="bar-row"><span data-k="lvlT">LVL 1</span><span class="mono" data-k="ovT" style="color:#fbbf24">OVERCHARGE 0%</span></div>
      <div class="bar-track" style="margin:0"><div class="bar-fill" data-k="xpB" style="width:0%;background:linear-gradient(90deg,#a78bfa,#fbbf24)"></div></div>
    </div>
    <div class="hud-card hud-tc">
      <div><div style="font-size:10px;color:#fbbf24;font-weight:800;letter-spacing:.1em" data-k="wvT">WAVE 1/4</div><div class="mono" style="font-size:15px;font-weight:800" data-k="scT">0</div></div>
      <div style="display:flex;align-items:center;gap:6px;padding:0 10px;border-left:1px solid rgba(148,163,184,.25);border-right:1px solid rgba(148,163,184,.25)">
        <svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="rgba(251,191,36,.4)" stroke-width="1.5"/><circle cx="12" cy="12" r="3.5" fill="#fbbf24"/><line data-k="sunN" x1="12" y1="12" x2="19" y2="12" stroke="#fde68a" stroke-width="2" stroke-linecap="round"/></svg>
        <div><div style="font-size:9px;color:#94a3b8;font-weight:700">SUN AZIMUTH</div><div class="mono" style="font-size:12px;font-weight:800;color:#fde68a" data-k="sunD">35°</div></div>
      </div>
      <div><div style="font-size:10px;color:#67e8f9;font-weight:800">SHARDS · <span class="mono" data-k="cmbT">x1.0</span></div><div class="mono" style="font-size:15px;font-weight:800;color:#67e8f9" data-k="shdT">45</div></div>
    </div>
    <div class="boss-bar-wrap" data-k="bWrap"><div class="bar-row" style="margin-bottom:4px"><span style="color:#fda4af">ARCHON SOVEREIGN</span><span class="mono" style="color:#fbbf24" data-k="bPh">P1</span></div><div class="bar-track" style="height:8px;margin:0"><div class="bar-fill" data-k="bBar" style="width:100%;background:linear-gradient(90deg,#f43f5e,#fbbf24)"></div></div></div>
    <div class="hud-tr">
      <div style="width:162px;height:102px;border-radius:10px;background:rgba(15,23,42,.72);border:1px solid rgba(245,196,108,.3)"></div>
      <div class="pill-row">
        <button class="btn-hud" data-act="auto" data-k="autoB">Auto [F]</button><button class="btn-hud" data-act="guide">Guide [H]</button>
        <button class="btn-hud" data-act="mute" data-k="muteB">SFX [M]</button><button class="btn-hud" data-act="pause">Pause [P]</button>
      </div>
    </div>
    <div class="hud-bl"><div class="pill-row" data-k="synR"></div><div class="pill-row"><span class="pill" data-k="dshP">[SPACE] DASH</span><span class="pill" data-k="empP">[Q] EMP NOVA</span></div></div>
    <div class="hud-br">
      <div class="pill-row" data-k="dots"></div>
      <div class="pill-row">${TURRET_ORDER.map((id) => { const t = TURRET_CFG[id]; return `<button class="build-slot" data-act="build" data-val="${id}"><span class="build-key">${t.key}</span><span style="text-align:left"><div style="font-size:11px;font-weight:800;color:${t.color}">${t.short}</div><div class="mono" style="font-size:10px;color:#cbd5e1" data-k="c_${id}">${t.cost} SHARDS</div></span></button>`; }).join('')}</div>
    </div>`;

  const el = {};
  hudRoot.querySelectorAll('[data-k]').forEach((n) => { el[n.getAttribute('data-k')] = n; });
  hudRoot.addEventListener('click', (e) => { const b = e.target.closest('button[data-act]'); if (b) callbacks.onAction(b.getAttribute('data-act'), b.getAttribute('data-val') || undefined); });

  function resize(w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    overlayCanvas.width = Math.round(w * dpr); overlayCanvas.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function update(state, ui, sceneCtx, visible) {
    hudRoot.classList.toggle('active', visible);
    const { width, height } = sceneCtx.getSize(); ctx.clearRect(0, 0, width, height);
    if (!visible) return;
    const p = state.player;
    el.hpT.textContent = `${Math.ceil(p.hp)}/${p.maxHp}`; el.hpB.style.width = `${Math.max(0, (p.hp / Math.max(1, p.maxHp)) * 100)}%`;
    el.shT.textContent = `${Math.ceil(p.shield)}/${p.maxShield}`; el.shB.style.width = `${Math.max(0, (p.shield / Math.max(1, p.maxShield)) * 100)}%`;
    el.lvlT.textContent = `LVL ${state.playerLevel}`;
    el.ovT.textContent = state.overchargeTimer > 0 ? `OVERCHARGE ${state.overchargeTimer.toFixed(1)}s` : `OVERCHARGE ${Math.round(state.overchargeMeter)}%`;
    el.xpB.style.width = `${Math.min(100, (state.xp / Math.max(1, state.xpNext)) * 100)}%`;

    const w = WAVES[state.waveIndex];
    el.wvT.textContent = `WAVE ${w.id}/${WAVES.length} · ${w.title.split('·')[1]?.trim() || 'CITADEL'}`;
    el.scT.textContent = state.score.toLocaleString('en-US'); el.cmbT.textContent = `x${state.combo.toFixed(1)}`; el.shdT.textContent = `${state.shards}`;
    el.sunD.textContent = `${Math.round(((state.sun.azimuth * 180) / Math.PI) % 360)}°`;
    el.sunN.setAttribute('x2', (12 + Math.cos(state.sun.azimuth) * 8).toFixed(1)); el.sunN.setAttribute('y2', (12 + Math.sin(state.sun.azimuth) * 8).toFixed(1));

    const bAct = Boolean(state.boss && state.boss.active); el.bWrap.classList.toggle('active', bAct);
    if (bAct) { el.bPh.textContent = `${BOSS_CFG.name} · P${state.boss.bossPhase}`; el.bBar.style.width = `${Math.max(0, (state.boss.hp / Math.max(1, state.boss.maxHp)) * 100)}%`; }

    el.autoB.classList.toggle('on', Boolean(ui.autoFire)); el.autoB.textContent = ui.autoFire ? 'Auto: ON [F]' : 'Auto [F]';
    el.muteB.textContent = ui.muted ? 'Muted [M]' : 'SFX [M]';
    el.dshP.textContent = p.dashTimer <= 0 ? '[SPACE] DASH · READY' : `[SPACE] DASH · ${p.dashTimer.toFixed(1)}s`;
    el.dshP.style.borderColor = p.dashTimer <= 0 ? 'rgba(52,211,153,.65)' : 'rgba(148,163,184,.25)';
    el.empP.textContent = p.empTimer <= 0 ? '[Q] EMP NOVA · READY' : `[Q] EMP NOVA · ${p.empTimer.toFixed(1)}s`;
    el.empP.style.borderColor = p.empTimer <= 0 ? 'rgba(103,232,249,.65)' : 'rgba(148,163,184,.25)';

    let synHtml = state.synergies.map((s) => `<span class="pill" style="border-color:${s.color};color:${s.color}">★ ${s.name}</span>`).join('');
    if (state.sun.activeLinks > 0) synHtml += `<span class="pill" style="border-color:#fbbf24;color:#fde68a">☀ SOLAR LINKS x${state.sun.activeLinks}</span>`;
    if (el.synR.dataset.p !== synHtml) { el.synR.innerHTML = synHtml; el.synR.dataset.p = synHtml; }

    const tgt = findTargetSocket(state, null);
    for (const id of TURRET_ORDER) {
      const sock = findTargetSocket(state, id); const cost = getTurretCost(sock, id);
      el[`c_${id}`].textContent = sock && sock.active ? `UPG T${sock.level + 1} · ${cost}` : `${cost} SHARDS`;
      el[`c_${id}`].closest('.build-slot').classList.toggle('dim', !sock || state.shards < cost);
    }
    const dotsHtml = `<span style="font-size:10px;color:#94a3b8;font-weight:700;margin-right:4px">SOCKETS</span>` + state.turrets.map((t) => {
      const col = !t.active ? (tgt && tgt.id === t.id ? '#67e8f9' : 'rgba(148,163,184,.35)') : TURRET_CFG[t.kind].color;
      return `<span style="width:9px;height:9px;border-radius:50%;display:inline-block;background:${t.active ? col : 'transparent'};border:1.5px solid ${col}"></span>`;
    }).join('');
    if (el.dots.dataset.p !== dotsHtml) { el.dots.innerHTML = dotsHtml; el.dots.dataset.p = dotsHtml; }

    const mx = width - 176; const my = 12; const mw = 162; const mh = 102;
    const toX = (x) => mx + ((x + ARENA.halfX) / (ARENA.halfX * 2)) * mw;
    const toZ = (z) => my + ((z + ARENA.halfZ) / (ARENA.halfZ * 2)) * mh;
    ctx.save(); ctx.beginPath(); ctx.rect(mx, my, mw, mh); ctx.clip();
    ctx.strokeStyle = 'rgba(251,191,36,.35)'; ctx.lineWidth = 18;
    ctx.beginPath(); ctx.moveTo(mx + mw * .5 - state.sun.dirX * 95, my + mh * .5 - state.sun.dirZ * 95); ctx.lineTo(mx + mw * .5 + state.sun.dirX * 95, my + mh * .5 + state.sun.dirZ * 95); ctx.stroke();
    for (const py of state.pylons) if (py.active) { ctx.fillStyle = py.sunlit ? '#fbbf24' : '#38bdf8'; ctx.fillRect(toX(py.x) - 2.5, toZ(py.z) - 2.5, 5, 5); }
    for (const tu of state.turrets) if (tu.active) { ctx.fillStyle = TURRET_CFG[tu.kind].color; ctx.beginPath(); ctx.arc(toX(tu.x), toZ(tu.z), 3, 0, Math.PI * 2); ctx.fill(); }
    for (const e of state.pools.enemies) if (e.active) { ctx.fillStyle = e.isBoss ? '#f43f5e' : '#fb7185'; ctx.beginPath(); ctx.arc(toX(e.x), toZ(e.z), e.isBoss ? 4.5 : 2.1, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#34d399'; ctx.beginPath(); ctx.arc(toX(p.x), toZ(p.z), 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const t of state.pools.texts) {
      if (!t.active) continue;
      sceneCtx.worldToScreen(t.x, t.y, t.z, _proj); if (!_proj.visible) continue;
      ctx.globalAlpha = Math.min(1, t.life / Math.max(0.01, t.maxLife * 0.45));
      ctx.font = `800 ${t.size}px system-ui,-apple-system,sans-serif`;
      ctx.strokeStyle = 'rgba(10,15,30,.85)'; ctx.lineWidth = 3.5; ctx.strokeText(t.text, _proj.x, _proj.y);
      ctx.fillStyle = t.color; ctx.fillText(t.text, _proj.x, _proj.y);
    }
    ctx.globalAlpha = 1;
    if (ui.pointer && ui.pointer.active) {
      ctx.strokeStyle = 'rgba(103,232,249,.78)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(ui.pointer.screenX, ui.pointer.screenY, 10, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(ui.pointer.screenX, ui.pointer.screenY, 2.2, 0, Math.PI * 2); ctx.fillStyle = '#fbbf24'; ctx.fill();
    }
  }
  return { resize, update };
}
