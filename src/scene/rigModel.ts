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
  screen: [number, number];
  svg: string;
  hasDynamic?: boolean;
}

export interface RigStaticScene {
  width: number;
  height: number;
  angleDeg: number;
  projection: k.Projection;
  glCam: GlCamera;
  haloPath: string;
  items: RigItem[];
  pumpKey: number;
  domeKey: number;
  cvpKey: number;
  arterialArchGlRoute: k.Point3[];
  arterialFeedGlRoute: k.Point3[];
  venousRoute: k.Point3[];
  capillaryRoutes: k.Point3[][];
  anchors: {
    heartCenter: k.Point3;
    pumpBoreBottomZ: number;
    pumpBoreTopZ: number;
    pumpHeadZ: number;
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
    pumpGlassSvg: string;
    domeGlassSvg: string;
    cvpGlassSvg: string;
  };
  auditRecorder?: A.AuditRecorder;
}

const BASE: k.Plan = { x: -224, y: -96, w: 392, d: 202, r: 8 };
const BASE_H = 11;
const FOOT_H = 6;
const DECK_CX = BASE.x + BASE.w * 0.5; // -28
const DECK_CY = BASE.y + BASE.d * 0.5; // +5

const HEART_XY: [number, number] = [-66, 16];
const PUMP_CRADLE_Z = 14;
const PUMP_HEAD_Z = 88;
const PUMP_HEAD_TOP_Z = 95;
const PUMP_BORE_Z0 = 29;
const PUMP_BORE_Z1 = 71;
const PUMP_GLASS_R = 21.8;

const DOME_XY: [number, number] = [12, -16];
const DOME_Z0 = 14;
const DOME_Z1 = 84;
const DOME_R = 23;

const GAUGE_XY: [number, number] = [18, 54];
const GAUGE_Z = 44;
const GAUGE_R = 21;

const SVR_MANIFOLD: k.Plan = { x: 74, y: -25, w: 20, d: 50, r: 2.5 };
const SVR_XY: [number, number] = [84, 0];
const SVR_BASE_Z = 22;

const VEN_MANIFOLD: k.Plan = { x: 136, y: -25, w: 18, d: 50, r: 2.5 };
const PERFUSION_TRAY: k.Plan = { x: 96, y: -21, w: 38, d: 42, r: 3 };

const CVP_XY: [number, number] = [-164, 10];
const CVP_PLINTH: k.Plan = { x: -178, y: -8, w: 28, d: 32, r: 4 };
const CVP_Z0 = 18;
const CVP_Z1 = 102;
const CVP_R = 11;

const LA_XY: [number, number] = [-160, 62];
const LA_Z = 82;

const AORTA_PORT_XY: [number, number] = [HEART_XY[0] + 16, HEART_XY[1] - 8];
const INLET_RAD = (153.9 * Math.PI) / 180;
const INLET_DIR: k.Point3 = [Math.cos(INLET_RAD), Math.sin(INLET_RAD), 0];
const INLET_PORT_XYZ: k.Point3 = [
  HEART_XY[0] + INLET_DIR[0] * 27.4,
  HEART_XY[1] + INLET_DIR[1] * 27.4,
  91.5,
];

function archSweep3(
  p0: k.Point3,
  p3: k.Point3,
  crownZ: number,
  lateralBow: number,
  steps = 28,
): k.Point3[] {
  const dx = p3[0] - p0[0];
  const dy = p3[1] - p0[1];
  const hLen = Math.hypot(dx, dy) || 1;
  const nx = -dy / hLen;
  const ny = dx / hLen;
  const p1: k.Point3 = [p0[0], p0[1], crownZ];
  const p2: k.Point3 = [p3[0], p3[1], crownZ];
  const pts: k.Point3[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const w0 = u * u * u;
    const w1 = 3 * u * u * t;
    const w2 = 3 * u * t * t;
    const w3 = t * t * t;
    const bow = lateralBow * Math.pow(Math.sin(Math.PI * t), 2);
    pts.push([
      w0 * p0[0] + w1 * p1[0] + w2 * p2[0] + w3 * p3[0] + nx * bow,
      w0 * p0[1] + w1 * p1[1] + w2 * p2[1] + w3 * p3[1] + ny * bow,
      w0 * p0[2] + w1 * p1[2] + w2 * p2[2] + w3 * p3[2],
    ]);
  }
  return pts;
}

function cubicSweep3(
  p0: k.Point3,
  p1: k.Point3,
  p2: k.Point3,
  p3: k.Point3,
  steps = 18,
): k.Point3[] {
  const pts: k.Point3[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const w0 = u * u * u;
    const w1 = 3 * u * u * t;
    const w2 = 3 * u * t * t;
    const w3 = t * t * t;
    pts.push([
      w0 * p0[0] + w1 * p1[0] + w2 * p2[0] + w3 * p3[0],
      w0 * p0[1] + w1 * p1[1] + w2 * p2[1] + w3 * p3[1],
      w0 * p0[2] + w1 * p1[2] + w2 * p2[2] + w3 * p3[2],
    ]);
  }
  return pts;
}

function addLandingCols(
  pts: k.Point3[],
  startNormal: k.Point3,
  endNormal: k.Point3,
  step = 1.2,
): k.Point3[] {
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  const pre: k.Point3 = [
    first[0] + startNormal[0] * step,
    first[1] + startNormal[1] * step,
    first[2] + startNormal[2] * step,
  ];
  const post: k.Point3 = [
    last[0] + endNormal[0] * step,
    last[1] + endNormal[1] * step,
    last[2] + endNormal[2] * step,
  ];
  return [first, pre, ...pts.slice(1, -1), post, last];
}

