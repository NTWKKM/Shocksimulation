import * as k from '../kit/iso-kit';
import { glLayer, type GlLayerHandle } from '../kit/gl.mjs';
import type { HemodynamicInputs, HemodynamicTelemetry } from '../physics/hemodynamics';
import { RIG_VIEW_H, RIG_VIEW_W, type RigStaticScene } from './rigModel';

const ART_ARCH_PTS = 20;
const ART_FEED_PTS = 8;
const VEN_PTS = 32;
const CAP_SEG = 4;

interface RouteProjectionData {
  artArchPts: Float32Array;
  artFeedPts: Float32Array;
  venPts: Float32Array;
  capPts: Float32Array;
  archBox: [number, number, number, number];
  feedBox: [number, number, number, number];
  capBox: [number, number, number, number];
  venBox: [number, number, number, number];
}

function boxOfFlatArray(pts: Float32Array, pad: number): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < pts.length; i += 3) {
    const x = pts[i]!;
    const y = pts[i + 1]!;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  if (!Number.isFinite(minX)) return [0, 0, 0, 0];
  return [minX - pad, minY - pad, maxX + pad, maxY + pad];
}

function samplePolylineProjected(
  pts3: k.Point3[],
  count: number,
  P: k.Projection,
): Float32Array {
  const out = new Float32Array(count * 3);
  if (pts3.length < 2) return out;

  const proj: Array<{ x: number; y: number; s: number }> = [];
  let total = 0;
  let prev = k.iso(pts3[0]!, P);
  proj.push({ x: prev[0], y: prev[1], s: 0 });
  for (let i = 1; i < pts3.length; i++) {
    const p = k.iso(pts3[i]!, P);
    total += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    proj.push({ x: p[0], y: p[1], s: total });
    prev = p;
  }
  const safeTotal = Math.max(1e-3, total);

  for (let i = 0; i < count; i++) {
    const targetS = (i / (count - 1)) * safeTotal;
    let lo = 0;
    while (lo < proj.length - 2 && proj[lo + 1]!.s < targetS) {
      lo++;
    }
    const a = proj[lo]!;
    const b = proj[lo + 1]!;
    const segLen = Math.max(1e-4, b.s - a.s);
    const t = Math.max(0, Math.min(1, (targetS - a.s) / segLen));
    out[i * 3 + 0] = a.x + (b.x - a.x) * t;
    out[i * 3 + 1] = a.y + (b.y - a.y) * t;
    out[i * 3 + 2] = i / (count - 1);
  }
  return out;
}

function projectRoutesForScene(scene: RigStaticScene): RouteProjectionData {
  const artArchPts = samplePolylineProjected(scene.arterialArchGlRoute, ART_ARCH_PTS, scene.projection);
  const artFeedPts = samplePolylineProjected(scene.arterialFeedGlRoute, ART_FEED_PTS, scene.projection);
  const venPts = samplePolylineProjected(scene.venousRoute, VEN_PTS, scene.projection);
  const capPts = new Float32Array(CAP_SEG * 2 * 3);
  for (let i = 0; i < CAP_SEG; i++) {
    const r = scene.capillaryRoutes[i];
    if (!r || r.length < 2) continue;
    const p0 = k.iso(r[0]!, scene.projection);
    const p1 = k.iso(r[r.length - 1]!, scene.projection);
    capPts[i * 6 + 0] = p0[0];
    capPts[i * 6 + 1] = p0[1];
    capPts[i * 6 + 2] = 0;
    capPts[i * 6 + 3] = p1[0];
    capPts[i * 6 + 4] = p1[1];
    capPts[i * 6 + 5] = 1;
  }
  return {
    artArchPts,
    artFeedPts,
    venPts,
    capPts,
    archBox: boxOfFlatArray(artArchPts, 8),
    feedBox: boxOfFlatArray(artFeedPts, 8),
    capBox: boxOfFlatArray(capPts, 8),
    venBox: boxOfFlatArray(venPts, 8),
  };
}

