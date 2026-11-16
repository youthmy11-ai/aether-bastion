/**
 * Three.js WebGL scene manager: ACESFilmic renderer, Golden-Hour sky dome shader,
 * shadow-casting dynamic sunlight, elevated tactical camera, and zero-alloc raycasting.
 */

import * as THREE from 'three';
import { ARENA } from '../config/constants.js';

const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -ARENA.flightY);
const _hit = new THREE.Vector3();
const _proj = new THREE.Vector3();

const SKY_VERT = `
varying vec3 vWorldPos;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const SKY_FRAG = `
uniform vec3 uSunDir;
varying vec3 vWorldPos;
void main() {
  vec3 dir = normalize(vWorldPos);
  float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 nadir = vec3(0.22, 0.30, 0.48);
  vec3 horizon = vec3(0.98, 0.73, 0.44);
  vec3 mid = vec3(0.42, 0.59, 0.82);
  vec3 zenith = vec3(0.14, 0.28, 0.52);
  vec3 col = mix(nadir, horizon, smoothstep(0.28, 0.50, h));
  col = mix(col, mid, smoothstep(0.50, 0.68, h));
  col = mix(col, zenith, smoothstep(0.68, 0.96, h));
  float sunAmt = max(dot(dir, normalize(uSunDir)), 0.0);
  col += vec3(1.0, 0.84, 0.48) * pow(sunAmt, 14.0) * 0.55;
  col += vec3(1.0, 0.96, 0.85) * smoothstep(0.996, 0.9992, sunAmt) * 1.4;
  gl_FragColor = vec4(col, 1.0);
}`;

/**
 * Creates the Three.js renderer, scene, golden-hour lights, sky dome, and camera helpers.
 * @param {HTMLCanvasElement} canvas
 */
export function createSceneContext(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x6e7b94, 0.0028);

  const camera = new THREE.PerspectiveCamera(43, 16 / 9, 0.5, 320);
  camera.position.set(0, 28.5, 31.0);
  camera.lookAt(0, -0.4, 0.3);

  // Sky dome
  const skyUniforms = {
    uSunDir: { value: new THREE.Vector3(0.7, 0.55, 0.45).normalize() },
  };
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(180, 32, 20), skyMat);
  scene.add(skyDome);

  // Golden-hour lights
  const hemiLight = new THREE.HemisphereLight(0xfff1d0, 0x3b4e7a, 0.95);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xffcf87, 2.35);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 115;
  const d = 32;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.bias = -0.0005;
  sunLight.position.set(28, 34, 18);
  scene.add(sunLight);

  const rimLight = new THREE.DirectionalLight(0x7dd3fc, 0.68);
  rimLight.position.set(-24, 18, -22);
  scene.add(rimLight);

  let width = 1280;
  let height = 720;

  function resize(w, h) {
    width = Math.max(1, w);
    height = Math.max(1, h);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }
  resize(window.innerWidth || 1280, window.innerHeight || 720);

  /**
   * Updates directional sun position and camera framing without per-frame allocations.
   */
  function updateCameraAndSun(state, isTitle) {
    const { sun, player, shake } = state;
    const sx = sun.dirX * 36;
    const sy = 32;
    const sz = sun.dirZ * 36;
    sunLight.position.set(sx, sy, sz);
    skyUniforms.uSunDir.value.set(sun.dirX * 0.85, 0.36, sun.dirZ * 0.85).normalize();

    const sxOff = shake > 0 ? Math.sin(state.elapsed * 52) * shake * 0.85 : 0;
    const szOff = shake > 0 ? Math.cos(state.elapsed * 47) * shake * 0.65 : 0;

    if (isTitle) {
      // Hero angle: shift citadel right of the left-docked title card
      const t = state.elapsed * 0.14;
      camera.position.set(-10.5 + Math.sin(t) * 2.0, 23.0, 31.0 + Math.cos(t) * 1.2);
      camera.lookAt(-3.8, 0.2, 0.2);
    } else {
      const followX = player.x * 0.10 + sxOff;
      const followZ = player.z * 0.07 + szOff;
      camera.position.set(followX, 28.5, 31.0 + followZ);
      camera.lookAt(followX * 0.55, -0.4, 0.3 + followZ * 0.4);
    }
    camera.updateMatrixWorld();
  }

  /**
   * Intersects screen pixel coordinates with the flight plane y = ARENA.flightY.
   */
  function screenToWorld(clientX, clientY, rect, out) {
    if (rect.width <= 0 || rect.height <= 0) return false;
    _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    _raycaster.setFromCamera(_ndc, camera);
    if (_raycaster.ray.intersectPlane(_plane, _hit)) {
      out.x = _hit.x;
      out.z = _hit.z;
      return true;
    }
    return false;
  }

  /**
   * Projects a 3D world point to 2D viewport pixel coordinates.
   */
  function worldToScreen(wx, wy, wz, out) {
    _proj.set(wx, wy, wz);
    _proj.project(camera);
    out.x = (_proj.x * 0.5 + 0.5) * width;
    out.y = (-_proj.y * 0.5 + 0.5) * height;
    out.visible = _proj.z < 1;
  }

  function render() {
    renderer.render(scene, camera);
  }

  return {
    renderer,
    scene,
    camera,
    resize,
    updateCameraAndSun,
    screenToWorld,
    worldToScreen,
    render,
    getSize: () => ({ width, height }),
  };
}
