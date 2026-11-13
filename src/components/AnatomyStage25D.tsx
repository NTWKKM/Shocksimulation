import { useEffect, useRef, useState } from 'react';
import type { AnatomyFocusId, HemodynamicTelemetry } from '../physics/hemodynamics';

interface AnatomyStage25DProps {
  selectedPart: AnatomyFocusId | null;
  hoveredPart: AnatomyFocusId | null;
  drawerOpen: boolean;
  onSelectPart: (partId: AnatomyFocusId | null) => void;
  onHoverPart: (partId: AnatomyFocusId | null) => void;
  onStepPhysics: (dtSec: number) => HemodynamicTelemetry;
}

interface FocusTransform {
  scale: number;
  tx: number;
  ty: number;
}

const FOCUS_TRANSFORMS: Record<'default' | AnatomyFocusId, FocusTransform> = {
  default: { scale: 1.0, tx: 0, ty: 0 },
  'lv-edv': { scale: 1.48, tx: 75, ty: -55 },
  'myocardium-lvef': { scale: 1.42, tx: 95, ty: -70 },
  'aorta-map': { scale: 1.45, tx: -35, ty: 105 },
  'arterioles-svr': { scale: 1.48, tx: -250, ty: -45 },
  'venous-cvp': { scale: 1.42, tx: 160, ty: 65 },
};

interface Vec2 {
  x: number;
  y: number;
}

