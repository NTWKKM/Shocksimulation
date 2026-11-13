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
  'lv-edv': { scale: 1.45, tx: 65, ty: -55 },
  'myocardium-lvef': { scale: 1.4, tx: 85, ty: -68 },
  'aorta-map': { scale: 1.38, tx: -75, ty: 98 },
  'arterioles-svr': { scale: 1.45, tx: -250, ty: -45 },
  'venous-cvp': { scale: 1.4, tx: 150, ty: 65 },
};

interface Vec2 {
  x: number;
  y: number;
}

// Smooth Catmull-Rom spline evaluator for 2D Netter Plate erythrocyte trajectories
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

// Anatomical path 1: LV outflow -> Aortic Valve -> Aortic Arch -> Tapering Descending Aorta -> Arteriolar Bed
const ARTERIAL_PATH: Vec2[] = [
  { x: 526, y: 416 },
  { x: 540, y: 344 },
  { x: 554, y: 274 },
  { x: 564, y: 188 },
  { x: 616, y: 122 },
  { x: 700, y: 126 },
  { x: 758, y: 188 },
  { x: 785, y: 280 },
  { x: 800, y: 368 },
  { x: 824, y: 438 },
];

// Anatomical path 2: Venular confluence -> Systemic venous return -> Left Atrium -> Mitral -> LV center
const VENOUS_PATH: Vec2[] = [
  { x: 824, y: 498 },
  { x: 724, y: 528 },
  { x: 560, y: 538 },
  { x: 405, y: 496 },
  { x: 344, y: 432 },
  { x: 346, y: 345 },
  { x: 398, y: 278 },
  { x: 462, y: 276 },
  { x: 492, y: 334 },
  { x: 522, y: 410 },
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
  const heartShellRef = useRef<SVGGElement | null>(null);
  const lvWallGroupRef = useRef<SVGGElement | null>(null);
  const lvCavityRef = useRef<SVGPathElement | null>(null);
  const mitralAntRef = useRef<SVGPathElement | null>(null);
  const mitralPostRef = useRef<SVGPathElement | null>(null);
  const chordaeGroupRef = useRef<SVGGElement | null>(null);
  const aorticLeftRef = useRef<SVGPathElement | null>(null);
  const aorticRightRef = useRef<SVGPathElement | null>(null);
  const aortaLumenRef = useRef<SVGPathElement | null>(null);
  const aortaArchPulseRef = useRef<SVGPathElement | null>(null);
  const atriumRef = useRef<SVGGElement | null>(null);
  const arteriolePathsRef = useRef<Array<SVGPathElement | null>>([]);
  const arterioleInkPathsRef = useRef<Array<SVGPathElement | null>>([]);
  const perfusionGlowRef = useRef<SVGEllipseElement | null>(null);

  // Keep latest physics callback in ref
  const stepCallbackRef = useRef(onStepPhysics);
  stepCallbackRef.current = onStepPhysics;

  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rbcCount = 78;
    const progress = new Float32Array(rbcCount);
    const radial = new Float32Array(rbcCount);
    const spin = new Float32Array(rbcCount);
    for (let i = 0; i < rbcCount; i++) {
      progress[i] = (i / rbcCount + Math.random() * 0.015) % 1;
      radial[i] = (Math.random() - 0.5) * 14;
      spin[i] = Math.random() * Math.PI * 2;
    }

    let rafId = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      const t = stepCallbackRef.current(dt);

      // 1. Unified Cardiac Base-Anchored Deformation (anchored at fibrous skeleton y=312 so LV never detaches from aorta/atrium)
      const volRatio = Math.max(0.48, Math.min(1.38, t.lvVolumeMl / 120));
      const cavScaleX = Math.pow(volRatio, 0.42);
      const cavScaleY = Math.pow(volRatio, 0.25);
      const wallScaleX = 0.9 + (cavScaleX - 0.9) * 0.62;
      const wallScaleY = 0.92 + (cavScaleY - 0.92) * 0.62;
      const shellScaleX = 1 + (wallScaleX - 1) * 0.45;
      const shellScaleY = 1 + (wallScaleY - 1) * 0.45;

      if (heartShellRef.current) {
        heartShellRef.current.setAttribute(
          'transform',
          `translate(495, 312) scale(${shellScaleX.toFixed(4)}, ${shellScaleY.toFixed(4)}) translate(-495, -312)`,
        );
      }
      if (lvWallGroupRef.current) {
        lvWallGroupRef.current.setAttribute(
          'transform',
          `translate(514, 312) scale(${wallScaleX.toFixed(4)}, ${wallScaleY.toFixed(4)}) translate(-514, -312)`,
        );
      }
      if (lvCavityRef.current) {
        lvCavityRef.current.setAttribute(
          'transform',
          `translate(514, 312) scale(${cavScaleX.toFixed(4)}, ${cavScaleY.toFixed(4)}) translate(-514, -312)`,
        );
      }

      // 2. Mitral Valve Leaflets + Chordae Tendineae Kinematics
      const mOpen = t.mitralOpen;
      const mAngleDeg = mOpen * 46;
      if (mitralAntRef.current) {
        mitralAntRef.current.setAttribute('transform', `rotate(${-mAngleDeg.toFixed(2)} 474 314)`);
      }
      if (mitralPostRef.current) {
        mitralPostRef.current.setAttribute('transform', `rotate(${mAngleDeg.toFixed(2)} 518 318)`);
      }
      if (chordaeGroupRef.current) {
        const chordStretch = 1 + mOpen * 0.05;
        chordaeGroupRef.current.setAttribute(
          'transform',
          `translate(500, 314) scale(1, ${chordStretch.toFixed(4)}) translate(-500, -314)`,
        );
      }

      // 3. Aortic Semilunar Valve Cusps Kinematics
      const aOpen = t.aorticOpen;
      const aAngleDeg = aOpen * 50;
      if (aorticLeftRef.current) {
        aorticLeftRef.current.setAttribute('transform', `rotate(${-aAngleDeg.toFixed(2)} 534 294)`);
      }
      if (aorticRightRef.current) {
        aorticRightRef.current.setAttribute('transform', `rotate(${aAngleDeg.toFixed(2)} 568 296)`);
      }

      // 4. Windkessel Arterial Compliance Pulse along Aortic Arch (stroke-width only, zero pattern invalidation)
      const paNorm = Math.max(-0.12, Math.min(1.15, (t.aorticPressureMmHg - 45) / 90));
      const archLumenWidth = 24 + paNorm * 6.5;
      if (aortaLumenRef.current) {
        aortaLumenRef.current.setAttribute('stroke-width', archLumenWidth.toFixed(2));
      }

      // 5. Left Atrium & Venous Return Swelling (CVP)
      const cvpScale = 1 + Math.max(-0.07, Math.min(0.18, (t.lvPressureMmHg - 8) * 0.007));
      if (atriumRef.current) {
        atriumRef.current.setAttribute(
          'transform',
          `translate(458, 286) scale(${cvpScale.toFixed(4)}) translate(-458, -286)`,
        );
      }

      // 6. Peripheral Arteriolar Bed Vasoconstriction / Vasodilation (SVR)
      const svrScale = Math.max(0.48, Math.min(1.65, 12 / Math.max(5, t.effectiveSvr)));
      const baseWidths = [11.5, 8.8, 7.5, 8.2, 6.8];
      for (let i = 0; i < arteriolePathsRef.current.length; i++) {
        const el = arteriolePathsRef.current[i];
        const ink = arterioleInkPathsRef.current[i];
        const w = baseWidths[i] * svrScale;
        if (el) {
          el.setAttribute('stroke-width', w.toFixed(2));
        }
        if (ink) {
          ink.setAttribute('stroke-width', (w + 2.8).toFixed(2));
        }
      }
      if (perfusionGlowRef.current) {
        const perfOpacity = Math.max(0.1, Math.min(0.46, (t.map - 30) / 140));
        perfusionGlowRef.current.setAttribute('fill-opacity', perfOpacity.toFixed(3));
      }

      // 7. Canvas2D Hand-Inked Gouache Erythrocyte Stream (Poiseuille velocity + tapered vessel bounds)
      ctx.setTransform(1, 0, 0, 1, 0, 0);
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
        const rNorm = Math.abs(radial[i]) / 8;
        const poiseuille = 1.0 - Math.min(0.55, rNorm * 0.45);

        progress[i] = (progress[i] + baseSpeed * poiseuille * dt) % 1;
        spin[i] += dt * (1.8 + baseSpeed * 3.0);

        const p = progress[i];
        const pt = sampleSpline(isArt ? ARTERIAL_PATH : VENOUS_PATH, p);
        const nx = -pt.ty;
        const ny = pt.tx;

        // Taper radial spread along descending aorta so RBCs stay cleanly inside the tapered lumen
        const taperMod = isArt
          ? p > 0.55
            ? Math.max(0.42, 1.0 - (p - 0.55) * 1.25)
            : 1.0 + paNorm * 0.12
          : 0.78;
        const px = pt.x + nx * radial[i] * taperMod;
        const py = pt.y + ny * radial[i] * taperMod;

        const angle = Math.atan2(pt.ty, pt.tx) + Math.sin(spin[i]) * 0.32;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        ctx.setTransform(cos, sin, -sin, cos, px, py);

        // Netter gouache-and-ink erythrocyte
        ctx.beginPath();
        ctx.ellipse(0, 0, 5.8, 3.4, 0, 0, Math.PI * 2);
        ctx.fillStyle = isArt ? 'rgba(196, 42, 36, 0.88)' : 'rgba(98, 52, 86, 0.82)';
        ctx.fill();
        ctx.lineWidth = 0.9;
        ctx.strokeStyle = isArt ? 'rgba(54, 22, 18, 0.72)' : 'rgba(38, 22, 38, 0.72)';
        ctx.stroke();

        // Warm parchment-rose biconcave pallor highlight
        ctx.beginPath();
        ctx.ellipse(-0.3, -0.2, 2.3, 1.2, 0, 0, Math.PI * 2);
        ctx.fillStyle = isArt ? 'rgba(248, 214, 202, 0.52)' : 'rgba(214, 188, 212, 0.4)';
        ctx.fill();
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const activeFocus = selectedPart ? FOCUS_TRANSFORMS[selectedPart] : FOCUS_TRANSFORMS.default;
  const stageTx = isMobile
    ? (selectedPart ? activeFocus.tx * 0.35 : -24)
    : activeFocus.tx + (drawerOpen ? 10 : 80);
  const stageTy = isMobile ? (selectedPart ? activeFocus.ty * 0.4 + 145 : 150) : activeFocus.ty;
  const stageScale = isMobile
    ? (selectedPart ? Math.min(1.22, activeFocus.scale) : 1.08)
    : activeFocus.scale;

  const isHighlighted = (id: AnatomyFocusId) => selectedPart === id || hoveredPart === id;

  return (
    <div
      ref={stageRef}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onSelectPart(null);
        }
      }}
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_54%_45%,#FAF4E6_0%,#F6EFE0_58%,#EDE1C8_100%)]"
    >
      {/* Subtle Vellum Paper Drafting & Fiber Texture */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-45"
        style={{
          backgroundImage:
            'radial-gradient(rgba(139,115,85,0.08) 0.7px, transparent 0.7px), linear-gradient(to right, rgba(92,77,66,0.025) 1px, transparent 1px), linear-gradient(to bottom, rgba(92,77,66,0.025) 1px, transparent 1px)',
          backgroundSize: '18px 18px, 64px 64px, 64px 64px',
        }}
      />

      {/* Flat 2D Netter Anatomical Plate Stage */}
      <div
        className="relative w-full max-w-[1140px] aspect-[1100/720] transition-transform duration-500 ease-out"
        style={{
          transform: `translate(${stageTx}px, ${stageTy}px) scale(${stageScale})`,
        }}
      >
        {/* Main Unified Hand-Inked & Watercolor SVG Plate */}
        <svg
          viewBox="0 0 1100 720"
          className="h-full w-full select-none overflow-visible"
          role="img"
          aria-label="2D hand-drawn Netter-style anatomical cutaway plate of the human heart, aorta, arteriolar resistance bed, and venous return"
        >
          <defs>
            {/* Classic Netter Gouache & Watercolor Washes */}
            <linearGradient id="netter-myo-outer" x1="5%" y1="5%" x2="95%" y2="95%">
              <stop offset="0%" stopColor="#DF7A6F" />
              <stop offset="50%" stopColor="#BA4C43" />
              <stop offset="100%" stopColor="#842B26" />
            </linearGradient>

            <linearGradient id="netter-myo-cut" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ECA395" />
              <stop offset="55%" stopColor="#CE655B" />
              <stop offset="100%" stopColor="#9E3B35" />
            </linearGradient>

            <linearGradient id="netter-rv" x1="15%" y1="10%" x2="85%" y2="95%">
              <stop offset="0%" stopColor="#D1796E" />
              <stop offset="58%" stopColor="#A34D45" />
              <stop offset="100%" stopColor="#722C28" />
            </linearGradient>

            <radialGradient id="netter-lv-blood" cx="44%" cy="40%" r="68%">
              <stop offset="0%" stopColor="#AE2D2D" />
              <stop offset="55%" stopColor="#7A181B" />
              <stop offset="100%" stopColor="#4A0D10" />
            </radialGradient>

            <linearGradient id="netter-aorta-wall" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#EE9384" />
              <stop offset="48%" stopColor="#C94E43" />
              <stop offset="100%" stopColor="#922A22" />
            </linearGradient>

            <linearGradient id="netter-aorta-lumen" x1="0%" y1="0%" x2="85%" y2="100%">
              <stop offset="0%" stopColor="#9B2120" />
              <stop offset="55%" stopColor="#7D1819" />
              <stop offset="100%" stopColor="#65161A" />
            </linearGradient>

            <linearGradient id="netter-vein" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8CA5C2" />
              <stop offset="52%" stopColor="#5B789B" />
              <stop offset="100%" stopColor="#344D6E" />
            </linearGradient>

            <linearGradient id="netter-pulm" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#93ABC8" />
              <stop offset="58%" stopColor="#627FA2" />
              <stop offset="100%" stopColor="#3B5372" />
            </linearGradient>

            <linearGradient id="netter-fat" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#EED17C" />
              <stop offset="100%" stopColor="#C99E3D" />
            </linearGradient>

            <linearGradient id="netter-valve" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#F6EFE0" />
              <stop offset="100%" stopColor="#D7C8AC" />
            </linearGradient>

            {/* Arterial-to-Venous Capillary Transition Gradients */}
            <linearGradient id="netter-arteriole-grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#BD322B" />
              <stop offset="60%" stopColor="#A63544" />
              <stop offset="100%" stopColor="#5B6E90" />
            </linearGradient>

            <linearGradient id="netter-arteriole-deep" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#9C2622" />
              <stop offset="62%" stopColor="#863146" />
              <stop offset="100%" stopColor="#4A6082" />
            </linearGradient>

            {/* Watercolor Capillary Perfusion Wash */}
            <radialGradient id="netter-perfusion" cx="50%" cy="46%" r="52%">
              <stop offset="0%" stopColor="#D65249" stopOpacity="0.48" />
              <stop offset="58%" stopColor="#C9463E" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#C9463E" stopOpacity="0" />
            </radialGradient>

            {/* Pen-and-Ink Cross-Hatching Patterns */}
            <pattern
              id="hatch-myo-fibers"
              width="16"
              height="10"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(24)"
            >
              <path
                d="M 0 3 Q 4 1.5, 8 3 T 16 3 M 0 8 Q 5 6.5, 10 8 T 16 8"
                fill="none"
                stroke="#431513"
                strokeOpacity="0.22"
                strokeWidth="0.9"
              />
            </pattern>

            <pattern
              id="hatch-sepia-cross"
              width="7"
              height="7"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(38)"
            >
              <line x1="0" y1="0" x2="0" y2="7" stroke="#2B1E19" strokeOpacity="0.18" strokeWidth="0.75" />
              <line x1="0" y1="3.5" x2="7" y2="3.5" stroke="#2B1E19" strokeOpacity="0.11" strokeWidth="0.6" />
            </pattern>

            <pattern
              id="hatch-vein-lines"
              width="8"
              height="8"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(-28)"
            >
              <line x1="0" y1="0" x2="0" y2="8" stroke="#1E293B" strokeOpacity="0.18" strokeWidth="0.75" />
            </pattern>

            <pattern id="stipple-capillary" width="14" height="14" patternUnits="userSpaceOnUse">
              <circle cx="2.5" cy="3.5" r="0.7" fill="#5A231E" fillOpacity="0.24" />
              <circle cx="9.5" cy="2.0" r="0.55" fill="#5A231E" fillOpacity="0.2" />
              <circle cx="6.0" cy="9.0" r="0.75" fill="#5A231E" fillOpacity="0.22" />
              <circle cx="12.0" cy="11.0" r="0.6" fill="#5A231E" fillOpacity="0.18" />
            </pattern>
          </defs>

          {/* Tasteful Top-Right Netter Plate Caption */}
          <text
            x="1058"
            y="40"
            textAnchor="end"
            className="pointer-events-none font-atlas-serif italic text-[13.5px] fill-[#6D5D4F]"
          >
            Plate I · Left Ventricular Cutaway, Windkessel Arch &amp; Arteriolar Bed
          </text>

          {/* Subtle Warm Vellum Ground Wash tying the entire cardiovascular loop into one cohesive plate */}
          <ellipse
            cx="598"
            cy="340"
            rx="320"
            ry="235"
            fill="#E7D8BE"
            fillOpacity="0.2"
            className="pointer-events-none"
          />

          {/* LAYER 1: CONTINUOUS SYSTEMIC VENOUS RETURN LOOP & SUPERIOR VENA CAVA */}
          <g
            onClick={(e) => {
              e.stopPropagation();
              onSelectPart('venous-cvp');
            }}
            onMouseEnter={() => onHoverPart('venous-cvp')}
            onMouseLeave={() => onHoverPart(null)}
            className="cursor-pointer"
          >
            {/* Outer sepia ink contour seamlessly running from venular confluence around inferior loop into posterior atrium */}
            <path
              d="M 824 498 C 742 540, 520 552, 386 490 C 324 460, 326 355, 386 284 C 398 270, 412 264, 428 264"
              fill="none"
              stroke={isHighlighted('venous-cvp') ? '#1E4E79' : '#241C18'}
              strokeWidth="26"
              strokeLinecap="round"
            />
            {/* Prussian-slate gouache fill */}
            <path
              d="M 824 498 C 742 540, 520 552, 386 490 C 324 460, 326 355, 386 284 C 398 270, 412 264, 428 264"
              fill="none"
              stroke="url(#netter-vein)"
              strokeWidth="22"
              strokeLinecap="round"
            />
            {/* Pen cross-hatching shading on lower curvature */}
            <path
              d="M 824 500 C 742 542, 520 554, 386 492 C 324 462, 326 357, 386 286"
              fill="none"
              stroke="url(#hatch-vein-lines)"
              strokeWidth="19"
              strokeLinecap="round"
            />
            {/* Hand-drawn dry-brush wash highlight & contour stria */}
            <path
              d="M 812 493 C 734 532, 522 543, 393 484 C 338 456, 338 358, 392 288"
              fill="none"
              stroke="#C9D8E8"
              strokeWidth="2.8"
              strokeLinecap="round"
              opacity="0.46"
            />

            {/* Superior Vena Cava seamlessly entering Right Atrium */}
            <path
              d="M 417 118 C 413 155, 412 192, 416 226 L 448 226 C 446 192, 446 155, 451 118 Z"
              fill="url(#netter-vein)"
              stroke="#241C18"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path
              d="M 417 118 C 413 155, 412 192, 416 226 L 448 226 C 446 192, 446 155, 451 118 Z"
              fill="url(#hatch-vein-lines)"
            />
            <ellipse
              cx="434"
              cy="118"
              rx="17"
              ry="5.2"
              fill="#324764"
              stroke="#241C18"
              strokeWidth="1.6"
            />
            <path
              d="M 424 142 C 422 165, 422 188, 424 206 M 441 138 C 440 162, 440 185, 441 205"
              fill="none"
              stroke="#1E293B"
              strokeWidth="0.75"
              strokeOpacity="0.45"
            />
          </g>

          {/* LAYER 2: UNIFIED HEART SILHOUETTE (RIGHT HEART, EPICARDIAL FAT PAD, CORONARIES & PULMONARY TRUNK) */}
          <g ref={heartShellRef}>
            {/* Pulmonary Trunk arching out behind ascending aorta */}
            <path
              d="M 455 318 C 465 255, 488 205, 525 186 C 556 170, 595 178, 622 192 L 608 218 C 585 206, 558 202, 535 215 C 508 230, 492 272, 485 320 Z"
              fill="url(#netter-pulm)"
              stroke="#241C18"
              strokeWidth="1.9"
              strokeLinejoin="round"
            />
            <path
              d="M 476 286 C 488 242, 508 210, 538 196 M 484 294 C 496 250, 514 218, 546 204 M 558 192 L 570 206 M 576 196 L 586 210 M 594 202 L 602 214"
              fill="none"
              stroke="#1E293B"
              strokeWidth="0.85"
              strokeLinecap="round"
              opacity="0.34"
            />
            <path
              d="M 498 202 C 472 196, 450 202, 434 214 L 444 236 C 458 228, 476 225, 495 228 Z"
              fill="url(#netter-pulm)"
              stroke="#241C18"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <ellipse
              cx="615"
              cy="205"
              rx="6"
              ry="14.5"
              transform="rotate(28 615 205)"
              fill="#334866"
              stroke="#241C18"
              strokeWidth="1.5"
            />

            {/* Cohesive Anterior Heart Silhouette: Right Atrium + Right Ventricle seamlessly fused into LV base */}
            <path
              d="M 405 215 C 362 232, 354 292, 382 332 C 362 390, 380 472, 440 520 C 468 542, 502 542, 518 522 C 502 468, 478 378, 486 314 C 482 268, 458 215, 405 215 Z"
              fill="url(#netter-rv)"
              stroke="#2B1E19"
              strokeWidth="2.0"
              strokeLinejoin="round"
            />
            {/* Hand-drawn RV myocardial fiber contours (zero pattern-cache invalidation) */}
            <path
              d="M 386 356 C 398 398, 422 448, 464 494 M 396 346 C 410 392, 434 442, 474 488 M 408 338 C 422 384, 444 434, 480 480 M 378 396 C 392 446, 422 492, 468 524"
              fill="none"
              stroke="#431513"
              strokeWidth="0.95"
              strokeLinecap="round"
              opacity="0.28"
            />
            {/* Soft atrioventricular groove shadow uniting RA and RV organically */}
            <path
              d="M 384 328 C 406 342, 434 344, 462 332"
              fill="none"
              stroke="#4B1D1A"
              strokeWidth="1.4"
              strokeLinecap="round"
              opacity="0.45"
            />
            {/* Auricular pectinate contour ticks */}
            <path
              d="M 382 246 C 392 252, 402 252, 412 245 M 374 268 C 388 274, 400 272, 408 265 M 378 292 C 390 298, 402 296, 410 289"
              fill="none"
              stroke="#4B1D1A"
              strokeWidth="0.95"
              strokeLinecap="round"
              opacity="0.52"
            />
            {/* Hand-drawn pen cross-hatch shading along lower RV shadow edge */}
            <path
              d="M 384 422 L 398 414 M 392 442 L 408 432 M 404 464 L 420 452 M 418 484 L 434 472 M 434 502 L 450 490 M 452 518 L 468 506 M 472 528 L 486 516"
              fill="none"
              stroke="#2B1E19"
              strokeWidth="0.9"
              strokeLinecap="round"
              opacity="0.45"
            />

            {/* Epicardial Adipose Sulcus (Netter Golden-Ochre Lobular Fat Pad) */}
            <path
              d="M 454 316 C 445 375, 456 445, 495 524"
              fill="none"
              stroke="url(#netter-fat)"
              strokeWidth="12.5"
              strokeLinecap="round"
              opacity="0.88"
            />
            <path
              d="M 448 332 Q 444 342 450 350 Q 445 362 452 372 Q 446 384 454 395 Q 449 408 458 420 Q 454 434 464 446 Q 460 460 472 474 Q 468 488 480 502 Q 478 512 490 520 M 461 334 Q 466 344 460 356 Q 466 368 460 380 Q 467 392 462 406 Q 470 420 466 434 Q 474 448 472 462 Q 481 476 480 490 Q 490 504 494 516"
              fill="none"
              stroke="#7A5A1D"
              strokeWidth="0.9"
              strokeLinecap="round"
              opacity="0.65"
            />

            {/* Left Anterior Descending (LAD) Coronary Artery + Great Cardiac Vein */}
            <path
              d="M 468 308 C 455 365, 460 438, 494 518 M 461 382 C 438 402, 422 425, 412 452 M 468 430 C 445 452, 434 475, 432 496 M 474 470 C 460 486, 454 502, 452 516"
              fill="none"
              stroke="#2B1E19"
              strokeWidth="4.2"
              strokeLinecap="round"
            />
            <path
              d="M 468 308 C 455 365, 460 438, 494 518 M 461 382 C 438 402, 422 425, 412 452 M 468 430 C 445 452, 434 475, 432 496 M 474 470 C 460 486, 454 502, 452 516"
              fill="none"
              stroke="#C8342C"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M 462 315 C 449 368, 453 434, 484 506"
              fill="none"
              stroke="#3B5578"
              strokeWidth="1.8"
              strokeLinecap="round"
              opacity="0.82"
            />
          </g>

          {/* LAYER 3: LEFT ATRIUM CUTAWAY & PULMONARY VEIN CONFLUENCE (CVP) */}
          <g
            ref={atriumRef}
            onClick={(e) => {
              e.stopPropagation();
              onSelectPart('venous-cvp');
            }}
            onMouseEnter={() => onHoverPart('venous-cvp')}
            onMouseLeave={() => onHoverPart(null)}
            className="cursor-pointer"
          >
            {/* Left Pulmonary Veins seamlessly entering Left Atrium */}
            <path
              d="M 366 250 C 392 258, 412 264, 428 270 M 362 290 C 388 292, 410 290, 426 288"
              fill="none"
              stroke="#241C18"
              strokeWidth="18"
              strokeLinecap="round"
            />
            <path
              d="M 366 250 C 392 258, 412 264, 428 270 M 362 290 C 388 292, 410 290, 426 288"
              fill="none"
              stroke="url(#netter-vein)"
              strokeWidth="14.5"
              strokeLinecap="round"
            />
            <ellipse cx="364" cy="250" rx="4.5" ry="7.3" fill="#324764" stroke="#241C18" strokeWidth="1.3" />
            <ellipse cx="360" cy="290" rx="4.5" ry="7.3" fill="#324764" stroke="#241C18" strokeWidth="1.3" />

            {/* Left Atrium Outer Cutaway Rim (smoothly funnels down into Mitral Annulus without abrupt shelf) */}
            <path
              d="M 414 246 C 404 280, 424 316, 470 322 C 502 325, 520 298, 506 258 C 492 222, 430 218, 414 246 Z"
              fill="url(#netter-vein)"
              stroke={isHighlighted('venous-cvp') ? '#1E4E79' : '#241C18'}
              strokeWidth="2.0"
            />
            {/* Inner Left Atrial Chamber opening smoothly down toward Mitral orifice */}
            <path
              d="M 426 254 C 420 282, 440 310, 474 314 L 502 314 C 508 296, 502 278, 492 260 C 480 236, 436 234, 426 254 Z"
              fill="#324A6D"
              stroke="#1E2B3E"
              strokeWidth="1.15"
            />
            <path
              d="M 432 260 C 446 250, 466 252, 478 264 M 429 272 C 445 262, 468 264, 482 276 M 431 284 C 448 276, 468 278, 482 288"
              fill="none"
              stroke="#1A2433"
              strokeWidth="0.9"
              strokeLinecap="round"
              opacity="0.45"
            />
          </g>

          {/* LAYER 4: UNIFIED AORTO-VENTRICULAR CUTAWAY (SEAMLESS AORTIC ARCH + TAPERING DESCENDING AORTA + LV) */}
          <g>
            {/* Continuous Fibrous Cardiac Skeleton Bridge (seals aortomitral-atrial junction with zero parchment notch) */}
            <path
              d="M 476 292 C 494 282, 524 282, 542 294 L 542 322 L 474 320 Z"
              fill="#9A3631"
              stroke="#2B1E19"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />

            {/* 4A. CONTINUOUS AORTIC ARCH, SUPRA-AORTIC TRUNKS & TAPERING DESCENDING AORTA (Windkessel MAP) */}
            <g
              ref={aortaArchPulseRef}
              onClick={(e) => {
                e.stopPropagation();
                onSelectPart('aorta-map');
              }}
              onMouseEnter={() => onHoverPart('aorta-map')}
              onMouseLeave={() => onHoverPart(null)}
              className="cursor-pointer"
            >
              {/* Single seamless closed silhouette: aortic root -> ascending -> 3 supra-aortic trunks -> arch -> tapering descending aorta */}
              <path
                d="M 526 306 C 538 242, 540 174, 578 124 L 568 68 L 590 64 L 602 108 C 610 104, 618 101, 626 99 L 624 56 L 646 55 L 648 99 C 657 100, 666 102, 674 105 L 686 62 L 706 67 L 694 114 C 734 128, 766 164, 782 218 C 800 280, 804 352, 833 432 L 814 434 C 785 356, 774 282, 756 218 C 740 162, 704 134, 662 134 C 622 134, 594 166, 586 220 C 580 256, 576 286, 572 308 Z"
                fill="url(#netter-aorta-wall)"
                stroke={isHighlighted('aorta-map') ? '#9E2A2B' : '#2B1E19'}
                strokeWidth={isHighlighted('aorta-map') ? '2.5' : '2.0'}
                strokeLinejoin="round"
              />

              {/* Netter cut-vessel open lumen ovals on supra-aortic tips */}
              <ellipse cx="579" cy="66" rx="11" ry="3.8" transform="rotate(-10 579 66)" fill="#6D1E1B" stroke="#2B1E19" strokeWidth="1.35" />
              <ellipse cx="635" cy="55.5" rx="11" ry="3.5" fill="#6D1E1B" stroke="#2B1E19" strokeWidth="1.35" />
              <ellipse cx="696" cy="64.5" rx="10" ry="3.8" transform="rotate(14 696 64.5)" fill="#6D1E1B" stroke="#2B1E19" strokeWidth="1.35" />

              {/* Continuous Tapered Arterial Cutaway Channel (no blunt cut, no double-stroke seam!) */}
              <path
                d="M 538 304 C 548 240, 552 174, 596 130 C 646 82, 730 112, 758 188 C 780 250, 788 338, 820 432 L 826 432 C 796 338, 790 248, 772 184 C 744 96, 650 68, 590 120 C 544 162, 540 236, 530 304 Z"
                fill="url(#netter-aorta-lumen)"
                fillOpacity="0.56"
              />

              {/* Dynamic Windkessel Elastic Lumen Pulse (smoothly swells inside the arch during systole) */}
              <path
                ref={aortaLumenRef}
                d="M 552 296 C 562 234, 566 172, 608 130 C 654 88, 728 118, 754 188 C 772 238, 780 304, 796 368"
                fill="none"
                stroke="#B22A25"
                strokeWidth="25"
                strokeLinecap="round"
                opacity="0.34"
              />

              {/* Hand-drawn Netter gouache highlight & inner concavity cross-hatching */}
              <path
                d="M 560 254 C 568 198, 586 150, 622 126 C 662 98, 722 120, 746 180 C 764 228, 776 294, 792 356"
                fill="none"
                stroke="#FADCD2"
                strokeWidth="3.8"
                strokeLinecap="round"
                opacity="0.44"
              />
              <path
                d="M 564 288 C 574 228, 580 176, 618 140 C 658 102, 720 132, 742 198"
                fill="none"
                stroke="url(#hatch-sepia-cross)"
                strokeWidth="9"
                strokeLinecap="round"
                opacity="0.5"
              />
            </g>

            {/* 4B. LEFT VENTRICULAR MYOCARDIUM CUTAWAY SHELL (LVEF - anchored at y=312 so it never separates from root!) */}
            <g
              ref={lvWallGroupRef}
              onClick={(e) => {
                e.stopPropagation();
                onSelectPart('myocardium-lvef');
              }}
              onMouseEnter={() => onHoverPart('myocardium-lvef')}
              onMouseLeave={() => onHoverPart(null)}
              className="cursor-pointer"
            >
              {/* Outer Epicardial Contour smoothly meeting Aortic Root & Mitral Base */}
              <path
                d="M 464 312 C 450 374, 464 466, 505 524 C 532 560, 582 544, 608 490 C 632 436, 620 356, 574 300 L 556 306 C 588 358, 592 426, 572 472 C 556 512, 526 512, 508 480 C 482 432, 474 368, 482 314 Z"
                fill="url(#netter-myo-outer)"
                stroke={isHighlighted('myocardium-lvef') ? '#9E2A2B' : '#2B1E19'}
                strokeWidth={isHighlighted('myocardium-lvef') ? '2.5' : '2.0'}
                strokeLinejoin="round"
              />
              {/* Muscular Cut-Section Face */}
              <path
                d="M 468 313 C 454 374, 468 462, 506 518 C 532 554, 578 538, 602 486 C 626 436, 614 358, 572 302 L 560 306 C 594 356, 600 432, 580 480 C 560 526, 526 528, 504 492 C 476 444, 468 372, 476 315 Z"
                fill="url(#netter-myo-cut)"
                stroke="#4B1B17"
                strokeWidth="0.95"
              />
              {/* Hand-drawn curved myocardial fiber bundles & pen cross-hatching */}
              <path
                d="M 472 340 C 464 385, 474 445, 502 496 M 482 328 C 474 378, 484 440, 512 492 M 586 318 C 608 368, 610 432, 592 482 M 574 312 C 596 364, 598 428, 580 478 M 514 508 C 534 532, 566 522, 584 494 M 506 516 C 530 544, 572 536, 594 496"
                fill="none"
                stroke="#431513"
                strokeWidth="1.05"
                strokeLinecap="round"
                opacity="0.34"
              />
              <path
                d="M 556 528 C 578 525, 598 495, 610 452 C 620 416, 616 364, 596 322 M 572 512 L 586 502 M 582 494 L 598 482 M 592 472 L 608 460 M 598 450 L 614 438 M 602 426 L 617 415 M 602 402 L 617 392 M 599 378 L 614 368 M 594 354 L 608 345"
                fill="none"
                stroke="#2B1E19"
                strokeWidth="0.9"
                strokeLinecap="round"
                opacity="0.45"
              />
            </g>

            {/* 4C. LV BLOOD POOL / ENDOCARDIAL CAVITY & OUTFLOW TRACT (EDV - continuous into LVOT!) */}
            <g
              onClick={(e) => {
                e.stopPropagation();
                onSelectPart('lv-edv');
              }}
              onMouseEnter={() => onHoverPart('lv-edv')}
              onMouseLeave={() => onHoverPart(null)}
              className="cursor-pointer"
            >
              {/* Seamless cavity flowing from Mitral inflow (left) and LVOT (right) up to the aortic root (no flat horizontal bar!) */}
              <path
                ref={lvCavityRef}
                d="M 476 312 C 468 368, 478 442, 510 488 C 532 518, 562 510, 578 470 C 594 426, 588 354, 564 298 L 534 300 C 526 314, 514 316, 476 312 Z"
                fill="url(#netter-lv-blood)"
                stroke={isHighlighted('lv-edv') ? '#E76F51' : '#2B1E19'}
                strokeWidth={isHighlighted('lv-edv') ? '2.1' : '1.4'}
              />
              {/* Trabeculae Carneae internal meshwork ridges */}
              <path
                d="M 484 378 C 492 386, 494 402, 486 414 M 488 424 C 498 432, 502 448, 496 462 M 566 366 C 558 378, 558 394, 568 408 M 568 422 C 556 434, 556 452, 564 468"
                fill="none"
                stroke="#3A0B0E"
                strokeWidth="2.1"
                strokeLinecap="round"
                opacity="0.58"
              />
              {/* Papillary Muscles */}
              <path
                d="M 494 452 C 498 432, 506 420, 512 426 C 516 432, 512 454, 506 476 Z M 552 462 C 546 436, 538 424, 532 430 C 528 436, 534 458, 540 478 Z"
                fill="#BD5B56"
                stroke="#2B1E19"
                strokeWidth="1.35"
              />
              <path
                d="M 499 448 L 509 444 M 498 457 L 510 453 M 497 466 L 508 462 M 534 446 L 546 442 M 536 456 L 548 452 M 538 466 L 549 462"
                fill="none"
                stroke="#2B1E19"
                strokeWidth="0.85"
                strokeLinecap="round"
                opacity="0.52"
              />
            </g>

            {/* Chordae Tendineae */}
            <g ref={chordaeGroupRef} className="pointer-events-none">
              <line x1="508" y1="428" x2="482" y2="352" stroke="#2B1E19" strokeWidth="2.2" />
              <line x1="508" y1="428" x2="482" y2="352" stroke="#F4ECD8" strokeWidth="1.1" />
              <line x1="506" y1="432" x2="492" y2="358" stroke="#2B1E19" strokeWidth="1.9" />
              <line x1="506" y1="432" x2="492" y2="358" stroke="#F4ECD8" strokeWidth="0.9" />
              <line x1="536" y1="432" x2="508" y2="356" stroke="#2B1E19" strokeWidth="2.2" />
              <line x1="536" y1="432" x2="508" y2="356" stroke="#F4ECD8" strokeWidth="1.1" />
              <line x1="538" y1="436" x2="518" y2="352" stroke="#2B1E19" strokeWidth="1.9" />
              <line x1="538" y1="436" x2="518" y2="352" stroke="#F4ECD8" strokeWidth="0.9" />
            </g>

            {/* Mitral Valve Annulus + Hinged Cusps */}
            <g className="pointer-events-none">
              <path
                ref={mitralAntRef}
                d="M 474 314 C 480 334, 490 350, 498 358 C 492 342, 486 328, 482 314 Z"
                fill="url(#netter-valve)"
                stroke="#2B1E19"
                strokeWidth="1.35"
                strokeLinejoin="round"
              />
              <path
                ref={mitralPostRef}
                d="M 518 318 C 512 336, 504 350, 498 358 C 502 342, 506 328, 508 316 Z"
                fill="url(#netter-valve)"
                stroke="#2B1E19"
                strokeWidth="1.35"
                strokeLinejoin="round"
              />
            </g>

            {/* Aortic Semilunar Valve Cusps (blended naturally into the LVOT-to-Aorta junction) */}
            <g className="pointer-events-none">
              <path
                ref={aorticLeftRef}
                d="M 534 294 C 538 274, 546 262, 554 260 C 552 276, 546 288, 542 296 Z"
                fill="url(#netter-valve)"
                stroke="#2B1E19"
                strokeWidth="1.35"
                strokeLinejoin="round"
              />
              <path
                ref={aorticRightRef}
                d="M 568 296 C 564 276, 558 264, 552 260 C 554 276, 558 288, 560 298 Z"
                fill="url(#netter-valve)"
                stroke="#2B1E19"
                strokeWidth="1.35"
                strokeLinejoin="round"
              />
            </g>
          </g>

          {/* LAYER 5: SEAMLESS ARTERIOLAR-CAPILLARY-VENULAR MICROVASCULAR BED (SVR / Afterload) */}
          <g
            onClick={(e) => {
              e.stopPropagation();
              onSelectPart('arterioles-svr');
            }}
            onMouseEnter={() => onHoverPart('arterioles-svr')}
            onMouseLeave={() => onHoverPart(null)}
            className="cursor-pointer"
          >
            {/* Watercolor Capillary Perfusion Wash + Ink Stippling */}
            <path
              d="M 738 468 C 742 436, 788 416, 836 420 C 884 424, 924 446, 922 476 C 920 504, 880 524, 826 522 C 774 520, 735 496, 738 468 Z"
              fill="url(#netter-perfusion)"
              fillOpacity="0.45"
            />
            <ellipse
              ref={perfusionGlowRef}
              cx="826"
              cy="470"
              rx="98"
              ry="52"
              fill="url(#netter-perfusion)"
              fillOpacity="0.82"
            />
            <ellipse
              cx="824"
              cy="468"
              rx="84"
              ry="42"
              fill="url(#stipple-capillary)"
              opacity="0.7"
            />

            {/* Delicate capillary anastomotic pen twigs bridging arteriolar arcades */}
            <path
              d="M 784 466 C 794 470, 804 468, 814 472 M 838 468 C 848 472, 858 470, 868 474 M 798 482 C 810 484, 822 480, 834 484"
              fill="none"
              stroke="#6B221E"
              strokeWidth="0.9"
              strokeLinecap="round"
              opacity="0.58"
            />

            {/* Smooth funneling distal aortic transition & venular collector */}
            <path
              d="M 772 488 C 788 504, 814 510, 826 510 C 842 510, 864 504, 876 488 C 864 498, 844 502, 826 502 C 808 502, 786 498, 772 488 Z"
              fill="url(#netter-vein)"
              stroke="#241C18"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />

            {/* Outer sepia ink silhouette group (rendered BELOW colored lumen strokes so junctions fuse seamlessly) */}
            <g>
              <path
                ref={(el) => {
                  arterioleInkPathsRef.current[0] = el;
                }}
                d="M 824 430 C 824 452, 825 472, 825 498"
                fill="none"
                stroke={isHighlighted('arterioles-svr') ? '#9E2A2B' : '#2B1E19'}
                strokeWidth="14.3"
                strokeLinecap="round"
              />
              <path
                ref={(el) => {
                  arterioleInkPathsRef.current[1] = el;
                }}
                d="M 822 431 C 786 442, 764 466, 774 490 C 782 506, 808 504, 825 498"
                fill="none"
                stroke={isHighlighted('arterioles-svr') ? '#9E2A2B' : '#2B1E19'}
                strokeWidth="11.6"
                strokeLinecap="round"
              />
              <path
                ref={(el) => {
                  arterioleInkPathsRef.current[2] = el;
                }}
                d="M 826 431 C 860 442, 884 466, 874 490 C 866 506, 842 504, 825 498"
                fill="none"
                stroke={isHighlighted('arterioles-svr') ? '#9E2A2B' : '#2B1E19'}
                strokeWidth="10.3"
                strokeLinecap="round"
              />
              <path
                ref={(el) => {
                  arterioleInkPathsRef.current[3] = el;
                }}
                d="M 822 432 C 804 452, 796 474, 804 492 C 810 502, 818 500, 825 498"
                fill="none"
                stroke={isHighlighted('arterioles-svr') ? '#9E2A2B' : '#2B1E19'}
                strokeWidth="11.0"
                strokeLinecap="round"
              />
              <path
                ref={(el) => {
                  arterioleInkPathsRef.current[4] = el;
                }}
                d="M 826 432 C 844 452, 852 474, 844 492 C 838 502, 832 500, 825 498"
                fill="none"
                stroke={isHighlighted('arterioles-svr') ? '#9E2A2B' : '#2B1E19'}
                strokeWidth="9.6"
                strokeLinecap="round"
              />
            </g>

            {/* Inner Arterial-to-Venous Color Gradient Arterioles (rendered ABOVE ink group for unified branching) */}
            <g>
              <path
                ref={(el) => {
                  arteriolePathsRef.current[0] = el;
                }}
                d="M 824 430 C 824 452, 825 472, 825 498"
                fill="none"
                stroke="url(#netter-arteriole-grad)"
                strokeWidth="11.5"
                strokeLinecap="round"
              />
              <path
                ref={(el) => {
                  arteriolePathsRef.current[1] = el;
                }}
                d="M 822 431 C 786 442, 764 466, 774 490 C 782 506, 808 504, 825 498"
                fill="none"
                stroke="url(#netter-arteriole-grad)"
                strokeWidth="8.8"
                strokeLinecap="round"
              />
              <path
                ref={(el) => {
                  arteriolePathsRef.current[2] = el;
                }}
                d="M 826 431 C 860 442, 884 466, 874 490 C 866 506, 842 504, 825 498"
                fill="none"
                stroke="url(#netter-arteriole-grad)"
                strokeWidth="7.5"
                strokeLinecap="round"
              />
              <path
                ref={(el) => {
                  arteriolePathsRef.current[3] = el;
                }}
                d="M 822 432 C 804 452, 796 474, 804 492 C 810 502, 818 500, 825 498"
                fill="none"
                stroke="url(#netter-arteriole-deep)"
                strokeWidth="8.2"
                strokeLinecap="round"
              />
              <path
                ref={(el) => {
                  arteriolePathsRef.current[4] = el;
                }}
                d="M 826 432 C 844 452, 852 474, 844 492 C 838 502, 832 500, 825 498"
                fill="none"
                stroke="url(#netter-arteriole-deep)"
                strokeWidth="6.8"
                strokeLinecap="round"
              />
              {/* Seamless arterial bifurcation cap & venular confluence blend */}
              <path d="M 814 430 C 818 440, 829 440, 833 430 Z" fill="#A82C26" />
              <ellipse cx="825" cy="498" rx="16" ry="6.5" fill="#4E6E91" />
            </g>
          </g>

          {/* LAYER 6: CLASSIC NETTER PLATE CALLOUT LEADERS */}
          <g className="font-atlas-serif text-[14.5px] font-semibold">
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
                stroke={isHighlighted('venous-cvp') ? '#9E2A2B' : '#5C4D42'}
                strokeWidth="1.15"
              />
              <circle
                cx="428"
                cy="236"
                r="2.8"
                fill={isHighlighted('venous-cvp') ? '#9E2A2B' : '#231A15'}
              />
              <text
                x="340"
                y="166"
                textAnchor="end"
                className={
                  isHighlighted('venous-cvp') ? 'fill-[#9E2A2B] font-bold italic' : 'fill-[#231A15]'
                }
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
                points="588,484 616,506 634,506"
                fill="none"
                stroke={isHighlighted('myocardium-lvef') ? '#9E2A2B' : '#5C4D42'}
                strokeWidth="1.15"
              />
              <circle
                cx="588"
                cy="484"
                r="2.8"
                fill={isHighlighted('myocardium-lvef') ? '#9E2A2B' : '#231A15'}
              />
              <text
                x="640"
                y="510"
                textAnchor="start"
                className={
                  isHighlighted('myocardium-lvef')
                    ? 'fill-[#9E2A2B] font-bold italic'
                    : 'fill-[#231A15]'
                }
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
                stroke={isHighlighted('lv-edv') ? '#9E2A2B' : '#5C4D42'}
                strokeWidth="1.15"
              />
              <circle
                cx="558"
                cy="412"
                r="2.8"
                fill={isHighlighted('lv-edv') ? '#9E2A2B' : '#231A15'}
              />
              <text
                x="658"
                y="394"
                textAnchor="start"
                className={
                  isHighlighted('lv-edv') ? 'fill-[#9E2A2B] font-bold italic' : 'fill-[#231A15]'
                }
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
                points="730,130 785,96 828,96"
                fill="none"
                stroke={isHighlighted('aorta-map') ? '#9E2A2B' : '#5C4D42'}
                strokeWidth="1.15"
              />
              <circle
                cx="730"
                cy="130"
                r="2.8"
                fill={isHighlighted('aorta-map') ? '#9E2A2B' : '#231A15'}
              />
              <text
                x="834"
                y="100"
                textAnchor="start"
                className={
                  isHighlighted('aorta-map') ? 'fill-[#9E2A2B] font-bold italic' : 'fill-[#231A15]'
                }
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
                stroke={isHighlighted('arterioles-svr') ? '#9E2A2B' : '#5C4D42'}
                strokeWidth="1.15"
              />
              <circle
                cx="874"
                cy="474"
                r="2.8"
                fill={isHighlighted('arterioles-svr') ? '#9E2A2B' : '#231A15'}
              />
              <text
                x="950"
                y="460"
                textAnchor="start"
                className={
                  isHighlighted('arterioles-svr')
                    ? 'fill-[#9E2A2B] font-bold italic'
                    : 'fill-[#231A15]'
                }
              >
                Arteriolar Bed · SVR
              </text>
            </g>
          </g>
        </svg>

        {/* Registered Canvas2D Hand-Inked Erythrocyte Fluid Stream Layer */}
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
