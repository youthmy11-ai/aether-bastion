// Main entry point: fixed-timestep loop, screen transitions, audio events, local persistence,
// and deterministic ?shot=...&seed=... capture mode.
import { DIFFICULTY_ORDER, SCREEN, STEP, STORAGE_KEYS } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import {
  createWorld,
  EV_BOSS,
  EV_CRIT,
  EV_CRYSTAL,
  EV_DASH,
  EV_DEFLECT,
  EV_EMP,
  EV_HIT,
  EV_KILL,
  EV_OVER,
  EV_SHOOT,
  EV_SNIPER_WARN,
  EV_UPGRADE,
  EV_VICTORY,
} from './world.js';
import {
  ACT_AUTOFIRE,
  ACT_CONFIRM,
  ACT_DASH,
  ACT_EMP,
  ACT_MUTE,
  ACT_PAUSE,
  ACT_PICK_1,
  ACT_PICK_2,
  ACT_PICK_3,
  ACT_RESTART,
  createInput,
} from './input.js';
import { createRenderer } from './render.js';
import { inRect, UI_RECTS } from './hud.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shotParam = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readStorage(key, fallback) {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Private browsing or disabled storage.
  }
}

function runShot(name) {
  const staged = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, staged.screen, staged.ui);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const audio = createAudio(readStorage(STORAGE_KEYS.muted, '0') === '1');
  let screen = SCREEN.TITLE;
  let best = Number.parseInt(readStorage(STORAGE_KEYS.best, '0'), 10) || 0;
  let isNewBest = false;
  let autoFire = false;
  let accumulator = 0;
  let last = performance.now();

  function announce(msg) {
    if (statusEl) statusEl.textContent = msg;
  }

  function uiState() {
    return {
      best,
      autoFire,
      muted: audio.isMuted(),
      isNewBest,
      pointer: input.pointer(),
    };
  }

  function startRun(diffId = world.state.difficultyId) {
    audio.unlock();
    world.reset(diffId);
    isNewBest = false;
    accumulator = 0;
    screen = SCREEN.PLAY;
    announce(`Bastion deployed on ${world.state.difficulty.label} difficulty.`);
  }

  function finishRun(victory) {
    screen = victory ? SCREEN.VICTORY : SCREEN.OVER;
    if (world.state.score > best) {
      best = world.state.score;
      isNewBest = true;
      writeStorage(STORAGE_KEYS.best, best);
    }
    if (victory) audio.victory();
    else audio.over();
    announce(`${victory ? 'Victory' : 'Game over'}. Score ${world.state.score}. Best ${best}.`);
  }

  function pickUpgrade(idx) {
    const picked = world.applyUpgrade(idx);
    if (!picked) return;
    audio.upgradePick();
    screen = SCREEN.PLAY;
    accumulator = 0;
    announce(`Installed ${picked.name}.`);
  }

  function toggleMute() {
    const m = audio.toggleMute();
    writeStorage(STORAGE_KEYS.muted, m ? '1' : '0');
  }

  function handleClicks(clicks) {
    if (clicks.length === 0) return;
    audio.unlock();
    for (let i = 0; i < clicks.length; i += 1) {
      const c = clicks[i];
      if (screen !== SCREEN.TITLE) {
        if (inRect(c.x, c.y, UI_RECTS.autoBtn)) {
          autoFire = !autoFire;
          continue;
        }
        if (inRect(c.x, c.y, UI_RECTS.muteBtn)) {
          toggleMute();
          continue;
        }
      }
      if (screen === SCREEN.TITLE) {
        for (let d = 0; d < DIFFICULTY_ORDER.length; d += 1) {
          if (inRect(c.x, c.y, UI_RECTS.diffCard(d))) {
            world.setDifficulty(DIFFICULTY_ORDER[d]);
            return;
          }
        }
        if (inRect(c.x, c.y, UI_RECTS.titleStartBtn) || c.y > 540) {
          startRun();
          return;
        }
      } else if (screen === SCREEN.UPGRADE) {
        for (let u = 0; u < world.state.upgradeChoices.length; u += 1) {
          if (inRect(c.x, c.y, UI_RECTS.upgradeCard(u))) {
            pickUpgrade(u);
            return;
          }
        }
      } else if (screen === SCREEN.VICTORY || screen === SCREEN.OVER) {
        if (inRect(c.x, c.y, UI_RECTS.endRestartBtn)) {
          startRun();
          return;
        }
        if (inRect(c.x, c.y, UI_RECTS.endTitleBtn)) {
          world.reset(world.state.difficultyId);
          screen = SCREEN.TITLE;
          return;
        }
      }
    }
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyT' && (screen === SCREEN.VICTORY || screen === SCREEN.OVER)) {
      world.reset(world.state.difficultyId);
      screen = SCREEN.TITLE;
    }
  });

  function processInputs() {
    const actions = input.takeActions();
    const clicks = input.takeClicks();
    handleClicks(clicks);

    if (actions & ACT_MUTE) toggleMute();
    if (actions & ACT_AUTOFIRE) autoFire = !autoFire;

    if (screen === SCREEN.TITLE) {
      if (actions & ACT_PICK_1) world.setDifficulty('cadet');
      else if (actions & ACT_PICK_2) world.setDifficulty('vanguard');
      else if (actions & ACT_PICK_3) world.setDifficulty('overdrive');
      if (actions & ACT_CONFIRM) startRun();
      return { dash: false, emp: false };
    }

    if (screen === SCREEN.UPGRADE) {
      if (actions & ACT_PICK_1) pickUpgrade(0);
      else if (actions & ACT_PICK_2) pickUpgrade(1);
      else if (actions & ACT_PICK_3) pickUpgrade(2);
      return { dash: false, emp: false };
    }

    if (screen === SCREEN.PAUSED) {
      if (actions & (ACT_PAUSE | ACT_CONFIRM)) {
        screen = SCREEN.PLAY;
        announce('Mission resumed.');
      } else if (actions & ACT_RESTART) {
        startRun();
      }
      return { dash: false, emp: false };
    }

    if (screen === SCREEN.VICTORY || screen === SCREEN.OVER) {
      if (actions & (ACT_CONFIRM | ACT_RESTART)) startRun();
      return { dash: false, emp: false };
    }

    if (actions & ACT_PAUSE) {
      screen = SCREEN.PAUSED;
      announce('Mission paused.');
      return { dash: false, emp: false };
    }
    if (actions & ACT_RESTART) {
      startRun();
      return { dash: false, emp: false };
    }

    return {
      dash: Boolean(actions & ACT_DASH),
      emp: Boolean(actions & ACT_EMP),
    };
  }

  function playEvents(events) {
    if (events & EV_SHOOT) audio.shoot(0.95 + Math.random() * 0.12);
    if (events & EV_CRIT) audio.crit();
    if (events & EV_DEFLECT) audio.deflect();
    if (events & EV_KILL) audio.kill(Boolean(events & EV_BOSS));
    if (events & EV_CRYSTAL) audio.crystal(world.state.combo);
    if (events & EV_DASH) audio.dash();
    if (events & EV_EMP) audio.emp();
    if (events & EV_HIT) audio.hit();
    if (events & EV_SNIPER_WARN) audio.sniperWarn();
    if (events & EV_BOSS) audio.bossWarn();
  }

  function stepWorld(oneShot) {
    if (screen === SCREEN.TITLE) {
      world.step(STEP, { moveX: 0, moveY: 0, aimActive: false, fire: false, dash: false, emp: false }, true);
      return;
    }
    const axis = input.moveAxis();
    const ptr = input.pointer();
    const ev = world.step(
      STEP,
      {
        moveX: axis.x,
        moveY: axis.y,
        aimX: ptr.x,
        aimY: ptr.y,
        aimActive: ptr.active,
        fire: input.isFiring(autoFire),
        dash: oneShot.dash,
        emp: oneShot.emp,
      },
      false,
    );
    oneShot.dash = false;
    oneShot.emp = false;
    playEvents(ev);

    if (ev & EV_VICTORY) {
      finishRun(true);
    } else if (ev & EV_OVER) {
      finishRun(false);
    } else if (ev & EV_UPGRADE && world.state.upgradeChoices.length > 0) {
      screen = SCREEN.UPGRADE;
      audio.upgradeOpen();
      announce(`Level ${world.state.playerLevel}. Select an upgrade.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const oneShot = processInputs();
    if (screen === SCREEN.TITLE || screen === SCREEN.PLAY) {
      while (accumulator >= STEP && (screen === SCREEN.TITLE || screen === SCREEN.PLAY)) {
        stepWorld(oneShot);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, uiState());
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN.PLAY) {
      screen = SCREEN.PAUSED;
      announce('Mission paused.');
    }
  });

  announce('Aether Bastion ready. Select difficulty and press Space to deploy.');
  requestAnimationFrame(frame);
}

if (shotParam) runShot(shotParam);
else runGame();