const UP = (o: k.Point3): G.Frame => G.frameOf(o, [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const ORIGIN_UP = UP([0, 0, 0]);

// Fit scale + centered pivot across 360 deg horizontal turntable sweep so scale never breathes during orbit
const SWEEP_FIT = (() => {
  const baseCorners = k.boxCorners(BASE, -BASE_H - FOOT_H, 0);
  const topPts: k.Point3[] = [
    [HEART_XY[0], HEART_XY[1], 134],
    [DOME_XY[0], DOME_XY[1], DOME_Z1 + 14],
    [CVP_XY[0], CVP_XY[1], CVP_Z1 + 12],
    [SVR_XY[0], SVR_XY[1], 72],
    [GAUGE_XY[0] + GAUGE_R, GAUGE_XY[1] + GAUGE_R, GAUGE_Z + 12],
  ];
  const allPts = [...baseCorners, ...topPts];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let a = 0; a < 360; a += 15) {
    const unit: k.Projection = { origin: [0, 0], scale: 1, azimuth: RIG_AZIMUTH - a, elevation: RIG_ELEVATION };
    const [cx, cy] = k.iso([DECK_CX, DECK_CY, 0], unit);
    for (const pt of allPts) {
      const [px, py] = k.iso(pt, unit);
      minX = Math.min(minX, px - cx);
      maxX = Math.max(maxX, px - cx);
      minY = Math.min(minY, py - cy);
      maxY = Math.max(maxY, py - cy);
    }
  }
  const pad = 26;
  const scale = Math.min(
    (RIG_VIEW_W - pad * 2) / (maxX - minX),
    (RIG_VIEW_H - pad * 2) / (maxY - minY),
  );
  const deckScreenCenter: k.Flat = [
    RIG_VIEW_W / 2 - ((minX + maxX) / 2) * scale,
    RIG_VIEW_H / 2 - ((minY + maxY) / 2) * scale,
  ];
  return { scale, deckScreenCenter };
})();

export function projectionForAngle(angleDeg = 0): k.Projection {
  const azimuth = RIG_AZIMUTH - angleDeg;
  const unit: k.Projection = {
    origin: [0, 0],
    scale: SWEEP_FIT.scale,
    azimuth,
    elevation: RIG_ELEVATION,
  };
  const [cx, cy] = k.iso([DECK_CX, DECK_CY, 0], unit);
  return {
    origin: [SWEEP_FIT.deckScreenCenter[0] - cx, SWEEP_FIT.deckScreenCenter[1] - cy],
    scale: SWEEP_FIT.scale,
    azimuth,
    elevation: RIG_ELEVATION,
  };
}

export const RIG_PROJECTION: k.Projection = projectionForAngle(0);

const S = (paths: k.SolidPaths, style?: k.SolidStyle) => k.solidSvg(paths, style);
const Ln = (d: string, style?: k.LineStyle) => k.lineSvg(d, style);
const Dots = (
  pts: Array<k.Flat | [number, number, number]>,
  style?: { size?: number; tone?: k.Tone; pulse?: boolean },
) => k.dotsSvg(pts, style);

// Cached vertical axisymmetric solids at [0,0,0] — identical shape under pure azimuth orbit, translated by screen delta
const ZERO_P = RIG_PROJECTION;
const ZERO_ORIGIN_FLAT = k.iso([0, 0, 0], ZERO_P);
function translateSolidMarkup(markup: string, worldXY: [number, number], P: k.Projection): string {
  const [wx, wy] = k.iso([worldXY[0], worldXY[1], 0], P);
  const dx = wx - ZERO_ORIGIN_FLAT[0];
  const dy = wy - ZERO_ORIGIN_FLAT[1];
  return `<g transform="translate(${dx.toFixed(2)} ${dy.toFixed(2)})">${markup}</g>`;
}

const CACHED_SOLIDS = (() => {
  const cradleProfile: G.MeridianPoint[] = [
    [0, 35],
    [4, 35],
    [4, 30],
    [11, 28],
    [PUMP_CRADLE_Z, 24],
  ];
  const barrelBotProfile: G.MeridianPoint[] = [
    [0, 24],
    [7, 24],
    [7, 26.5],
    [14, 26.5],
    [14, 23.0],
    [15, 22.2],
  ];
  const barrelTopProfile: G.MeridianPoint[] = [
    [0, 22.2],
    [1, 23.0],
    [1, 26.5],
    [9, 26.5],
    [9, 24],
    [17, 24],
  ];
  const actProfile: G.MeridianPoint[] = [
    [0, 6.2],
    [5, 6.2],
    [5, 8.2],
    [24, 8.2],
    [24, 6.6],
    [29, 6.6],
  ];
  const domePedProfile: G.MeridianPoint[] = [
    [0, 29],
    [5, 29],
    [5, 25],
    [DOME_Z0, 25],
  ];
  const domeProfile: G.MeridianPoint[] = [[DOME_Z0, DOME_R]];
  const domeBodyTop = DOME_Z1 - 18;
  domeProfile.push([domeBodyTop, DOME_R, 1]);
  for (let i = 1; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2);
    domeProfile.push([domeBodyTop + Math.sin(a) * 18, Math.max(4.5, Math.cos(a) * DOME_R), 1]);
  }
  const svrBonnetProfile: G.MeridianPoint[] = [
    [0, 10],
    [4, 10],
    [4, 7.5],
    [16, 6.2],
    [22, 4.8],
  ];
  const laStandProfile: G.MeridianPoint[] = [
    [0, 17],
    [14, 17],
    [14, 11],
    [62, 11],
  ];
  const laCupProfile: G.MeridianPoint[] = [
    [62, 11],
    [68, 16.5],
    [95, 16.5],
    [98, 12],
  ];
  const pistonProfile: G.MeridianPoint[] = [
    [0, 17.4],
    [2.0, 17.4],
    [2.0, 16.1],
    [3.6, 16.1],
    [3.6, 17.4],
    [5.6, 17.4],
    [5.6, 16.3],
    [7.2, 17.4],
  ];

  return {
    footMarkup:
      S(k.cylinder(0, 0, 8.2, -BASE_H - FOOT_H, 2.2, ZERO_P, 22), { tone: 'lo' }) +
      S(k.cylinder(0, 0, 6.0, -BASE_H - FOOT_H + 2.2, FOOT_H - 2.2, ZERO_P, 22), { tone: 'mid' }),
    cradleMarkup: S(G.solidOf(cradleProfile, ORIGIN_UP, ZERO_P, { steps: 32, bevel: 0.4 }), { tone: 'mid' }),
    barrelBotMarkup:
      S(G.solidOf(barrelBotProfile, UP([0, 0, PUMP_CRADLE_Z]), ZERO_P, { steps: 32, bevel: 0.45 }), { tone: 'hi' }) +
      `<path class="iso-shade" data-shade="0" d="${k.ring(0, 0, 17.8, PUMP_BORE_Z0, ZERO_P, 24)}"/>` +
      Ln(k.ring(0, 0, 17.8, PUMP_BORE_Z0, ZERO_P, 24), { tone: 'mid' }),
    barrelTopMarkup: S(G.solidOf(barrelTopProfile, UP([0, 0, PUMP_BORE_Z1]), ZERO_P, { steps: 32, bevel: 0.45 }), {
      tone: 'hi',
    }),
    headMarkup: S(
      G.disc(0, PUMP_HEAD_TOP_Z - PUMP_HEAD_Z, 27.5, UP([0, 0, PUMP_HEAD_Z]), ZERO_P, { steps: 32, bevel: 0.5 }),
      { tone: 'hi' },
    ),
    actuatorMarkup: S(G.solidOf(actProfile, UP([0, 0, PUMP_HEAD_TOP_Z]), ZERO_P, { steps: 24, bevel: 0.35 }), {
      tone: 'hi',
    }),
    domePedMarkup: S(G.solidOf(domePedProfile, ORIGIN_UP, ZERO_P, { steps: 28 }), { tone: 'mid' }),
    domeGlassLines: Ln(
      (() => {
        const dg = G.solidOf(domeProfile, ORIGIN_UP, ZERO_P, { steps: 28, smooth: true });
        return dg.outline + dg.crease;
      })(),
      { tone: 'mid' },
    ),
    domeTopCapMarkup: S(G.disc(DOME_Z1, DOME_Z1 + 5, 9.2, ORIGIN_UP, ZERO_P, 20), { tone: 'hi' }),
    dischCollarMarkup: S(G.disc(0, 4.0, 7.6, UP([0, 0, PUMP_HEAD_TOP_Z]), ZERO_P, 18), { tone: 'hi' }),
    aortaDischRiserMarkup: S(k.cylinder(0, 0, 6.6, PUMP_HEAD_TOP_Z + 4, 25, ZERO_P, 20), { tone: 'mid' }),
    aortaManifoldCapMarkup: S(G.disc(124, 139, 8.0, ORIGIN_UP, ZERO_P, { steps: 20, bevel: 0.45 }), { tone: 'hi' }),
    aortaDomeRiserMarkup: S(k.cylinder(0, 0, 9.0, DOME_Z1 + 5, 35, ZERO_P, 20), { tone: 'mid' }),
    gaugePostMarkup:
      S(k.cylinder(0, 0, 11.5, 0, 12, ZERO_P, 20), { tone: 'mid' }) +
      S(k.cylinder(0, 0, 4.5, 12, GAUGE_Z - 12, ZERO_P, 20), { tone: 'mid', crease: 'none' }),
    gaugeBodyMarkup: S(k.cylinder(0, 0, GAUGE_R, GAUGE_Z, 9, ZERO_P, 32, 0.8), { tone: 'hi' }),
    svrBonnetMarkup: S(G.solidOf(svrBonnetProfile, UP([0, 0, SVR_BASE_Z]), ZERO_P, { steps: 22 }), { tone: 'mid' }),
    cvpGlassLines: Ln(
      (() => {
        const cg = k.cylinder(0, 0, CVP_R, CVP_Z0, CVP_Z1 - CVP_Z0, ZERO_P, 24);
        return cg.outline + cg.crease;
      })(),
      { tone: 'mid' },
    ),
    cvpMidCollarMarkup: S(G.disc(58, 64, CVP_R + 1.4, ORIGIN_UP, ZERO_P, 24), { tone: 'mid' }),
    cvpCapMarkup: S(G.disc(CVP_Z1, CVP_Z1 + 5, CVP_R + 1.5, ORIGIN_UP, ZERO_P, 24), { tone: 'hi' }),
    laStandMarkup: S(G.solidOf(laStandProfile, ORIGIN_UP, ZERO_P, { steps: 24, bevel: 0.35 }), {
      tone: 'mid',
    }),
    laCupMarkup: S(G.solidOf(laCupProfile, ORIGIN_UP, ZERO_P, { steps: 24, bevel: 0.35 }), {
      tone: 'mid',
    }),
    pumpGlassLines: Ln(
      (() => {
        const pg = k.cylinder(0, 0, PUMP_GLASS_R, PUMP_BORE_Z0, PUMP_BORE_Z1 - PUMP_BORE_Z0, ZERO_P, 28);
        return pg.outline + pg.crease;
      })(),
      { tone: 'mid' },
    ),
    pistonHeadPaths: G.solidOf(pistonProfile, ORIGIN_UP, ZERO_P, { steps: 24, bevel: 0.25 }),
    pistonTopRing: Ln(k.ring(0, 0, 11.5, 7.2, ZERO_P, 18), { tone: 'faint' }),
    pistonGlandMarkup: S(G.disc(0, 2.5, 6.2, UP([0, 0, PUMP_HEAD_Z - 3]), ZERO_P, 18), { tone: 'mid' }),
  };
})();

