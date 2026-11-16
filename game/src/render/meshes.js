/**
 * Pre-allocated 3D entity mesh pools: Aether Interceptor, Sentinel Drones,
 * Dash Afterimages, 6 distinct Enemy archetypes + Shards, 3-Ring Archon Boss,
 * and instanced Aether Crystals (zero per-frame allocations).
 */

import * as THREE from 'three';
import { ARENA, POOLS } from '../config/constants.js';

const _m4 = new THREE.Matrix4(); const _pos = new THREE.Vector3(); const _quat = new THREE.Quaternion();
const _scl = new THREE.Vector3(); const _eul = new THREE.Euler();

function buildPlayerRig() {
  const g = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.28, metalness: 0.55 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.78 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });
  const body = new THREE.Mesh(new THREE.ConeGeometry(.45, 1.85, 6), hullMat); body.rotation.z = -Math.PI / 2; body.castShadow = true;
  const wing = new THREE.Mesh(new THREE.BoxGeometry(.75, .08, 2.05), hullMat); wing.position.set(-.22, 0, 0); wing.castShadow = true;
  const trim = new THREE.Mesh(new THREE.BoxGeometry(.9, .14, .42), goldMat); trim.position.set(.05, .12, 0);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(.28, 10, 8), glowMat); canopy.scale.set(1.5, .65, .8); canopy.position.set(.18, .18, 0);
  const engGeo = new THREE.ConeGeometry(.18, .55, 8);
  const engL = new THREE.Mesh(engGeo, glowMat); engL.rotation.z = Math.PI / 2; engL.position.set(-1.05, 0, .32);
  const engR = new THREE.Mesh(engGeo, glowMat); engR.rotation.z = Math.PI / 2; engR.position.set(-1.05, 0, -.32);
  const shieldBubble = new THREE.Mesh(new THREE.TorusGeometry(1.12, .06, 8, 28), new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: .55 }));
  shieldBubble.rotation.x = Math.PI / 2;
  const auraRing = new THREE.Mesh(new THREE.RingGeometry(1.22, 1.42, 24), new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: .85, side: THREE.DoubleSide }));
  auraRing.rotation.x = -Math.PI / 2; auraRing.position.y = -.35; auraRing.visible = false;
  g.add(body, wing, trim, canopy, engL, engR, shieldBubble, auraRing);
  return { group: g, hullMat, shieldBubble, auraRing };
}

