import * as k from '../kit/iso-kit';
import * as G from '../kit/lathe.mjs';
import { tubePieces, tubeSvg } from '../kit/tube.mjs';
import * as A from '../kit/audit.mjs';
import { glCamera, type GlCamera } from '../kit/gl.mjs';
import type { AnatomyFocusId } from '../physics/hemodynamics';

export const RIG_VIEW_W = 700;
export const RIG_VIEW_H = 420;
export const RIG_AZIMUTH = 50;
export const RIG_ELEVATION = 31;

export type RigFocusGroup = AnatomyFocusId | 'stand';

export interface RigItem {
  id: string;
  piece: RigFocusGroup;
  key: number;
  svg: string;
  hasDynamic?: boolean;
}

export interface RigStaticScene {
  width: number;
  height: number;
  projection: k.Projection;
  glCam: GlCamera;
  haloPath: string;
  items: RigItem[];
  arterialArchGlRoute: k.Point3[];
  arterialFeedGlRoute: k.Point3[];
  venousRoute: k.Point3[];
  capillaryRoutes: k.Point3[][];
  anchors: {
    heartCenter: k.Point3;
    annulusZ: number;
    domeCenter: [number, number];
    domeBottomZ: number;
    domeTopZ: number;
    domeRadius: number;
    gaugeCenter: [number, number];
    gaugeDialZ: number;
    gaugeRadius: number;
    svrCenter: [number, number];
    svrBaseZ: number;
    cvpCenter: [number, number];
    cvpBottomZ: number;
    cvpTopZ: number;
    cvpRadius: number;
    perfusionTray: k.Plan;
    perfusionZ: number;
  };
  overlays: {
    domeGlassSvg: string;
    cvpGlassSvg: string;
  };
  auditRecorder: A.AuditRecorder;
}

const BASE: k.Plan = { x: -224, y: -96, w: 392, d: 202, r: 8 };
const BASE_H = 11;
const FOOT_H = 6;

const HEART_XY: [number, number] = [-66, 16];
const HEART_CRADLE_Z = 14;
const HEART_ANNULUS_Z = 88;

const DOME_XY: [number, number] = [18, -24];
const DOME_Z0 = 14;
const DOME_Z1 = 84;
const DOME_R = 23;

const GAUGE_XY: [number, number] = [18, 54];
const GAUGE_Z = 44;
const GAUGE_R = 21;

const SVR_MANIFOLD: k.Plan = { x: 74, y: -15, w: 20, d: 42, r: 3 };
const SVR_XY: [number, number] = [84, 6];
const SVR_BASE_Z = 22;

const VEN_MANIFOLD: k.Plan = { x: 136, y: -16, w: 18, d: 44, r: 3 };
const PERFUSION_TRAY: k.Plan = { x: 96, y: -15, w: 38, d: 42, r: 3 };

// Aligned along y=16 (+x flow CVP -> LA -> Heart) so every elbow stays perpendicular to view ray
const CVP_XY: [number, number] = [-162, 16];
const CVP_PLINTH: k.Plan = { x: -176, y: 2, w: 28, d: 28, r: 4 };
const CVP_Z0 = 18;
const CVP_Z1 = 102;
const CVP_R = 11;

const LA_XY: [number, number] = [-118, 16];
const LA_Z = 66;

const UP = (o: k.Point3): G.Frame => G.frameOf(o, [0, 0, 1], [1, 0, 0], [0, 1, 0]);

export const RIG_PROJECTION: k.Projection = k.fitProjection(
  [
    ...k.boxCorners(BASE, -BASE_H - FOOT_H, 0),
    [HEART_XY[0], HEART_XY[1], 134],
    [DOME_XY[0], DOME_XY[1], DOME_Z1 + 14],
    [CVP_XY[0], CVP_XY[1], CVP_Z1 + 12],
    [SVR_XY[0], SVR_XY[1], 72],
    [GAUGE_XY[0] + GAUGE_R, GAUGE_XY[1] + GAUGE_R, GAUGE_Z + 12],
  ],
  RIG_VIEW_W,
  RIG_VIEW_H,
  { pad: 34, azimuth: RIG_AZIMUTH, elevation: RIG_ELEVATION },
);

const P = RIG_PROJECTION;
const at = (pt: k.Point3) => k.iso(pt, P);
const S = (paths: k.SolidPaths, style?: k.SolidStyle) => k.solidSvg(paths, style);
const Ln = (d: string, style?: k.LineStyle) => k.lineSvg(d, style);
const Dots = (pts: Array<k.Flat | [number, number, number]>, style?: { size?: number; tone?: k.Tone; pulse?: boolean }) =>
  k.dotsSvg(pts, style);
const slab = (plan: k.Plan, z: number, h: number, steps = 4, bevel = 0.5) =>
  k.slabOf(plan, z, h, P, steps, bevel);

function lvOuterRadius(zLocal: number): number {
  const u = Math.max(0, Math.min(1, zLocal / (HEART_ANNULUS_Z - HEART_CRADLE_Z)));
  const apex = 11 + 22 * Math.sin(Math.pow(u, 0.62) * Math.PI * 0.86);
  return Math.max(10, apex - 2.5 * Math.pow(u, 2.2));
}

function verticalSideTicks(
  cx: number,
  cy: number,
  radius: number,
  angleDeg: number,
  zFrom: number,
  zTo: number,
  step: number,
  every: number,
  lengths: [number, number],
): k.Ticks {
  const rad = (angleDeg * Math.PI) / 180;
  const nx = Math.cos(rad);
  const ny = Math.sin(rad);
  const tx = -ny;
  const ty = nx;
  const minor: string[] = [];
  const major: string[] = [];
  let idx = 0;
  for (let z = zFrom; z <= zTo + 1e-6; z += step, idx++) {
    const big = idx % every === 0;
    const len = big ? lengths[1] : lengths[0];
    const pA: k.Point3 = [cx + radius * nx, cy + radius * ny, z];
    const pB: k.Point3 = [cx + radius * nx + tx * len, cy + radius * ny + ty * len, z];
    (big ? major : minor).push(k.segment(pA, pB, P));
  }
  return { minor: minor.join(''), major: major.join('') };
}