const FRAGMENT_SHADER = `
uniform vec4 uViewBox;
uniform float uLight;
uniform float uPhase;
uniform float uLvFrac;
uniform float uEjection;
uniform float uPaNorm;
uniform float uCvpNorm;
uniform float uPerfusion;
uniform float uSvrNorm;
uniform float uFlowArt;
uniform float uFlowVen;
uniform vec3 uHeart;
uniform vec4 uDome;
uniform vec4 uCvp;
uniform vec4 uTray;
uniform vec4 uArchBox;
uniform vec4 uFeedBox;
uniform vec4 uCapBox;
uniform vec4 uVenBox;
uniform vec3 uArtArchPts[${ART_ARCH_PTS}];
uniform vec3 uArtFeedPts[${ART_FEED_PTS}];
uniform vec3 uVenPts[${VEN_PTS}];
uniform vec3 uCapPts[${CAP_SEG * 2}];

vec4 over(vec4 fg, vec4 bg) {
  return fg + bg * (1.0 - fg.a);
}

float sdSeg(vec2 p, vec2 a, vec2 b, out float u) {
  vec2 ab = b - a;
  float l2 = dot(ab, ab);
  u = l2 > 1e-4 ? clamp(dot(p - a, ab) / l2, 0.0, 1.0) : 0.0;
  return length(p - (a + ab * u));
}

vec2 traceVen(vec2 vb) {
  float minD = 1e5;
  float bestS = 0.0;
  for (int i = 0; i < ${VEN_PTS - 1}; i++) {
    float u = 0.0;
    float d = sdSeg(vb, uVenPts[i].xy, uVenPts[i + 1].xy, u);
    if (d < minD) {
      minD = d;
      bestS = mix(uVenPts[i].z, uVenPts[i + 1].z, u);
    }
  }
  return vec2(minD, bestS);
}

vec2 traceArch(vec2 vb) {
  float minD = 1e5;
  float bestS = 0.0;
  for (int i = 0; i < ${ART_ARCH_PTS - 1}; i++) {
    float u = 0.0;
    float d = sdSeg(vb, uArtArchPts[i].xy, uArtArchPts[i + 1].xy, u);
    if (d < minD) {
      minD = d;
      bestS = mix(uArtArchPts[i].z, uArtArchPts[i + 1].z, u);
    }
  }
  return vec2(minD, bestS);
}

vec2 traceFeed(vec2 vb) {
  float minD = 1e5;
  float bestS = 0.0;
  for (int i = 0; i < ${ART_FEED_PTS - 1}; i++) {
    float u = 0.0;
    float d = sdSeg(vb, uArtFeedPts[i].xy, uArtFeedPts[i + 1].xy, u);
    if (d < minD) {
      minD = d;
      bestS = mix(uArtFeedPts[i].z, uArtFeedPts[i + 1].z, u);
    }
  }
  return vec2(minD, bestS);
}

// Compute 3D cylinder column hit along orthographic camera ray through vb
vec2 cylColumnMask(vec2 vb, vec2 centerXY, float r, float zBot, float zTop, out float radialNorm, out float meniscus) {
  vec3 ro = onFloor(vb, zTop + 26.0);
  vec3 rd = -towardViewer();
  vec2 d0 = ro.xy - centerXY;
  float A = dot(rd.xy, rd.xy);
  float B = dot(d0, rd.xy);
  float C = dot(d0, d0) - r * r;
  float disc = B * B - A * C;
  radialNorm = 1.0;
  meniscus = 0.0;
  if (disc <= 0.0 || A <= 1e-6) return vec2(0.0);

  float sq = sqrt(disc);
  float tNear = (-B - sq) / A;
  float tFar = (-B + sq) / A;
  float tZTop = (zTop - ro.z) / rd.z;
  float tZBot = (zBot - ro.z) / rd.z;
  float tMin = max(tNear, min(tZTop, tZBot));
  float tMax = min(tFar, max(tZTop, tZBot));
  if (tMax <= tMin) return vec2(0.0);

  vec3 pHit = ro + rd * tMin;
  radialNorm = clamp(length(pHit.xy - centerXY) / r, 0.0, 1.0);
  float thickness = clamp((tMax - tMin) / (2.0 * r), 0.0, 1.0);
  float px = pixelOf();
  float capTop = 1.0 - smoothstep(0.0, 1.6 * px, abs(pHit.z - zTop));
  meniscus = capTop * smoothstep(0.05, 0.35, thickness);
  return vec2(smoothstep(0.02, 0.28, thickness), thickness);
}

vec4 shadeLightInk(vec3 bodyCol, vec3 coreCol, float density, float coreWeight) {
  if (density <= 0.002) return vec4(0.0);
  float cap = 0.78;
  float a = cap * (1.0 - exp(-1.55 * density / cap));
  vec3 col = mix(bodyCol, coreCol, clamp(coreWeight, 0.0, 1.0));
  return vec4(col * a, a);
}

vec4 shadeDarkGlow(vec3 baseCol, vec3 coreCol, float density, float coreWeight) {
  if (density <= 0.002) return vec4(0.0);
  vec3 e = mix(baseCol, coreCol, clamp(coreWeight, 0.0, 1.0)) * density;
  vec3 mapped = tonemap(e, 1.15);
  float a = clamp(max(mapped.r, max(mapped.g, mapped.b)) * 0.96, 0.0, 0.96);
  return vec4(mapped, a);
}

void main() {
  vec2 uvNorm = viewOf(gl_FragCoord.xy) / uView;
  vec2 vb = uViewBox.xy + uvNorm * uViewBox.zw;

  // Keep canvas margins strictly zero so edges never show hard cuts
  float edgeWin = window(uvNorm.x, 0.015, 0.985, 0.012) * window(uvNorm.y, 0.015, 0.985, 0.012);
  if (edgeWin <= 0.001) {
    gl_FragColor = vec4(0.0);
    return;
  }

  vec4 outCol = vec4(0.0);

  vec3 artBody = uLight > 0.5 ? vec3(0.84, 0.21, 0.24) : vec3(0.95, 0.30, 0.28);
  vec3 artCore = uLight > 0.5 ? vec3(0.94, 0.42, 0.35) : vec3(1.00, 0.62, 0.52);
  vec3 venBody = uLight > 0.5 ? vec3(0.20, 0.38, 0.80) : vec3(0.28, 0.52, 0.98);
  vec3 venCore = uLight > 0.5 ? vec3(0.36, 0.54, 0.92) : vec3(0.56, 0.78, 1.00);
  vec3 perfWarm = uLight > 0.5 ? vec3(0.76, 0.26, 0.28) : vec3(0.92, 0.34, 0.32);
  vec3 perfPale = uLight > 0.5 ? vec3(0.26, 0.42, 0.72) : vec3(0.32, 0.52, 0.86);

  // 1. 360° Sight-Glass Pump Chamber Blood Column (visible from all azimuths below piston head)
  float radialLv = 1.0;
  float menLv = 0.0;
  float zPistonBot = 32.0 + clamp(uLvFrac, 0.14, 0.92) * 27.0;
  vec2 lvMask = cylColumnMask(vb, uHeart.xy, 17.4, 29.5, zPistonBot, radialLv, menLv);
  if (lvMask.x > 0.0) {
    float beatCore = 0.28 + 0.72 * uEjection;
    float lvDens = lvMask.x * (0.50 + 0.44 * lvMask.y + 0.36 * beatCore);
    float coreW = (1.0 - radialLv * radialLv) * (0.35 + 0.55 * uEjection) + menLv * 0.45;
    vec4 lvCol = uLight > 0.5
      ? shadeLightInk(artBody, artCore, lvDens, coreW)
      : shadeDarkGlow(artBody, artCore, lvDens * 0.92, coreW);
    outCol = over(lvCol, outCol);
  }

  // 2. Windkessel Arterial Glass Dome Column
  float radialDome = 1.0;
  float menDome = 0.0;
  float domeZTop = uDome.z + 4.0 + clamp(uPaNorm, 0.14, 0.88) * 44.0;
  vec2 domeMask = cylColumnMask(vb, uDome.xy, uDome.w, uDome.z + 2.0, domeZTop, radialDome, menDome);
  if (domeMask.x > 0.0) {
    float ripple = 0.06 * uEjection * sin(radialDome * 9.0 - uTime * 8.0);
    float dens = domeMask.x * (0.52 + 0.42 * domeMask.y + 0.25 * uEjection + ripple) + menDome * 0.42;
    float coreW = (1.0 - pow(radialDome, 1.6)) * 0.55 + menDome * 0.6;
    vec4 domeCol = uLight > 0.5
      ? shadeLightInk(artBody, artCore, dens, coreW)
      : shadeDarkGlow(artBody, artCore, dens * 0.88, coreW);
    outCol = over(domeCol, outCol);
  }

  // 3. Graduated CVP Venous Standpipe Column
  float radialCvp = 1.0;
  float menCvp = 0.0;
  float cvpZTop = uCvp.z + 4.0 + clamp(uCvpNorm, 0.08, 0.96) * 70.0;
  vec2 cvpMask = cylColumnMask(vb, uCvp.xy, uCvp.w, uCvp.z + 2.0, cvpZTop, radialCvp, menCvp);
  if (cvpMask.x > 0.0) {
    float dens = cvpMask.x * (0.52 + 0.38 * cvpMask.y + 0.14 * uFlowVen) + menCvp * 0.38;
    float coreW = (1.0 - pow(radialCvp, 1.7)) * 0.48 + menCvp * 0.55;
    vec4 cvpCol = uLight > 0.5
      ? shadeLightInk(venBody, venCore, dens, coreW)
      : shadeDarkGlow(venBody, venCore, dens * 0.85, coreW);
    outCol = over(cvpCol, outCol);
  }

  // 4. Microvascular Perfusion Bed Tray Surface Glow (z = 11)
  vec3 trayHit = onFloor(vb, 11.0);
  if (
    trayHit.x >= uTray.x + 1.0 &&
    trayHit.x <= uTray.x + uTray.z - 1.0 &&
    trayHit.y >= uTray.y + 1.0 &&
    trayHit.y <= uTray.y + uTray.w - 1.0
  ) {
    float tx = (trayHit.x - uTray.x) / uTray.z;
    float ty = (trayHit.y - uTray.y) / uTray.w;
    float edgeMask = window(tx, 0.04, 0.96, 0.05) * window(ty, 0.04, 0.96, 0.05);
    float cell = 0.72 + 0.28 * fbm2(trayHit.xy * 0.22 - vec2(uTime * 0.35 * uFlowArt, 0.0));
    float perfMix = clamp(uPerfusion, 0.0, 1.0);
    vec3 trayTone = mix(perfPale, perfWarm, perfMix);
    float trayDens = edgeMask * cell * (0.14 + 0.28 * perfMix + 0.14 * uEjection * perfMix);
    vec4 trayCol = uLight > 0.5
      ? shadeLightInk(trayTone, artCore, trayDens * 0.82, perfMix * 0.25)
      : shadeDarkGlow(trayTone, artCore, trayDens * 0.72, perfMix * 0.25);
    outCol = over(trayCol, outCol);
  }

  // 5a. Arterial Arch Wavefront (dynamic rotated screen-space bbox)
  if (vb.x > uArchBox.x && vb.x < uArchBox.z && vb.y > uArchBox.y && vb.y < uArchBox.w) {
    vec2 arch = traceArch(vb);
    float halfW = 3.2;
    if (arch.x < halfW) {
      float radFade = 1.0 - smoothstep(0.6, halfW, arch.x);
      float endFade = window(arch.y, 0.04, 0.94, 0.06);
      float wave = fract(arch.y * 1.4 - uTime * (0.55 + 0.75 * uFlowArt));
      float packet = exp(-pow((wave - 0.5) / 0.18, 2.0));
      float dens = radFade * endFade * (0.10 + 0.48 * packet * (0.35 + 0.65 * uFlowArt));
      vec4 artCol = uLight > 0.5
        ? shadeLightInk(artBody, artCore, dens * 0.68, packet * 0.55)
        : shadeDarkGlow(artBody, artCore, dens * 0.68, packet * 0.55);
      outCol = over(artCol, outCol);
    }
  }

  // 5b. Arterial Feed Pipe into SVR Manifold
  if (vb.x > uFeedBox.x && vb.x < uFeedBox.z && vb.y > uFeedBox.y && vb.y < uFeedBox.w) {
    vec2 feed = traceFeed(vb);
    float halfW = 2.4;
    if (feed.x < halfW) {
      float radFade = 1.0 - smoothstep(0.4, halfW, feed.x);
      float endFade = window(feed.y, 0.08, 0.94, 0.08);
      float wave = fract(feed.y * 1.2 - uTime * (0.55 + 0.75 * uFlowArt));
      float packet = exp(-pow((wave - 0.5) / 0.20, 2.0));
      float dens = radFade * endFade * (0.10 + 0.44 * packet * (0.35 + 0.65 * uFlowArt));
      vec4 feedCol = uLight > 0.5
        ? shadeLightInk(artBody, artCore, dens * 0.68, packet * 0.5)
        : shadeDarkGlow(artBody, artCore, dens * 0.68, packet * 0.5);
      outCol = over(feedCol, outCol);
    }
  }

  // 6. Four Capillary Perfusion Branches
  if (vb.x > uCapBox.x && vb.x < uCapBox.z && vb.y > uCapBox.y && vb.y < uCapBox.w) {
    float capD = 1e5;
    float capU = 0.0;
    for (int c = 0; c < ${CAP_SEG}; c++) {
      float u = 0.0;
      float d = sdSeg(vb, uCapPts[c * 2].xy, uCapPts[c * 2 + 1].xy, u);
      if (d < capD) {
        capD = d;
        capU = u;
      }
    }
    float capHalfW = mix(2.0, 1.1, clamp(uSvrNorm, 0.0, 1.0));
    if (capD < capHalfW) {
      float radFade = 1.0 - smoothstep(0.2, capHalfW, capD);
      float wave = fract(capU * 1.4 - uTime * (0.40 + 0.60 * uFlowArt));
      float pulse = exp(-pow((wave - 0.5) / 0.22, 2.0));
      vec3 capTone = mix(perfPale, artBody, uPerfusion);
      float dens = radFade * (0.14 + 0.48 * pulse * (0.25 + 0.75 * uPerfusion));
      vec4 capCol = uLight > 0.5
        ? shadeLightInk(capTone, artCore, dens * 0.78, pulse * 0.45)
        : shadeDarkGlow(capTone, artCore, dens * 0.78, pulse * 0.45);
      outCol = over(capCol, outCol);
    }
  }

  // 7. Exposed Venous Return Loop
  if (vb.x > uVenBox.x && vb.x < uVenBox.z && vb.y > uVenBox.y && vb.y < uVenBox.w) {
    vec2 ven = traceVen(vb);
    float halfW = 2.2;
    if (ven.x < halfW) {
      float radFade = 1.0 - smoothstep(0.4, halfW, ven.x);
      float endFade = window(ven.y, 0.03, 0.96, 0.04);
      float wave = fract(ven.y * 2.4 - uTime * (0.35 + 0.55 * uFlowVen));
      float packet = exp(-pow((wave - 0.5) / 0.18, 2.0));
      float dens = radFade * endFade * (0.08 + 0.36 * packet * (0.3 + 0.7 * uFlowVen));
      vec4 venCol = uLight > 0.5
        ? shadeLightInk(venBody, venCore, dens * 0.65, packet * 0.45)
        : shadeDarkGlow(venBody, venCore, dens * 0.65, packet * 0.45);
      outCol = over(venCol, outCol);
    }
  }

  // Dither & clean alpha threshold per anatomy/webgl rules (rgb <= a, 0 at canvas border)
  float dither = (hash12(gl_FragCoord.xy) - 0.5) / 255.0;
  outCol *= edgeWin;
  outCol.a = clamp(outCol.a + dither, 0.0, 1.0);
  outCol.a *= smoothstep(0.0, 1.5 / 255.0, outCol.a);
  outCol.rgb = clamp(outCol.rgb + dither * outCol.a, 0.0, outCol.a);
  gl_FragColor = outCol;
}
`;

