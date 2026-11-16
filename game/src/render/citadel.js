/**
 * Sculpted 3D Floating Sky Citadel builder and per-frame updater:
 * celestial hex-deck, parapet braziers, central Solar Spire & Aether Obelisk,
 * armillary astrolabe rings, under-hull thruster ribs, solar prism pylons,
 * 6 build sockets + 3 turret models, animated clouds, and sunbeams.
 */

import * as THREE from 'three';
import { ARENA, BUILD_SOCKETS, PYLON_ANCHORS, TURRET_CFG } from '../config/constants.js';
import { findTargetSocket } from '../sim/turrets.js';

function createDeckTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2d3748'; ctx.fillRect(0, 0, 512, 512);

  // Hex-flagstone pavement
  for (let y = 0; y < 512; y += 64) for (let x = 0; x < 512; x += 64) {
    const s = ((x * 3 + y * 5) % 20) - 10;
    ctx.fillStyle = `rgb(${72 + s},${78 + s},${92 + s})`; ctx.fillRect(x + 2, y + 2, 60, 60);
    ctx.strokeStyle = 'rgba(245,196,108,0.42)'; ctx.lineWidth = 1.5; ctx.strokeRect(x + 2, y + 2, 60, 60);
  }

  // Golden runic conduits & cyan energy circuits
  ctx.strokeStyle = 'rgba(251,191,36,0.55)'; ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, 256); ctx.lineTo(512, 256);
  ctx.moveTo(256, 0); ctx.lineTo(256, 512);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(56,189,248,0.48)'; ctx.lineWidth = 2;
  for (let y = 32; y < 512; y += 128) for (let x = 32; x < 512; x += 128) {
    ctx.beginPath(); ctx.arc(x, y, 24, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(103,232,249,0.18)'; ctx.fill();
  }

  // Central celestial star glyph
  ctx.strokeStyle = 'rgba(245,158,11,0.65)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(256, 256, 68, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(256, 256, 42, 0, Math.PI * 2); ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(6, 4); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Builds the static and dynamic 3D Sky Citadel architecture. */
export function createCitadelBuilder(scene) {
  const root = new THREE.Group(); scene.add(root);
  const stoneMat = new THREE.MeshStandardMaterial({ map: createDeckTexture(), roughness: 0.68, metalness: 0.16 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xe0aa3e, roughness: 0.28, metalness: 0.82 });
  const darkBrass = new THREE.MeshStandardMaterial({ color: 0x9a6b1f, roughness: 0.35, metalness: 0.78 });
  const parapetMat = new THREE.MeshStandardMaterial({ color: 0x6e727a, roughness: 0.62, metalness: 0.22 });
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x475161, roughness: 0.72, metalness: 0.28 });
  const cyanMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });
  const amberGlow = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });

  const addM = (geo, mat, x, y, z, sh = true, rx = 0, ry = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0);
    m.castShadow = sh; m.receiveShadow = true; root.add(m); return m;
  };

  // Main Citadel Island Hull
  addM(new THREE.BoxGeometry(ARENA.halfX * 2 + 1.4, 1.3, ARENA.halfZ * 2 + 1.4), stoneMat, 0, -0.65, 0, false);
  addM(new THREE.BoxGeometry(ARENA.halfX * 2 + 2.2, 0.44, ARENA.halfZ * 2 + 2.2), brassMat, 0, -0.34, 0, false);
  addM(new THREE.ConeGeometry(21.5, 9.6, 8), hullMat, 0, -6.0, 0, false, Math.PI, Math.PI / 8);
  addM(new THREE.TorusGeometry(4.6, 0.32, 10, 24), cyanMat, 0, -5.4, 0, false, Math.PI / 2);
  addM(new THREE.TorusGeometry(8.8, 0.22, 8, 32), brassMat, 0, -4.2, 0, false, Math.PI / 2);

  // Raised stone parapet walls
  const wLong = new THREE.BoxGeometry(11.5, 0.95, 0.85); const wShort = new THREE.BoxGeometry(0.85, 0.95, 9.2);
  for (const x of [-14.5, 0, 14.5]) { addM(wLong, parapetMat, x, 0.48, -ARENA.halfZ - 0.35); addM(wLong, parapetMat, x, 0.48, ARENA.halfZ + 0.35); }
  for (const z of [-7.2, 7.2]) { addM(wShort, parapetMat, -ARENA.halfX - 0.35, 0.48, z); addM(wShort, parapetMat, ARENA.halfX + 0.35, 0.48, z); }

  // Corner Citadel Bastion Towers & Beacon Braziers
  const pilGeo = new THREE.CylinderGeometry(0.9, 1.15, 1.75, 6);
  const brazierBowl = new THREE.CylinderGeometry(0.48, 0.25, 0.35, 8);
  const flameOrb = new THREE.SphereGeometry(0.24, 10, 8);

  const brazierPositions = [
    [-ARENA.halfX - 0.3, -ARENA.halfZ - 0.3], [ARENA.halfX + 0.3, -ARENA.halfZ - 0.3],
    [-ARENA.halfX - 0.3, ARENA.halfZ + 0.3], [ARENA.halfX + 0.3, ARENA.halfZ + 0.3],
    [0, -ARENA.halfZ - 0.35], [0, ARENA.halfZ + 0.35],
    [-ARENA.halfX - 0.35, 0], [ARENA.halfX + 0.35, 0],
  ];

  for (const [bx, bz] of brazierPositions) {
    addM(pilGeo, brassMat, bx, 0.82, bz);
    addM(brazierBowl, darkBrass, bx, 1.78, bz);
    addM(flameOrb, amberGlow, bx, 2.05, bz, false);
  }

  // ==========================================
  // CENTRAL SOLAR SPIRE & AETHER OBELISK
  // ==========================================
  const centralGroup = new THREE.Group(); root.add(centralGroup);

  // Stepped circular stone & brass plinth
  const plinth1 = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 4.4, 0.38, 12), parapetMat); plinth1.position.y = 0.19; plinth1.receiveShadow = true;
  const plinth2 = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 3.1, 0.28, 8), darkBrass); plinth2.position.y = 0.48; plinth2.receiveShadow = true;
  const plinthTrim = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.14, 8, 32), brassMat); plinthTrim.rotation.x = Math.PI / 2; plinthTrim.position.y = 0.39;
  const plinthCyan = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.11, 8, 28), cyanMat); plinthCyan.rotation.x = Math.PI / 2; plinthCyan.position.y = 0.64;
  centralGroup.add(plinth1, plinth2, plinthTrim, plinthCyan);

  // 4 Arching Flying Buttresses
  const strutGeo = new THREE.BoxGeometry(0.32, 2.2, 0.32);
  for (let i = 0; i < 4; i += 1) {
    const ang = (i * Math.PI) / 2 + Math.PI / 4;
    const strut = new THREE.Mesh(strutGeo, brassMat);
    strut.position.set(Math.cos(ang) * 1.85, 1.25, Math.sin(ang) * 1.85);
    strut.rotation.set(-Math.sin(ang) * 0.38, 0, Math.cos(ang) * 0.38);
    strut.castShadow = true;
    centralGroup.add(strut);
  }

  // Central Obelisk Spire Tower
  const spireBase = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.35, 2.6, 8), brassMat); spireBase.position.y = 1.78; spireBase.castShadow = true;
  const spireMid = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.72, 1.6, 8), darkBrass); spireMid.position.y = 3.65; spireMid.castShadow = true;
  const spireCrown = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), brassMat); spireCrown.position.y = 4.65;
  centralGroup.add(spireBase, spireMid, spireCrown);

  // Floating Rotating Solar Prism Core
  const prismMat = new THREE.MeshStandardMaterial({
    color: 0xfffbeb, emissive: 0xf59e0b, emissiveIntensity: 1.6, roughness: 0.15, metalness: 0.45,
  });
  const solarPrism = new THREE.Mesh(new THREE.OctahedronGeometry(1.05, 0), prismMat);
  solarPrism.position.y = 4.85; solarPrism.scale.set(0.85, 1.35, 0.85); solarPrism.castShadow = true;
  centralGroup.add(solarPrism);

  // 2 Celestial Armillary Astrolabe Rings
  const astrolabeA = new THREE.Mesh(new THREE.TorusGeometry(1.85, 0.08, 8, 32), brassMat); astrolabeA.position.y = 4.85;
  const astrolabeB = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.07, 8, 28), cyanMat); astrolabeB.position.y = 4.85;
  centralGroup.add(astrolabeA, astrolabeB);

  // Warm Central Point Light illuminating citadel center & flying craft
  const coreLight = new THREE.PointLight(0xffbe3b, 2.6, 32, 1.3);
  coreLight.position.set(0, 4.2, 0);
  root.add(coreLight);

  // Rotating outer sunbeam shafts
  const sunShaftGroup = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.PlaneGeometry(48, 12.0),
    new THREE.MeshBasicMaterial({ color: 0xfde68a, transparent: true, opacity: 0.15, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })
  );
  shaft.rotation.x = -Math.PI / 2; shaft.position.y = 0.06; sunShaftGroup.add(shaft); root.add(sunShaftGroup);

  // Atmospheric drifting volumetric cloud clusters
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xfff2dc, emissive: 0x4a321a, emissiveIntensity: 0.26, roughness: 0.94 });
  const puffGeo = new THREE.DodecahedronGeometry(1, 1);
  const clouds = Array.from({ length: 18 }, (_, i) => {
    const cg = new THREE.Group(); const bs = 4.5 + (i % 4) * 1.5;
    for (let k = 0; k < 3; k += 1) {
      const p = new THREE.Mesh(puffGeo, cloudMat); p.scale.set(bs * (1 - k * 0.16), bs * 0.44, bs * 0.88);
      p.position.set((k - 1) * bs * 0.72, (k % 2) * 0.5, (k === 1 ? 0.4 : -0.3) * bs * 0.38); cg.add(p);
    }
    const baseX = -56 + (i % 6) * 22;
    const zRow = [-26, -19, 22][Math.floor(i / 6)];
    cg.position.set(baseX, -7.2 - (i % 3) * 1.8, zRow);
    root.add(cg); return { mesh: cg, baseX, speed: 0.45 + (i % 4) * 0.15 };
  });

  // Distant Floating Sky Islands with celestial ruins
  const spGeo = new THREE.ConeGeometry(2.4, 7.2, 6); const capGeo = new THREE.CylinderGeometry(3.2, 2.2, 1.1, 6); const bcGeo = new THREE.OctahedronGeometry(0.75, 0);
  for (const [ix, iy, iz, sc] of [[-38, -5.8, -24, 1.05], [40, -5.0, -25, 1.15], [-42, -7.0, 14, 0.95], [43, -6.5, 15, 1.05]]) {
    const ig = new THREE.Group(); const sp = new THREE.Mesh(spGeo, hullMat); sp.rotation.x = Math.PI; sp.position.y = -3.9;
    const bc = new THREE.Mesh(bcGeo, brassMat); bc.position.y = 1.6;
    const ruinsPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.8, 6), parapetMat); ruinsPillar.position.set(1.1, 1.2, 0.5);
    ig.add(new THREE.Mesh(capGeo, parapetMat), sp, bc, ruinsPillar);
    ig.position.set(ix, iy, iz); ig.scale.setScalar(sc); root.add(ig);
  }

  // 4 Cardinal Solar Prism Pylons
  const pyB = new THREE.CylinderGeometry(1, 1.35, 0.75, 6); const pyC = new THREE.TorusGeometry(0.95, 0.1, 8, 18);
  const pyCry = new THREE.OctahedronGeometry(0.85, 0); const pyH = new THREE.RingGeometry(1.15, 1.55, 24);
  const pylonViews = PYLON_ANCHORS.map((a) => {
    const g = new THREE.Group(); g.position.set(a.x, 0, a.z);
    const b = new THREE.Mesh(pyB, parapetMat); b.position.y = 0.38; b.castShadow = b.receiveShadow = true;
    const c = new THREE.Mesh(pyC, brassMat); c.rotation.x = Math.PI / 2; c.position.y = 0.76;
    const crystalMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.95, roughness: 0.18, metalness: 0.4 });
    const crystal = new THREE.Mesh(pyCry, crystalMat); crystal.position.y = 1.9; crystal.scale.set(0.85, 1.5, 0.85); crystal.castShadow = true;
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
    const halo = new THREE.Mesh(pyH, haloMat); halo.rotation.x = -Math.PI / 2; halo.position.y = 0.08;
    g.add(b, c, crystal, halo); root.add(g); return { crystal, crystalMat, halo, haloMat };
  });

  // 6 Tactical Build Sockets + 3 Turret Archetypes
  const padGeo = new THREE.CylinderGeometry(1.15, 1.3, 0.18, 8); const padRing = new THREE.RingGeometry(0.85, 1.08, 24);
  const selGeo = new THREE.RingGeometry(1.25, 1.48, 24); const auraGeo = new THREE.RingGeometry(TURRET_CFG.cryo.range - 0.18, TURRET_CFG.cryo.range, 36);
  const socketViews = BUILD_SOCKETS.map((s) => {
    const g = new THREE.Group(); g.position.set(s.x, 0, s.z);
    const pad = new THREE.Mesh(padGeo, parapetMat); pad.position.y = 0.09; pad.receiveShadow = true;
    const ring = new THREE.Mesh(padRing, brassMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.18;
    const selector = new THREE.Mesh(selGeo, new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    selector.rotation.x = -Math.PI / 2; selector.position.y = 0.13; selector.visible = false;
    g.add(pad, ring, selector);

    // Prism Spire
    const prismGroup = new THREE.Group(); prismGroup.visible = false;
    const pShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.58, 1.45, 6), brassMat); pShaft.position.y = 0.85; pShaft.castShadow = true;
    const pHeadMat = new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x0ea5e9, emissiveIntensity: 0.95, roughness: 0.15, metalness: 0.45 });
    const pHead = new THREE.Mesh(new THREE.OctahedronGeometry(0.58, 0), pHeadMat); pHead.position.y = 2.05; pHead.scale.set(0.8, 1.4, 0.8);
    prismGroup.add(pShaft, pHead);

    // Tesla Arc Tower
    const teslaGroup = new THREE.Group(); teslaGroup.visible = false;
    const tMast = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.48, 1.6, 8), parapetMat); tMast.position.y = 0.9; tMast.castShadow = true;
    const tc1 = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.08, 8, 18), brassMat); tc1.rotation.x = Math.PI / 2; tc1.position.y = 1.25;
    const tc2 = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.07, 8, 18), brassMat); tc2.rotation.x = Math.PI / 2; tc2.position.y = 1.62;
    const tOrb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfbbf24 })); tOrb.position.y = 2.08;
    teslaGroup.add(tMast, tc1, tc2, tOrb);

    // Cryo Ward
    const cryoGroup = new THREE.Group(); cryoGroup.visible = false;
    const cPil = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.62, 1.2, 6), parapetMat); cPil.position.y = 0.7; cPil.castShadow = true;
    const cCore = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), new THREE.MeshStandardMaterial({ color: 0xa5f3fc, emissive: 0x38bdf8, emissiveIntensity: 0.9, roughness: 0.2 }));
    cCore.position.y = 1.74;
    const cAura = new THREE.Mesh(auraGeo, new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }));
    cAura.rotation.x = -Math.PI / 2; cAura.position.y = 0.1; cryoGroup.add(cPil, cCore, cAura);

    g.add(prismGroup, teslaGroup, cryoGroup); root.add(g);
    return { selector, prismGroup, pHead, pHeadMat, teslaGroup, tOrb, cryoGroup, cCore, cAura };
  });

  function update(state, showSel) {
    const t = state.elapsed;

    // Animate Central Solar Spire & Astrolabe
    solarPrism.rotation.y = t * 1.6;
    solarPrism.rotation.x = Math.sin(t * 0.8) * 0.18;
    solarPrism.position.y = 4.85 + Math.sin(t * 2.2) * 0.12;
    astrolabeA.rotation.x = t * 0.9;
    astrolabeA.rotation.z = state.sun.azimuth;
    astrolabeB.rotation.y = -t * 1.3;
    astrolabeB.rotation.z = t * 0.7;
    coreLight.intensity = 2.4 + Math.sin(t * 3.5) * 0.35;

    sunShaftGroup.rotation.y = -state.sun.azimuth + Math.PI / 2;
    for (const cp of clouds) cp.mesh.position.x = ((cp.baseX + t * cp.speed + 65) % 130) - 65;

    for (let i = 0; i < state.pylons.length; i += 1) {
      const py = state.pylons[i]; const v = pylonViews[i];
      v.crystal.visible = v.halo.visible = py.active; if (!py.active) continue;
      v.crystal.rotation.y = t * 1.4 + i; v.crystal.position.y = 1.88 + Math.sin(py.pulse) * 0.16;
      v.crystalMat.color.setHex(py.flash > 0 ? 0xffffff : py.sunlit ? 0x67e8f9 : 0x38bdf8);
      v.crystalMat.emissive.setHex(py.flash > 0 ? 0xfbbf24 : py.sunlit ? 0xf59e0b : 0x0369a1);
      v.crystalMat.emissiveIntensity = py.sunlit ? 1.2 : 0.6;
      v.haloMat.opacity = py.sunlit ? 0.52 + Math.sin(py.pulse * 1.5) * 0.15 : 0.16;
    }

    const tgt = showSel ? findTargetSocket(state, null) : null;
    for (let i = 0; i < state.turrets.length; i += 1) {
      const tu = state.turrets[i]; const sv = socketViews[i];
      sv.selector.visible = Boolean(tgt && tgt.id === tu.id);
      if (sv.selector.visible) sv.selector.scale.setScalar(1 + Math.sin(t * 6) * 0.08);
      sv.prismGroup.visible = tu.active && tu.kind === 'prism'; sv.teslaGroup.visible = tu.active && tu.kind === 'tesla'; sv.cryoGroup.visible = tu.active && tu.kind === 'cryo';
      if (!tu.active) continue;
      const sc = 1 + (tu.level - 1) * 0.14;
      if (tu.kind === 'prism') { sv.prismGroup.scale.setScalar(sc); sv.pHead.rotation.y = t * 2.1 + i; sv.pHeadMat.emissive.setHex(tu.sunlit ? 0xf59e0b : 0x0284c7); sv.pHeadMat.emissiveIntensity = tu.sunlit ? 1.3 : 0.7; }
      else if (tu.kind === 'tesla') { sv.teslaGroup.scale.setScalar(sc); sv.tOrb.scale.setScalar(1 + Math.sin(t * 9 + i) * 0.12); }
      else if (tu.kind === 'cryo') { sv.cCore.rotation.y = -t * 1.5; sv.cCore.position.y = 1.74 + Math.sin(t * 3 + i) * 0.1; sv.cAura.scale.setScalar(1 + (tu.level - 1) * 0.15); }
    }
  }
  return { update };
}