function buildLvCutawayShell(scaleXY = 1, scaleZ = 1): {
  backBody: string;
  cavityRecess: string;
  cutRimWalls: string;
  outerLines: string;
  papillary: string;
  chordae: string;
} {
  const [hx, hy] = HEART_XY;
  const zBase = HEART_CRADLE_Z;
  const hTotal = (HEART_ANNULUS_Z - HEART_CRADLE_Z) * scaleZ;
  const zTop = zBase + hTotal;

  const backProfile: G.MeridianPoint[] = [];
  const segs = 12;
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const zOff = u * hTotal;
    const r = lvOuterRadius(u * (HEART_ANNULUS_Z - HEART_CRADLE_Z)) * scaleXY;
    backProfile.push([zOff, r, 1]);
  }
  const lvFrame = UP([hx, hy, zBase]);
  const shellPaths = G.solidOf(backProfile, lvFrame, P, { steps: 28, smooth: true });

  const thA = (-38 * Math.PI) / 180;
  const thB = (88 * Math.PI) / 180;
  const wallThick = 5.4 * scaleXY;

  const rimLeftOuter: k.Flat[] = [];
  const rimLeftInner: k.Flat[] = [];
  const rimRightOuter: k.Flat[] = [];
  const rimRightInner: k.Flat[] = [];
  const cavityTopArc: k.Flat[] = [];
  const cavityBotArc: k.Flat[] = [];

  const vSteps = 10;
  for (let i = 0; i <= vSteps; i++) {
    const u = 0.14 + (i / vSteps) * 0.78;
    const z = zBase + u * hTotal;
    const rOut = lvOuterRadius(u * (HEART_ANNULUS_Z - HEART_CRADLE_Z)) * scaleXY;
    const rIn = Math.max(4.5, rOut - wallThick);

    rimLeftOuter.push(at([hx + rOut * Math.cos(thB), hy + rOut * Math.sin(thB), z]));
    rimLeftInner.push(at([hx + rIn * Math.cos(thB), hy + rIn * Math.sin(thB), z]));
    rimRightOuter.push(at([hx + rOut * Math.cos(thA), hy + rOut * Math.sin(thA), z]));
    rimRightInner.push(at([hx + rIn * Math.cos(thA), hy + rIn * Math.sin(thA), z]));
  }

  const uTop = 0.92;
  const zCavTop = zBase + uTop * hTotal;
  const rInTop = Math.max(5, lvOuterRadius(uTop * (HEART_ANNULUS_Z - HEART_CRADLE_Z)) * scaleXY - wallThick);
  const uBot = 0.14;
  const zCavBot = zBase + uBot * hTotal;
  const rInBot = Math.max(4.5, lvOuterRadius(uBot * (HEART_ANNULUS_Z - HEART_CRADLE_Z)) * scaleXY - wallThick);

  const arcSteps = 10;
  for (let j = 0; j <= arcSteps; j++) {
    const th = thA + (j / arcSteps) * (thB - thA);
    cavityTopArc.push(at([hx + rInTop * Math.cos(th), hy + rInTop * Math.sin(th), zCavTop]));
    cavityBotArc.push(at([hx + rInBot * Math.cos(th), hy + rInBot * Math.sin(th), zCavBot]));
  }

  const cavityPoly = [
    ...rimRightInner,
    ...cavityTopArc.slice(1, -1),
    ...[...rimLeftInner].reverse(),
    ...[...cavityBotArc].reverse().slice(1, -1),
  ];
  const cavityD = k.pathOf(cavityPoly, true);

  const leftWallPoly = [...rimLeftOuter, ...[...rimLeftInner].reverse()];
  const rightWallPoly = [...rimRightOuter, ...[...rimRightInner].reverse()];
  const topLipPoly = [
    rimRightOuter[rimRightOuter.length - 1]!,
    rimLeftOuter[rimLeftOuter.length - 1]!,
    rimLeftInner[rimLeftInner.length - 1]!,
    rimRightInner[rimRightInner.length - 1]!,
  ];

  const pap1 = G.solidOf(
    [
      [0, 3.6, 1],
      [14, 1.8, 1],
      [18, 0.4, 1],
    ],
    UP([hx - 5, hy + 8, zCavBot + 1]),
    P,
    { steps: 12, smooth: true },
  );
  const pap2 = G.solidOf(
    [
      [0, 3.2, 1],
      [13, 1.6, 1],
      [17, 0.4, 1],
    ],
    UP([hx + 8, hy - 2, zCavBot + 2]),
    P,
    { steps: 12, smooth: true },
  );

  const pap1Tip = at([hx - 5, hy + 8, zCavBot + 18]);
  const pap2Tip = at([hx + 8, hy - 2, zCavBot + 17]);
  const mitralAntTarget = at([hx - 10, hy + 2, zTop - 10]);
  const mitralPostTarget = at([hx + 2, hy - 1, zTop - 10]);
  const chordaeD = [
    k.pathOf([pap1Tip, mitralAntTarget]),
    k.pathOf([pap1Tip, at([hx - 5, hy + 1, zTop - 11])]),
    k.pathOf([pap2Tip, mitralPostTarget]),
    k.pathOf([pap2Tip, at([hx - 2, hy + 1, zTop - 11])]),
  ].join('');

  const ribArcs = [0.32, 0.52, 0.72]
    .map((u) => {
      const z = zBase + u * hTotal;
      const r = lvOuterRadius(u * (HEART_ANNULUS_Z - HEART_CRADLE_Z)) * scaleXY;
      const pts: k.Flat[] = [];
      for (let j = 0; j <= 10; j++) {
        const th = thB + (j / 10) * (Math.PI * 1.15);
        pts.push(at([hx + r * Math.cos(th), hy + r * Math.sin(th), z]));
      }
      return k.pathOf(pts);
    })
    .join('');

  return {
    backBody: S(shellPaths, {
      tone: 'hi',
      inner: Ln(ribArcs, { tone: 'faint' }),
    }),
    cavityRecess: `<g class="iso-cavity"><path class="iso-fill" d="${cavityD}"/><path class="iso-shade" data-shade="0" d="${cavityD}"/><path class="iso-line" data-tone="mid" d="${cavityD}"/></g>`,
    cutRimWalls:
      `<path class="iso-shade" data-shade="2" d="${k.pathOf(leftWallPoly, true)}"/>` +
      `<path class="iso-shade" data-shade="1" d="${k.pathOf(rightWallPoly, true)}"/>` +
      `<path class="iso-top" d="${k.pathOf(topLipPoly, true)}"/>` +
      Ln(k.pathOf(leftWallPoly, true) + k.pathOf(rightWallPoly, true) + k.pathOf(topLipPoly, true), { tone: 'hi' }),
    outerLines: Ln(k.pathOf(rimLeftOuter) + k.pathOf(rimRightOuter), { tone: 'hi' }),
    papillary: `<g class="iso-cavity">${S(pap1, { tone: 'lo', crease: 'none' }) + S(pap2, { tone: 'lo', crease: 'none' })}</g>`,
    chordae: Ln(chordaeD, { tone: 'mid' }) + Dots([pap1Tip, pap2Tip], { size: 0.65, tone: 'mid' }),
  };
}

