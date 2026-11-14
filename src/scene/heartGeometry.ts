import * as THREE from 'three';
import type { AnatomyFocusId } from '../physics/hemodynamics';
import type { NetterMaterialLibrary } from './netterMaterials';
import { computeArteriolarCages, createCardiovascularSplines, type SplineAnchorMap } from './splineMath';

export interface InteractivePartEntry {
  id: AnatomyFocusId;
  meshes: THREE.Object3D[];
}

export interface HeartRigHandles {
  root: THREE.Group;
  splines: SplineAnchorMap;
  lvOuterGroup: THREE.Group;
  lvBloodMesh: THREE.Mesh;
  mitralAnteriorPivot: THREE.Group;
  mitralPosteriorPivot: THREE.Group;
  aorticLeftPivot: THREE.Group;
  aorticRightPivot: THREE.Group;
  chordaeLines: THREE.LineSegments;
  arteriolarRibGroup: THREE.Group;
  arteriolarRibMeshes: THREE.Mesh[];
  perfusionHaloMesh: THREE.Mesh;
  rbcArterialInstanced: THREE.InstancedMesh;
  rbcVenousInstanced: THREE.InstancedMesh;
  rbcArterialCount: number;
  rbcVenousCount: number;
  calloutsWorld: Record<AnatomyFocusId, THREE.Vector3>;
  interactiveParts: InteractivePartEntry[];
  dispose: () => void;
}

function tagInteractive(obj: THREE.Object3D, id: AnatomyFocusId): void {
  obj.userData.anatomyId = id;
  obj.traverse((child) => {
    child.userData.anatomyId = id;
  });
}

function addInkOutline(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  inkMaterial: THREE.Material,
  thickness = 1.045,
): THREE.Mesh {
  const outline = new THREE.Mesh(geometry, inkMaterial);
  outline.scale.setScalar(thickness);
  outline.renderOrder = -1;
  parent.add(outline);
  return outline;
}

/**
 * Create a thick cutaway hollow chamber wall spanning [thetaStart, thetaStart + thetaLength]
 * with closed cut faces along the longitudinal window edges.
 */
function buildCutawayChamberWallGeometry(
  profile: Array<{ y: number; rOuter: number; rInner: number }>,
  thetaStart: number,
  thetaLength: number,
  radialSegs = 28,
): {
  outerGeo: THREE.BufferGeometry;
  innerGeo: THREE.BufferGeometry;
  cutFacesGeo: THREE.BufferGeometry;
} {
  const rows = profile.length;
  const cols = radialSegs + 1;

  const makeSurface = (useOuter: boolean, flipNormal: boolean) => {
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let r = 0; r < rows; r++) {
      const v = r / (rows - 1);
      const { y, rOuter, rInner } = profile[r]!;
      const rad = useOuter ? rOuter : rInner;
      for (let c = 0; c < cols; c++) {
        const u = c / radialSegs;
        const th = thetaStart + u * thetaLength;
        positions.push(Math.cos(th) * rad, y, Math.sin(th) * rad);
        uvs.push(u, v);
      }
    }

    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < radialSegs; c++) {
        const a = r * cols + c;
        const b = a + 1;
        const d = (r + 1) * cols + c;
        const e = d + 1;
        if (flipNormal) {
          indices.push(a, b, d, b, e, d);
        } else {
          indices.push(a, d, b, b, d, e);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  };

  // Cut faces connecting rOuter -> rInner along thetaStart and thetaEnd
  const cutPositions: number[] = [];
  const cutIndices: number[] = [];
  const addWallCap = (theta: number, reverse: boolean) => {
    const base = cutPositions.length / 3;
    const cx = Math.cos(theta);
    const sz = Math.sin(theta);
    for (let r = 0; r < rows; r++) {
      const { y, rOuter, rInner } = profile[r]!;
      cutPositions.push(cx * rOuter, y, sz * rOuter);
      cutPositions.push(cx * rInner, y, sz * rInner);
    }
    for (let r = 0; r < rows - 1; r++) {
      const o0 = base + r * 2;
      const i0 = o0 + 1;
      const o1 = o0 + 2;
      const i1 = o0 + 3;
      if (reverse) {
        cutIndices.push(o0, o1, i0, o1, i1, i0);
      } else {
        cutIndices.push(o0, i0, o1, o1, i0, i1);
      }
    }
  };
  addWallCap(thetaStart, true);
  addWallCap(thetaStart + thetaLength, false);

  const cutFacesGeo = new THREE.BufferGeometry();
  cutFacesGeo.setAttribute('position', new THREE.Float32BufferAttribute(cutPositions, 3));
  cutFacesGeo.setIndex(cutIndices);
  cutFacesGeo.computeVertexNormals();

  return {
    outerGeo: makeSurface(true, false),
    innerGeo: makeSurface(false, true),
    cutFacesGeo,
  };
}