// Smooth Catmull-Rom spline evaluator for 2.5D Canvas erythrocyte trajectories
function sampleSpline(pts: Vec2[], t: number): { x: number; y: number; tx: number; ty: number } {
  const n = pts.length - 1;
  const scaled = Math.max(0, Math.min(n - 0.0001, t * n));
  const i = Math.floor(scaled);
  const u = scaled - i;

  const p0 = pts[Math.max(0, i - 1)];
  const p1 = pts[i];
  const p2 = pts[Math.min(n, i + 1)];
  const p3 = pts[Math.min(n, i + 2)];

  const u2 = u * u;
  const u3 = u2 * u;

  const x =
    0.5 *
    (2 * p1.x +
      (-p0.x + p2.x) * u +
      (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 +
      (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3);
  const y =
    0.5 *
    (2 * p1.y +
      (-p0.y + p2.y) * u +
      (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 +
      (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3);

  const dx =
    0.5 *
    (-p0.x +
      p2.x +
      2 * (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u +
      3 * (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u2);
  const dy =
    0.5 *
    (-p0.y +
      p2.y +
      2 * (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u +
      3 * (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u2);

  const len = Math.hypot(dx, dy) || 1;
  return { x, y, tx: dx / len, ty: dy / len };
}

// Anatomical path 1: LV outflow -> Aortic Valve -> Aortic Arch -> Descending Aorta -> Arteriolar Bed
const ARTERIAL_PATH: Vec2[] = [
  { x: 525, y: 418 },
  { x: 540, y: 345 },
  { x: 558, y: 270 },
  { x: 562, y: 185 },
  { x: 615, y: 118 },
  { x: 700, y: 122 },
  { x: 760, y: 185 },
  { x: 785, y: 280 },
  { x: 795, y: 375 },
  { x: 830, y: 445 },
];

// Anatomical path 2: Venous return collector -> Systemic vein -> Left Atrium -> Mitral -> LV center
const VENOUS_PATH: Vec2[] = [
  { x: 828, y: 494 },
  { x: 725, y: 526 },
  { x: 560, y: 536 },
  { x: 405, y: 495 },
  { x: 342, y: 432 },
  { x: 344, y: 345 },
  { x: 408, y: 278 },
  { x: 468, y: 278 },
  { x: 492, y: 335 },
  { x: 522, y: 412 },
];

export function AnatomyStage25D({
  selectedPart,
  hoveredPart,
  drawerOpen,
  onSelectPart,
  onHoverPart,
  onStepPhysics,
}: AnatomyStage25DProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Direct SVG element refs for smooth 60fps anatomical tissue deformation without React re-renders
  const lvWallGroupRef = useRef<SVGGElement | null>(null);
  const lvCavityRef = useRef<SVGPathElement | null>(null);
  const mitralAntRef = useRef<SVGPathElement | null>(null);
  const mitralPostRef = useRef<SVGPathElement | null>(null);
  const chordaeGroupRef = useRef<SVGGElement | null>(null);
  const aorticLeftRef = useRef<SVGPathElement | null>(null);
  const aorticRightRef = useRef<SVGPathElement | null>(null);
  const aortaLumenRef = useRef<SVGPathElement | null>(null);
  const aortaOuterRef = useRef<SVGPathElement | null>(null);
  const atriumRef = useRef<SVGGElement | null>(null);
  const arteriolePathsRef = useRef<Array<SVGPathElement | null>>([]);
  const perfusionGlowRef = useRef<SVGEllipseElement | null>(null);

  // Keep latest physics callback in ref
  const stepCallbackRef = useRef(onStepPhysics);
  stepCallbackRef.current = onStepPhysics;

  // 2.5D pointer parallax tilt state (subtle textbook plate tilt)
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const tiltRef = useRef({ rx: 0, ry: 0, targetRx: 0, targetRy: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rbcCount = 120;
    const progress = new Float32Array(rbcCount);
    const radial = new Float32Array(rbcCount);
    const spin = new Float32Array(rbcCount);
    for (let i = 0; i < rbcCount; i++) {
      progress[i] = (i / rbcCount + Math.random() * 0.015) % 1;
      radial[i] = (Math.random() - 0.5) * 18;
      spin[i] = Math.random() * Math.PI * 2;
    }

    let rafId = 0;
    let lastTime = performance.now();
    let tiltSyncAcc = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      const t = stepCallbackRef.current(dt);

      // 1. LV Wall & Endocardial Cavity Deformation (Preload EDV + Systolic Wall Thickening)
      const volRatio = Math.max(0.45, Math.min(1.42, t.lvVolumeMl / 120));
      const cavScaleX = Math.pow(volRatio, 0.45);
      const cavScaleY = Math.pow(volRatio, 0.28);
      const wallScaleX = 0.88 + (cavScaleX - 0.88) * 0.62;
      const wallScaleY = 0.9 + (cavScaleY - 0.9) * 0.62;

      if (lvWallGroupRef.current) {
        lvWallGroupRef.current.setAttribute(
          'transform',
          `translate(515, 395) scale(${wallScaleX.toFixed(4)}, ${wallScaleY.toFixed(4)}) translate(-515, -395)`,
        );
      }
      if (lvCavityRef.current) {
        lvCavityRef.current.setAttribute(
          'transform',
          `translate(515, 395) scale(${cavScaleX.toFixed(4)}, ${cavScaleY.toFixed(4)}) translate(-515, -395)`,
        );
      }

      // 2. Mitral Valve Leaflets + Chordae Tendineae Kinematics
      const mOpen = t.mitralOpen; // 0 = closed, 1 = wide open into LV
      const mAngleDeg = mOpen * 48;
      if (mitralAntRef.current) {
        mitralAntRef.current.setAttribute('transform', `rotate(${-mAngleDeg.toFixed(2)} 470 315)`);
      }
      if (mitralPostRef.current) {
        mitralPostRef.current.setAttribute('transform', `rotate(${mAngleDeg.toFixed(2)} 518 320)`);
      }
      if (chordaeGroupRef.current) {
        // Subtle flex synced with mitral opening
        const chordStretch = 1 + mOpen * 0.06;
        chordaeGroupRef.current.setAttribute(
          'transform',
          `translate(495, 420) scale(1, ${chordStretch.toFixed(4)}) translate(-495, -420)`,
        );
      }

      // 3. Aortic Semilunar Valve Cusps Kinematics
      const aOpen = t.aorticOpen; // 0 = closed coapted, 1 = open upward into aorta
      const aAngleDeg = aOpen * 52;
      if (aorticLeftRef.current) {
        aorticLeftRef.current.setAttribute('transform', `rotate(${-aAngleDeg.toFixed(2)} 534 294)`);
      }
      if (aorticRightRef.current) {
        aorticRightRef.current.setAttribute('transform', `rotate(${aAngleDeg.toFixed(2)} 568 298)`);
      }

      // 4. Windkessel Arterial Compliance Pulse on Aortic Arch
      const paNorm = Math.max(-0.12, Math.min(1.15, (t.aorticPressureMmHg - 45) / 90));
      const lumenWidth = 30 + paNorm * 7.5;
      const wallWidth = 42 + paNorm * 8.0;
      if (aortaLumenRef.current) {
        aortaLumenRef.current.setAttribute('stroke-width', lumenWidth.toFixed(2));
      }
      if (aortaOuterRef.current) {
        aortaOuterRef.current.setAttribute('stroke-width', wallWidth.toFixed(2));
      }

      // 5. Left Atrium & Venous Return Swelling (CVP)
      const cvpScale = 1 + Math.max(-0.08, Math.min(0.22, (t.lvPressureMmHg - 8) * 0.008));
      if (atriumRef.current) {
        atriumRef.current.setAttribute(
          'transform',
          `translate(445, 270) scale(${cvpScale.toFixed(4)}) translate(-445, -270)`,
        );
      }

      // 6. Peripheral Arteriolar Bed Vasoconstriction / Vasodilation (SVR)
      // SVR 12 WU = base 1.0x; SVR 5 = 1.65x wide; SVR 30 = 0.48x tight
      const svrScale = Math.max(0.48, Math.min(1.65, 12 / Math.max(5, t.effectiveSvr)));
      const baseWidths = [15, 11, 9, 10, 8];
      for (let i = 0; i < arteriolePathsRef.current.length; i++) {
        const el = arteriolePathsRef.current[i];
        if (el) {
          el.setAttribute('stroke-width', (baseWidths[i] * svrScale).toFixed(2));
        }
      }
      if (perfusionGlowRef.current) {
        const perfOpacity = Math.max(0.08, Math.min(0.45, (t.map - 30) / 140));
        perfusionGlowRef.current.setAttribute('fill-opacity', perfOpacity.toFixed(3));
      }

      // 7. Canvas2D Erythrocyte Fluid Simulation (Poiseuille velocity + Windkessel flow)
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const splitIdx = Math.floor(rbcCount * 0.56);
      const windkesselRunoff = Math.max(
        0.1,
        (t.aorticPressureMmHg - 5) / Math.max(5, t.effectiveSvr) / 14,
      );
      const arterialSpeed = 0.075 + t.aorticFlowLMin * 0.02 + windkesselRunoff * 0.13;
      const venousSpeed = 0.085 + t.mitralFlowLMin * 0.018 + (t.coLMin / 5) * 0.11;

      for (let i = 0; i < rbcCount; i++) {
        const isArt = i < splitIdx;
        const baseSpeed = isArt ? arterialSpeed : venousSpeed;
        const rNorm = Math.abs(radial[i]) / 10;
        const poiseuille = 1.0 - Math.min(0.55, rNorm * 0.48);

        progress[i] = (progress[i] + baseSpeed * poiseuille * dt) % 1;
        spin[i] += dt * (1.8 + baseSpeed * 3.0);

        const pt = sampleSpline(isArt ? ARTERIAL_PATH : VENOUS_PATH, progress[i]);
        // Normal perpendicular to vessel tangent
        const nx = -pt.ty;
        const ny = pt.tx;
        const vesselRadiusMod = isArt ? 1.0 + paNorm * 0.15 : 0.92;
        const px = pt.x + nx * radial[i] * vesselRadiusMod;
        const py = pt.y + ny * radial[i] * vesselRadiusMod;

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(Math.atan2(pt.ty, pt.tx) + Math.sin(spin[i]) * 0.35);

        // Biconcave medical-atlas erythrocyte disc
        ctx.beginPath();
        ctx.ellipse(0, 0, 6.2, 3.8, 0, 0, Math.PI * 2);
        ctx.fillStyle = isArt ? 'rgba(217, 45, 32, 0.88)' : 'rgba(136, 19, 55, 0.78)';
        ctx.fill();
        ctx.lineWidth = 0.8;
        ctx.strokeStyle = isArt ? 'rgba(127, 29, 29, 0.65)' : 'rgba(76, 5, 25, 0.65)';
        ctx.stroke();

        // Central pallor biconcave dimple
        ctx.beginPath();
        ctx.ellipse(0, 0, 2.7, 1.4, 0, 0, Math.PI * 2);
        ctx.fillStyle = isArt ? 'rgba(254, 202, 202, 0.48)' : 'rgba(190, 24, 93, 0.35)';
        ctx.fill();
        ctx.restore();
      }

      // Smooth 2.5D tilt interpolation
      const tl = tiltRef.current;
      const damp = 1 - Math.exp(-7 * dt);
      tl.rx += (tl.targetRx - tl.rx) * damp;
      tl.ry += (tl.targetRy - tl.ry) * damp;
      tiltSyncAcc += dt;
      if (tiltSyncAcc > 0.04) {
        tiltSyncAcc = 0;
        setTilt({ rx: tl.rx, ry: tl.ry });
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const activeFocus = selectedPart ? FOCUS_TRANSFORMS[selectedPart] : FOCUS_TRANSFORMS.default;
  // Center specimen in open stage space to the right of TelemetryHud
  const drawerOffsetX = drawerOpen ? 55 : 85;

  const isHighlighted = (id: AnatomyFocusId) => selectedPart === id || hoveredPart === id;

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    tiltRef.current.targetRy = nx * 5.5;
    tiltRef.current.targetRx = -ny * 4.5;
  };

  const handlePointerLeave = () => {
    tiltRef.current.targetRx = 0;
    tiltRef.current.targetRy = 0;
  };

  return (
    <div
      ref={stageRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onSelectPart(null);
        }
      }}
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_55%_42%,#FFFFFF_0%,#F4F6F9_58%,#E9EEF5_100%)]"
      style={{ perspective: '1400px' }}
    >
      {/* Subtle Anatomical Plate Drafting Grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-45"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(15,23,42,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* 2.5D Transform Stage */}
      <div
        className="relative w-full max-w-[1140px] aspect-[1100/720] transition-transform duration-500 ease-out"
        style={{
          transform: `translate(${activeFocus.tx + drawerOffsetX}px, ${activeFocus.ty}px) scale(${activeFocus.scale}) rotateX(${tilt.rx.toFixed(2)}deg) rotateY(${tilt.ry.toFixed(2)}deg)`,
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Main Medical Textbook Layered SVG Illustration */}
        <svg
          viewBox="0 0 1100 720"
          className="h-full w-full select-none overflow-visible drop-shadow-[0_24px_38px_rgba(15,23,42,0.12)]"
          role="img"
          aria-label="2.5D anatomical cutaway diagram of the human heart, aorta, arteriolar resistance bed, and venous return"
        >
          <defs>
            {/* Myocardium outer wall shading */}
            <linearGradient id="grad-myo-outer" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#DF6D75" />
              <stop offset="52%" stopColor="#BA3B46" />
              <stop offset="100%" stopColor="#7C1D28" />
            </linearGradient>

            {/* Cutaway muscle wall cross-section */}
            <linearGradient id="grad-myo-cut" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#EF8C93" />
              <stop offset="55%" stopColor="#D15661" />
              <stop offset="100%" stopColor="#9F2C38" />
            </linearGradient>

            {/* Right heart & posterior silhouette */}
            <linearGradient id="grad-rv" x1="15%" y1="10%" x2="85%" y2="95%">
              <stop offset="0%" stopColor="#CC6A72" />
              <stop offset="60%" stopColor="#9B3943" />
              <stop offset="100%" stopColor="#691A24" />
            </linearGradient>

            {/* LV inner blood pool / endocardium */}
            <radialGradient id="grad-lv-blood" cx="46%" cy="42%" r="60%">
              <stop offset="0%" stopColor="#E11D48" />
              <stop offset="58%" stopColor="#B91C1C" />
              <stop offset="100%" stopColor="#6B0F1A" />
            </radialGradient>

            {/* Aortic arterial wall */}
            <linearGradient id="grad-aorta-wall" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F5A3A9" />
              <stop offset="48%" stopColor="#D64A55" />
              <stop offset="100%" stopColor="#921E2A" />
            </linearGradient>

            {/* Venous structures (SVC, IVC, Left Atrium) */}
            <linearGradient id="grad-vein" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7DA2D1" />
              <stop offset="50%" stopColor="#466DA3" />
              <stop offset="100%" stopColor="#233E6B" />
            </linearGradient>

            {/* Pulmonary trunk */}
            <linearGradient id="grad-pulm" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8CAAD4" />
              <stop offset="60%" stopColor="#567BB0" />
              <stop offset="100%" stopColor="#2F4D7B" />
            </linearGradient>

            {/* Epicardial adipose tissue */}
            <linearGradient id="grad-fat" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FDE68A" />
              <stop offset="100%" stopColor="#D9A84E" />
            </linearGradient>

            {/* Fibrous valve cusps */}
            <linearGradient id="grad-valve" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#CBD5E1" />
            </linearGradient>

            {/* Soft radial capillary tissue perfusion blush */}
            <radialGradient id="grad-perfusion" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FB7185" stopOpacity="0.65" />
              <stop offset="55%" stopColor="#F43F5E" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#F43F5E" stopOpacity="0" />
            </radialGradient>

            {/* Subtle striated muscle fiber pattern */}
            <pattern
              id="pattern-muscle"
              width="12"
              height="12"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(28)"
            >
              <line x1="0" y1="0" x2="0" y2="12" stroke="#581018" strokeOpacity="0.16" strokeWidth="2.5" />
            </pattern>

            {/* Soft tissue 2.5D relief shadow */}
            <filter id="tissue-shadow" x="-15%" y="-15%" width="130%" height="130%">
              <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#0F172A" floodOpacity="0.14" />
            </filter>
            <filter id="part-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#0F62FE" floodOpacity="0.48" />
            </filter>
          </defs>

          {/* LAYER 1: POSTERIOR VENOUS RETURN LOOP & SYSTEMIC VENA CAVA */}
          <g
            onClick={(e) => {
              e.stopPropagation();
              onSelectPart('venous-cvp');
            }}
            onMouseEnter={() => onHoverPart('venous-cvp')}
            onMouseLeave={() => onHoverPart(null)}
            className="cursor-pointer"
            filter={isHighlighted('venous-cvp') ? 'url(#part-glow)' : undefined}
          >
            {/* Systemic venous return conduit (from arteriolar venules back up behind heart) */}
            <path
              d="M 830 492 C 745 538, 520 550, 385 488 C 325 460, 325 360, 385 292"
              fill="none"
              stroke="url(#grad-vein)"
              strokeWidth="26"
              strokeLinecap="round"
              opacity="0.82"
            />
            {/* Cylindrical specular vein highlight */}
            <path
              d="M 822 487 C 740 532, 520 544, 390 484 C 335 458, 332 365, 387 298"
              fill="none"
              stroke="#DCE9F9"
              strokeWidth="4"
              strokeLinecap="round"
              opacity="0.35"
            />

            {/* Superior Vena Cava (anatomical silhouette behind right atrium) */}
            <path
              d="M 418 118 C 414 155, 412 188, 416 218 L 448 218 C 446 188, 446 155, 450 118 Z"
              fill="url(#grad-vein)"
              stroke="#1E3A5F"
              strokeWidth="1.2"
            />
          </g>

          {/* LAYER 2: RIGHT HEART SILHOUETTE & PULMONARY TRUNK (Background Anatomical Context) */}
          <g filter="url(#tissue-shadow)">
            {/* Right Atrium & Auricle */}
            <path
              d="M 405 215 C 362 232, 355 298, 385 342 C 405 368, 445 365, 462 325 C 470 280, 455 215, 405 215 Z"
              fill="url(#grad-rv)"
              stroke="#5A151E"
              strokeWidth="1.2"
            />

            {/* Right Ventricle Anterior Wall (partially visible to anatomical right of LV) */}
            <path
              d="M 382 325 C 362 382, 378 468, 438 518 C 468 542, 502 542, 515 520 C 482 465, 458 380, 465 322 Z"
              fill="url(#grad-rv)"
              stroke="#5A151E"
              strokeWidth="1.2"
            />
            {/* Muscle fiber texture overlay on RV */}
            <path
              d="M 382 325 C 362 382, 378 468, 438 518 C 468 542, 502 542, 515 520 C 482 465, 458 380, 465 322 Z"
              fill="url(#pattern-muscle)"
            />

            {/* Epicardial adipose sulcus + Left Anterior Descending (LAD) coronary artery */}
            <path
              d="M 454 316 C 445 375, 456 445, 495 524"
              fill="none"
              stroke="url(#grad-fat)"
              strokeWidth="12"
              strokeLinecap="round"
              opacity="0.72"
            />
            <path
              d="M 468 308 C 455 365, 460 438, 494 518 M 461 382 C 438 402, 422 425, 412 452 M 468 430 C 445 452, 434 475, 432 496"
              fill="none"
              stroke="#DC2626"
              strokeWidth="3.2"
              strokeLinecap="round"
            />

            {/* Pulmonary Trunk arching out from RV infundibulum */}
            <path
              d="M 455 318 C 465 255, 488 205, 525 186 C 556 170, 595 178, 622 192 L 608 218 C 585 206, 558 202, 535 215 C 508 230, 492 272, 485 320 Z"
              fill="url(#grad-pulm)"
              stroke="#243B61"
              strokeWidth="1.2"
            />
            <path
              d="M 498 202 C 472 196, 450 202, 434 214 L 444 236 C 458 228, 476 225, 495 228 Z"
              fill="url(#grad-pulm)"
              stroke="#243B61"
              strokeWidth="1"
            />
          </g>

          {/* LAYER 3: LEFT ATRIUM & PULMONARY VEIN INFLOW (CVP) */}
          <g
            ref={atriumRef}
            onClick={(e) => {
              e.stopPropagation();
              onSelectPart('venous-cvp');
            }}
            onMouseEnter={() => onHoverPart('venous-cvp')}
            onMouseLeave={() => onHoverPart(null)}
            className="cursor-pointer"
            filter={isHighlighted('venous-cvp') ? 'url(#part-glow)' : 'url(#tissue-shadow)'}
          >
            {/* Left Pulmonary Veins */}
            <path
              d="M 366 250 C 392 258, 410 264, 425 270 M 362 290 C 388 292, 408 290, 422 288"
              fill="none"
              stroke="url(#grad-vein)"
              strokeWidth="16"
              strokeLinecap="round"
            />
            {/* Left Atrium Cutaway Chamber */}
            <path
              d="M 412 246 C 400 282, 420 318, 464 322 C 495 324, 514 295, 502 256 C 490 222, 428 218, 412 246 Z"
              fill="url(#grad-vein)"
              stroke="#1E3A5F"
              strokeWidth="1.6"
            />
            <path
              d="M 426 255 C 418 282, 434 306, 466 308 C 488 309, 498 288, 488 260 C 478 235, 436 234, 426 255 Z"
              fill="#2B4C7E"
              opacity="0.72"
            />
          </g>

          {/* LAYER 4: LEFT VENTRICLE MYOCARDIUM CUTAWAY (LVEF) & CAVITY (EDV) */}
          <g filter="url(#tissue-shadow)">
            {/* Thick Myocardium Outer Cutaway Shell */}
            <g
              ref={lvWallGroupRef}
              onClick={(e) => {
                e.stopPropagation();
                onSelectPart('myocardium-lvef');
              }}
              onMouseEnter={() => onHoverPart('myocardium-lvef')}
              onMouseLeave={() => onHoverPart(null)}
              className="cursor-pointer"
              filter={isHighlighted('myocardium-lvef') ? 'url(#part-glow)' : undefined}
            >
              {/* Outer Epicardial Contour */}
              <path
                d="M 458 312 C 446 372, 462 465, 505 524 C 532 560, 582 544, 608 490 C 632 438, 622 355, 582 296 L 552 308 C 584 358, 590 426, 572 472 C 556 512, 526 512, 508 480 C 482 432, 474 368, 484 318 Z"
                fill="url(#grad-myo-outer)"
                stroke="#6D131D"
                strokeWidth="1.5"
              />
              {/* Muscular Cut-Section Face */}
              <path
                d="M 458 312 C 446 372, 462 465, 505 524 C 532 560, 582 544, 608 490 C 632 438, 622 355, 582 296 L 564 303 C 598 355, 604 432, 584 480 C 562 528, 526 530, 504 494 C 474 445, 464 372, 474 316 Z"
                fill="url(#grad-myo-cut)"
              />
              {/* Striated Cardiac Muscle Fibers */}
              <path
                d="M 458 312 C 446 372, 462 465, 505 524 C 532 560, 582 544, 608 490 C 632 438, 622 355, 582 296 L 552 308 C 584 358, 590 426, 572 472 C 556 512, 526 512, 508 480 C 482 432, 474 368, 484 318 Z"
                fill="url(#pattern-muscle)"
              />
            </g>

            {/* LV Blood Pool / Endocardial Cavity (EDV - Preload) */}
            <g
              onClick={(e) => {
                e.stopPropagation();
                onSelectPart('lv-edv');
              }}
              onMouseEnter={() => onHoverPart('lv-edv')}
              onMouseLeave={() => onHoverPart(null)}
              className="cursor-pointer"
              filter={isHighlighted('lv-edv') ? 'url(#part-glow)' : undefined}
            >
              <path
                ref={lvCavityRef}
                d="M 476 316 C 468 370, 478 442, 510 488 C 532 518, 562 510, 578 470 C 594 426, 586 358, 558 304 L 476 316 Z"
                fill="url(#grad-lv-blood)"
                stroke="#7F1D1D"
                strokeWidth="1.2"
              />
              {/* Papillary Muscles & Trabeculae Carneae Ridges */}
              <path
                d="M 494 452 C 498 432, 506 420, 512 426 C 516 432, 512 454, 506 476 Z M 552 462 C 546 436, 538 424, 532 430 C 528 436, 534 458, 540 478 Z"
                fill="#B83B47"
                opacity="0.92"
              />
            </g>

            {/* Chordae Tendineae & Mitral Valve Leaflets */}
            <g ref={chordaeGroupRef} className="pointer-events-none">
              <line x1="508" y1="428" x2="482" y2="352" stroke="#F1F5F9" strokeWidth="1.4" opacity="0.88" />
              <line x1="506" y1="432" x2="492" y2="358" stroke="#F1F5F9" strokeWidth="1.2" opacity="0.8" />
              <line x1="536" y1="432" x2="508" y2="356" stroke="#F1F5F9" strokeWidth="1.4" opacity="0.88" />
              <line x1="538" y1="436" x2="518" y2="352" stroke="#F1F5F9" strokeWidth="1.2" opacity="0.8" />
            </g>

            {/* Mitral Valve Annulus + Hinged Cusps */}
            <g className="pointer-events-none">
              <path
                ref={mitralAntRef}
                d="M 470 315 C 476 334, 488 352, 496 358 C 490 342, 484 328, 480 315 Z"
                fill="url(#grad-valve)"
                stroke="#94A3B8"
                strokeWidth="1"
              />
              <path
                ref={mitralPostRef}
                d="M 518 320 C 512 338, 502 352, 496 358 C 500 342, 506 330, 508 318 Z"
                fill="url(#grad-valve)"
                stroke="#94A3B8"
                strokeWidth="1"
              />
            </g>
          </g>

          {/* LAYER 5: ASCENDING AORTA, AORTIC ARCH & SUPRA-AORTIC TRUNKS (Windkessel MAP) */}
          <g
            onClick={(e) => {
              e.stopPropagation();
              onSelectPart('aorta-map');
            }}
            onMouseEnter={() => onHoverPart('aorta-map')}
            onMouseLeave={() => onHoverPart(null)}
            className="cursor-pointer"
            filter={isHighlighted('aorta-map') ? 'url(#part-glow)' : 'url(#tissue-shadow)'}
          >
            {/* Supra-aortic branches: Brachiocephalic, Left Common Carotid, Left Subclavian */}
            <path
              d="M 596 122 L 584 68 L 606 64 L 616 116 Z M 636 112 L 634 58 L 654 57 L 656 112 Z M 674 116 L 686 64 L 706 68 L 694 122 Z"
              fill="url(#grad-aorta-wall)"
              stroke="#7F1D1D"
              strokeWidth="1.1"
            />

            {/* Descending Thoracic Aorta continuation behind heart */}
            <path
              d="M 758 182 C 792 252, 792 340, 825 436"
              fill="none"
              stroke="url(#grad-aorta-wall)"
              strokeWidth="42"
              strokeLinecap="round"
            />

            {/* Aortic Arch Outer Tunica Adventitia (Elastic Windkessel Compliance) */}
            <path
              ref={aortaOuterRef}
              d="M 544 304 C 556 238, 558 168, 608 120 C 660 72, 742 108, 764 185 C 782 248, 785 340, 824 434"
              fill="none"
              stroke="url(#grad-aorta-wall)"
              strokeWidth="44"
              strokeLinecap="round"
              opacity="0.46"
            />

            {/* Aortic Arch Inner Arterial Lumen */}
            <path
              ref={aortaLumenRef}
              d="M 544 304 C 556 238, 558 168, 608 120 C 660 72, 742 108, 764 185 C 782 248, 785 340, 824 434"
              fill="none"
              stroke="#DC2626"
              strokeWidth="31"
              strokeLinecap="round"
              opacity="0.28"
            />

            {/* Longitudinal Specular Gloss Highlight along Arch */}
            <path
              d="M 562 246 C 566 196, 582 146, 616 122 C 660 92, 725 118, 748 180"
              fill="none"
              stroke="#FFF1F2"
              strokeWidth="5"
              strokeLinecap="round"
              opacity="0.42"
            />

            {/* Aortic Semilunar Valve Cusps */}
            <path
              ref={aorticLeftRef}
              d="M 534 294 C 538 274, 546 262, 554 260 C 552 276, 546 288, 542 296 Z"
              fill="url(#grad-valve)"
              stroke="#94A3B8"
              strokeWidth="1"
            />
            <path
              ref={aorticRightRef}
              d="M 568 298 C 564 278, 558 264, 552 260 C 554 276, 558 290, 560 300 Z"
              fill="url(#grad-valve)"
              stroke="#94A3B8"
              strokeWidth="1"
            />
          </g>

          {/* LAYER 6: PERIPHERAL ARTERIOLAR RESISTANCE BED (SVR / Afterload) */}
          <g
            onClick={(e) => {
              e.stopPropagation();
              onSelectPart('arterioles-svr');
            }}
            onMouseEnter={() => onHoverPart('arterioles-svr')}
            onMouseLeave={() => onHoverPart(null)}
            className="cursor-pointer"
            filter={isHighlighted('arterioles-svr') ? 'url(#part-glow)' : 'url(#tissue-shadow)'}
          >
            {/* Tissue Capillary Perfusion Blush */}
            <ellipse
              ref={perfusionGlowRef}
              cx="830"
              cy="472"
              rx="105"
              ry="56"
              fill="url(#grad-perfusion)"
              fillOpacity="0.85"
            />

            {/* Branching Arteriolar Smooth-Muscle Manifold (width scales dynamically with 1/SVR) */}
            <path
              ref={(el) => {
                arteriolePathsRef.current[0] = el;
              }}
              d="M 824 434 C 824 452, 826 468, 828 492"
              fill="none"
              stroke="#DC2626"
              strokeWidth="15"
              strokeLinecap="round"
            />
            <path
              ref={(el) => {
                arteriolePathsRef.current[1] = el;
              }}
              d="M 824 436 C 788 446, 764 468, 774 494 C 784 514, 812 504, 828 494"
              fill="none"
              stroke="#E11D48"
              strokeWidth="11"
              strokeLinecap="round"
            />
            <path
              ref={(el) => {
                arteriolePathsRef.current[2] = el;
              }}
              d="M 824 436 C 858 446, 886 468, 876 494 C 866 514, 844 504, 828 494"
              fill="none"
              stroke="#E11D48"
              strokeWidth="9"
              strokeLinecap="round"
            />
            <path
              ref={(el) => {
                arteriolePathsRef.current[3] = el;
              }}
              d="M 824 438 C 804 456, 796 476, 804 494 C 810 506, 820 500, 828 494"
              fill="none"
              stroke="#BE123C"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <path
              ref={(el) => {
                arteriolePathsRef.current[4] = el;
              }}
              d="M 824 438 C 844 456, 854 476, 846 494 C 840 506, 834 500, 828 494"
              fill="none"
              stroke="#BE123C"
              strokeWidth="8"
              strokeLinecap="round"
            />

            {/* Venular Collector Hub */}
            <ellipse cx="828" cy="496" rx="46" ry="14" fill="url(#grad-vein)" opacity="0.9" />
          </g>

          {/* LAYER 7: TEXTBOOK CALLOUT LEADERS (Hairline anatomical atlas labels) */}
          <g className="text-[11px] font-semibold fill-slate-700">
            {/* Venous / CVP */}
            <g
              onClick={(e) => {
                e.stopPropagation();
                onSelectPart('venous-cvp');
              }}
              className="cursor-pointer"
            >
              <polyline
                points="428,236 392,162 346,162"
                fill="none"
                stroke={isHighlighted('venous-cvp') ? '#0F62FE' : '#94A3B8'}
                strokeWidth="1.2"
              />
              <circle cx="428" cy="236" r="3" fill={isHighlighted('venous-cvp') ? '#0F62FE' : '#475569'} />
              <text
                x="340"
                y="166"
                textAnchor="end"
                className={isHighlighted('venous-cvp') ? 'fill-blue-700 font-bold' : 'fill-slate-700'}
              >
                Left Atrium · CVP
              </text>
            </g>

            {/* Myocardium / LVEF */}
            <g
              onClick={(e) => {
                e.stopPropagation();
                onSelectPart('myocardium-lvef');
              }}
              className="cursor-pointer"
            >
              <polyline
                points="596,466 642,486 672,486"
                fill="none"
                stroke={isHighlighted('myocardium-lvef') ? '#0F62FE' : '#94A3B8'}
                strokeWidth="1.2"
              />
              <circle
                cx="596"
                cy="466"
                r="3"
                fill={isHighlighted('myocardium-lvef') ? '#0F62FE' : '#475569'}
              />
              <text
                x="678"
                y="490"
                textAnchor="start"
                className={isHighlighted('myocardium-lvef') ? 'fill-blue-700 font-bold' : 'fill-slate-700'}
              >
                Myocardium · LVEF
              </text>
            </g>

            {/* LV Cavity / EDV */}
            <g
              onClick={(e) => {
                e.stopPropagation();
                onSelectPart('lv-edv');
              }}
              className="cursor-pointer"
            >
              <polyline
                points="558,412 630,412 652,390"
                fill="none"
                stroke={isHighlighted('lv-edv') ? '#0F62FE' : '#94A3B8'}
                strokeWidth="1.2"
              />
              <circle cx="558" cy="412" r="3" fill={isHighlighted('lv-edv') ? '#0F62FE' : '#475569'} />
              <text
                x="658"
                y="394"
                textAnchor="start"
                className={isHighlighted('lv-edv') ? 'fill-blue-700 font-bold' : 'fill-slate-700'}
              >
                LV Cavity · EDV
              </text>
            </g>

            {/* Aortic Arch / MAP */}
            <g
              onClick={(e) => {
                e.stopPropagation();
                onSelectPart('aorta-map');
              }}
              className="cursor-pointer"
            >
              <polyline
                points="730,126 785,96 828,96"
                fill="none"
                stroke={isHighlighted('aorta-map') ? '#0F62FE' : '#94A3B8'}
                strokeWidth="1.2"
              />
              <circle cx="730" cy="126" r="3" fill={isHighlighted('aorta-map') ? '#0F62FE' : '#475569'} />
              <text
                x="834"
                y="100"
                textAnchor="start"
                className={isHighlighted('aorta-map') ? 'fill-blue-700 font-bold' : 'fill-slate-700'}
              >
                Aortic Arch · MAP
              </text>
            </g>

            {/* Arteriolar Bed / SVR */}
            <g
              onClick={(e) => {
                e.stopPropagation();
                onSelectPart('arterioles-svr');
              }}
              className="cursor-pointer"
            >
              <polyline
                points="874,474 926,474 945,456"
                fill="none"
                stroke={isHighlighted('arterioles-svr') ? '#0F62FE' : '#94A3B8'}
                strokeWidth="1.2"
              />
              <circle
                cx="874"
                cy="474"
                r="3"
                fill={isHighlighted('arterioles-svr') ? '#0F62FE' : '#475569'}
              />
              <text
                x="950"
                y="460"
                textAnchor="start"
                className={isHighlighted('arterioles-svr') ? 'fill-blue-700 font-bold' : 'fill-slate-700'}
              >
                Arteriolar Bed · SVR
              </text>
            </g>
          </g>
        </svg>

        {/* Registered Canvas2D Erythrocyte Fluid Stream Layer */}
        <canvas
          ref={canvasRef}
          width={1100}
          height={720}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
      </div>
    </div>
  );
}
