// Unified keyboard + mouse aim + UI button click input mapped cleanly to 1280x720 coordinates.
import { FIELD } from './config.js';

export const ACT_CONFIRM = 1;
export const ACT_PAUSE = 2;
export const ACT_DASH = 4;
export const ACT_EMP = 8;
export const ACT_AUTOFIRE = 16;
export const ACT_MUTE = 32;
export const ACT_RESTART = 64;
export const ACT_PICK_1 = 128;
export const ACT_PICK_2 = 256;
export const ACT_PICK_3 = 512;

const UP_KEYS = new Set(['KeyW', 'ArrowUp']);
const DOWN_KEYS = new Set(['KeyS', 'ArrowDown']);
const LEFT_KEYS = new Set(['KeyA', 'ArrowLeft']);
const RIGHT_KEYS = new Set(['KeyD', 'ArrowRight']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouseDown = false;
  let mouseActive = false;
  let pointerX = FIELD.width / 2;
  let pointerY = FIELD.height / 2 - 100;
  const clicks = [];

  function toLogical(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const scale = Math.min(rect.width / FIELD.width, rect.height / FIELD.height);
    const offsetX = (rect.width - FIELD.width * scale) / 2;
    const offsetY = (rect.height - FIELD.height * scale) / 2;
    pointerX = Math.max(0, Math.min(FIELD.width, (clientX - rect.left - offsetX) / scale));
    pointerY = Math.max(0, Math.min(FIELD.height, (clientY - rect.top - offsetY) / scale));
    mouseActive = true;
  }

  window.addEventListener('keydown', (e) => {
    if (UP_KEYS.has(e.code) || DOWN_KEYS.has(e.code) || LEFT_KEYS.has(e.code) || RIGHT_KEYS.has(e.code)) {
      held.add(e.code);
      e.preventDefault();
      return;
    }
    if (e.code === 'Space') {
      if (!e.repeat) actions |= ACT_DASH | ACT_CONFIRM;
      e.preventDefault();
    } else if (e.code === 'Enter') {
      if (!e.repeat) actions |= ACT_CONFIRM;
      e.preventDefault();
    } else if (e.code === 'KeyQ') {
      if (!e.repeat) actions |= ACT_EMP;
      e.preventDefault();
    } else if (e.code === 'KeyP' || e.code === 'Escape') {
      if (!e.repeat) actions |= ACT_PAUSE;
      e.preventDefault();
    } else if (e.code === 'KeyF') {
      if (!e.repeat) actions |= ACT_AUTOFIRE;
    } else if (e.code === 'KeyM') {
      if (!e.repeat) actions |= ACT_MUTE;
    } else if (e.code === 'KeyR') {
      if (!e.repeat) actions |= ACT_RESTART;
    } else if (e.code === 'Digit1' || e.code === 'Numpad1') {
      if (!e.repeat) actions |= ACT_PICK_1;
    } else if (e.code === 'Digit2' || e.code === 'Numpad2') {
      if (!e.repeat) actions |= ACT_PICK_2;
    } else if (e.code === 'Digit3' || e.code === 'Numpad3') {
      if (!e.repeat) actions |= ACT_PICK_3;
    } else if (e.code === 'KeyJ') {
      held.add(e.code);
    }
  });

  window.addEventListener('keyup', (e) => {
    held.delete(e.code);
  });

  window.addEventListener('blur', () => {
    held.clear();
    mouseDown = false;
  });

  canvas.addEventListener('pointermove', (e) => {
    toLogical(e.clientX, e.clientY);
  });

  canvas.addEventListener('pointerdown', (e) => {
    toLogical(e.clientX, e.clientY);
    if (e.button === 2) {
      actions |= ACT_EMP;
      return;
    }
    mouseDown = true;
    clicks.push({ x: pointerX, y: pointerY });
  });

  window.addEventListener('pointerup', (e) => {
    if (e.button === 0) mouseDown = false;
  });

  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  return {
    moveAxis() {
      let x = 0;
      let y = 0;
      for (const code of held) {
        if (LEFT_KEYS.has(code)) x -= 1;
        else if (RIGHT_KEYS.has(code)) x += 1;
        else if (UP_KEYS.has(code)) y -= 1;
        else if (DOWN_KEYS.has(code)) y += 1;
      }
      x = Math.max(-1, Math.min(1, x));
      y = Math.max(-1, Math.min(1, y));
      const len = Math.hypot(x, y);
      if (len > 1) {
        x /= len;
        y /= len;
      }
      return { x, y };
    },
    isFiring(autoFire) {
      return Boolean(autoFire || mouseDown || held.has('KeyJ'));
    },
    pointer() {
      return { x: pointerX, y: pointerY, active: mouseActive };
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    takeClicks() {
      if (clicks.length === 0) return [];
      return clicks.splice(0, clicks.length);
    },
  };
}