export function buildLvDynamicPaths(
  lvVolumeMl: number,
  mitralOpen = 0.4,
): {
  shellSvg: string;
  frontOverlaySvg: string;
  cavitySvg: string;
  fluidFallbackSvg: string;
} {
  const volRatio = Math.max(0.55, Math.min(1.32, lvVolumeMl / 120));
  const scaleXY = 0.88 + (Math.pow(volRatio, 0.36) - 0.88) * 0.55;
  const scaleZ = 0.94 + (Math.pow(volRatio, 0.18) - 0.94) * 0.4;
  const lv = buildLvCutawayShell(scaleXY, scaleZ);

  const [hx, hy] = HEART_XY;
  const fillFrac = Math.max(0.18, Math.min(0.92, (lvVolumeMl - 30) / 145));
  const zBot = HEART_CRADLE_Z + 12;
  const zTop = zBot + fillFrac * 44 * scaleZ;
  const fluidPts: k.Flat[] = [
    at([hx + 12 * scaleXY, hy - 8 * scaleXY, zBot]),
    at([hx + 14 * scaleXY, hy + 10 * scaleXY, zBot]),
    at([hx + 2 * scaleXY, hy + 18 * scaleXY, zBot]),
    at([hx + 2 * scaleXY, hy + 18 * scaleXY, zTop]),
    at([hx + 14 * scaleXY, hy + 10 * scaleXY, zTop]),
    at([hx + 12 * scaleXY, hy - 8 * scaleXY, zTop]),
  ];
  const fluidFallbackSvg = `<path class="iso-fallback-art" d="${k.pathOf(fluidPts, true)}" />`;
  const { mitralD } = buildValveLeafletPaths(mitralOpen, 0);
  const frontOverlaySvg =
    lv.papillary +
    lv.chordae +
    `<g data-dyn="mitral-valve">${Ln(mitralD, { tone: 'lit' })}</g>` +
    lv.cutRimWalls +
    lv.outerLines;

  return {
    shellSvg:
      lv.backBody +
      `<g data-piece="lv-edv" data-dyn="lv-cavity">${lv.cavityRecess}<g data-dyn="lv-fluid-fallback">${fluidFallbackSvg}</g>${lv.papillary}${lv.chordae}<g data-dyn="mitral-valve">${Ln(mitralD, { tone: 'lit' })}</g></g>` +
      lv.cutRimWalls +
      lv.outerLines,
    frontOverlaySvg,
    cavitySvg: lv.cavityRecess + lv.papillary + lv.chordae,
    fluidFallbackSvg,
  };
}

export function buildValveLeafletPaths(mitralOpen: number, aorticOpen: number): {
  mitralD: string;
  aorticD: string;
} {
  const [hx, hy] = HEART_XY;
  const mAngle = mitralOpen * 0.65;
  const mZ = HEART_ANNULUS_Z - 4;
  const mLeft = at([hx - 14, hy + 4, mZ]);
  const mTipL = at([hx - 10 + Math.sin(mAngle) * 5, hy + 3, mZ - 9 * Math.cos(mAngle)]);
  const mRight = at([hx - 2, hy + 2, mZ]);
  const mTipR = at([hx - 6 - Math.sin(mAngle) * 5, hy + 2, mZ - 9 * Math.cos(mAngle)]);
  const mitralD = k.pathOf([mLeft, mTipL]) + k.pathOf([mRight, mTipR]);

  const aAngle = aorticOpen * 0.72;
  const aZ = HEART_ANNULUS_Z + 6.2;
  const aLeft = at([hx + 6, hy - 6, aZ]);
  const aTipL = at([hx + 9 - Math.sin(aAngle) * 3.5, hy - 5, aZ + 5 * Math.cos(aAngle)]);
  const aRight = at([hx + 14, hy - 3, aZ]);
  const aTipR = at([hx + 11 + Math.sin(aAngle) * 3.5, hy - 4, aZ + 5 * Math.cos(aAngle)]);
  const aorticD = k.pathOf([aLeft, aTipL]) + k.pathOf([aRight, aTipR]);

  return { mitralD, aorticD };
}

export function buildDialNeedlePath(mapMmHg: number): string {
  const [gx, gy] = GAUGE_XY;
  const zFace = GAUGE_Z + 9.2;
  const clamped = Math.max(20, Math.min(180, mapMmHg));
  const frac = (clamped - 20) / 160;
  const angle = (-130 + frac * 260) * (Math.PI / 180);
  const rTip = GAUGE_R * 0.68;
  const rTail = GAUGE_R * 0.2;
  const pTail: k.Point3 = [gx - Math.cos(angle) * rTail, gy - Math.sin(angle) * rTail, zFace];
  const pTip: k.Point3 = [gx + Math.cos(angle) * rTip, gy + Math.sin(angle) * rTip, zFace];
  return k.pathOf([at(pTail), at(pTip)]);
}

export function buildSvrValveDynamicPaths(effectiveSvr: number): {
  stemSvg: string;
  knobSvg: string;
} {
  const openFrac = Math.max(0, Math.min(1, (30 - effectiveSvr) / 25));
  const lift = openFrac * 11;
  const [sx, sy] = SVR_XY;
  const zStemBase = SVR_BASE_Z + 22;
  const zKnob = zStemBase + 7 + lift;

  const stemPaths = k.cylinder(sx, sy, 2.2, zStemBase, 7 + lift, P, 16);
  const knobPaths = k.cylinder(sx, sy, 10.5, zKnob, 5.2, P, 28, 0.7);
  const knurlLines = k.knurl(sx, sy, 10.5, zKnob, zKnob + 5.2, 26, P, 0.35);
  const topCap = k.ring(sx, sy, 4.2, zKnob + 5.2, P, 16);

  return {
    stemSvg: S(stemPaths, { tone: 'hi', crease: 'none' }),
    knobSvg:
      S(knobPaths, {
        tone: 'hi',
        inner: Ln(knurlLines, { tone: 'lo' }),
      }) +
      Ln(topCap, { tone: 'mid' }) +
      Dots([at([sx, sy, zKnob + 5.2])], { size: 0.7, tone: 'hi' }),
  };
}

