import { useEffect, useMemo, useRef, useState } from 'react';
import * as k from '../kit/iso-kit';

function follow(current: number, target: number, dt: number, seconds: number, calm = false): number {
  if (calm) return target;
  const next = current + (target - current) * (1 - Math.exp(-dt / seconds));
  return Math.abs(target - next) < 1e-3 ? target : next;
}
import type {
  AnatomyFocusId,
  HemodynamicInputs,
  HemodynamicTelemetry,
} from '../physics/hemodynamics';
import { createHemodynamicGl, type HemodynamicGlController } from '../scene/hemodynamicGl';
import {
  RIG_VIEW_H,
  RIG_VIEW_W,
  buildDialNeedlePath,
  buildFallbackFluidPaths,
  buildLvDynamicPaths,
  buildSvrValveDynamicPaths,
  buildValveLeafletPaths,
  createRigScene,
} from '../scene/rigModel';

interface IsometricRigStageProps {
  selectedPart: AnatomyFocusId | null;
  hoveredPart: AnatomyFocusId | null;
  theme: 'dark' | 'light';
  inputs: HemodynamicInputs;
  onSelectPart: (partId: AnatomyFocusId | null) => void;
  onHoverPart: (partId: AnatomyFocusId | null) => void;
  onStepPhysics: (dtSec: number) => HemodynamicTelemetry;
}

type ViewBoxTuple = [number, number, number, number];
const FULL_VIEW_BOX: ViewBoxTuple = [0, 0, RIG_VIEW_W, RIG_VIEW_H];

function computeFocusViewBox(
  focus: AnatomyFocusId | null,
  scene: ReturnType<typeof createRigScene>,
): ViewBoxTuple {
  if (!focus) return FULL_VIEW_BOX;
  const a = scene.anchors;
  let targetPt: k.Point3;
  let zoomScale = 0.58;

  switch (focus) {
    case 'lv-edv':
    case 'myocardium-lvef':
      targetPt = [a.heartCenter[0], a.heartCenter[1], 56];
      zoomScale = 0.56;
      break;
    case 'aorta-map':
      targetPt = [a.domeCenter[0] - 8, (a.domeCenter[1] + a.gaugeCenter[1]) * 0.42, 68];
      zoomScale = 0.6;
      break;
    case 'arterioles-svr':
      targetPt = [a.svrCenter[0] + 18, a.svrCenter[1], 24];
      zoomScale = 0.56;
      break;
    case 'venous-cvp':
      targetPt = [a.cvpCenter[0] + 24, a.cvpCenter[1], 54];
      zoomScale = 0.58;
      break;
  }

  const [cx, cy] = k.iso(targetPt, scene.projection);
  const vw = RIG_VIEW_W * zoomScale;
  const vh = RIG_VIEW_H * zoomScale;
  const vx = Math.max(0, Math.min(RIG_VIEW_W - vw, cx - vw * 0.5));
  const vy = Math.max(0, Math.min(RIG_VIEW_H - vh, cy - vh * 0.5));
  return [vx, vy, vw, vh];
}

function isInteractiveFocusId(val: string | null): val is AnatomyFocusId {
  return (
    val === 'lv-edv' ||
    val === 'myocardium-lvef' ||
    val === 'aorta-map' ||
    val === 'arterioles-svr' ||
    val === 'venous-cvp'
  );
}