function buildValveLeafletGeometry(width = 0.24, length = 0.34): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-width * 0.5, 0);
  shape.quadraticCurveTo(-width * 0.45, -length * 0.65, 0, -length);
  shape.quadraticCurveTo(width * 0.45, -length * 0.65, width * 0.5, 0);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.032,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.01,
    bevelSegments: 2,
    curveSegments: 10,
  });
  geo.translate(0, 0, -0.016);
  return geo;
}

function buildBiconcaveRbcGeometry(): THREE.BufferGeometry {
  // Lathe profile of an erythrocyte biconcave disc
  const pts: THREE.Vector2[] = [];
  const steps = 12;
  const rad = 0.048;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const r = u * rad;
    const halfThick = 0.011 + 0.011 * Math.sin(u * Math.PI) * Math.pow(u, 0.7);
    pts.push(new THREE.Vector2(r, halfThick));
  }
  for (let i = steps; i >= 0; i--) {
    const u = i / steps;
    const r = u * rad;
    const halfThick = -(0.011 + 0.011 * Math.sin(u * Math.PI) * Math.pow(u, 0.7));
    pts.push(new THREE.Vector2(r, halfThick));
  }
  const geo = new THREE.LatheGeometry(pts, 14);
  geo.rotateX(Math.PI * 0.5);
  return geo;
}