export function buildFallbackFluidPaths(cvpMmHg: number, aorticPressureMmHg: number): {
  cvpSvg: string;
  domeSvg: string;
} {
  const cvpFrac = Math.max(0.06, Math.min(0.92, cvpMmHg / 30));
  const zCvpTop = CVP_Z0 + 4 + cvpFrac * (CVP_Z1 - CVP_Z0 - 12);
  const cvpCol = k.cylinder(CVP_XY[0], CVP_XY[1], CVP_R - 2.2, CVP_Z0 + 2, zCvpTop - (CVP_Z0 + 2), P, 20);
  const cvpSvg = `<g class="iso-fallback-blue"><path class="iso-fallback-fill" d="${cvpCol.fill}"/><path class="iso-line" data-tone="blue" d="${k.ring(CVP_XY[0], CVP_XY[1], CVP_R - 2.2, zCvpTop, P, 20)}"/></g>`;

  const paFrac = Math.max(0.14, Math.min(0.88, (aorticPressureMmHg - 25) / 140));
  const zDomeTop = DOME_Z0 + 4 + paFrac * 44;
  const domeCol = k.cylinder(DOME_XY[0], DOME_XY[1], DOME_R - 2.5, DOME_Z0 + 2, zDomeTop - (DOME_Z0 + 2), P, 24);
  const domeSvg = `<g class="iso-fallback-art"><path class="iso-fallback-fill" d="${domeCol.fill}"/><path class="iso-line" data-tone="red" d="${k.ring(DOME_XY[0], DOME_XY[1], DOME_R - 2.5, zDomeTop, P, 24)}"/></g>`;

  return { cvpSvg, domeSvg };
}

function buildDialHousingStatic(needleSvg: string): string {
  const [gx, gy] = GAUGE_XY;
  const gaugeBody = k.cylinder(gx, gy, GAUGE_R, GAUGE_Z, 9, P, 32, 0.8);
  const gaugeTicks = k.radialTicks(gx, gy, GAUGE_R - 2.5, 24, 4, GAUGE_Z + 9, [2.2, 4.2], P);
  const critAng = (-130 + ((65 - 20) / 160) * 260) * (Math.PI / 180);
  const critLine = k.lineOnTop(
    [gx + Math.cos(critAng) * (GAUGE_R - 7.5), gy + Math.sin(critAng) * (GAUGE_R - 7.5)],
    [gx + Math.cos(critAng) * (GAUGE_R - 2), gy + Math.sin(critAng) * (GAUGE_R - 2)],
    GAUGE_Z + 9.05,
    P,
  );
  const gaugeLabel = k.faceTextSvg(k.topMatrix([gx, gy + 7], GAUGE_Z + 9, P, 'x'), 'MAP', {
    size: 3.3,
    tone: 'mid',
    anchor: 'middle',
  });
  return (
    S(gaugeBody, { tone: 'hi' }) +
    Ln(gaugeTicks.minor, { tone: 'lo' }) +
    Ln(gaugeTicks.major, { tone: 'mid' }) +
    Ln(critLine, { tone: 'red' }) +
    gaugeLabel +
    `<g data-dyn="dial-needle">${needleSvg}</g>` +
    Dots([at([gx, gy, GAUGE_Z + 9.25])], { size: 0.9, tone: 'hi' })
  );
}

