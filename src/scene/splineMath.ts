import * as THREE from 'three';
import type { AnatomyFocusId } from '../physics/hemodynamics';

export interface CameraFocusPreset {
  position: [number, number, number];
  target: [number, number, number];
}

export const OVERVIEW_CAMERA_PRESET: CameraFocusPreset = {
  position: [0.35, 0.45, 7.35],
  target: [0.35, 0.15, 0],
};

export const FOCUS_CAMERA_PRESETS: Record<AnatomyFocusId, CameraFocusPreset> = {
  'lv-edv': {
    position: [-0.45, -0.35, 4.15],
    target: [-0.65, -0.45, 0.25],
  },
  'myocardium-lvef': {
    position: [-0.85, -0.65, 4.55],
    target: [-0.95, -0.55, 0.15],
  },
  'aorta-map': {
    position: [0.95, 1.35, 4.85],
    target: [0.75, 1.1, 0],
  },
  'arterioles-svr': {
    position: [2.45, -0.75, 3.85],
    target: [2.35, -1.1, 0],
  },
  'venous-cvp': {
    position: [-1.45, 0.95, 4.45],
    target: [-1.45, 0.75, 0.1],
  },
};

export interface SplineAnchorMap {
  arterialCurve: THREE.CatmullRomCurve3;
  venousCurve: THREE.CatmullRomCurve3;
  coronaryMainCurve: THREE.CatmullRomCurve3;
  coronaryBranchCurves: THREE.CatmullRomCurve3[];
}

export function createCardiovascularSplines(): SplineAnchorMap {
  // Ascending aortic root -> Windkessel arch crest -> descending thoracic aorta -> arteriolar junction
  const arterialCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-0.32, 0.42, 0.08),
      new THREE.Vector3(-0.08, 1.28, 0.1),
      new THREE.Vector3(0.45, 2.02, 0.05),
      new THREE.Vector3(1.22, 2.15, 0),
      new THREE.Vector3(1.92, 1.56, -0.04),
      new THREE.Vector3(2.26, 0.35, -0.02),
      new THREE.Vector3(2.42, -0.78, 0),
    ],
    false,
    'catmullrom',
    0.5,
  );

  // Capillary collector basin -> sweeping inferior/posterior venous return -> SVC / Left Atrium
  const venousCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(2.38, -1.56, -0.05),
      new THREE.Vector3(1.45, -1.68, -0.18),
      new THREE.Vector3(-0.25, -1.62, -0.32),
      new THREE.Vector3(-1.78, -1.32, -0.28),
      new THREE.Vector3(-2.12, -0.38, -0.18),
      new THREE.Vector3(-1.95, 0.62, -0.08),
      new THREE.Vector3(-1.35, 0.85, 0.12),
      new THREE.Vector3(-0.98, 0.48, 0.18),
    ],
    false,
    'catmullrom',
    0.5,
  );

  // Anterior interventricular coronary artery running down epicardial sulcus toward apex
  const coronaryMainCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-0.88, 0.38, 0.62),
      new THREE.Vector3(-0.92, -0.05, 0.72),
      new THREE.Vector3(-0.94, -0.58, 0.68),
      new THREE.Vector3(-0.9, -1.08, 0.52),
      new THREE.Vector3(-0.8, -1.38, 0.32),
    ],
    false,
    'catmullrom',
    0.45,
  );

  const coronaryBranchCurves = [
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.92, -0.12, 0.71),
      new THREE.Vector3(-1.26, -0.34, 0.66),
      new THREE.Vector3(-1.54, -0.62, 0.52),
    ]),
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.94, -0.52, 0.68),
      new THREE.Vector3(-1.24, -0.78, 0.6),
      new THREE.Vector3(-1.46, -1.04, 0.44),
    ]),
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.91, -0.92, 0.58),
      new THREE.Vector3(-1.14, -1.16, 0.46),
    ]),
  ];

  return {
    arterialCurve,
    venousCurve,
    coronaryMainCurve,
    coronaryBranchCurves,
  };
}

export function sampleCurveUniform(
  curve: THREE.CatmullRomCurve3,
  t: number,
  outPos: THREE.Vector3,
  outTangent: THREE.Vector3,
): void {
  const clamped = ((t % 1) + 1) % 1;
  curve.getPointAt(clamped, outPos);
  curve.getTangentAt(clamped, outTangent);
}

export function computeArteriolarCages(
  ribCount: number,
  dilationFactor: number,
): THREE.CatmullRomCurve3[] {
  const curves: THREE.CatmullRomCurve3[] = [];
  const topY = -0.82;
  const botY = -1.48;
  const centerX = 2.42;
  const spreadX = 0.42 * dilationFactor;
  const spreadZ = 0.34 * dilationFactor;

  for (let i = 0; i < ribCount; i++) {
    const angle = (i / ribCount) * Math.PI * 2 + 0.32;
    const dx = Math.cos(angle) * spreadX;
    const dz = Math.sin(angle) * spreadZ;
    curves.push(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(centerX + dx * 0.2, topY, dz * 0.2),
        new THREE.Vector3(centerX + dx * 0.92, topY - 0.16, dz * 0.92),
        new THREE.Vector3(centerX + dx * 1.05, (topY + botY) * 0.52, dz * 1.05),
        new THREE.Vector3(centerX + dx * 0.72, botY + 0.08, dz * 0.72),
        new THREE.Vector3(centerX + dx * 0.22, botY - 0.04, dz * 0.22),
      ]),
    );
  }
  return curves;
}