export function IsometricRigStage({
  selectedPart,
  hoveredPart,
  theme,
  inputs,
  onSelectPart,
  onHoverPart,
  onStepPhysics,
}: IsometricRigStageProps) {
  const scene = useMemo(() => createRigScene(), []);

  const stageRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const overlaySvgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);

  const [glActive, setGlActive] = useState(false);

  const selectedRef = useRef(selectedPart);
  selectedRef.current = selectedPart;
  const hoveredRef = useRef(hoveredPart);
  hoveredRef.current = hoveredPart;
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const inputsRef = useRef(inputs);
  inputsRef.current = inputs;
  const stepRef = useRef(onStepPhysics);
  stepRef.current = onStepPhysics;

  // Sync lit/dim highlight attributes cleanly on main & overlay SVG nodes
  useEffect(() => {
    const active = hoveredPart ?? selectedPart;
    const roots = [svgRef.current, overlaySvgRef.current];
    for (const root of roots) {
      if (!root) continue;
      root.querySelectorAll<SVGElement>('[data-piece]').forEach((el) => {
        const piece = el.getAttribute('data-piece');
        if (!piece || piece === 'stand') {
          el.removeAttribute('data-lit');
          if (active) el.setAttribute('data-dim', '1');
          else el.removeAttribute('data-dim');
          return;
        }
        const matched =
          active === piece ||
          (active === 'lv-edv' && piece === 'myocardium-lvef') ||
          (active === 'myocardium-lvef' && piece === 'lv-edv');
        if (active) {
          if (matched) {
            el.setAttribute('data-lit', '1');
            el.removeAttribute('data-dim');
          } else {
            el.removeAttribute('data-lit');
            el.setAttribute('data-dim', '1');
          }
        } else {
          el.removeAttribute('data-lit');
          el.removeAttribute('data-dim');
        }
      });
    }
  }, [hoveredPart, selectedPart]);

  // Mount WebGL fluid layer + 60fps imperative DOM/WebGL animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const svg = svgRef.current;
    const overlaySvg = overlaySvgRef.current;
    if (!svg || !overlaySvg) return;

    let glCtrl: HemodynamicGlController | null = null;
    if (canvas) {
      glCtrl = createHemodynamicGl(canvas, scene);
      setGlActive(Boolean(glCtrl));
    }

    const lvShellNode = svg.querySelector<SVGGElement>('[data-dyn="lv-shell"]');
    const lvOverlayNode = overlaySvg.querySelector<SVGGElement>('[data-dyn="lv-front-overlay"]');
    const aorticValveNode = svg.querySelector<SVGGElement>('[data-dyn="aortic-valve"]');
    const dialNeedleNode = svg.querySelector<SVGGElement>('[data-dyn="dial-needle"]');
    const svrStemNode = svg.querySelector<SVGGElement>('[data-dyn="svr-stem"]');
    const svrKnobNode = svg.querySelector<SVGGElement>('[data-dyn="svr-knob"]');
    const domeFallbackNode = svg.querySelector<SVGGElement>('[data-dyn="dome-fluid-fallback"]');
    const cvpFallbackNode = svg.querySelector<SVGGElement>('[data-dyn="cvp-fluid-fallback"]');

    let currentVb: ViewBoxTuple = [...FULL_VIEW_BOX];
    let lastTime = performance.now();
    let elapsedSim = 0;
    let lastReadoutMs = 0;

    let lastLv = -999;
    let lastMitral = -999;
    let lastAortic = -999;
    let lastMap = -999;
    let lastSvr = -999;
    let lastCvp = -999;
    let lastPa = -999;

    let rafId = 0;
    const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const tick = (now: number) => {
      const calm = reduceQuery.matches;
      const dtSec = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      if (!calm) elapsedSim += dtSec;

      const t = stepRef.current(calm ? 0 : dtSec);
      const curInputs = inputsRef.current;

      // Smooth focus zoom viewBox interpolation (locked across both SVGs and WebGL)
      const targetVb = computeFocusViewBox(selectedRef.current, scene);
      currentVb = [
        follow(currentVb[0], targetVb[0], dtSec, 0.18, calm),
        follow(currentVb[1], targetVb[1], dtSec, 0.18, calm),
        follow(currentVb[2], targetVb[2], dtSec, 0.18, calm),
        follow(currentVb[3], targetVb[3], dtSec, 0.18, calm),
      ];
      const vbStr = `${currentVb[0].toFixed(2)} ${currentVb[1].toFixed(2)} ${currentVb[2].toFixed(2)} ${currentVb[3].toFixed(2)}`;
      if (svg.getAttribute('viewBox') !== vbStr) {
        svg.setAttribute('viewBox', vbStr);
        overlaySvg.setAttribute('viewBox', vbStr);
      }

      // 1. LV cutaway geometry + mitral leaflets (rebuilt only when threshold changes)
      if (
        Math.abs(t.lvVolumeMl - lastLv) > 0.7 ||
        Math.abs(t.mitralOpen - lastMitral) > 0.035
      ) {
        lastLv = t.lvVolumeMl;
        lastMitral = t.mitralOpen;
        const lvPaths = buildLvDynamicPaths(t.lvVolumeMl, t.mitralOpen);
        if (lvShellNode) lvShellNode.innerHTML = lvPaths.shellSvg;
        if (lvOverlayNode) lvOverlayNode.innerHTML = lvPaths.frontOverlaySvg;
      }

      // 2. Aortic valve leaflets
      if (aorticValveNode && Math.abs(t.aorticOpen - lastAortic) > 0.035) {
        lastAortic = t.aorticOpen;
        const { aorticD } = buildValveLeafletPaths(t.mitralOpen, t.aorticOpen);
        aorticValveNode.innerHTML = `<path class="iso-line" data-tone="lit" d="${aorticD}"/>`;
      }

      // 3. MAP Dial needle
      if (dialNeedleNode && Math.abs(t.aorticPressureMmHg - lastMap) > 0.25) {
        lastMap = t.aorticPressureMmHg;
        dialNeedleNode.innerHTML = `<path class="iso-line" data-tone="red" d="${buildDialNeedlePath(t.aorticPressureMmHg)}"/>`;
      }

      // 4. SVR rising-stem knurled throttle valve
      if ((svrStemNode || svrKnobNode) && Math.abs(t.effectiveSvr - lastSvr) > 0.1) {
        lastSvr = t.effectiveSvr;
        const svrPaths = buildSvrValveDynamicPaths(t.effectiveSvr);
        if (svrStemNode) svrStemNode.innerHTML = svrPaths.stemSvg;
        if (svrKnobNode) svrKnobNode.innerHTML = svrPaths.knobSvg;
      }

      // 5. Fallback SVG column fills (always updated cleanly if WebGL inactive)
      if (
        !glCtrl &&
        (Math.abs(curInputs.cvp - lastCvp) > 0.1 || Math.abs(t.aorticPressureMmHg - lastPa) > 0.4)
      ) {
        lastCvp = curInputs.cvp;
        lastPa = t.aorticPressureMmHg;
        const fb = buildFallbackFluidPaths(curInputs.cvp, t.aorticPressureMmHg);
        if (cvpFallbackNode) cvpFallbackNode.innerHTML = fb.cvpSvg;
        if (domeFallbackNode) domeFallbackNode.innerHTML = fb.domeSvg;
      }

      // 6. WebGL volumetric blood & flow pulse shader
      if (glCtrl) {
        glCtrl.draw(t, curInputs, currentVb, themeRef.current, elapsedSim);
      }

      // 7. Monospace plate corner readout at ~10Hz
      if (readoutRef.current && now - lastReadoutMs >= 100) {
        lastReadoutMs = now;
        const line = `MAP ${t.map} · BP ${t.sbp}/${t.dbp} · CO ${t.coLMin.toFixed(2)} · SVR ${t.effectiveSvr.toFixed(0)}`;
        if (readoutRef.current.textContent !== line) {
          readoutRef.current.textContent = line;
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      glCtrl?.clear();
    };
  }, [scene]);

  const initialLv = useMemo(() => buildLvDynamicPaths(120, 0.4), []);

  const resolvePieceFromEvent = (target: EventTarget | null): AnatomyFocusId | null => {
    if (!(target instanceof Element)) return null;
    const holder = target.closest('[data-piece]');
    const id = holder?.getAttribute('data-piece') ?? null;
    return isInteractiveFocusId(id) ? id : null;
  };

  return (
    <figure className="flex h-full w-full flex-col gap-2.5 min-h-0">
      <div
        ref={stageRef}
        className="iso-plate iso-stage flex items-center justify-center overflow-hidden px-3 pt-9 pb-10 sm:px-6 sm:py-11"
        data-gl={glActive ? '1' : undefined}
        data-testid="cardio-isometric-stage"
      >
        <div className="iso-plate-corners">
          <div className="iso-plate-row">
            <span className="iso-plate-corner" data-corner="fig">
              FIG 01 · ISO 50°/31°
            </span>
            <span className="iso-plate-corner" data-corner="title">
              HYBRID WINDKESSEL RIG
            </span>
          </div>
          <div className="iso-plate-row">
            <span className="iso-plate-corner hidden xl:inline" data-corner="hint">
              CLICK PART · ESC RESET
            </span>
            <span ref={readoutRef} className="iso-plate-corner ml-auto" data-corner="readout">
              MAP 68 · BP 84/56 · CO 5.04 · SVR 12
            </span>
          </div>
        </div>

        {/* Exact aspect-locked stage box so SVG, WebGL canvas & front overlay lines never drift */}
        <div className="relative w-full max-w-[960px] max-h-full aspect-[700/420]">
          <svg
            ref={svgRef}
            className="iso-svg h-full w-full"
            viewBox={`0 0 ${RIG_VIEW_W} ${RIG_VIEW_H}`}
            role="img"
            aria-label="Interactive isometric Windkessel cardiovascular rig diagram"
            onClick={(e) => {
              const part = resolvePieceFromEvent(e.target);
              if (part) {
                onSelectPart(part);
              } else {
                onSelectPart(null);
              }
            }}
            onPointerMove={(e) => {
              const part = resolvePieceFromEvent(e.target);
              onHoverPart(part);
            }}
            onPointerLeave={() => onHoverPart(null)}
          >
            <path className="iso-halo" d={scene.haloPath} />
            {scene.items.map((item) => (
              <g
                key={item.id}
                className="iso-item"
                data-item-id={item.id}
                data-piece={item.piece}
                dangerouslySetInnerHTML={{ __html: item.svg }}
              />
            ))}
          </svg>

          <canvas
            ref={canvasRef}
            data-testid="rig-webgl-canvas"
            className="iso-gl-layer"
            aria-hidden="true"
          />

          {/* Foreground 0.6px linework overlay kept strictly above WebGL fluid so glass ticks & cutaway rim never blur */}
          <svg
            ref={overlaySvgRef}
            className="iso-svg pointer-events-none absolute inset-0 h-full w-full z-[3]"
            viewBox={`0 0 ${RIG_VIEW_W} ${RIG_VIEW_H}`}
            aria-hidden="true"
          >
            <g
              data-piece="myocardium-lvef"
              data-dyn="lv-front-overlay"
              dangerouslySetInnerHTML={{ __html: initialLv.frontOverlaySvg }}
            />
            <g
              data-piece="aorta-map"
              dangerouslySetInnerHTML={{ __html: scene.overlays.domeGlassSvg }}
            />
            <g
              data-piece="venous-cvp"
              dangerouslySetInnerHTML={{ __html: scene.overlays.cvpGlassSvg }}
            />
          </svg>
        </div>
      </div>

      <figcaption className="iso-legend px-0.5">
        <div className="iso-keys">
          <span className="iso-key">
            <svg className="iso-swatch" data-mark="lit" viewBox="0 0 16 10" aria-hidden="true">
              <path d="M2 4.5 8 1.5 14 4.5 14 6 8 9 2 6Z" />
              <path className="iso-swatch-crease" d="M2 4.5 8 7.5 14 4.5" />
            </svg>
            Selected assembly
          </span>
          <span className="iso-key">
            <svg className="iso-swatch" data-mark="red" viewBox="0 0 16 10" aria-hidden="true">
              <path d="M1.5 5h13" />
            </svg>
            Arterial pressure / 65 mmHg threshold
          </span>
          <span className="iso-key">
            <svg className="iso-swatch" data-mark="blue" viewBox="0 0 16 10" aria-hidden="true">
              <path d="M1.5 5h13" />
            </svg>
            Venous return &amp; CVP column
          </span>
          <span className="iso-key">
            <svg className="iso-swatch" data-mark="dashed" viewBox="0 0 16 10" aria-hidden="true">
              <path d="M1.5 5h13" />
            </svg>
            Section &amp; sight-glass ticks
          </span>
        </div>
      </figcaption>
    </figure>
  );
}