export function createRigScene(): RigStaticScene {
  const R = A.recorder(P, { order: [], spring: {} });
  const { nameFor } = R;
  const record = R.solid;

  const collected: RigItem[] = [];

  const put = (
    piece: RigFocusGroup,
    ref: k.Point3,
    svg: string,
    opts: {
      bias?: number;
      shapes?: A.AuditShape[];
      name?: string;
      route?: string;
      chunk?: number;
      hasDynamic?: boolean;
      skipRecord?: boolean;
    } = {},
  ) => {
    const id = opts.name ?? nameFor(`${piece}.item`);
    const shapes = opts.shapes ?? [];
    if (!opts.skipRecord) {
      for (const s of shapes) {
        if (s.kind !== 'tube') {
          if (!s.name) s.name = id;
          record(s);
        }
      }
    }
    R.put({
      piece,
      at: ref,
      bias: opts.bias ?? 0,
      svg,
      shapes,
      name: id,
      route: opts.route,
      chunk: opts.chunk,
    });
    collected.push({
      id,
      piece,
      key: 0,
      svg,
      hasDynamic: opts.hasDynamic,
    });
  };

  const addTube = (
    piece: RigFocusGroup,
    route: k.Point3[],
    r: number,
    opts: {
      name?: string;
      tone?: k.Tone;
      breaks?: number[];
      gaps?: Array<[number, number]>;
      caps?: boolean | [boolean, boolean];
      rings?: { pitch?: number; twist?: number; cross?: boolean; fade?: [number, number]; tone?: k.Tone } | null;
      touch?: string[];
      bias?: number;
      limp?: boolean;
      free?: [boolean, boolean];
      ends?: [boolean, boolean];
    } = {},
  ) => {
    const id = nameFor(opts.name ?? `${piece}.tube`);
    R.route(id, route, r, {
      owner: id,
      piece,
      gaps: opts.gaps ?? [],
      touch: opts.touch ?? [],
      limp: opts.limp ?? false,
      free: opts.free ?? [false, false],
      ends: opts.ends ?? [true, true],
    });
    const parts = tubePieces(route, r, P, {
      maxLength: 32,
      spacing: 2.2,
      breaks: opts.breaks ?? [],
      gaps: opts.gaps ?? [],
      caps: opts.caps ?? true,
      rings: opts.rings ?? null,
    });
    parts.forEach((part, idx) => {
      put(piece, part.mid, tubeSvg(part, { tone: opts.tone ?? 'hi' }), {
        name: `${id}.${idx}`,
        route: id,
        chunk: idx,
        bias: opts.bias ?? 0,
        skipRecord: true,
        shapes: [A.tube(part.points, r, { ground: false })],
      });
    });
  };

  // ─── 1. BENCHTOP BASEPLATE, ISOLATION FEET, RULER & ENGRAVED SPEC PLATE ───
  const haloPath = k.haloOf(BASE, -BASE_H - FOOT_H, BASE_H, P);

  const feetCorners = k
    .corners(BASE, 20)
    .sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
  feetCorners.forEach(([fx, fy], idx) => {
    const pad = k.cylinder(fx, fy, 8.2, -BASE_H - FOOT_H, 2.2, P, 24);
    const col = k.cylinder(fx, fy, 6.0, -BASE_H - FOOT_H + 2.2, FOOT_H - 2.2, P, 24);
    put('stand', [fx, fy, -BASE_H - FOOT_H * 0.5], S(pad, { tone: 'lo' }) + S(col, { tone: 'mid' }), {
      name: `stand.foot.${idx}`,
      shapes: [A.cylinder(fx, fy, 8.2, -BASE_H - FOOT_H, FOOT_H, { ground: true })],
    });
  });

  const baseSlab = slab(BASE, -BASE_H, BASE_H, 6, 1.4);
  const baseGroove = Ln(k.planOutline(k.insetPlan(BASE, 5.5), 0, P, 6), { tone: 'lo' });
  const boltPts = k.corners(BASE, 11);
  const boltRings = Ln(boltPts.map(([bx, by]) => k.ring(bx, by, 2.3, 0, P, 14)).join(''), { tone: 'lo' });
  const boltDots = Dots(boltPts.map(([bx, by]) => at([bx, by, 0])), { size: 0.5, tone: 'mid' });

  const rulerPlan: k.Plan = { x: -138, y: 71, w: 204, d: 8, r: 1.2 };
  const rulerSlab = S(slab(rulerPlan, 0, 0.8, 3, 0), { tone: 'lo', crease: 'none' });
  const rulerTicks = k.topTicks(rulerPlan.x + 5, rulerPlan.x + rulerPlan.w - 5, 4, 5, rulerPlan.y + 1, 0.8, [2.2, 4.2], P);
  const rulerSvg =
    rulerSlab +
    Ln(rulerTicks.minor, { tone: 'lo' }) +
    Ln(rulerTicks.major, { tone: 'mid' }) +
    Dots([at([rulerPlan.x + 2.5, rulerPlan.y + 4, 0.8]), at([rulerPlan.x + rulerPlan.w - 2.5, rulerPlan.y + 4, 0.8])], {
      size: 0.45,
    });

  const badgePlan: k.Plan = { x: 88, y: 66, w: 62, d: 13, r: 1.5 };
  const badgeSvg =
    S(slab(badgePlan, 0, 0.8, 3, 0), { tone: 'lo', crease: 'none' }) +
    k.faceTextSvg(k.topMatrix([badgePlan.x + 31, badgePlan.y + 6.8], 0.8, P, 'x'), 'WINDKESSEL · I', {
      size: 3.1,
      tone: 'mid',
      anchor: 'middle',
    });

  put(
    'stand',
    [0, 0, -BASE_H * 0.5],
    S(baseSlab, { tone: 'mid' }) + baseGroove + boltRings + boltDots + rulerSvg + badgeSvg,
    {
      name: 'stand.baseplate',
      bias: -10,
      shapes: [A.slab(BASE, -BASE_H, BASE_H, { ground: true })],
    },
  );

  put(
    'arterioles-svr',
    [PERFUSION_TRAY.x + PERFUSION_TRAY.w * 0.5, PERFUSION_TRAY.y + PERFUSION_TRAY.d * 0.5, 2],
    S(slab(PERFUSION_TRAY, 0, 4, 3, 0.4), { tone: 'lo' }) +
      Ln(k.planOutline(k.insetPlan(PERFUSION_TRAY, 3), 4, P, 3), { tone: 'faint' }),
    {
      name: 'arterioles.tray',
      shapes: [A.slab(PERFUSION_TRAY, 0, 4, { ground: true })],
    },
  );

  // ─── 2. LEFT VENTRICULAR CUTAWAY HEART-PUMP (myocardium-lvef & lv-edv) ──
  const [hx, hy] = HEART_XY;
  const cradleBase = G.solidOf(
    [
      [0, 36],
      [4.5, 36],
      [4.5, 31],
      [11, 28],
      [HEART_CRADLE_Z, 19],
    ],
    UP([hx, hy, 0]),
    P,
    { steps: 28 },
  );
  const cradleBolts = Dots(G.dotsOf(UP([hx, hy, 0]), 4.5, 33.5, 8, P, { all: true }), {
    size: 0.55,
    tone: 'mid',
  });
  put('myocardium-lvef', [hx, hy, 7], S(cradleBase, { tone: 'mid' }) + cradleBolts, {
    name: 'heart.cradle',
    shapes: [
      A.solid(
        UP([hx, hy, 0]),
        [
          [0, 36],
          [4.5, 36],
          [4.5, 31],
          [11, 28],
          [HEART_CRADLE_Z, 19],
        ],
        { ground: true },
      ),
    ],
  });

  const lvInit = buildLvDynamicPaths(120, 0.4);
  const lvProfile: A.MeridianPoint[] = Array.from({ length: 13 }, (_, i) => {
    const u = i / 12;
    return [u * (HEART_ANNULUS_Z - HEART_CRADLE_Z), lvOuterRadius(u * (HEART_ANNULUS_Z - HEART_CRADLE_Z))];
  });
  put('myocardium-lvef', [hx, hy, 52], `<g data-dyn="lv-shell">${lvInit.shellSvg}</g>`, {
    name: 'heart.lv.shell',
    hasDynamic: true,
    bias: 0.1,
    shapes: [A.solid(UP([hx, hy, HEART_CRADLE_Z]), lvProfile, { ground: false })],
  });

  const annulusFlange = G.disc(0, 6, 27, UP([hx, hy, HEART_ANNULUS_Z]), P, 28);
  const annulusBolts = Dots(G.dotsOf(UP([hx, hy, HEART_ANNULUS_Z]), 6, 23, 8, P, { all: true }), {
    size: 0.5,
    tone: 'mid',
  });
  const valvesInit = buildValveLeafletPaths(0.4, 0.2);
  put(
    'myocardium-lvef',
    [hx, hy, HEART_ANNULUS_Z + 3],
    S(annulusFlange, { tone: 'hi' }) +
      annulusBolts +
      `<g data-piece="aorta-map" data-dyn="aortic-valve">${Ln(valvesInit.aorticD, { tone: 'lit' })}</g>`,
    {
      name: 'heart.annulus',
      hasDynamic: true,
      shapes: [A.disc(UP([hx, hy, HEART_ANNULUS_Z]), 0, 6, 27)],
    },
  );

  // Epicardial Coronary Artery riding intact anterior-left wall (th = 96 deg, just past +88 deg cutaway lip)
  const corTh = (96 * Math.PI) / 180;
  const corCx = Math.cos(corTh);
  const corCy = Math.sin(corTh);
  const corPt = (r: number, z: number): k.Point3 => [hx + r * corCx, hy + r * corCy, z];
  const coronaryRoute = G.fillet(
    [
      corPt(23.0, HEART_ANNULUS_Z),
      corPt(23.0, 81),
      corPt(28.8, 68),
      corPt(33.4, 52),
      corPt(33.4, 36),
      corPt(33.5, 13),
      corPt(33.5, 4.5),
    ],
    5.5,
    5,
  );
  addTube('myocardium-lvef', coronaryRoute, 1.35, {
    name: 'heart.coronary',
    tone: 'mid',
    caps: [true, true],
    touch: ['heart.annulus', 'heart.cradle', 'heart.lv.shell'],
    bias: 6,
  });

  // ─── 3. AORTIC ARCH, WINDKESSEL DOME & ANALOG MAP DIAL GAUGE (aorta-map) ─
  const [dx, dy] = DOME_XY;
  const domePedestal = G.solidOf(
    [
      [0, 29],
      [5, 29],
      [5, 25],
      [DOME_Z0, 25],
    ],
    UP([dx, dy, 0]),
    P,
    { steps: 28 },
  );
  const domeBolts = Dots(G.dotsOf(UP([dx, dy, 0]), 5, 26.8, 8, P, { all: true }), {
    size: 0.5,
    tone: 'mid',
  });
  // Tall outlet flange (z: 2..18, d: 18) so r=5.2 feed pipe rim lands strictly inside flat face
  const domeOutletFlange: k.Plan = { x: dx + 25, y: dy - 9, w: 6, d: 18, r: 1 };
  put('aorta-map', [dx, dy, 7], S(domePedestal, { tone: 'mid' }) + domeBolts, {
    name: 'dome.pedestal',
    shapes: [A.cylinder(dx, dy, 25, 0, DOME_Z0, { ground: true })],
  });
  put('aorta-map', [dx + 28, dy, 10], S(slab(domeOutletFlange, 2, 16, 2, 0.3), { tone: 'hi' }), {
    name: 'dome.flange',
    shapes: [A.slab(domeOutletFlange, 2, 16, { ground: false })],
  });

  const fallbackInit = buildFallbackFluidPaths(8, 70);
  const domeProfile: G.MeridianPoint[] = [[DOME_Z0, DOME_R]];
  const domeBodyTop = DOME_Z1 - 18;
  domeProfile.push([domeBodyTop, DOME_R, 1]);
  for (let i = 1; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2);
    domeProfile.push([domeBodyTop + Math.sin(a) * 18, Math.max(4.5, Math.cos(a) * DOME_R), 1]);
  }
  const domeGlass = G.solidOf(domeProfile, UP([dx, dy, 0]), P, { steps: 28, smooth: true });
  const domeTicks = verticalSideTicks(dx, dy, DOME_R, 45, DOME_Z0 + 8, domeBodyTop - 6, 4, 4, [2.2, 4.2]);
  const domeTopCap = G.disc(DOME_Z1, DOME_Z1 + 5, 9.5, UP([dx, dy, 0]), P, 20);
  const domeGlassSvg =
    `<g class="iso-glass">${Ln(domeGlass.outline + domeGlass.crease, { tone: 'mid' })}</g>` +
    Ln(domeTicks.minor, { tone: 'faint' }) +
    Ln(domeTicks.major, { tone: 'lo' }) +
    S(domeTopCap, { tone: 'hi' });
  put(
    'aorta-map',
    [dx, dy, (DOME_Z0 + DOME_Z1) * 0.5],
    `<g data-dyn="dome-fluid-fallback">${fallbackInit.domeSvg}</g>` + domeGlassSvg,
    {
      name: 'dome.housing',
      hasDynamic: true,
      bias: 0.4,
      shapes: [A.cylinder(dx, dy, DOME_R, DOME_Z0, DOME_Z1 + 5 - DOME_Z0)],
    },
  );

  // Ascending Aortic Arch Pipe with vertical tangents and level crest plateau for supra-aortic branches
  const arterialArchRoute = G.fillet(
    [
      [hx + 10, hy - 4, HEART_ANNULUS_Z + 6],
      [hx + 10, hy - 4, 114],
      [-40, -22, 128],
      [-2, -22, 128],
      [dx, dy, 114],
      [dx, dy, DOME_Z1 + 5],
    ],
    14,
    7,
    { P, tube: 7 },
  );
  addTube('aorta-map', arterialArchRoute, 7.0, {
    name: 'aorta.arch',
    tone: 'hi',
    touch: ['heart.annulus', 'dome.housing', 'aorta.branch.0', 'aorta.branch.1', 'aorta.branch.2'],
    rings: { pitch: 8, fade: [0.08, 0.45], tone: 'faint' },
  });

  // 3 Supra-Aortic Branch Risers seated cleanly on the level arch crest (z = 128, r_arch = 7.0)
  const archBranchAnchors: k.Point3[] = [
    [-29, -22, 128],
    [-19, -22, 128],
    [-9, -22, 128],
  ];
  archBranchAnchors.forEach(([bx, by, bz], idx) => {
    const stub = G.disc(6.9, 14.5, 3.0, UP([bx, by, bz]), P, 16);
    const cap = G.disc(14.5, 17, 4.2, UP([bx, by, bz]), P, 16);
    put('aorta-map', [bx, by, bz + 12], S(stub, { tone: 'mid' }) + S(cap, { tone: 'hi' }), {
      name: `aorta.branch.${idx}`,
      bias: 12,
      shapes: [A.disc(UP([bx, by, bz]), 6.9, 17, 4.2)],
    });
  });

  const [gx, gy] = GAUGE_XY;
  const gaugePost = k.cylinder(gx, gy, 4.5, 0, GAUGE_Z, P, 20);
  const gaugeFoot = k.cylinder(gx, gy, 8.5, 0, 3.5, P, 20);
  put('aorta-map', [gx, gy, GAUGE_Z * 0.5], S(gaugeFoot, { tone: 'mid' }) + S(gaugePost, { tone: 'mid', crease: 'none' }), {
    name: 'gauge.post',
    shapes: [A.cylinder(gx, gy, 8.5, 0, GAUGE_Z, { ground: true })],
  });

  const portF = G.frameOf([gx, gy - GAUGE_R, GAUGE_Z + 4.5], [0, -1, 0], [1, 0, 0], [0, 0, 1]);
  const gaugePort = G.disc(0, 4, 2.8, portF, P, 14);
  put('aorta-map', [gx, gy - GAUGE_R - 2, GAUGE_Z + 4.5], S(gaugePort, { tone: 'mid' }), {
    name: 'gauge.port',
    shapes: [A.disc(portF, 0, 4, 2.8)],
  });

  put(
    'aorta-map',
    [gx, gy, GAUGE_Z + 4.5],
    buildDialHousingStatic(Ln(buildDialNeedlePath(70), { tone: 'red' })),
    {
      name: 'gauge.housing',
      hasDynamic: true,
      shapes: [A.cylinder(gx, gy, GAUGE_R, GAUGE_Z, 9)],
    },
  );

  // Sense capillary tapping dome.pedestal (+y face at y=1) cleanly forward & up to gauge.port
  const senseRoute = G.fillet(
    [
      [dx, dy + 25, 8],
      [dx, 15, 8],
      [dx, 15, GAUGE_Z + 4.5],
      [gx, gy - GAUGE_R - 4, GAUGE_Z + 4.5],
    ],
    6.4,
    7,
    { P, tube: 1.5 },
  );
  addTube('aorta-map', senseRoute, 1.5, {
    name: 'aorta.sense',
    tone: 'lo',
    touch: ['dome.pedestal', 'gauge.port'],
    bias: 2,
    limp: true,
  });

  // ─── 4. ARTERIOLAR RESISTANCE MANIFOLD & SVR THROTTLE VALVE (arterioles-svr) ─
  put('stand', [54, -8, 2.9], S(slab({ x: 49, y: -14, w: 10, d: 12, r: 1.5 }, 0, 5.8, 3), { tone: 'lo' }), {
    name: 'stand.clamp.art',
    shapes: [A.slab({ x: 49, y: -14, w: 10, d: 12, r: 1.5 }, 0, 5.8, { ground: true })],
  });

  const arterialFeedRoute = G.fillet(
    [
      [dx + 31, dy, 11],
      [dx + 37, dy, 11],
      [56, -8, 11],
      [SVR_MANIFOLD.x - 6, SVR_XY[1], 11],
      [SVR_MANIFOLD.x, SVR_XY[1], 11],
    ],
    13,
    7,
    { P, tube: 5.2 },
  );
  addTube('aorta-map', arterialFeedRoute, 5.2, {
    name: 'aorta.feed',
    tone: 'hi',
    touch: ['dome.flange', 'stand.clamp.art', 'svr.manifold'],
  });

  put(
    'arterioles-svr',
    [SVR_XY[0], SVR_XY[1], 11],
    S(slab(SVR_MANIFOLD, 0, SVR_BASE_Z, 3, 0.6), { tone: 'mid' }) +
      Dots(
        [
          at([SVR_MANIFOLD.x + 4, SVR_MANIFOLD.y + 4, SVR_BASE_Z]),
          at([SVR_MANIFOLD.x + SVR_MANIFOLD.w - 4, SVR_MANIFOLD.y + SVR_MANIFOLD.d - 4, SVR_BASE_Z]),
        ],
        { size: 0.5 },
      ),
    {
      name: 'svr.manifold',
      shapes: [A.slab(SVR_MANIFOLD, 0, SVR_BASE_Z, { ground: true })],
    },
  );

  const svrBonnet = G.solidOf(
    [
      [0, 10],
      [4, 10],
      [4, 7.5],
      [16, 6.2],
      [22, 4.8],
    ],
    UP([SVR_XY[0], SVR_XY[1], SVR_BASE_Z]),
    P,
    { steps: 22 },
  );
  put('arterioles-svr', [SVR_XY[0], SVR_XY[1], SVR_BASE_Z + 11], S(svrBonnet, { tone: 'mid' }), {
    name: 'svr.bonnet',
    shapes: [A.cylinder(SVR_XY[0], SVR_XY[1], 10, SVR_BASE_Z, 22)],
  });

  const svrInit = buildSvrValveDynamicPaths(12);
  put('arterioles-svr', [SVR_XY[0], SVR_XY[1], SVR_BASE_Z + 26], `<g data-dyn="svr-stem">${svrInit.stemSvg}</g>`, {
    name: 'svr.stem',
    hasDynamic: true,
    bias: 0.2,
    shapes: [A.cylinder(SVR_XY[0], SVR_XY[1], 2.2, SVR_BASE_Z + 22, 13)],
  });
  put('arterioles-svr', [SVR_XY[0], SVR_XY[1], SVR_BASE_Z + 40], `<g data-dyn="svr-knob">${svrInit.knobSvg}</g>`, {
    name: 'svr.knob',
    hasDynamic: true,
    bias: 0.4,
    shapes: [A.cylinder(SVR_XY[0], SVR_XY[1], 10.5, SVR_BASE_Z + 35, 5.2)],
  });

  const capYs = [-8, 1, 10, 19];
  const capillaryRoutes: k.Point3[][] = capYs.map((cy, idx) => {
    const bulge = (idx - 1.5) * 4.5;
    return G.fillet(
      [
        [SVR_MANIFOLD.x + SVR_MANIFOLD.w, cy, 11],
        [SVR_MANIFOLD.x + SVR_MANIFOLD.w + 6, cy, 11],
        [108, cy + bulge * 0.45, 11],
        [124, cy + bulge * 0.45, 11],
        [VEN_MANIFOLD.x - 6, cy, 11],
        [VEN_MANIFOLD.x, cy, 11],
      ],
      6,
      5,
    );
  });
  capillaryRoutes.forEach((route, idx) => {
    addTube('arterioles-svr', route, 2.0, {
      name: `arterioles.cap.${idx}`,
      tone: 'mid',
      touch: ['svr.manifold', 'venous.collector'],
      bias: 1.0,
      limp: true,
    });
  });

  put(
    'venous-cvp',
    [VEN_MANIFOLD.x + VEN_MANIFOLD.w * 0.5, VEN_MANIFOLD.y + VEN_MANIFOLD.d * 0.5, 11],
    S(slab(VEN_MANIFOLD, 0, 22, 3, 0.6), { tone: 'mid' }),
    {
      name: 'venous.collector',
      shapes: [A.slab(VEN_MANIFOLD, 0, 22, { ground: true })],
    },
  );

  // ─── 5. VENOUS RETURN LOOP & GRADUATED CVP STANDPIPE COLUMN (venous-cvp) ─
  [
    { x: 64, y: -74 },
    { x: -34, y: -74 },
  ].forEach((pos, idx) => {
    put(
      'stand',
      [pos.x, pos.y, 2.5],
      S(slab({ x: pos.x - 5, y: pos.y - 6, w: 10, d: 12, r: 1.5 }, 0, 5.0, 3), { tone: 'lo' }),
      {
        name: `stand.clamp.ven.${idx}`,
        shapes: [A.slab({ x: pos.x - 5, y: pos.y - 6, w: 10, d: 12, r: 1.5 }, 0, 5.0, { ground: true })],
      },
    );
  });

  const [cx, cy] = CVP_XY;
  put(
    'venous-cvp',
    [cx, cy, 9],
    S(slab(CVP_PLINTH, 0, CVP_Z0, 3, 0.5), { tone: 'mid' }) +
      Dots(k.corners(CVP_PLINTH, 4).map(([bx, by]) => at([bx, by, CVP_Z0])), { size: 0.45, tone: 'mid' }),
    {
      name: 'cvp.pedestal',
      shapes: [A.slab(CVP_PLINTH, 0, CVP_Z0, { ground: true })],
    },
  );

  // Wide 32-unit arc on the front-left corner so projected radius stays >> 7.04 px pipe radius
  const backCorner = G.fillet(
    [
      [VEN_MANIFOLD.x + 9, VEN_MANIFOLD.y, 10],
      [VEN_MANIFOLD.x + 9, VEN_MANIFOLD.y - 16, 10],
      [145, -52, 10],
      [120, -74, 10],
      [-186, -74, 10],
      [-214, -46, 10],
      [-214, cy - 32, 10],
    ],
    18,
    7,
    { P, tube: 5.0 },
  );
  const frontArc: k.Point3[] = Array.from({ length: 10 }, (_, idx) => {
    const theta = Math.PI - ((idx + 1) / 10) * (Math.PI / 2);
    return [-182 + Math.cos(theta) * 32, cy - 32 + Math.sin(theta) * 32, 10];
  });
  const venousReturnRoute: k.Point3[] = [...backCorner, ...frontArc, [CVP_PLINTH.x, cy, 10]];
  addTube('venous-cvp', venousReturnRoute, 5.0, {
    name: 'venous.return',
    tone: 'mid',
    touch: ['venous.collector', 'stand.clamp.ven.0', 'stand.clamp.ven.1', 'cvp.pedestal'],
  });

  const cvpGlass = k.cylinder(cx, cy, CVP_R, CVP_Z0, CVP_Z1 - CVP_Z0, P, 24);
  const cvpScale = verticalSideTicks(cx, cy, CVP_R, 45, CVP_Z0 + 6, CVP_Z1 - 6, 4, 5, [2, 4]);
  const cvpCap = G.disc(CVP_Z1, CVP_Z1 + 5, CVP_R + 1.5, UP([cx, cy, 0]), P, 24);
  const cvpGlassSvg =
    `<g class="iso-glass">${Ln(cvpGlass.outline + cvpGlass.crease, { tone: 'mid' })}</g>` +
    Ln(cvpScale.minor, { tone: 'faint' }) +
    Ln(cvpScale.major, { tone: 'lo' }) +
    S(cvpCap, { tone: 'hi' });
  put(
    'venous-cvp',
    [cx, cy, (CVP_Z0 + CVP_Z1) * 0.5],
    `<g data-dyn="cvp-fluid-fallback">${fallbackInit.cvpSvg}</g>` + cvpGlassSvg,
    {
      name: 'cvp.column',
      hasDynamic: true,
      bias: 0.4,
      shapes: [A.cylinder(cx, cy, CVP_R, CVP_Z0, CVP_Z1 + 5 - CVP_Z0)],
    },
  );

  // Left Atrial Cutaway Receiving Chamber with cylindrical center band for flush PV mounts
  const laCup = G.solidOf(
    [
      [0, 8],
      [6, 16.5],
      [20, 16.5],
      [24, 12],
    ],
    UP([LA_XY[0], LA_XY[1], LA_Z - 12]),
    P,
    { steps: 24, smooth: true },
  );
  put('venous-cvp', [LA_XY[0], LA_XY[1], LA_Z], S(laCup, { tone: 'mid' }), {
    name: 'venous.atrium',
    shapes: [
      A.solid(
        UP([LA_XY[0], LA_XY[1], LA_Z - 12]),
        [
          [0, 8],
          [6, 16.5],
          [20, 16.5],
          [24, 12],
        ],
      ),
    ],
  });

  const laRiserRoute = G.fillet(
    [
      [CVP_PLINTH.x + CVP_PLINTH.w, cy, 9],
      [LA_XY[0], LA_XY[1], 9],
      [LA_XY[0], LA_XY[1], LA_Z - 12],
    ],
    13,
    7,
    { P, tube: 4.4 },
  );
  addTube('venous-cvp', laRiserRoute, 4.4, {
    name: 'venous.riser',
    tone: 'mid',
    touch: ['cvp.pedestal', 'venous.atrium'],
  });

  const laBridgeRoute = G.fillet(
    [
      [LA_XY[0], LA_XY[1], LA_Z + 12],
      [LA_XY[0], LA_XY[1], LA_Z + 22],
      [-98, 17, 108],
      [hx - 12, hy + 2, 108],
      [hx - 12, hy + 2, HEART_ANNULUS_Z + 6],
    ],
    14,
    7,
    { P, tube: 4.4 },
  );
  addTube('venous-cvp', laBridgeRoute, 4.4, {
    name: 'venous.bridge',
    tone: 'mid',
    touch: ['venous.atrium', 'heart.annulus'],
    bias: 1.5,
  });

  [LA_Z + 3, LA_Z - 3].forEach((pz, idx) => {
    const ux = 0.35;
    const uy = Math.sqrt(1 - ux * ux);
    const rad = 16.45;
    const pvRoute: k.Point3[] = [
      [LA_XY[0] + ux * (rad + 10), LA_XY[1] + uy * (rad + 10), pz],
      [LA_XY[0] + ux * rad, LA_XY[1] + uy * rad, pz],
    ];
    addTube('venous-cvp', pvRoute, 1.85, {
      name: `venous.pv.${idx}`,
      tone: 'lo',
      caps: [true, false],
      touch: ['venous.atrium'],
      free: [true, false],
      ends: [false, true],
      bias: 1.5,
      limp: true,
    });
  });

  // ─── 6. SETTLE PAINTER'S ORDER MATHEMATICALLY VIA kit/audit.mjs ──────────
  A.settle(R, P, { states: [0] });
  const keyMap = new Map<string, number>();
  R.items.forEach((item) => {
    if (item.name && typeof item.key === 'number') {
      keyMap.set(item.name, item.key);
    }
  });
  collected.forEach((item) => {
    item.key = keyMap.get(item.id) ?? 0;
  });
  collected.sort((a, b) => a.key - b.key);

  // Strictly unobstructed GL routes (exclude dome interior jump & behind-heart LA bridge)
  const arterialArchGlRoute: k.Point3[] = arterialArchRoute.slice(0);
  const arterialFeedGlRoute: k.Point3[] = arterialFeedRoute.slice(0);
  const venousRoute: k.Point3[] = [
    [VEN_MANIFOLD.x + 9, VEN_MANIFOLD.y, 10],
    ...venousReturnRoute.slice(1),
  ];

  return {
    width: RIG_VIEW_W,
    height: RIG_VIEW_H,
    projection: P,
    glCam: glCamera(P),
    haloPath,
    items: collected,
    arterialArchGlRoute,
    arterialFeedGlRoute,
    venousRoute,
    capillaryRoutes,
    anchors: {
      heartCenter: [hx, hy, 50],
      annulusZ: HEART_ANNULUS_Z,
      domeCenter: DOME_XY,
      domeBottomZ: DOME_Z0,
      domeTopZ: DOME_Z1,
      domeRadius: DOME_R,
      gaugeCenter: GAUGE_XY,
      gaugeDialZ: GAUGE_Z,
      gaugeRadius: GAUGE_R,
      svrCenter: SVR_XY,
      svrBaseZ: SVR_BASE_Z,
      cvpCenter: CVP_XY,
      cvpBottomZ: CVP_Z0,
      cvpTopZ: CVP_Z1,
      cvpRadius: CVP_R,
      perfusionTray: PERFUSION_TRAY,
      perfusionZ: 4,
    },
    overlays: {
      domeGlassSvg,
      cvpGlassSvg,
    },
    auditRecorder: R,
  };
}
