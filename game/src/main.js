/**
 * Main entry point for Aether Bastion: Solar Citadel.
 * Manages fixed-timestep 1/60s simulation, Three.js 3D rendering, HUD/overlay UI,
 * WebAudio event synthesis, localStorage persistence, and deterministic shot staging.
 */

import { createRandom, SCREEN, STEP, STORAGE_KEYS, TURRET_ORDER } from './config/constants.js';
import { createAudio } from './audio/synth.js';
import { ACT_AUTOFIRE, ACT_CONFIRM, ACT_DASH, ACT_EMP, ACT_GUIDE, ACT_MUTE, ACT_PAUSE, ACT_PICK_1, ACT_PICK_2, ACT_PICK_3, ACT_RESTART, createControls } from './input/controls.js';
import { createSceneContext } from './render/scene.js';
import { createCitadelBuilder } from './render/citadel.js';
import { createMeshPools } from './render/meshes.js';
import { createEffectsPool } from './render/effects.js';
import { createHud } from './ui/hud.js';
import { createOverlays } from './ui/overlays.js';
import { createWorld, EV_BOSS, EV_BUILD, EV_CRIT, EV_CRYSTAL, EV_DASH, EV_DEFLECT, EV_EMP, EV_HIT, EV_KILL, EV_OVER, EV_OVERCHARGE, EV_PYLON, EV_SHOOT, EV_SNIPER_WARN, EV_UPGRADE, EV_VICTORY } from './sim/world.js';
import { stageShot } from './shots/stager.js';

const params = new URLSearchParams(window.location.search);
const shotParam = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const world = createWorld(createRandom(Number.isInteger(seedParam) ? seedParam : 1));
const canvas3d = document.getElementById('game');
const sceneCtx = createSceneContext(canvas3d);
const citadel = createCitadelBuilder(sceneCtx.scene);
const meshes = createMeshPools(sceneCtx.scene);
const effects = createEffectsPool(sceneCtx.scene);
const statusEl = document.getElementById('status');

const readStore = (k, fb) => { try { return window.localStorage.getItem(k) ?? fb; } catch { return fb; } };
const writeStore = (k, v) => { try { window.localStorage.setItem(k, String(v)); } catch {} };

function renderFrame(screen, ui, hud, overlays) {
  sceneCtx.updateCameraAndSun(world.state, screen === SCREEN.TITLE);
  citadel.update(world.state, screen === SCREEN.PLAY);
  meshes.update(world.state);
  effects.update(world.state);
  sceneCtx.render();
  hud.update(world.state, ui, sceneCtx, screen !== SCREEN.TITLE && !ui.guideOpen);
  overlays.render(world.state, screen, ui);
}