export interface HemodynamicGlController {
  updateCameraAndRoutes: (scene: RigStaticScene) => void;
  draw: (
    telemetry: HemodynamicTelemetry,
    inputs: HemodynamicInputs,
    viewBox: [number, number, number, number],
    theme: 'dark' | 'light',
    timeSec: number,
  ) => void;
  clear: () => void;
}

export function createHemodynamicGl(
  canvas: HTMLCanvasElement,
  initialScene: RigStaticScene,
): HemodynamicGlController | null {
  const initialRoutes = projectRoutesForScene(initialScene);
  const a = initialScene.anchors;
  let currentGlCam = initialScene.glCam;

  const layer: GlLayerHandle | null = glLayer({
    canvas,
    fragment: FRAGMENT_SHADER,
    view: [RIG_VIEW_W, RIG_VIEW_H],
    camera: currentGlCam,
    uniforms: [
      'uViewBox',
      'uLight',
      'uPhase',
      'uLvFrac',
      'uEjection',
      'uPaNorm',
      'uCvpNorm',
      'uPerfusion',
      'uSvrNorm',
      'uFlowArt',
      'uFlowVen',
      'uArchBox',
      'uFeedBox',
      'uCapBox',
      'uVenBox',
      'uArtArchPts',
      'uArtFeedPts',
      'uVenPts',
      'uCapPts',
    ],
    fixed: {
      uHeart: [a.heartCenter[0], a.heartCenter[1], a.heartCenter[2]],
      uDome: [a.domeCenter[0], a.domeCenter[1], a.domeBottomZ, a.domeRadius - 2.6],
      uCvp: [a.cvpCenter[0], a.cvpCenter[1], a.cvpBottomZ, a.cvpRadius - 2.2],
      uTray: [a.perfusionTray.x, a.perfusionTray.y, a.perfusionTray.w, a.perfusionTray.d],
      uArchBox: initialRoutes.archBox,
      uFeedBox: initialRoutes.feedBox,
      uCapBox: initialRoutes.capBox,
      uVenBox: initialRoutes.venBox,
      uArtArchPts: initialRoutes.artArchPts,
      uArtFeedPts: initialRoutes.artFeedPts,
      uVenPts: initialRoutes.venPts,
      uCapPts: initialRoutes.capPts,
    },
    maxRatio: 1.5,
  });

  if (!layer) return null;

  return {
    updateCameraAndRoutes(scene: RigStaticScene) {
      currentGlCam = scene.glCam;
      const routes = projectRoutesForScene(scene);
      layer.set({
        uArchBox: routes.archBox,
        uFeedBox: routes.feedBox,
        uCapBox: routes.capBox,
        uVenBox: routes.venBox,
        uArtArchPts: routes.artArchPts,
        uArtFeedPts: routes.artFeedPts,
        uVenPts: routes.venPts,
        uCapPts: routes.capPts,
      });
    },
    draw(telemetry, inputs, viewBox, theme, timeSec) {
      const lvFrac = Math.max(0.14, Math.min(0.92, (telemetry.lvVolumeMl - 30) / 145));
      const ejection = telemetry.isSystole
        ? Math.max(0.1, Math.min(1, telemetry.aorticOpen * 0.8 + telemetry.aorticFlowLMin / 24))
        : 0.08;
      const paNorm = Math.max(0.14, Math.min(0.88, (telemetry.aorticPressureMmHg - 25) / 140));
      const cvpNorm = Math.max(0.08, Math.min(0.96, inputs.cvp / 28));
      const perfusion = Math.max(0, Math.min(1, (telemetry.map - 38) / 45));
      const svrNorm = Math.max(0, Math.min(1, (telemetry.effectiveSvr - 5) / 25));
      const flowArt = Math.max(0.15, Math.min(1.4, telemetry.coLMin / 5.0));
      const flowVen = Math.max(0.15, Math.min(1.3, (telemetry.coLMin / 5.0) * (0.7 + 0.3 * cvpNorm)));

      layer.draw(
        {
          uOrigin: currentGlCam.origin,
          uK: currentGlCam.k,
          uCam: currentGlCam.cam,
          uViewBox: viewBox,
          uLight: theme === 'light' ? 1.0 : 0.0,
          uPhase: telemetry.phase,
          uLvFrac: lvFrac,
          uEjection: ejection,
          uPaNorm: paNorm,
          uCvpNorm: cvpNorm,
          uPerfusion: perfusion,
          uSvrNorm: svrNorm,
          uFlowArt: flowArt,
          uFlowVen: flowVen,
        },
        timeSec,
      );
    },
    clear() {
      layer.clear();
    },
  };
}
