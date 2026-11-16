/**
 * Zero-allocation 3D VFX pools: instanced plasma bolts & particles,
 * oriented solar refraction laser beams, sniper rail telegraphs,
 * parabolic mortar shells + ground impact rings, and EMP shockwaves.
 */

import * as THREE from 'three';
import { ARENA, POOLS } from '../config/constants.js';

const _m4 = new THREE.Matrix4(); const _pos = new THREE.Vector3(); const _quat = new THREE.Quaternion();
const _scl = new THREE.Vector3(); const _col = new THREE.Color(); const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3(); const _pA = new THREE.Vector3(); const _pB = new THREE.Vector3();

/** Builds and updates all pre-allocated 3D projectile, beam, telegraph, mortar, and particle pools. */
export function createEffectsPool(scene) {
  const mkInst = (geo, max) => {
    const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }), max);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(im); return im;
  };
  const pBoltGeo = new THREE.CapsuleGeometry(.14, .55, 4, 6); pBoltGeo.rotateX(Math.PI / 2);
  const pBoltInst = mkInst(pBoltGeo, POOLS.playerBolts);
  const eBoltInst = mkInst(new THREE.SphereGeometry(.24, 8, 6), POOLS.enemyBolts);
  const partInst = mkInst(new THREE.OctahedronGeometry(.22, 0), POOLS.particles);

  const mkSlots = (geo, n, col, add = true) => Array.from({ length: n }, () => {
    const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .88, depthWrite: false, side: THREE.DoubleSide, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending });
    const mesh = new THREE.Mesh(geo, mat); mesh.visible = false; scene.add(mesh); return { mesh, mat };
  });
  const beamSlots = mkSlots(new THREE.CylinderGeometry(1, 1, 1, 6, 1, true), POOLS.beams + 12, 0x22d3ee, false);
  const sniperSlots = mkSlots(new THREE.CylinderGeometry(.05, .05, 1, 4), 16, 0xfbbf24);
  const ringSlots = mkSlots(new THREE.RingGeometry(.84, 1, 32), POOLS.rings, 0x38bdf8);
  for (const r of ringSlots) r.mesh.rotation.x = -Math.PI / 2;

  const rGeo = new THREE.RingGeometry(.86, 1, 28); const fGeo = new THREE.CircleGeometry(1, 28); const sGeo = new THREE.SphereGeometry(.32, 8, 6);
  const mortarSlots = Array.from({ length: POOLS.mortars }, () => {
    const g = new THREE.Group();
    const outer = new THREE.Mesh(rGeo, new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: .82, side: THREE.DoubleSide })); outer.rotation.x = -Math.PI / 2;
    const fillMat = new THREE.MeshBasicMaterial({ color: 0xfb7185, transparent: true, opacity: .28, side: THREE.DoubleSide });
    const fill = new THREE.Mesh(fGeo, fillMat); fill.rotation.x = -Math.PI / 2;
    const shell = new THREE.Mesh(sGeo, new THREE.MeshBasicMaterial({ color: 0xfbbf24 }));
    g.add(outer, fill, shell); g.visible = false; scene.add(g); return { g, outer, fill, shell, fillMat };
  });

  function placeBeam(slot, x1, y1, z1, x2, y2, z2, w, col, op) {
    _pA.set(x1, y1, z1); _pB.set(x2, y2, z2); _dir.subVectors(_pB, _pA);
    const len = _dir.length(); if (len < .05) { slot.mesh.visible = false; return; }
    _dir.divideScalar(len); slot.mesh.position.addVectors(_pA, _pB).multiplyScalar(.5);
    slot.mesh.quaternion.setFromUnitVectors(_up, _dir); slot.mesh.scale.set(w, len, w);
    slot.mat.color.set(col); slot.mat.opacity = op; slot.mesh.visible = true;
  }

  function update(state) {
    const { pools, sun } = state;
    let pc = 0;
    for (const b of pools.playerBolts) {
      if (!b.active) continue;
      _pos.set(b.x, ARENA.flightY, b.z); _quat.setFromAxisAngle(_up, Math.atan2(b.vx, b.vz)); _scl.setScalar(b.crit ? 1.32 : 1);
      _m4.compose(_pos, _quat, _scl); pBoltInst.setMatrixAt(pc, _m4); _col.set(b.color); pBoltInst.setColorAt(pc++, _col);
    }
    pBoltInst.count = pc; pBoltInst.instanceMatrix.needsUpdate = true; if (pBoltInst.instanceColor) pBoltInst.instanceColor.needsUpdate = true;

    let ec = 0;
    for (const b of pools.enemyBolts) {
      if (!b.active) continue;
      _pos.set(b.x, ARENA.flightY - .1, b.z); _quat.identity(); _scl.set(b.isRail ? 1.5 : 1, 1, b.isRail ? 2.2 : 1);
      _m4.compose(_pos, _quat, _scl); eBoltInst.setMatrixAt(ec, _m4); _col.set(b.color); eBoltInst.setColorAt(ec++, _col);
    }
    eBoltInst.count = ec; eBoltInst.instanceMatrix.needsUpdate = true; if (eBoltInst.instanceColor) eBoltInst.instanceColor.needsUpdate = true;

    let ptc = 0;
    for (const pt of pools.particles) {
      if (!pt.active) continue;
      const t = pt.life / Math.max(.01, pt.maxLife);
      _pos.set(pt.x, pt.y, pt.z); _quat.setFromAxisAngle(_up, pt.life * 8); _scl.setScalar(Math.max(.15, t * pt.size * 5));
      _m4.compose(_pos, _quat, _scl); partInst.setMatrixAt(ptc, _m4); _col.set(pt.color); partInst.setColorAt(ptc++, _col);
    }
    partInst.count = ptc; partInst.instanceMatrix.needsUpdate = true; if (partInst.instanceColor) partInst.instanceColor.needsUpdate = true;

    let bi = 0;
    for (let i = 0; i < sun.solarLinks.length && bi < beamSlots.length; i += 1) {
      const lk = sun.solarLinks[i]; placeBeam(beamSlots[bi++], lk.x1, 1.75, lk.z1, lk.x2, 1.75, lk.z2, .08, lk.color, .72);
    }
    for (let i = 0; i < pools.beams.length && bi < beamSlots.length; i += 1) {
      const bm = pools.beams[i]; if (!bm.active) continue;
      const al = Math.max(.1, bm.life / Math.max(.01, bm.maxLife));
      placeBeam(beamSlots[bi++], bm.x1, bm.y1, bm.z1, bm.x2, bm.y2, bm.z2, bm.width * al, bm.color, al);
    }
    for (let i = bi; i < beamSlots.length; i += 1) beamSlots[i].mesh.visible = false;

    let si = 0;
    for (let i = 0; i < pools.enemies.length && si < sniperSlots.length; i += 1) {
      const e = pools.enemies[i]; if (!e.active || e.telegraph <= 0) continue;
      const urg = e.telegraph < .35;
      placeBeam(sniperSlots[si++], e.x, .9, e.z, e.x + Math.cos(e.aimAngle) * 26, .9, e.z + Math.sin(e.aimAngle) * 26, urg ? 1.5 : .8, urg ? '#f43f5e' : '#fbbf24', urg ? .95 : .58);
    }
    for (let i = si; i < sniperSlots.length; i += 1) sniperSlots[i].mesh.visible = false;

    let mi = 0;
    for (const m of pools.mortars) {
      if (!m.active || mi >= mortarSlots.length) continue;
      const slot = mortarSlots[mi++]; slot.g.visible = true;
      const pr = Math.min(1, m.elapsed / Math.max(.01, m.duration));
      slot.outer.position.set(m.x, .14, m.z); slot.outer.scale.setScalar(m.radius);
      slot.fill.position.set(m.x, .12, m.z); slot.fill.scale.setScalar(Math.max(.08, m.radius * pr));
      slot.fillMat.opacity = .22 + pr * .42;
      slot.shell.position.set(m.sx + (m.x - m.sx) * pr, .6 + Math.sin(pr * Math.PI) * 7.5, m.sz + (m.z - m.sz) * pr);
    }
    for (let i = mi; i < mortarSlots.length; i += 1) mortarSlots[i].g.visible = false;

    let ri = 0;
    for (const r of pools.rings) {
      if (!r.active || ri >= ringSlots.length) continue;
      const slot = ringSlots[ri++]; const t = 1 - r.life / Math.max(.01, r.maxLife);
      slot.mesh.visible = true; slot.mesh.position.set(r.x, r.y, r.z); slot.mesh.scale.setScalar(r.radius + (r.maxRadius - r.radius) * t);
      slot.mat.color.set(r.color); slot.mat.opacity = Math.max(.05, 1 - t);
    }
    for (let i = ri; i < ringSlots.length; i += 1) ringSlots[i].mesh.visible = false;
  }

  return { update };
}