function startApp() {
  const audio = createAudio(readStore(STORAGE_KEYS.muted, '0') === '1');
  const controls = createControls(canvas3d, sceneCtx);
  let screen = SCREEN.TITLE;
  let best = Number.parseInt(readStore(STORAGE_KEYS.best, '0'), 10) || 0;
  let isNewBest = false; let autoFire = false; let guideOpen = false; let pendingBuild = null;
  let accumulator = 0; let last = performance.now();

  const announce = (msg) => { if (statusEl) statusEl.textContent = msg; };
  const startRun = (diff = world.state.difficultyId) => {
    audio.unlock(); world.reset(diff); isNewBest = false; guideOpen = false; accumulator = 0;
    screen = SCREEN.PLAY; announce(`Bastion deployed on ${world.state.difficulty.label}.`);
  };
  const finishRun = (vic) => {
    screen = vic ? SCREEN.VICTORY : SCREEN.OVER;
    if (world.state.score > best) { best = world.state.score; isNewBest = true; writeStore(STORAGE_KEYS.best, best); }
    if (vic) audio.victory(); else audio.over();
    announce(`${vic ? 'Victory' : 'Defeat'}. Score ${world.state.score}.`);
  };
  const pickUpgrade = (idx) => {
    const ch = world.applyUpgrade(idx); if (!ch) return;
    audio.upgradePick(); screen = SCREEN.PLAY; accumulator = 0; announce(`Installed ${ch.name}.`);
  };
  const toggleMute = () => writeStore(STORAGE_KEYS.muted, audio.toggleMute() ? '1' : '0');

  function handleAction(act, val) {
    audio.unlock();
    if (act === 'diff') world.setDifficulty(val);
    else if (act === 'start' || act === 'restart') startRun();
    else if (act === 'title') { world.reset(world.state.difficultyId); screen = SCREEN.TITLE; guideOpen = false; }
    else if (act === 'pick') pickUpgrade(Number.parseInt(val, 10));
    else if (act === 'build' && screen === SCREEN.PLAY) pendingBuild = val;
    else if (act === 'auto') autoFire = !autoFire;
    else if (act === 'mute') toggleMute();
    else if (act === 'guide') guideOpen = !guideOpen;
    else if (act === 'closeGuide' || act === 'resume') { guideOpen = false; if (screen === SCREEN.PAUSED) screen = SCREEN.PLAY; }
    else if (act === 'pause' && screen === SCREEN.PLAY) screen = SCREEN.PAUSED;
  }

  const hud = createHud(document.getElementById('hud'), document.getElementById('overlay2d'), { onAction: handleAction });
  const overlays = createOverlays(document.getElementById('overlays'), { onAction: handleAction });

  const handleResize = () => {
    const w = window.innerWidth || 1280; const h = window.innerHeight || 720;
    sceneCtx.resize(w, h); hud.resize(w, h);
  };
  window.addEventListener('resize', handleResize); handleResize();

  if (shotParam) {
    const staged = stageShot(shotParam, world); screen = staged.screen;
    renderFrame(screen, staged.ui, hud, overlays); window.__shotReady = true;
    requestAnimationFrame(() => renderFrame(screen, staged.ui, hud, overlays));
    return;
  }

  function playEvents(ev) {
    if (ev & EV_SHOOT) audio.shoot(.95 + Math.random() * .12);
    if (ev & EV_CRIT) audio.crit(); if (ev & EV_DEFLECT) audio.deflect();
    if (ev & EV_KILL) audio.kill(Boolean(ev & EV_BOSS)); if (ev & EV_CRYSTAL) audio.crystal(world.state.combo);
    if (ev & EV_BUILD) audio.buildTurret(); if (ev & EV_DASH) audio.dash(); if (ev & EV_EMP) audio.emp();
    if (ev & EV_PYLON) audio.pylonBlast(); if (ev & EV_OVERCHARGE) audio.overcharge(); if (ev & EV_HIT) audio.hit();
    if (ev & EV_SNIPER_WARN) audio.sniperWarn(); if (ev & EV_BOSS) audio.bossWarn();
  }

  function processInputs() {
    const a = controls.takeActions();
    if (a & ACT_MUTE) toggleMute(); if (a & ACT_AUTOFIRE) autoFire = !autoFire; if (a & ACT_GUIDE) guideOpen = !guideOpen;
    if (guideOpen) { if (a & (ACT_PAUSE | ACT_CONFIRM)) guideOpen = false; return { dash: false, emp: false }; }
    if (screen === SCREEN.TITLE) {
      if (a & ACT_PICK_1) world.setDifficulty('cadet'); else if (a & ACT_PICK_2) world.setDifficulty('vanguard'); else if (a & ACT_PICK_3) world.setDifficulty('overdrive');
      if (a & ACT_CONFIRM) startRun(); return { dash: false, emp: false };
    }
    if (screen === SCREEN.UPGRADE) { if (a & ACT_PICK_1) pickUpgrade(0); else if (a & ACT_PICK_2) pickUpgrade(1); else if (a & ACT_PICK_3) pickUpgrade(2); return { dash: false, emp: false }; }
    if (screen === SCREEN.PAUSED) { if (a & (ACT_PAUSE | ACT_CONFIRM)) screen = SCREEN.PLAY; else if (a & ACT_RESTART) startRun(); return { dash: false, emp: false }; }
    if (screen === SCREEN.VICTORY || screen === SCREEN.OVER) { if (a & (ACT_CONFIRM | ACT_RESTART)) startRun(); return { dash: false, emp: false }; }
    if (a & ACT_PAUSE) { screen = SCREEN.PAUSED; return { dash: false, emp: false }; }
    if (a & ACT_RESTART) { startRun(); return { dash: false, emp: false }; }
    if (a & ACT_PICK_1) pendingBuild = TURRET_ORDER[0]; else if (a & ACT_PICK_2) pendingBuild = TURRET_ORDER[1]; else if (a & ACT_PICK_3) pendingBuild = TURRET_ORDER[2];
    return { dash: Boolean(a & ACT_DASH), emp: Boolean(a & ACT_EMP) };
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, 0.25); last = now;
    const oneShot = processInputs(); const ptr = controls.pointer();
    if ((screen === SCREEN.TITLE || screen === SCREEN.PLAY) && !guideOpen) {
      while (accumulator >= STEP && (screen === SCREEN.TITLE || screen === SCREEN.PLAY)) {
        if (screen === SCREEN.TITLE) world.step(STEP, { moveX: 0, moveZ: 0, aimActive: false, fire: false, dash: false, emp: false }, true);
        else {
          const ax = controls.moveAxis();
          const ev = world.step(STEP, { moveX: ax.x, moveZ: ax.z, aimX: ptr.x, aimZ: ptr.z, aimActive: ptr.active, fire: controls.isFiring(autoFire), dash: oneShot.dash, emp: oneShot.emp, buildKind: pendingBuild }, false);
          oneShot.dash = oneShot.emp = false; pendingBuild = null; playEvents(ev);
          if (ev & EV_VICTORY) finishRun(true); else if (ev & EV_OVER) finishRun(false);
          else if ((ev & EV_UPGRADE) && world.state.upgradeChoices.length) { screen = SCREEN.UPGRADE; audio.upgradeOpen(); }
        }
        accumulator -= STEP;
      }
    } else accumulator = 0;
    renderFrame(screen, { best, autoFire, muted: audio.isMuted(), isNewBest, guideOpen, pointer: ptr }, hud, overlays);
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden && screen === SCREEN.PLAY) screen = SCREEN.PAUSED; });
  announce('Aether Bastion: Solar Citadel ready.'); requestAnimationFrame(frame);
}

startApp();
