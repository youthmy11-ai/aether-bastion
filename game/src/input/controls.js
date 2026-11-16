/**
 * Unified keyboard and pointer input controller with zero-allocation 3D ground plane aiming.
 */

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
export const ACT_GUIDE = 1024;

const UP_KEYS = new Set(['KeyW', 'ArrowUp']);
const DOWN_KEYS = new Set(['KeyS', 'ArrowDown']);
const LEFT_KEYS = new Set(['KeyA', 'ArrowLeft']);
const RIGHT_KEYS = new Set(['KeyD', 'ArrowRight']);

/**
 * Attaches keyboard and pointer event listeners onto the Three.js canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {{ screenToWorld: Function }} sceneCtx
 */
export function createControls(canvas, sceneCtx) {
  const held = new Set();
  let actions = 0;
  let mouseDown = false;
  let mouseActive = false;
  let clientX = 640;
  let clientY = 300;
  const worldAim = { x: 0, z: -4 };

  function updateWorldAim() {
    const rect = canvas.getBoundingClientRect();
    sceneCtx.screenToWorld(clientX, clientY, rect, worldAim);
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
    } else if (e.code === 'KeyH') {
      if (!e.repeat) actions |= ACT_GUIDE;
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

  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => { held.clear(); mouseDown = false; });

  canvas.addEventListener('pointermove', (e) => {
    clientX = e.clientX;
    clientY = e.clientY;
    mouseActive = true;
    updateWorldAim();
  });

  canvas.addEventListener('pointerdown', (e) => {
    clientX = e.clientX;
    clientY = e.clientY;
    mouseActive = true;
    updateWorldAim();
    if (e.button === 2) {
      actions |= ACT_EMP;
      return;
    }
    mouseDown = true;
  });

  window.addEventListener('pointerup', (e) => {
    if (e.button === 0) mouseDown = false;
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    moveAxis() {
      let x = 0;
      let z = 0;
      for (const code of held) {
        if (LEFT_KEYS.has(code)) x -= 1;
        else if (RIGHT_KEYS.has(code)) x += 1;
        else if (UP_KEYS.has(code)) z -= 1;
        else if (DOWN_KEYS.has(code)) z += 1;
      }
      const len = Math.hypot(x, z);
      if (len > 1) { x /= len; z /= len; }
      return { x, z };
    },
    isFiring(autoFire) {
      return Boolean(autoFire || mouseDown || held.has('KeyJ'));
    },
    pointer() {
      if (mouseActive) updateWorldAim();
      return { x: worldAim.x, z: worldAim.z, screenX: clientX, screenY: clientY, active: mouseActive };
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