export function buildHeartRig(mats: NetterMaterialLibrary): HeartRigHandles {
  const root = new THREE.Group();
  const disposables: THREE.BufferGeometry[] = [];
  const track = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.push(g);
    return g;
  };

  const splines = createCardiovascularSplines();
  const interactiveParts: InteractivePartEntry[] = [];

  // ── 1. LEFT VENTRICLE CUTAWAY + MYOCARDIUM (lv-edv & myocardium-lvef) ─────
  const lvOuterGroup = new THREE.Group();
  lvOuterGroup.position.set(-0.56, -0.52, 0.06);
  root.add(lvOuterGroup);

  const lvProfile = [
    { y: -1.04, rOuter: 0.24, rInner: 0.08 },
    { y: -0.92, rOuter: 0.44, rInner: 0.28 },
    { y: -0.68, rOuter: 0.66, rInner: 0.48 },
    { y: -0.32, rOuter: 0.78, rInner: 0.58 },
    { y: 0.14, rOuter: 0.76, rInner: 0.56 },
    { y: 0.56, rOuter: 0.66, rInner: 0.48 },
    { y: 0.84, rOuter: 0.54, rInner: 0.38 },
  ];
  // Leave front-right sector open (~115 deg window facing +Z/+X)
  const { outerGeo, innerGeo, cutFacesGeo } = buildCutawayChamberWallGeometry(
    lvProfile,
    Math.PI * 0.52,
    Math.PI * 1.48,
    28,
  );
  track(outerGeo);
  track(innerGeo);
  track(cutFacesGeo);

  const lvOuterMesh = new THREE.Mesh(outerGeo, mats.myocardiumOuter);
  const lvCutMesh = new THREE.Mesh(cutFacesGeo, mats.myocardiumCut);
  const lvInnerMesh = new THREE.Mesh(innerGeo, mats.endocardiumWall);
  lvOuterGroup.add(lvOuterMesh, lvCutMesh, lvInnerMesh);
  addInkOutline(lvOuterGroup, outerGeo, mats.inkOutline, 1.032);
  tagInteractive(lvOuterMesh, 'myocardium-lvef');
  tagInteractive(lvCutMesh, 'myocardium-lvef');
  tagInteractive(lvInnerMesh, 'lv-edv');

  // Striated left/anterior ventricular lobe beside the cutaway so whole heart silhouette reads anatomically
  const rvLobeGeo = track(new THREE.SphereGeometry(0.68, 24, 20));
  rvLobeGeo.scale(0.86, 1.42, 0.78);
  const rvLobe = new THREE.Mesh(rvLobeGeo, mats.myocardiumOuter);
  rvLobe.position.set(-0.56, -0.06, -0.02);
  rvLobe.rotation.z = 0.22;
  lvOuterGroup.add(rvLobe);
  addInkOutline(rvLobe, rvLobeGeo, mats.inkOutline, 1.032);
  tagInteractive(rvLobe, 'myocardium-lvef');

  // Top muscular rim collar sealing cutaway chamber roof
  const rimCollarGeo = track(new THREE.TorusGeometry(0.46, 0.085, 10, 24, Math.PI * 1.48));
  rimCollarGeo.rotateX(Math.PI * 0.5);
  rimCollarGeo.rotateY(-Math.PI * 0.52);
  const rimCollar = new THREE.Mesh(rimCollarGeo, mats.myocardiumCut);
  rimCollar.position.set(0, 0.84, 0);
  lvOuterGroup.add(rimCollar);
  tagInteractive(rimCollar, 'myocardium-lvef');

  // Epicardial Interventricular Fat Strip & Coronary Tree (in world coordinates under root or lvOuterGroup)
  const fatGeo = track(new THREE.TubeGeometry(splines.coronaryMainCurve, 24, 0.072, 10, false));
  const fatMesh = new THREE.Mesh(fatGeo, mats.epicardialFat);
  root.add(fatMesh);
  addInkOutline(root, fatGeo, mats.inkOutline, 1.08);
  tagInteractive(fatMesh, 'myocardium-lvef');

  const ladGeo = track(new THREE.TubeGeometry(splines.coronaryMainCurve, 24, 0.032, 8, false));
  const ladMesh = new THREE.Mesh(ladGeo, mats.coronaryArtery);
  ladMesh.position.z = 0.045;
  root.add(ladMesh);
  tagInteractive(ladMesh, 'myocardium-lvef');

  splines.coronaryBranchCurves.forEach((branch) => {
    const bGeo = track(new THREE.TubeGeometry(branch, 14, 0.02, 7, false));
    const bMesh = new THREE.Mesh(bGeo, mats.coronaryArtery);
    bMesh.position.z = 0.035;
    root.add(bMesh);
    tagInteractive(bMesh, 'myocardium-lvef');
  });

  // LV Cavity Fluid Volume (scales height & slight radius smoothly with EDV / instantaneous LV volume)
  const lvBloodGeo = track(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.01, -0.82),
        new THREE.Vector2(0.32, -0.68),
        new THREE.Vector2(0.49, -0.3),
        new THREE.Vector2(0.51, 0.25),
        new THREE.Vector2(0.42, 0.58),
        new THREE.Vector2(0.01, 0.58),
      ],
      22,
    ),
  );
  const lvBloodMesh = new THREE.Mesh(lvBloodGeo, mats.lvBlood);
  lvBloodMesh.position.set(0.02, -0.08, 0.04);
  lvBloodMesh.renderOrder = 2;
  lvOuterGroup.add(lvBloodMesh);
  tagInteractive(lvBloodMesh, 'lv-edv');

  // Papillary Muscles inside LV cavity
  const papGeo = track(new THREE.ConeGeometry(0.11, 0.44, 12));
  const pap1 = new THREE.Mesh(papGeo, mats.myocardiumOuter);
  pap1.position.set(-0.18, -0.62, 0.16);
  pap1.rotation.z = -0.14;
  const pap2 = new THREE.Mesh(papGeo, mats.myocardiumOuter);
  pap2.position.set(0.15, -0.64, 0.22);
  pap2.rotation.z = 0.12;
  lvOuterGroup.add(pap1, pap2);
  tagInteractive(pap1, 'lv-edv');
  tagInteractive(pap2, 'lv-edv');

  // Hinged Mitral & Aortic Valve Leaflets
  const leafletGeo = track(buildValveLeafletGeometry(0.22, 0.32));
  const mitralAnteriorPivot = new THREE.Group();
  mitralAnteriorPivot.position.set(-0.28, 0.66, 0.18);
  const mitralAntMesh = new THREE.Mesh(leafletGeo, mats.valveLeaflet);
  mitralAnteriorPivot.add(mitralAntMesh);

  const mitralPosteriorPivot = new THREE.Group();
  mitralPosteriorPivot.position.set(-0.04, 0.68, 0.14);
  const mitralPostMesh = new THREE.Mesh(leafletGeo, mats.valveLeaflet);
  mitralPosteriorPivot.add(mitralPostMesh);
  lvOuterGroup.add(mitralAnteriorPivot, mitralPosteriorPivot);

  // Chordae Tendineae connecting papillary tips to mitral leaflet tips
  const chordaePositions = new Float32Array(4 * 2 * 3);
  const chordaeGeo = track(new THREE.BufferGeometry());
  chordaeGeo.setAttribute('position', new THREE.BufferAttribute(chordaePositions, 3));
  const chordaeLines = new THREE.LineSegments(chordaeGeo, mats.chordaeLine);
  chordaeLines.renderOrder = 3;
  lvOuterGroup.add(chordaeLines);

  const aorticLeafletGeo = track(buildValveLeafletGeometry(0.16, 0.25));
  aorticLeafletGeo.rotateZ(Math.PI);
  const aorticLeftPivot = new THREE.Group();
  aorticLeftPivot.position.set(-0.42, 0.46, 0.12);
  aorticLeftPivot.add(new THREE.Mesh(aorticLeafletGeo, mats.valveLeaflet));

  const aorticRightPivot = new THREE.Group();
  aorticRightPivot.position.set(-0.22, 0.44, 0.12);
  aorticRightPivot.add(new THREE.Mesh(aorticLeafletGeo, mats.valveLeaflet));
  root.add(aorticLeftPivot, aorticRightPivot);

  interactiveParts.push(
    { id: 'lv-edv', meshes: [lvInnerMesh, lvBloodMesh, pap1, pap2] },
    { id: 'myocardium-lvef', meshes: [lvOuterMesh, lvCutMesh, rvLobe, fatMesh, ladMesh] },
  );

  // ── 2. ASCENDING AORTA, WINDKESSEL ARCH & TRUNKS (aorta-map) ────────────────
  const aortaGroup = new THREE.Group();
  root.add(aortaGroup);

  // Split curve visual: ascending half translucent cutaway revealing flowing RBCs + posterior/descending solid crimson
  const artPoints = splines.arterialCurve.getPoints(48);
  const ascCurve = new THREE.CatmullRomCurve3(artPoints.slice(0, 26));
  const descCurve = new THREE.CatmullRomCurve3(artPoints.slice(23));

  const ascOuterGeo = track(new THREE.TubeGeometry(ascCurve, 28, 0.245, 18, false));
  const descGeo = track(new THREE.TubeGeometry(descCurve, 32, 0.225, 18, false));

  const ascGlassMesh = new THREE.Mesh(ascOuterGeo, mats.aortaGlass);
  ascGlassMesh.renderOrder = 4;
  const descMesh = new THREE.Mesh(descGeo, mats.aortaOpaque);
  aortaGroup.add(descMesh, ascGlassMesh);
  addInkOutline(aortaGroup, descGeo, mats.inkOutline, 1.055);
  addInkOutline(aortaGroup, ascOuterGeo, mats.inkOutline, 1.045);

  // Three Supra-Aortic Arch Branches (Brachiocephalic, Left Carotid, Left Subclavian)
  const branchSpecs: Array<{ pos: [number, number, number]; rotZ: number; h: number }> = [
    { pos: [0.36, 2.18, 0.02], rotZ: 0.16, h: 0.46 },
    { pos: [0.76, 2.34, 0], rotZ: 0.04, h: 0.44 },
    { pos: [1.14, 2.32, -0.02], rotZ: -0.08, h: 0.42 },
  ];
  const branchMeshes: THREE.Mesh[] = [];
  branchSpecs.forEach((b) => {
    const bGeo = track(new THREE.CylinderGeometry(0.088, 0.105, b.h, 14, 1, false));
    const mesh = new THREE.Mesh(bGeo, mats.aortaOpaque);
    mesh.position.set(b.pos[0], b.pos[1], b.pos[2]);
    mesh.rotation.z = b.rotZ;
    aortaGroup.add(mesh);
    addInkOutline(mesh, bGeo, mats.inkOutline, 1.07);
    tagInteractive(mesh, 'aorta-map');
    branchMeshes.push(mesh);
  });

  tagInteractive(ascGlassMesh, 'aorta-map');
  tagInteractive(descMesh, 'aorta-map');
  interactiveParts.push({ id: 'aorta-map', meshes: [ascGlassMesh, descMesh, ...branchMeshes] });

  // ── 3. ARTERIOLAR RESISTANCE CAGE & PERFUSION HALO (arterioles-svr) ─────────
  const arterioleGroup = new THREE.Group();
  root.add(arterioleGroup);

  const haloGeo = track(new THREE.PlaneGeometry(1.75, 1.55));
  const perfusionHaloMesh = new THREE.Mesh(haloGeo, mats.perfusionHalo);
  perfusionHaloMesh.position.set(2.42, -1.16, -0.25);
  perfusionHaloMesh.renderOrder = 1;
  arterioleGroup.add(perfusionHaloMesh);

  const arteriolarRibGroup = new THREE.Group();
  arterioleGroup.add(arteriolarRibGroup);
  const baseCages = computeArteriolarCages(5, 1.0);
  const arteriolarRibMeshes: THREE.Mesh[] = [];
  baseCages.forEach((c) => {
    const rGeo = track(new THREE.TubeGeometry(c, 22, 0.042, 10, false));
    const rMesh = new THREE.Mesh(rGeo, mats.arterioleVessel);
    arteriolarRibGroup.add(rMesh);
    addInkOutline(rMesh, rGeo, mats.inkOutline, 1.09);
    tagInteractive(rMesh, 'arterioles-svr');
    arteriolarRibMeshes.push(rMesh);
  });

  // Elliptical collector manifold at base of arterioles
  const collectorGeo = track(new THREE.SphereGeometry(0.36, 18, 12));
  collectorGeo.scale(1.18, 0.38, 0.85);
  const collectorMesh = new THREE.Mesh(collectorGeo, mats.venousWall);
  collectorMesh.position.set(2.4, -1.52, -0.04);
  arterioleGroup.add(collectorMesh);
  addInkOutline(collectorMesh, collectorGeo, mats.inkOutline, 1.06);
  tagInteractive(collectorMesh, 'arterioles-svr');
  interactiveParts.push({
    id: 'arterioles-svr',
    meshes: [...arteriolarRibMeshes, collectorMesh],
  });

  // ── 4. VENOUS RETURN LOOP & LEFT ATRIUM CUTAWAY (venous-cvp) ───────────────
  const venousGroup = new THREE.Group();
  root.add(venousGroup);

  const venTubeGeo = track(new THREE.TubeGeometry(splines.venousCurve, 44, 0.145, 14, false));
  const venTubeMesh = new THREE.Mesh(venTubeGeo, mats.venousWall);
  venousGroup.add(venTubeMesh);
  addInkOutline(venousGroup, venTubeGeo, mats.inkOutline, 1.065);
  tagInteractive(venTubeMesh, 'venous-cvp');

  // Left Atrium Cutaway Receiving Chamber (top-left of heart)
  const laGroup = new THREE.Group();
  laGroup.position.set(-1.12, 0.72, 0.24);
  venousGroup.add(laGroup);

  const laProfile = [
    { y: -0.32, rOuter: 0.26, rInner: 0.18 },
    { y: -0.14, rOuter: 0.42, rInner: 0.34 },
    { y: 0.12, rOuter: 0.45, rInner: 0.37 },
    { y: 0.34, rOuter: 0.34, rInner: 0.26 },
  ];
  const laCut = buildCutawayChamberWallGeometry(laProfile, Math.PI * 0.65, Math.PI * 1.45, 22);
  track(laCut.outerGeo);
  track(laCut.innerGeo);
  track(laCut.cutFacesGeo);

  const laOuter = new THREE.Mesh(laCut.outerGeo, mats.venousWall);
  const laInner = new THREE.Mesh(laCut.innerGeo, mats.atriumCut);
  const laFaces = new THREE.Mesh(laCut.cutFacesGeo, mats.venousWall);
  laGroup.add(laOuter, laInner, laFaces);
  addInkOutline(laGroup, laCut.outerGeo, mats.inkOutline, 1.045);

  // Vertical SVC Column + Pulmonary Vein Stubs entering Left Atrium
  const svcGeo = track(new THREE.CylinderGeometry(0.115, 0.125, 0.88, 14));
  const svcMesh = new THREE.Mesh(svcGeo, mats.venousWall);
  svcMesh.position.set(-0.18, 0.62, -0.18);
  laGroup.add(svcMesh);
  addInkOutline(svcMesh, svcGeo, mats.inkOutline, 1.07);

  const pv1Geo = track(new THREE.CylinderGeometry(0.068, 0.075, 0.56, 12));
  pv1Geo.rotateZ(Math.PI * 0.42);
  const pv1 = new THREE.Mesh(pv1Geo, mats.venousWall);
  pv1.position.set(-0.52, 0.08, -0.05);
  const pv2 = new THREE.Mesh(pv1Geo, mats.venousWall);
  pv2.position.set(-0.54, -0.14, -0.08);
  pv2.rotation.z = -0.15;
  laGroup.add(pv1, pv2);
  addInkOutline(pv1, pv1Geo, mats.inkOutline, 1.07);
  addInkOutline(pv2, pv1Geo, mats.inkOutline, 1.07);

  tagInteractive(laGroup, 'venous-cvp');
  interactiveParts.push({
    id: 'venous-cvp',
    meshes: [venTubeMesh, laOuter, laInner, svcMesh, pv1, pv2],
  });

  // ── 5. FLOWING 3D RED BLOOD CORPUSCLES (InstancedMesh) ─────────────────────
  const rbcGeo = track(buildBiconcaveRbcGeometry());
  const rbcArterialCount = 42;
  const rbcVenousCount = 30;
  const rbcArterialInstanced = new THREE.InstancedMesh(rbcGeo, mats.rbcCell, rbcArterialCount);
  const rbcVenousInstanced = new THREE.InstancedMesh(rbcGeo, mats.rbcCell, rbcVenousCount);
  rbcArterialInstanced.frustumCulled = false;
  rbcVenousInstanced.frustumCulled = false;
  rbcArterialInstanced.renderOrder = 3;
  rbcVenousInstanced.renderOrder = 3;
  root.add(rbcArterialInstanced, rbcVenousInstanced);

  const calloutsWorld: Record<AnatomyFocusId, THREE.Vector3> = {
    'venous-cvp': new THREE.Vector3(-1.35, 0.88, 0.45),
    'aorta-map': new THREE.Vector3(1.18, 2.02, 0.22),
    'lv-edv': new THREE.Vector3(-0.34, -0.58, 0.45),
    'myocardium-lvef': new THREE.Vector3(-0.18, -1.24, 0.35),
    'arterioles-svr': new THREE.Vector3(2.68, -1.16, 0.22),
  };

  return {
    root,
    splines,
    lvOuterGroup,
    lvBloodMesh,
    mitralAnteriorPivot,
    mitralPosteriorPivot,
    aorticLeftPivot,
    aorticRightPivot,
    chordaeLines,
    arteriolarRibGroup,
    arteriolarRibMeshes,
    perfusionHaloMesh,
    rbcArterialInstanced,
    rbcVenousInstanced,
    rbcArterialCount,
    rbcVenousCount,
    calloutsWorld,
    interactiveParts,
    dispose() {
      disposables.forEach((g) => g.dispose());
    },
  };
}