/** Creates all pre-allocated entity 3D mesh pools and returns update function. */
export function createMeshPools(scene) {
  const pRig = buildPlayerRig(); scene.add(pRig.group);
  const drGeo = new THREE.OctahedronGeometry(.28, 0);
  const drMat = new THREE.MeshStandardMaterial({ color: 0x2dd4bf, emissive: 0x0f766e, roughness: .25, metalness: .6 });
  const drones = Array.from({ length: 4 }, () => { const m = new THREE.Mesh(drGeo, drMat); m.castShadow = true; m.visible = false; scene.add(m); return m; });

  const aftGeo = new THREE.ConeGeometry(.45, 1.75, 4); aftGeo.rotateZ(-Math.PI / 2);
  const aftMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: .38 });
  const afters = Array.from({ length: 6 }, () => { const m = new THREE.Mesh(aftGeo, aftMat); m.visible = false; scene.add(m); return m; });

  const sh = {
    sw: new THREE.ConeGeometry(.48, 1.3, 4), sn: new THREE.ConeGeometry(.45, 1.8, 5), pr: new THREE.BoxGeometry(.85, .12, .12),
    ba: new THREE.CylinderGeometry(1.05, 1.25, .85, 6), baT: new THREE.CylinderGeometry(.55, .72, .42, 6),
    arc: new THREE.CylinderGeometry(1.55, 1.55, 1.05, 16, 1, true, 0, Math.PI * .68),
    mo: new THREE.CylinderGeometry(.82, 1.05, .75, 8), br: new THREE.CylinderGeometry(.22, .3, 1.15, 8),
    sp: new THREE.OctahedronGeometry(.82, 0), spR: new THREE.TorusGeometry(1.15, .1, 6, 18),
    sd: new THREE.OctahedronGeometry(.46, 0), stW: new THREE.BoxGeometry(.42, .08, 1.85), sph: new THREE.SphereGeometry(.18, 8, 8),
    brass: new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: .32, metalness: .76 }),
    swM: new THREE.MeshStandardMaterial({ color: 0xfb7185, emissive: 0x881337, roughness: .38 }),
    snM: new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0x78350f, roughness: .32 }),
    baM: new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x1e3a8a, roughness: .42, metalness: .45 }),
    moM: new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0x7c2d12, roughness: .46 }),
    spM: new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0x581c87, roughness: .32 }),
    sdM: new THREE.MeshStandardMaterial({ color: 0xe879f9, emissive: 0x701a75, roughness: .28 }),
    criG: new THREE.MeshBasicMaterial({ color: 0xfb7185 }), gldG: new THREE.MeshBasicMaterial({ color: 0xfde047 }), vioG: new THREE.MeshBasicMaterial({ color: 0xd946ef }),
    arcM: new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: .68, side: THREE.DoubleSide }),
  };

  const builders = {
    swarmer: () => {
      const g = new THREE.Group(); const mat = sh.swM.clone();
      const w = new THREE.Mesh(sh.sw, mat); w.rotation.z = -Math.PI / 2; w.scale.set(.95, 1.3, 1.35); w.castShadow = true;
      const c = new THREE.Mesh(sh.sph, sh.criG); c.position.set(-.25, .1, 0); g.add(w, c); return { group: g, mat };
    },
    sniper: () => {
      const g = new THREE.Group(); const mat = sh.snM.clone();
      const h = new THREE.Mesh(sh.sn, mat); h.rotation.z = -Math.PI / 2; h.castShadow = true;
      const pL = new THREE.Mesh(sh.pr, sh.brass); pL.position.set(.45, .05, .34);
      const pR = new THREE.Mesh(sh.pr, sh.brass); pR.position.set(.45, .05, -.34);
      const eye = new THREE.Mesh(sh.sph, sh.gldG); eye.position.set(.25, .22, 0); g.add(h, pL, pR, eye); return { group: g, mat };
    },
    bastion: () => {
      const g = new THREE.Group(); const mat = sh.baM.clone();
      const b = new THREE.Mesh(sh.ba, mat); b.castShadow = true;
      const top = new THREE.Mesh(sh.baT, sh.brass); top.position.y = .45;
      const arc = new THREE.Mesh(sh.arc, sh.arcM); arc.position.y = .15; arc.rotation.y = -Math.PI * .34 + Math.PI / 2;
      g.add(b, top, arc); return { group: g, mat, extra: arc };
    },
    mortar: () => {
      const g = new THREE.Group(); const mat = sh.moM.clone();
      const h = new THREE.Mesh(sh.mo, mat); h.castShadow = true;
      const br = new THREE.Mesh(sh.br, sh.brass); br.position.set(.18, .58, 0); br.rotation.z = -.68; br.castShadow = true;
      g.add(h, br); return { group: g, mat, extra: br };
    },
    splitter: () => {
      const g = new THREE.Group(); const mat = sh.spM.clone();
      const o = new THREE.Mesh(sh.sp, mat); o.castShadow = true;
      const r = new THREE.Mesh(sh.spR, sh.vioG); r.rotation.x = Math.PI / 2; g.add(o, r); return { group: g, mat, extra: r };
    },
    shard: () => {
      const g = new THREE.Group(); const mat = sh.sdM.clone();
      const c = new THREE.Mesh(sh.sd, mat); c.castShadow = true; g.add(c); return { group: g, mat };
    },
    stalker: () => {
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: 0x6366f1, emissive: 0x312e81, roughness: .25, metalness: .6, transparent: true, opacity: .28 });
      const b = new THREE.Mesh(sh.sw, mat); b.rotation.z = -Math.PI / 2; b.scale.set(1.05, 1.5, 1.25);
      const w = new THREE.Mesh(sh.stW, mat); w.position.set(-.2, 0, 0); g.add(b, w); return { group: g, mat };
    },
    boss: () => {
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0x881337, emissiveIntensity: .85, roughness: .3, metalness: .65 });
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(1.45, 1), mat); core.castShadow = true;
      const r1 = new THREE.Mesh(new THREE.TorusGeometry(2.15, .18, 10, 32), sh.brass); r1.rotation.x = Math.PI / 2;
      const r2 = new THREE.Mesh(new THREE.TorusGeometry(2.65, .14, 10, 32), sh.criG);
      const r3 = new THREE.Mesh(new THREE.TorusGeometry(3.15, .12, 8, 36), sh.gldG); r3.rotation.y = Math.PI / 4;
      g.add(core, r1, r2, r3); return { group: g, mat, rings: [r1, r2, r3] };
    },
  };

  const counts = { swarmer: 34, sniper: 14, bastion: 14, mortar: 12, splitter: 12, shard: 22, stalker: 14, boss: 1 };
  const enemyPools = {};
  for (const k of Object.keys(counts)) enemyPools[k] = Array.from({ length: counts[k] }, () => { const s = builders[k](); s.group.visible = false; scene.add(s.group); return s; });

  const crysInst = new THREE.InstancedMesh(new THREE.OctahedronGeometry(.32, 0), new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x0ea5e9, emissiveIntensity: .9, roughness: .18, metalness: .4 }), POOLS.crystals);
  crysInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(crysInst);

  const cur = {};
  function update(state) {
    const p = state.player; const t = state.elapsed;
    pRig.group.position.set(p.x, ARENA.flightY + Math.sin(t * 5) * .08, p.z); pRig.group.rotation.set(p.bank, -p.aimAngle, 0);
    pRig.hullMat.emissive.setHex(p.flash > 0 ? 0xfb7185 : 0x0f172a); pRig.shieldBubble.visible = p.shield > 1;
    pRig.auraRing.visible = state.overchargeTimer > 0; if (pRig.auraRing.visible) pRig.auraRing.rotation.z = t * 4;

    for (let i = 0; i < 4; i += 1) {
      drones[i].visible = i < p.drones;
      if (drones[i].visible) {
        const a = p.droneAngle + (i * Math.PI * 2) / p.drones;
        drones[i].position.set(p.x + Math.cos(a) * 1.95, ARENA.flightY + .35 + Math.sin(t * 6 + i) * .1, p.z + Math.sin(a) * 1.95);
        drones[i].rotation.y = t * 3.5;
      }
    }
    for (let i = 0; i < 6; i += 1) {
      afters[i].visible = i < state.afterimages.length;
      if (afters[i].visible) {
        const ai = state.afterimages[i]; afters[i].position.set(ai.x, ARENA.flightY, ai.z);
        afters[i].rotation.set(0, -ai.angle, 0); afters[i].scale.setScalar(.6 + ai.life * 1.8);
      }
    }

    for (const k of Object.keys(enemyPools)) cur[k] = 0;
    for (let i = 0; i < state.pools.enemies.length; i += 1) {
      const e = state.pools.enemies[i]; if (!e.active) continue;
      const list = enemyPools[e.kind]; if (!list || cur[e.kind] >= list.length) continue;
      const sl = list[cur[e.kind]++]; sl.group.visible = true;
      sl.group.position.set(e.x, e.isBoss ? 1.85 + Math.sin(t * 2.6) * .22 : .72 + Math.sin(t * 4 + i) * .08, e.z);
      sl.group.rotation.set(0, -e.angle, 0);
      if (e.isBoss) {
        sl.rings[0].rotation.z = t * 1.5; sl.rings[1].rotation.x = t * 1.2; sl.rings[1].rotation.y = t * .9; sl.rings[2].rotation.y = -t * 1.8;
        sl.mat.emissive.setHex(e.flash > 0 ? 0xfbbf24 : e.bossPhase === 3 ? 0xdc2626 : 0x881337);
      } else {
        sl.mat.emissive.setHex(e.flash > 0 ? 0xffffff : e.chill > 0 ? 0x0284c7 : 0x1e1b4b);
        if (e.kind === 'stalker') { sl.mat.opacity = e.revealed > 0 ? .95 : .24; sl.mat.emissive.setHex(e.revealed > 0 ? 0xf59e0b : 0x312e81); }
        else if (e.kind === 'splitter' && sl.extra) sl.extra.rotation.z = t * 3.5;
        else if (e.kind === 'bastion' && sl.extra) sl.extra.visible = e.stun <= 0;
      }
    }
    for (const k of Object.keys(enemyPools)) for (let i = cur[k]; i < enemyPools[k].length; i += 1) enemyPools[k][i].group.visible = false;

    let cc = 0;
    for (const c of state.pools.crystals) {
      if (!c.active) continue;
      _pos.set(c.x, .65 + Math.sin(c.pulse) * .14, c.z); _eul.set(0, c.pulse * .8, .35);
      _quat.setFromEuler(_eul); _scl.setScalar(1); _m4.compose(_pos, _quat, _scl); crysInst.setMatrixAt(cc++, _m4);
    }
    crysInst.count = cc; crysInst.instanceMatrix.needsUpdate = true;
  }
  return { update };
}