// Ticks rooted directly on cylinder right-hand silhouette (azimuth - 90 deg) so lines.mjs sees 0 floating ends
function verticalSideTicks(
  cx: number,
  cy: number,
  radius: number,
  zFrom: number,
  zTo: number,
  step: number,
  every: number,
  lengths: [number, number],
  P: k.Projection,
): k.Ticks {
  const rad = (((P.azimuth ?? RIG_AZIMUTH) - 90) * Math.PI) / 180;
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

function buildPumpGlassMarkup(P: k.Projection): { backSvg: string; frontSvg: string } {
  const [hx, hy] = HEART_XY;
  const glassTranslated = translateSolidMarkup(CACHED_SOLIDS.pumpGlassLines, HEART_XY, P);
  const boreTicks = verticalSideTicks(
    hx,
    hy,
    PUMP_GLASS_R,
    PUMP_BORE_Z0 + 5,
    PUMP_BORE_Z1 - 5,
    4,
    3,
    [2.0, 3.6],
    P,
  );
  return {
    backSvg: `<g class="iso-glass">${glassTranslated}</g>`,
    frontSvg:
      `<g class="iso-glass">${glassTranslated}</g>` +
      Ln(boreTicks.minor, { tone: 'faint', free: 'end' }) +
      Ln(boreTicks.major, { tone: 'lo', free: 'end' }),
  };
}

export function buildPumpDynamicPaths(
  lvVolumeMl: number,
  P: k.Projection = RIG_PROJECTION,
): {
  shellSvg: string;
  frontOverlaySvg: string;
  cavitySvg: string;
  fluidFallbackSvg: string;
} {
  const [hx, hy] = HEART_XY;
  const fillFrac = Math.max(0.14, Math.min(0.92, (lvVolumeMl - 30) / 145));
  const zPistonBot = PUMP_BORE_Z0 + 3 + fillFrac * 27;
  const zPistonTop = zPistonBot + 7.2;

  // Fallback pressurized chamber blood cylinder (hidden automatically when WebGL layer active)
  const fluidCol = k.cylinder(hx, hy, 17.2, PUMP_BORE_Z0 + 0.5, zPistonBot - (PUMP_BORE_Z0 + 0.5), P, 24);
  const fluidFallbackSvg = `<g class="iso-fallback-art"><path class="iso-fallback-fill" d="${fluidCol.fill}"/><path class="iso-line" data-tone="red" d="${k.ring(hx, hy, 17.2, zPistonBot, P, 24)}"/></g>`;

  // Translate cached double-ring machined piston head to exact vertical height zPistonBot
  const [px, py] = k.iso([hx, hy, zPistonBot], P);
  const pdx = px - ZERO_ORIGIN_FLAT[0];
  const pdy = py - ZERO_ORIGIN_FLAT[1];
  const pistonHeadSvg = `<g transform="translate(${pdx.toFixed(2)} ${pdy.toFixed(2)})">${S(CACHED_SOLIDS.pistonHeadPaths, { tone: 'hi', inner: CACHED_SOLIDS.pistonTopRing })}</g>`;

  const rodHeight = Math.max(4, PUMP_HEAD_Z - zPistonTop);
  const rodPaths = k.cylinder(hx, hy, 3.6, zPistonTop, rodHeight, P, 16);
  const glandSvg = translateSolidMarkup(CACHED_SOLIDS.pistonGlandMarkup, HEART_XY, P);

  const pistonAssemblySvg =
    pistonHeadSvg + S(rodPaths, { tone: 'mid', crease: 'none' }) + glandSvg;

  return {
    shellSvg:
      `<g data-piece="lv-edv" data-dyn="lv-fluid-fallback">${fluidFallbackSvg}</g>` +
      `<g data-piece="myocardium-lvef">${pistonAssemblySvg}</g>`,
    frontOverlaySvg: `<g data-piece="myocardium-lvef" data-dyn="pump-piston">${pistonAssemblySvg}</g>`,
    cavitySvg: fluidFallbackSvg,
    fluidFallbackSvg,
  };
}

// Keep alias exported for tests expecting buildLvDynamicPaths
export const buildLvDynamicPaths = buildPumpDynamicPaths;

export function buildDialNeedlePath(
  mapMmHg: number,
  P: k.Projection = RIG_PROJECTION,
): string {
  const [gx, gy] = GAUGE_XY;
  const zFace = GAUGE_Z + 9.2;
  const clamped = Math.max(20, Math.min(180, mapMmHg));
  const frac = (clamped - 20) / 160;
  const angle = (-130 + frac * 260) * (Math.PI / 180);
  const rTip = GAUGE_R * 0.68;
  const rTail = GAUGE_R * 0.18;
  const pTail: k.Point3 = [gx - Math.cos(angle) * rTail, gy - Math.sin(angle) * rTail, zFace];
  const pTip: k.Point3 = [gx + Math.cos(angle) * rTip, gy + Math.sin(angle) * rTip, zFace];
  return k.pathOf([k.iso(pTail, P), k.iso(pTip, P)]);
}

export function buildSvrValveDynamicPaths(
  effectiveSvr: number,
  P: k.Projection = RIG_PROJECTION,
): {
  stemSvg: string;
  knobSvg: string;
} {
  const openFrac = Math.max(0, Math.min(1, (30 - effectiveSvr) / 25));
  const lift = openFrac * 11;
  const [sx, sy] = SVR_XY;
  const zStemBase = SVR_BASE_Z + 22;
  const zKnob = zStemBase + 7 + lift;

  const stemPaths = k.cylinder(sx, sy, 2.2, zStemBase, 7 + lift, P, 14);
  const knobPaths = k.cylinder(sx, sy, 10.5, zKnob, 5.2, P, 24, 0.7);
  const knurlLines = k.knurl(sx, sy, 10.5, zKnob, zKnob + 5.2, 24, P, 0.35);
  const topCap = k.ring(sx, sy, 4.2, zKnob + 5.2, P, 16);

  return {
    stemSvg: S(stemPaths, { tone: 'hi', crease: 'none' }),
    knobSvg:
      S(knobPaths, {
        tone: 'hi',
        inner: Ln(knurlLines, { tone: 'lo' }),
      }) +
      Ln(topCap, { tone: 'mid' }) +
      Dots([k.iso([sx, sy, zKnob + 5.2], P)], { size: 0.7, tone: 'hi' }),
  };
}

export function buildFallbackFluidPaths(
  cvpMmHg: number,
  aorticPressureMmHg: number,
  P: k.Projection = RIG_PROJECTION,
): {
  cvpSvg: string;
  domeSvg: string;
} {
  const cvpFrac = Math.max(0.06, Math.min(0.92, cvpMmHg / 30));
  const zCvpTop = CVP_Z0 + 4 + cvpFrac * (CVP_Z1 - CVP_Z0 - 12);
  const cvpCol = k.cylinder(CVP_XY[0], CVP_XY[1], CVP_R - 2.2, CVP_Z0 + 2, zCvpTop - (CVP_Z0 + 2), P, 18);
  const cvpSvg = `<g class="iso-fallback-blue"><path class="iso-fallback-fill" d="${cvpCol.fill}"/><path class="iso-line" data-tone="blue" d="${k.ring(CVP_XY[0], CVP_XY[1], CVP_R - 2.2, zCvpTop, P, 18)}"/></g>`;

  const paFrac = Math.max(0.14, Math.min(0.88, (aorticPressureMmHg - 25) / 140));
  const zDomeTop = DOME_Z0 + 4 + paFrac * 44;
  const domeCol = k.cylinder(DOME_XY[0], DOME_XY[1], DOME_R - 2.5, DOME_Z0 + 2, zDomeTop - (DOME_Z0 + 2), P, 22);
  const domeSvg = `<g class="iso-fallback-art"><path class="iso-fallback-fill" d="${domeCol.fill}"/><path class="iso-line" data-tone="red" d="${k.ring(DOME_XY[0], DOME_XY[1], DOME_R - 2.5, zDomeTop, P, 22)}"/></g>`;

  return { cvpSvg, domeSvg };
}

function buildDialHousingStatic(needleSvg: string, P: k.Projection): string {
  const [gx, gy] = GAUGE_XY;
  const gaugeBody = translateSolidMarkup(CACHED_SOLIDS.gaugeBodyMarkup, GAUGE_XY, P);
  const gaugeTicks = k.radialTicks(gx, gy, GAUGE_R, 24, 4, GAUGE_Z + 9, [2.1, 4.0], P);
  const critAng = (-130 + ((65 - 20) / 160) * 260) * (Math.PI / 180);
  const critLine = k.lineOnTop(
    [gx + Math.cos(critAng) * GAUGE_R, gy + Math.sin(critAng) * GAUGE_R],
    [gx + Math.cos(critAng) * (GAUGE_R - 6.2), gy + Math.sin(critAng) * (GAUGE_R - 6.2)],
    GAUGE_Z + 9.05,
    P,
  );
  const gaugeLabel = k.faceTextSvg(k.topMatrix([gx, gy + 7], GAUGE_Z + 9, P, 'x'), 'MAP', {
    size: 3.3,
    tone: 'mid',
    anchor: 'middle',
  });
  return (
    gaugeBody +
    Ln(gaugeTicks.minor, { tone: 'lo', free: 'end' }) +
    Ln(gaugeTicks.major, { tone: 'mid', free: 'end' }) +
    Ln(critLine, { tone: 'red', free: 'end' }) +
    gaugeLabel +
    `<g data-dyn="dial-needle">${needleSvg}</g>` +
    Dots([k.iso([gx, gy, GAUGE_Z + 9.25], P)], { size: 0.9, tone: 'hi' })
  );
}

export function createRigScene(
  angleDeg = 0,
  options: { audit?: boolean; spacing?: number; fast?: boolean } = {},
): RigStaticScene {
  const P = projectionForAngle(angleDeg);
  const at = (pt: k.Point3) => k.iso(pt, P);
  const slab = (plan: k.Plan, z: number, h: number, steps = 4, bevel = 0.5) =>
    k.slabOf(plan, z, h, P, steps, bevel);

  const runAudit = Boolean(options.audit);
  const fastDrag = Boolean(options.fast);
  const tubeSpacing = options.spacing ?? (runAudit ? 2.2 : 2.8);
  const R = runAudit ? A.recorder(P, { order: [], spring: {} }) : null;
  let seq = 0;
  const nextId = (prefix: string) => (R ? R.nameFor(prefix) : `${prefix}.${++seq}`);

  interface InternalItem {
    id: string;
    piece: RigFocusGroup;
    tier: -1 | 0 | 1;
    depth: number;
    key: number;
    screen: [number, number];
    svg: string;
    hasDynamic?: boolean;
  }

  const collected: InternalItem[] = [];

  const put = (
    piece: RigFocusGroup,
    ref: k.Point3,
    svg: string,
    opts: {
      tier?: -1 | 0 | 1;
      bias?: number;
      shapes?: A.AuditShape[];
      name?: string;
      route?: string;
      chunk?: number;
      hasDynamic?: boolean;
      skipRecord?: boolean;
    } = {},
  ) => {
    const id = opts.name ?? nextId(`${piece}.item`);
    if (R) {
      const shapes = opts.shapes ?? [];
      if (!opts.skipRecord) {
        for (const s of shapes) {
          if (s.kind !== 'tube') {
            if (!s.name) s.name = id;
            R.solid(s);
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
    }
    collected.push({
      id,
      piece,
      tier: opts.tier ?? 1,
      depth: k.depthOf(ref, P) + (opts.bias ?? 0),
      key: 0,
      screen: at(ref),
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
    const id = nextId(opts.name ?? `${piece}.tube`);
    if (R) {
      R.route(id, route, r, {
        owner: id,
        piece,
        gaps: opts.gaps ?? [],
        touch: opts.touch ?? [],
        limp: opts.limp ?? false,
        free: opts.free ?? [false, false],
        ends: opts.ends ?? [true, true],
      });
    }
    const parts = tubePieces(route, r, P, {
      maxLength: 32,
      spacing: tubeSpacing,
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
        shapes: R ? [A.tube(part.points, r, { ground: false })] : undefined,
      });
    });
  };

  // ─── 1. BENCHTOP BASEPLATE, ISOLATION FEET, RULER & SPEC PLATE ──────────
  const haloPath = k.haloOf(BASE, -BASE_H - FOOT_H, BASE_H, P);

  const feetCorners = k
    .corners(BASE, 20)
    .sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
  feetCorners.forEach(([fx, fy], idx) => {
    put('stand', [fx, fy, -BASE_H - FOOT_H * 0.5], translateSolidMarkup(CACHED_SOLIDS.footMarkup, [fx, fy], P), {
      tier: -1,
      name: `stand.foot.${idx}`,
      shapes: R ? [A.cylinder(fx, fy, 8.2, -BASE_H - FOOT_H, FOOT_H, { ground: true })] : undefined,
    });
  });

  const baseSlab = slab(BASE, -BASE_H, BASE_H, 6, 1.4);
  const baseGroove = Ln(k.planOutline(k.insetPlan(BASE, 5.5), 0, P, 6), { tone: 'lo' });
  const boltPts = k.corners(BASE, 11);
  const boltRings = Ln(boltPts.map(([bx, by]) => k.ring(bx, by, 2.3, 0, P, 14)).join(''), { tone: 'lo' });
  const boltDots = Dots(boltPts.map(([bx, by]) => at([bx, by, 0])), { size: 0.5, tone: 'mid' });

  const rulerPlan: k.Plan = { x: -138, y: 71, w: 204, d: 8, r: 1.2 };
  const rulerSlab = S(slab(rulerPlan, 0, 0.8, 3, 0), { tone: 'lo', crease: 'none' });
  const rulerTicks = k.topTicks(rulerPlan.x + 6, rulerPlan.x + rulerPlan.w - 6, 4, 5, rulerPlan.y, 0.8, [2.2, 4.0], P);
  const rulerSvg =
    rulerSlab +
    Ln(rulerTicks.minor, { tone: 'lo', free: 'end' }) +
    Ln(rulerTicks.major, { tone: 'mid', free: 'end' }) +
    Dots([at([rulerPlan.x + 2.5, rulerPlan.y + 4, 0.8]), at([rulerPlan.x + rulerPlan.w - 2.5, rulerPlan.y + 4, 0.8])], {
      size: 0.45,
    });

  const badgePlan: k.Plan = { x: 88, y: 66, w: 62, d: 13, r: 1.5 };
  const badgeSvg =
    S(slab(badgePlan, 0, 0.8, 3, 0), { tone: 'lo', crease: 'none' }) +
    Ln(k.planOutline(k.insetPlan(badgePlan, 1.6), 0.8, P, 3), { tone: 'faint' }) +
    k.faceTextSvg(k.topMatrix([badgePlan.x + 31, badgePlan.y + 6.8], 0.8, P, 'x'), 'WINDKESSEL · I', {
      size: 3.1,
      tone: 'mid',
      anchor: 'middle',
    }) +
    Dots(
      [
        at([badgePlan.x + 4, badgePlan.y + 6.5, 0.8]),
        at([badgePlan.x + badgePlan.w - 4, badgePlan.y + 6.5, 0.8]),
      ],
      { size: 0.45, tone: 'mid' },
    );

  put(
    'stand',
    [DECK_CX, DECK_CY, -BASE_H * 0.5],
    S(baseSlab, { tone: 'mid' }) + baseGroove + boltRings + boltDots + rulerSvg + badgeSvg,
    {
      tier: 0,
      name: 'stand.baseplate',
      bias: -10,
      shapes: R ? [A.slab(BASE, -BASE_H, BASE_H, { ground: true })] : undefined,
    },
  );

  put(
    'arterioles-svr',
    [PERFUSION_TRAY.x + PERFUSION_TRAY.w * 0.5, PERFUSION_TRAY.y + PERFUSION_TRAY.d * 0.5, 2],
    S(slab(PERFUSION_TRAY, 0, 4, 3, 0.4), { tone: 'lo' }) +
      Ln(k.planOutline(k.insetPlan(PERFUSION_TRAY, 3), 4, P, 3), { tone: 'faint' }),
    {
      name: 'arterioles.tray',
      bias: -2,
      shapes: R ? [A.slab(PERFUSION_TRAY, 0, 4, { ground: true })] : undefined,
    },
  );

  // ─── 2. 360° SIGHT-GLASS HYDRAULIC PUMP CHAMBER (myocardium-lvef / lv-edv) ─
  const [hx, hy] = HEART_XY;
  const cradleBolts = Dots(G.dotsOf(UP([hx, hy, 0]), 4, 32.5, 8, P, { all: true }), {
    size: 0.55,
    tone: 'mid',
  });
  put(
    'myocardium-lvef',
    [hx, hy, 7],
    translateSolidMarkup(CACHED_SOLIDS.cradleMarkup, HEART_XY, P) + cradleBolts,
    {
      name: 'pump.cradle',
      bias: -0.6,
      shapes: R
        ? [
            A.solid(
              UP([hx, hy, 0]),
              [
                [0, 35],
                [4, 35],
                [4, 30],
                [11, 28],
                [PUMP_CRADLE_Z, 24],
              ],
              { ground: true },
            ),
          ]
        : undefined,
    },
  );

  put(
    'myocardium-lvef',
    [hx, hy, 21.5],
    translateSolidMarkup(CACHED_SOLIDS.barrelBotMarkup, HEART_XY, P),
    {
      name: 'pump.barrel.bot',
      bias: -0.35,
      shapes: R
        ? [
            A.solid(
              UP([hx, hy, PUMP_CRADLE_Z]),
              [
                [0, 24],
                [7, 24],
                [7, 26.5],
                [14, 26.5],
                [14, 23.0],
                [15, 22.2],
              ],
              { ground: false },
            ),
          ]
        : undefined,
    },
  );

  // 360° Clear Borosilicate Sight-Glass Sleeve + Dynamic Piston
  const pumpInit = buildPumpDynamicPaths(120, P);
  const pumpGlass = buildPumpGlassMarkup(P);
  put(
    'lv-edv',
    [hx, hy, 50],
    pumpGlass.backSvg + `<g data-dyn="lv-shell">${pumpInit.shellSvg}</g>` + pumpGlass.frontSvg,
    {
      name: 'pump.barrel.glass',
      hasDynamic: true,
      bias: 0.1,
      shapes: R ? [A.cylinder(hx, hy, PUMP_GLASS_R, PUMP_BORE_Z0, PUMP_BORE_Z1 - PUMP_BORE_Z0)] : undefined,
    },
  );

  // 3 Vertical Billet Steel Tie-Rods clamping lower & upper flanges around the 360° glass bore
  [0, 120, 240].forEach((deg, idx) => {
    const rad = (deg * Math.PI) / 180;
    const rx = hx + 24.75 * Math.cos(rad);
    const ry = hy + 24.75 * Math.sin(rad);
    const rod = k.cylinder(rx, ry, 1.15, 28, 44, P, 14);
    put('myocardium-lvef', [rx, ry, 50], S(rod, { tone: 'mid', crease: 'none' }), {
      name: `pump.tie.${idx}`,
      bias: 0.25,
      shapes: R ? [A.cylinder(rx, ry, 1.15, 28, 44)] : undefined,
    });
  });

  put(
    'myocardium-lvef',
    [hx, hy, 79.5],
    translateSolidMarkup(CACHED_SOLIDS.barrelTopMarkup, HEART_XY, P),
    {
      name: 'pump.barrel.top',
      bias: 0.65,
      shapes: R
        ? [
            A.solid(
              UP([hx, hy, PUMP_BORE_Z1]),
              [
                [0, 22.2],
                [1, 23.0],
                [1, 26.5],
                [9, 26.5],
                [9, 24],
                [17, 24],
              ],
              { ground: false },
            ),
          ]
        : undefined,
    },
  );

  // Bolted cylinder head cover plate (z = 88..95, r = 27.5)
  const headBolts = Dots(G.dotsOf(UP([hx, hy, PUMP_HEAD_Z]), PUMP_HEAD_TOP_Z - PUMP_HEAD_Z, 23.5, 8, P, { all: true }), {
    size: 0.5,
    tone: 'mid',
  });
  put(
    'myocardium-lvef',
    [hx, hy, PUMP_HEAD_Z + 3.5],
    translateSolidMarkup(CACHED_SOLIDS.headMarkup, HEART_XY, P) + headBolts,
    {
      name: 'pump.head',
      bias: 0.9,
      shapes: R ? [A.disc(UP([hx, hy, PUMP_HEAD_Z]), 0, PUMP_HEAD_TOP_Z - PUMP_HEAD_Z, 27.5)] : undefined,
    },
  );

  // Coaxial Overhead Linear Servo Actuator Canister with all-around camera-facing fadeLineSvg flutes
  const actRibEntries = G.ribsOf(UP([hx, hy, PUMP_HEAD_TOP_Z]), 5.4, 23.6, 8.2, 16, P, {
    fade: [0.1, 0.55],
  }) as Array<{ d: string; alpha: number }>;
  const actRibsSvg = actRibEntries
    .map(
      (entry) =>
        `<path class="iso-line" data-tone="faint" data-free="" opacity="${entry.alpha.toFixed(2)}" d="${entry.d}"/>`,
    )
    .join('');
  const actTopBolts = Dots(G.dotsOf(UP([hx, hy, PUMP_HEAD_TOP_Z]), 29, 5.0, 4, P, { all: true }), {
    size: 0.45,
    tone: 'mid',
  });
  put(
    'myocardium-lvef',
    [hx, hy, PUMP_HEAD_TOP_Z + 14.5],
    translateSolidMarkup(CACHED_SOLIDS.actuatorMarkup, HEART_XY, P) +
      actRibsSvg +
      actTopBolts +
      Dots([at([hx, hy, PUMP_HEAD_TOP_Z + 29])], { size: 0.65, tone: 'hi' }),
    {
      name: 'pump.actuator',
      bias: 1.4,
      shapes: R
        ? [
            A.solid(
              UP([hx, hy, PUMP_HEAD_TOP_Z]),
              [
                [0, 6.2],
                [5, 6.2],
                [5, 8.2],
                [24, 8.2],
                [24, 6.6],
                [29, 6.6],
              ],
              { ground: false },
            ),
          ]
        : undefined,
    },
  );

  // External High-Pressure Hydraulic Sense/Bypass Line dropping vertically into grounded deck manifold block (th = -60 deg)
  const bpTh = (-60 * Math.PI) / 180;
  const bpCx = Math.cos(bpTh);
  const bpCy = Math.sin(bpTh);
  const bpPt = (r: number, z: number): k.Point3 => [hx + r * bpCx, hy + r * bpCy, z];
  const bpBossF = G.frameOf(bpPt(27.4, 91.5), [bpCx, bpCy, 0], [-bpCy, bpCx, 0], [0, 0, 1]);
  put('myocardium-lvef', bpPt(29.5, 91.5), S(G.disc(0, 4.2, 2.2, bpBossF, P, 14), { tone: 'mid' }), {
    name: 'pump.bypass.boss',
    bias: 2.0,
    shapes: R ? [A.disc(bpBossF, 0, 4.2, 2.2)] : undefined,
  });
  const [bpBaseX, bpBaseY] = bpPt(40.0, 0);
  put(
    'myocardium-lvef',
    [bpBaseX, bpBaseY, 4],
    S(k.cylinder(bpBaseX, bpBaseY, 2.8, 0, 8, P, 16), { tone: 'mid' }),
    {
      name: 'pump.bypass.base',
      bias: -0.4,
      shapes: R ? [A.cylinder(bpBaseX, bpBaseY, 2.8, 0, 8, { ground: true })] : undefined,
    },
  );
  const bypassRoute = addLandingCols(
    cubicSweep3(
      bpPt(31.6, 91.5),
      bpPt(40.0, 91.5),
      bpPt(40.0, 74.0),
      bpPt(40.0, 8.0),
      16,
    ),
    [bpCx, bpCy, 0],
    [0, 0, -1],
    1.2,
  );
  addTube('myocardium-lvef', bypassRoute, 1.3, {
    name: 'pump.bypass',
    tone: 'mid',
    caps: [true, true],
    touch: ['pump.bypass.boss', 'pump.bypass.base'],
    bias: 4,
  });

  // ─── 3. AORTIC ARCH, WINDKESSEL DOME & ANALOG MAP DIAL GAUGE (aorta-map) ─
  const [dx, dy] = DOME_XY;
  const domeBolts = Dots(G.dotsOf(UP([dx, dy, 0]), 5, 26.8, 8, P, { all: true }), {
    size: 0.5,
    tone: 'mid',
  });
  const domeOutletFlange: k.Plan = { x: dx + 25, y: dy - 9, w: 6, d: 18, r: 1 };
  put('aorta-map', [dx, dy, 7], translateSolidMarkup(CACHED_SOLIDS.domePedMarkup, DOME_XY, P) + domeBolts, {
    name: 'dome.pedestal',
    bias: -0.4,
    shapes: R ? [A.cylinder(dx, dy, 25, 0, DOME_Z0, { ground: true })] : undefined,
  });
  put('aorta-map', [dx + 28, dy, 10], S(slab(domeOutletFlange, 2, 16, 2, 0.3), { tone: 'hi' }), {
    name: 'dome.flange',
    shapes: R ? [A.slab(domeOutletFlange, 2, 16, { ground: false })] : undefined,
  });

  const fallbackInit = buildFallbackFluidPaths(8, 70, P);
  const domeBodyTop = DOME_Z1 - 18;
  const domeTicks = verticalSideTicks(dx, dy, DOME_R, DOME_Z0 + 8, domeBodyTop - 6, 4, 4, [2.2, 4.0], P);
  const domeGlassSvg =
    `<g class="iso-glass">${translateSolidMarkup(CACHED_SOLIDS.domeGlassLines, DOME_XY, P)}</g>` +
    Ln(domeTicks.minor, { tone: 'faint', free: 'end' }) +
    Ln(domeTicks.major, { tone: 'lo', free: 'end' }) +
    translateSolidMarkup(CACHED_SOLIDS.domeTopCapMarkup, DOME_XY, P);
  put(
    'aorta-map',
    [dx, dy, (DOME_Z0 + DOME_Z1) * 0.5],
    `<g data-dyn="dome-fluid-fallback">${fallbackInit.domeSvg}</g>` + domeGlassSvg,
    {
      name: 'dome.housing',
      hasDynamic: true,
      bias: 0.4,
      shapes: R ? [A.cylinder(dx, dy, DOME_R, DOME_Z0, DOME_Z1 + 5 - DOME_Z0)] : undefined,
    },
  );

  // Discharge Flange Collar at Aortic Port (z = 95..99) + Dual Overhead Manifold Risers & Swept Header (0 folds across 360°)
  const [ax, ay] = AORTA_PORT_XY;
  put('aorta-map', [ax, ay, PUMP_HEAD_TOP_Z + 2], translateSolidMarkup(CACHED_SOLIDS.dischCollarMarkup, AORTA_PORT_XY, P), {
    name: 'aorta.discharge.collar',
    bias: 0.5,
    shapes: R ? [A.disc(UP([ax, ay, PUMP_HEAD_TOP_Z]), 0, 4.0, 7.6)] : undefined,
  });
  put('aorta-map', [ax, ay, 111.5], translateSolidMarkup(CACHED_SOLIDS.aortaDischRiserMarkup, AORTA_PORT_XY, P), {
    name: 'aorta.riser.pump',
    bias: 0.7,
    shapes: R ? [A.cylinder(ax, ay, 6.6, PUMP_HEAD_TOP_Z + 4, 25)] : undefined,
  });
  put('aorta-map', [ax, ay, 131.5], translateSolidMarkup(CACHED_SOLIDS.aortaManifoldCapMarkup, AORTA_PORT_XY, P), {
    name: 'aorta.man.left',
    bias: 1.0,
    shapes: R ? [A.disc(UP([ax, ay, 124]), 0, 15, 8.0)] : undefined,
  });

  put('aorta-map', [dx, dy, 106.5], translateSolidMarkup(CACHED_SOLIDS.aortaDomeRiserMarkup, DOME_XY, P), {
    name: 'aorta.riser.dome',
    bias: 0.7,
    shapes: R ? [A.cylinder(dx, dy, 9.0, DOME_Z1 + 5, 35)] : undefined,
  });
  put('aorta-map', [dx, dy, 131.5], translateSolidMarkup(CACHED_SOLIDS.aortaManifoldCapMarkup, DOME_XY, P), {
    name: 'aorta.man.right',
    bias: 1.0,
    shapes: R ? [A.disc(UP([dx, dy, 124]), 0, 15, 8.0)] : undefined,
  });

  const archDx = dx - ax;
  const archDy = dy - ay;
  const archLen = Math.hypot(archDx, archDy) || 1;
  const archUx = archDx / archLen;
  const archUy = archDy / archLen;
  const archNx = -archUy;
  const archNy = archUx;
  const archBow = -12;
  const archMidStart: k.Point3 = [ax + archUx * 8, ay + archUy * 8, 131.5];
  const archMidEnd: k.Point3 = [dx - archUx * 8, dy - archUy * 8, 131.5];
  const archHdrSpan = Math.hypot(archMidEnd[0] - archMidStart[0], archMidEnd[1] - archMidStart[1]) || 1;
  const slopeEnd = (archBow * Math.PI) / archHdrSpan;
  const lOutDir = G.unit3([archUx + archNx * slopeEnd, archUy + archNy * slopeEnd, 0]);
  const rOutDir = G.unit3([-archUx + archNx * slopeEnd, -archUy + archNy * slopeEnd, 0]);

  const lBossBase: k.Point3 = [ax + lOutDir[0] * 7.8, ay + lOutDir[1] * 7.8, 131.5];
  const lBossF = G.frameOf(lBossBase, lOutDir, [-lOutDir[1], lOutDir[0], 0], [0, 0, 1]);
  put(
    'aorta-map',
    [lBossBase[0] + lOutDir[0] * 1.8, lBossBase[1] + lOutDir[1] * 1.8, 131.5],
    S(G.disc(0, 3.6, 6.4, lBossF, P, 16), { tone: 'hi' }),
    {
      name: 'aorta.man.left.boss',
      bias: 1.6,
      shapes: R ? [A.disc(lBossF, 0, 3.6, 6.4)] : undefined,
    },
  );

  const rBossBase: k.Point3 = [dx + rOutDir[0] * 7.8, dy + rOutDir[1] * 7.8, 131.5];
  const rBossF = G.frameOf(rBossBase, rOutDir, [-rOutDir[1], rOutDir[0], 0], [0, 0, 1]);
  put(
    'aorta-map',
    [rBossBase[0] + rOutDir[0] * 1.8, rBossBase[1] + rOutDir[1] * 1.8, 131.5],
    S(G.disc(0, 3.6, 6.4, rBossF, P, 16), { tone: 'hi' }),
    {
      name: 'aorta.man.right.boss',
      bias: 1.6,
      shapes: R ? [A.disc(rBossF, 0, 3.6, 6.4)] : undefined,
    },
  );

  const hdrP0: k.Point3 = [lBossBase[0] + lOutDir[0] * 3.6, lBossBase[1] + lOutDir[1] * 3.6, 131.5];
  const hdrP1: k.Point3 = [rBossBase[0] + rOutDir[0] * 3.6, rBossBase[1] + rOutDir[1] * 3.6, 131.5];
  const arterialArchFull: k.Point3[] = Array.from({ length: 21 }, (_, i) => {
    const t = i / 20;
    const b = archBow * Math.sin(Math.PI * t);
    return [
      hdrP0[0] + (hdrP1[0] - hdrP0[0]) * t + archNx * b,
      hdrP0[1] + (hdrP1[1] - hdrP0[1]) * t + archNy * b,
      131.5,
    ] as k.Point3;
  });
  const arterialArchRoute: k.Point3[] = [
    [ax, ay, PUMP_HEAD_TOP_Z + 4.0],
    [ax, ay, 131.5],
    ...arterialArchFull,
    [dx, dy, 131.5],
    [dx, dy, DOME_Z1 + 5],
  ];
  addTube('aorta-map', arterialArchFull, 5.2, {
    name: 'aorta.arch',
    tone: 'hi',
    touch: ['aorta.man.left.boss', 'aorta.man.right.boss', 'aorta.branch.0', 'aorta.branch.1', 'aorta.branch.2'],
    rings: fastDrag ? null : { pitch: 8, fade: [0.08, 0.45], tone: 'faint' },
    bias: 3.0,
  });

  // Mount 3 vertical pressure riser bosses cleanly on top crown of the swept horizontal header
  [7, 10, 13].forEach((sIdx, idx) => {
    const [bx, by, bz] = arterialArchFull[sIdx]!;
    const rf = UP([bx, by, bz]);
    const branchSvg =
      S(G.disc(4.8, 12.0, 2.8, rf, P, 14), { tone: 'mid' }) +
      S(G.disc(12.0, 14.5, 3.8, rf, P, 14), { tone: 'hi' });
    put('aorta-map', [bx, by, bz + 10], branchSvg, {
      name: `aorta.branch.${idx}`,
      bias: 12,
      shapes: R ? [A.disc(rf, 4.8, 14.5, 3.8)] : undefined,
    });
  });

  const [gx, gy] = GAUGE_XY;
  put('aorta-map', [gx, gy, GAUGE_Z * 0.5], translateSolidMarkup(CACHED_SOLIDS.gaugePostMarkup, GAUGE_XY, P), {
    name: 'gauge.post',
    bias: -0.4,
    shapes: R
      ? [
          A.solid(
            UP([gx, gy, 0]),
            [
              [0, 11.5],
              [12, 11.5],
              [12, 4.5],
              [GAUGE_Z, 4.5],
            ],
            { ground: true },
          ),
        ]
      : undefined,
  });

  const sDx = gx - dx;
  const sDy = gy - dy;
  const sLen = Math.hypot(sDx, sDy) || 1;
  const sDir: k.Point3 = [sDx / sLen, sDy / sLen, 0];
  const sStart: k.Point3 = [dx + sDir[0] * 25.0, dy + sDir[1] * 25.0, 8];
  const gSenseBossBase: k.Point3 = [gx - sDir[0] * 11.5, gy - sDir[1] * 11.5, 8];
  const gSenseBossF = G.frameOf(gSenseBossBase, [-sDir[0], -sDir[1], 0], [sDir[1], -sDir[0], 0], [0, 0, 1]);
  put(
    'aorta-map',
    [gSenseBossBase[0] - sDir[0] * 1.6, gSenseBossBase[1] - sDir[1] * 1.6, 8],
    S(G.disc(0, 3.2, 2.5, gSenseBossF, P, 14), { tone: 'mid' }),
    {
      name: 'gauge.port',
      bias: 0.4,
      shapes: R ? [A.disc(gSenseBossF, 0, 3.2, 2.5)] : undefined,
    },
  );

  put(
    'aorta-map',
    [gx, gy, GAUGE_Z + 4.5],
    buildDialHousingStatic(Ln(buildDialNeedlePath(70, P), { tone: 'red', free: true }), P),
    {
      name: 'gauge.housing',
      hasDynamic: true,
      bias: 0.6,
      shapes: R ? [A.cylinder(gx, gy, GAUGE_R, GAUGE_Z, 9)] : undefined,
    },
  );

  const gSenseTip: k.Point3 = [gSenseBossBase[0] - sDir[0] * 3.2, gSenseBossBase[1] - sDir[1] * 3.2, 8];
  const senseRoute: k.Point3[] = [
    sStart,
    [sStart[0] + (gSenseTip[0] - sStart[0]) * 0.25, sStart[1] + (gSenseTip[1] - sStart[1]) * 0.25, 8],
    [sStart[0] + (gSenseTip[0] - sStart[0]) * 0.75, sStart[1] + (gSenseTip[1] - sStart[1]) * 0.75, 8],
    gSenseTip,
  ];
  addTube('aorta-map', senseRoute, 1.5, {
    name: 'aorta.sense',
    tone: 'lo',
    touch: ['dome.pedestal', 'gauge.port'],
    bias: 0.5,
  });

  // ─── 4. ARTERIOLAR RESISTANCE MANIFOLD & SVR THROTTLE VALVE (arterioles-svr) ─
  put('stand', [58.5, dy, 2.9], S(slab({ x: 53.5, y: dy - 6, w: 10, d: 12, r: 1.5 }, 0, 5.8, 3), { tone: 'lo' }), {
    name: 'stand.clamp.art',
    shapes: R ? [A.slab({ x: 53.5, y: dy - 6, w: 10, d: 12, r: 1.5 }, 0, 5.8, { ground: true })] : undefined,
  });

  const arterialFeedRoute: k.Point3[] = [
    [dx + 31, dy, 11],
    [dx + 41, dy, 11],
    [(dx + 31 + SVR_MANIFOLD.x) * 0.5 + 4, dy, 11],
    [SVR_MANIFOLD.x, dy, 11],
  ];
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
      bias: -0.2,
      shapes: R ? [A.slab(SVR_MANIFOLD, 0, SVR_BASE_Z, { ground: true })] : undefined,
    },
  );

  put('arterioles-svr', [SVR_XY[0], SVR_XY[1], SVR_BASE_Z + 11], translateSolidMarkup(CACHED_SOLIDS.svrBonnetMarkup, SVR_XY, P), {
    name: 'svr.bonnet',
    bias: 0.1,
    shapes: R ? [A.cylinder(SVR_XY[0], SVR_XY[1], 10, SVR_BASE_Z, 22)] : undefined,
  });

  const svrInit = buildSvrValveDynamicPaths(12, P);
  put('arterioles-svr', [SVR_XY[0], SVR_XY[1], SVR_BASE_Z + 26], `<g data-dyn="svr-stem">${svrInit.stemSvg}</g>`, {
    name: 'svr.stem',
    hasDynamic: true,
    bias: 0.3,
    shapes: R ? [A.cylinder(SVR_XY[0], SVR_XY[1], 2.2, SVR_BASE_Z + 22, 13)] : undefined,
  });
  put('arterioles-svr', [SVR_XY[0], SVR_XY[1], SVR_BASE_Z + 40], `<g data-dyn="svr-knob">${svrInit.knobSvg}</g>`, {
    name: 'svr.knob',
    hasDynamic: true,
    bias: 0.6,
    shapes: R ? [A.cylinder(SVR_XY[0], SVR_XY[1], 10.5, SVR_BASE_Z + 35, 5.2)] : undefined,
  });

  const capYs = [-14, -5, 4, 13];
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
      shapes: R ? [A.slab(VEN_MANIFOLD, 0, 22, { ground: true })] : undefined,
    },
  );

  // ─── 5. VENOUS RETURN LOOP & GRADUATED CVP STANDPIPE COLUMN (venous-cvp) ─
  [
    { x: 64, y: -82 },
    { x: -34, y: -82 },
  ].forEach((pos, idx) => {
    put(
      'stand',
      [pos.x, pos.y, 2.5],
      S(slab({ x: pos.x - 5, y: pos.y - 6, w: 10, d: 12, r: 1.5 }, 0, 5.0, 3), { tone: 'lo' }),
      {
        name: `stand.clamp.ven.${idx}`,
        shapes: R ? [A.slab({ x: pos.x - 5, y: pos.y - 6, w: 10, d: 12, r: 1.5 }, 0, 5.0, { ground: true })] : undefined,
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
      bias: -0.4,
      shapes: R ? [A.slab(CVP_PLINTH, 0, CVP_Z0, { ground: true })] : undefined,
    },
  );

  const venousReturnRoute = G.fillet(
    [
      [VEN_MANIFOLD.x + 9, VEN_MANIFOLD.y, 10],
      [VEN_MANIFOLD.x + 9, -82, 10],
      [cx, -82, 10],
      [cx, CVP_PLINTH.y, 10],
    ],
    32,
    10,
    { P, tube: 4.5 },
  );
  addTube('venous-cvp', venousReturnRoute, 4.5, {
    name: 'venous.return',
    tone: 'mid',
    touch: ['venous.collector', 'stand.clamp.ven.0', 'stand.clamp.ven.1', 'cvp.pedestal'],
  });

  const cvpScale = verticalSideTicks(cx, cy, CVP_R, CVP_Z0 + 6, CVP_Z1 - 6, 4, 5, [2, 3.8], P);
  const cvpGlassSvg =
    `<g class="iso-glass">${translateSolidMarkup(CACHED_SOLIDS.cvpGlassLines, CVP_XY, P)}</g>` +
    Ln(cvpScale.minor, { tone: 'faint', free: 'end' }) +
    Ln(cvpScale.major, { tone: 'lo', free: 'end' }) +
    translateSolidMarkup(CACHED_SOLIDS.cvpMidCollarMarkup, CVP_XY, P) +
    translateSolidMarkup(CACHED_SOLIDS.cvpCapMarkup, CVP_XY, P);
  put(
    'venous-cvp',
    [cx, cy, (CVP_Z0 + CVP_Z1) * 0.5],
    `<g data-dyn="cvp-fluid-fallback">${fallbackInit.cvpSvg}</g>` + cvpGlassSvg,
    {
      name: 'cvp.column',
      hasDynamic: true,
      bias: 0.4,
      shapes: R
        ? [
            A.cylinder(cx, cy, CVP_R, CVP_Z0, 58 - CVP_Z0),
            A.cylinder(cx, cy, CVP_R + 1.4, 58, 6),
            A.cylinder(cx, cy, CVP_R, 64, CVP_Z1 + 5 - 64),
          ]
        : undefined,
    },
  );

  // Grounded Atrial Preload Surge Chamber Stand + Bowl + Straight Horizontal Riser & Bridge across 360°
  put('venous-cvp', [LA_XY[0], LA_XY[1], 31], translateSolidMarkup(CACHED_SOLIDS.laStandMarkup, LA_XY, P), {
    name: 'venous.atrium.stand',
    bias: -0.3,
    shapes: R
      ? [
          A.solid(
            UP([LA_XY[0], LA_XY[1], 0]),
            [
              [0, 17],
              [14, 17],
              [14, 11],
              [62, 11],
            ],
            { ground: true },
          ),
        ]
      : undefined,
  });

  put('venous-cvp', [LA_XY[0], LA_XY[1], 80], translateSolidMarkup(CACHED_SOLIDS.laCupMarkup, LA_XY, P), {
    name: 'venous.atrium',
    bias: -0.1,
    shapes: R
      ? [
          A.solid(
            UP([LA_XY[0], LA_XY[1], 0]),
            [
              [62, 11],
              [68, 16.5],
              [95, 16.5],
              [98, 12],
            ],
          ),
        ]
      : undefined,
  });

  const riserBossF = G.frameOf([LA_XY[0], LA_XY[1] - 17, 10], [0, -1, 0], [1, 0, 0], [0, 0, 1]);
  put(
    'venous-cvp',
    [LA_XY[0], LA_XY[1] - 19.2, 10],
    S(G.disc(0, 4.4, 5.8, riserBossF, P, 16), { tone: 'mid' }),
    {
      name: 'atrium.riser.boss',
      bias: 0.4,
      shapes: R ? [A.disc(riserBossF, 0, 4.4, 5.8)] : undefined,
    },
  );
  const laRiserStart: k.Point3 = [LA_XY[0], CVP_PLINTH.y + CVP_PLINTH.d, 10];
  const laRiserEnd: k.Point3 = [LA_XY[0], LA_XY[1] - 21.4, 10];
  const laRiserRoute: k.Point3[] = [
    laRiserStart,
    [LA_XY[0], laRiserStart[1] + (laRiserEnd[1] - laRiserStart[1]) * 0.3, 10],
    [LA_XY[0], laRiserStart[1] + (laRiserEnd[1] - laRiserStart[1]) * 0.7, 10],
    laRiserEnd,
  ];
  addTube('venous-cvp', laRiserRoute, 4.2, {
    name: 'venous.riser',
    tone: 'mid',
    touch: ['cvp.pedestal', 'atrium.riser.boss'],
  });

  // Coaxial horizontal suction bosses on pump.head (153.9°) and venous.atrium (-26.1°) + straight horizontal bridge
  const inletF = G.frameOf(INLET_PORT_XYZ, INLET_DIR, [-INLET_DIR[1], INLET_DIR[0], 0], [0, 0, 1]);
  put(
    'myocardium-lvef',
    [
      INLET_PORT_XYZ[0] + INLET_DIR[0] * 2.25,
      INLET_PORT_XYZ[1] + INLET_DIR[1] * 2.25,
      INLET_PORT_XYZ[2],
    ],
    S(G.disc(0, 4.5, 5.8, inletF, P, 16), { tone: 'hi' }),
    {
      name: 'pump.inlet.boss',
      bias: 1.8,
      shapes: R ? [A.disc(inletF, 0, 4.5, 5.8)] : undefined,
    },
  );
  const inletTip: k.Point3 = [
    INLET_PORT_XYZ[0] + INLET_DIR[0] * 4.5,
    INLET_PORT_XYZ[1] + INLET_DIR[1] * 4.5,
    INLET_PORT_XYZ[2],
  ];

  const brOutDir: k.Point3 = [-INLET_DIR[0], -INLET_DIR[1], 0];
  const brBossBase: k.Point3 = [LA_XY[0] + brOutDir[0] * 16.4, LA_XY[1] + brOutDir[1] * 16.4, 91.5];
  const brBossF = G.frameOf(brBossBase, brOutDir, [-brOutDir[1], brOutDir[0], 0], [0, 0, 1]);
  put(
    'venous-cvp',
    [brBossBase[0] + brOutDir[0] * 2.25, brBossBase[1] + brOutDir[1] * 2.25, 91.5],
    S(G.disc(0, 4.5, 5.6, brBossF, P, 16), { tone: 'mid' }),
    {
      name: 'atrium.bridge.boss',
      bias: 1.8,
      shapes: R ? [A.disc(brBossF, 0, 4.5, 5.6)] : undefined,
    },
  );
  const bridgeP0: k.Point3 = [brBossBase[0] + brOutDir[0] * 4.5, brBossBase[1] + brOutDir[1] * 4.5, 91.5];
  const laBridgeRoute: k.Point3[] = [
    bridgeP0,
    [bridgeP0[0] + (inletTip[0] - bridgeP0[0]) * 0.3, bridgeP0[1] + (inletTip[1] - bridgeP0[1]) * 0.3, 91.5],
    [bridgeP0[0] + (inletTip[0] - bridgeP0[0]) * 0.7, bridgeP0[1] + (inletTip[1] - bridgeP0[1]) * 0.7, 91.5],
    inletTip,
  ];
  addTube('venous-cvp', laBridgeRoute, 3.8, {
    name: 'venous.bridge',
    tone: 'mid',
    touch: ['atrium.bridge.boss', 'pump.inlet.boss'],
    bias: 2.5,
  });

  [LA_Z + 4, LA_Z - 3].forEach((pz, idx) => {
    const ux = -0.82;
    const uy = Math.sqrt(1 - ux * ux);
    const rad = 16.45;
    const pvRoute: k.Point3[] = [
      [LA_XY[0] + ux * (rad + 7.5), LA_XY[1] + uy * (rad + 7.5), pz],
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

  // ─── 6. SORT PAINTER'S ORDER BACK-TO-FRONT ───────────────────────────────
  if (R) {
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
  } else {
    collected.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      return a.depth - b.depth;
    });
    collected.forEach((item, idx) => {
      item.key = idx;
    });
  }

  const pumpKey = collected.find((i) => i.id === 'pump.barrel.glass')?.key ?? 0;
  const domeKey = collected.find((i) => i.id === 'dome.housing')?.key ?? 0;
  const cvpKey = collected.find((i) => i.id === 'cvp.column')?.key ?? 0;

  const finalItems: RigItem[] = collected.map(({ id, piece, key, screen, svg, hasDynamic }) => ({
    id,
    piece,
    key,
    screen,
    svg,
    hasDynamic,
  }));

  const arterialArchGlRoute: k.Point3[] = arterialArchRoute.slice(0);
  const arterialFeedGlRoute: k.Point3[] = arterialFeedRoute.slice(0);
  const venousRoute: k.Point3[] = [
    [VEN_MANIFOLD.x + 9, VEN_MANIFOLD.y, 10],
    ...venousReturnRoute.slice(1),
  ];

  return {
    width: RIG_VIEW_W,
    height: RIG_VIEW_H,
    angleDeg,
    projection: P,
    glCam: glCamera(P),
    haloPath,
    items: finalItems,
    pumpKey,
    domeKey,
    cvpKey,
    arterialArchGlRoute,
    arterialFeedGlRoute,
    venousRoute,
    capillaryRoutes,
    anchors: {
      heartCenter: [hx, hy, 50],
      pumpBoreBottomZ: PUMP_BORE_Z0,
      pumpBoreTopZ: PUMP_BORE_Z1,
      pumpHeadZ: PUMP_HEAD_Z,
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
      pumpGlassSvg: pumpGlass.frontSvg,
      domeGlassSvg,
      cvpGlassSvg,
    },
    auditRecorder: R ?? undefined,
  };
}
