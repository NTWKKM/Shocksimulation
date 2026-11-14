import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as k from '../kit/iso-kit';
import { Plate } from '../kit/react/draw';
import { follow, useReadout } from '../kit/react/live';
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
  buildPumpDynamicPaths,
  buildSvrValveDynamicPaths,
  createRigScene,
  type RigFocusGroup,
  type RigStaticScene,
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
const ORBIT_PRESETS = [0, 90, 180, 270] as const;

function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function shortestDeltaDeg(fromDeg: number, toDeg: number): number {
  return ((((toDeg - fromDeg) % 360) + 540) % 360) - 180;
}

function computeFocusViewBox(
  focus: AnatomyFocusId | null,
  scene: RigStaticScene,
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

interface OverlayEntry {
  id: string;
  piece: RigFocusGroup;
  key: number;
  dyn?: string;
  html: string;
}

function isGlPulseTubeId(id: string): boolean {
  return (
    id.startsWith('aorta.arch.') ||
    id.startsWith('aorta.feed.') ||
    id.startsWith('arterioles.cap.') ||
    id.startsWith('venous.return.')
  );
}

function buildOverlayEntries(scene: RigStaticScene, initialPistonSvg: string): OverlayEntry[] {
  const pumpItem = scene.items.find((i) => i.id === 'pump.barrel.glass');
  const domeItem = scene.items.find((i) => i.id === 'dome.housing');
  const cvpItem = scene.items.find((i) => i.id === 'cvp.column');

  const vessels = [pumpItem, domeItem, cvpItem].filter((v): v is NonNullable<typeof v> => Boolean(v));
  const entries: OverlayEntry[] = [
    {
      id: 'overlay.pump.piston',
      piece: 'myocardium-lvef',
      key: scene.pumpKey + 0.01,
      dyn: 'lv-front-overlay',
      html: initialPistonSvg,
    },
    {
      id: 'overlay.pump.glass',
      piece: 'lv-edv',
      key: scene.pumpKey + 0.02,
      html: scene.overlays.pumpGlassSvg,
    },
    {
      id: 'overlay.dome.glass',
      piece: 'aorta-map',
      key: scene.domeKey + 0.02,
      html: scene.overlays.domeGlassSvg,
    },
    {
      id: 'overlay.cvp.glass',
      piece: 'venous-cvp',
      key: scene.cvpKey + 0.02,
      html: scene.overlays.cvpGlassSvg,
    },
  ];

  for (const item of scene.items) {
    if (
      item.id === 'pump.barrel.glass' ||
      item.id === 'dome.housing' ||
      item.id === 'cvp.column' ||
      item.id === 'stand.baseplate' ||
      item.id.startsWith('stand.foot.') ||
      item.id === 'arterioles.tray' ||
      isGlPulseTubeId(item.id)
    ) {
      continue;
    }
    const nearVessels = vessels.filter(
      (v) => Math.hypot(item.screen[0] - v.screen[0], item.screen[1] - v.screen[1]) < 92,
    );
    if (nearVessels.length === 0) continue;
    const inFrontOfAny = nearVessels.some((v) => item.key > v.key);
    if (inFrontOfAny) {
      entries.push({
        id: `overlay.${item.id}`,
        piece: item.piece,
        key: item.key,
        html: item.svg,
      });
    }
  }

  entries.sort((a, b) => a.key - b.key);
  return entries;
}

function applyLitDimAttributes(
  roots: Array<SVGSVGElement | null>,
  hoveredPart: AnatomyFocusId | null,
  selectedPart: AnatomyFocusId | null,
) {
  const active = hoveredPart ?? selectedPart;
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
  const [scene, setScene] = useState<RigStaticScene>(() => createRigScene(0));
  const [displayAngle, setDisplayAngle] = useState(0);
  const [draggingUi, setDraggingUi] = useState(false);

  const initialPump = useMemo(() => buildPumpDynamicPaths(120, scene.projection), [scene.projection]);
  const overlayEntries = useMemo(
    () => buildOverlayEntries(scene, initialPump.frontOverlaySvg),
    [scene, initialPump.frontOverlaySvg],
  );

  const { anchor: stageAnchorRef, say } = useReadout<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement>(null);
  const overlaySvgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glCtrlRef = useRef<HemodynamicGlController | null>(null);
  const [glActive, setGlActive] = useState(false);

  const sceneRef = useRef(scene);
  sceneRef.current = scene;

  const targetAngleRef = useRef(0);
  const currentAngleRef = useRef(0);
  const renderedAngleRef = useRef(0);
  const isDraggingRef = useRef(false);
  const lastSceneWasFastRef = useRef(false);
  const suppressNextClickRef = useRef(false);
  const dragMetaRef = useRef<{
    active: boolean;
    pointerId: number;
    startX: number;
    startY: number;
    startAngle: number;
    moved: number;
    downTarget: EventTarget | null;
  }>({
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    startAngle: 0,
    moved: 0,
    downTarget: null,
  });

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
  const sayRef = useRef(say);
  sayRef.current = say;

  const lastDynamicRef = useRef({
    lvVolumeMl: 120,
    aorticPressureMmHg: 70,
    effectiveSvr: 12,
    cvp: inputs.cvp,
    viewBox: [...FULL_VIEW_BOX] as ViewBoxTuple,
  });

  const syncDynamicDom = useCallback(
    (
      activeScene: RigStaticScene,
      lvVolumeMl: number,
      aorticPressureMmHg: number,
      effectiveSvr: number,
      cvp: number,
      forceAll = false,
    ) => {
      const svg = svgRef.current;
      const overlaySvg = overlaySvgRef.current;
      if (!svg || !overlaySvg) return;
      const P = activeScene.projection;
      const prev = lastDynamicRef.current;

      if (forceAll || Math.abs(lvVolumeMl - prev.lvVolumeMl) > 0.7) {
        prev.lvVolumeMl = lvVolumeMl;
        const lvPaths = buildPumpDynamicPaths(lvVolumeMl, P);
        svg.querySelectorAll<SVGGElement>('[data-dyn="lv-shell"]').forEach((node) => {
          node.innerHTML = lvPaths.shellSvg;
        });
        overlaySvg.querySelectorAll<SVGGElement>('[data-dyn="lv-front-overlay"]').forEach((node) => {
          node.innerHTML = lvPaths.frontOverlaySvg;
        });
      }

      if (forceAll || Math.abs(aorticPressureMmHg - prev.aorticPressureMmHg) > 0.25) {
        const needleD = buildDialNeedlePath(aorticPressureMmHg, P);
        const needleMarkup = `<path class="iso-line" data-tone="red" data-free="" d="${needleD}"/>`;
        [svg, overlaySvg].forEach((root) => {
          root.querySelectorAll<SVGGElement>('[data-dyn="dial-needle"]').forEach((node) => {
            node.innerHTML = needleMarkup;
          });
        });
      }

      if (forceAll || Math.abs(effectiveSvr - prev.effectiveSvr) > 0.1) {
        prev.effectiveSvr = effectiveSvr;
        const svrPaths = buildSvrValveDynamicPaths(effectiveSvr, P);
        [svg, overlaySvg].forEach((root) => {
          root.querySelectorAll<SVGGElement>('[data-dyn="svr-stem"]').forEach((node) => {
            node.innerHTML = svrPaths.stemSvg;
          });
          root.querySelectorAll<SVGGElement>('[data-dyn="svr-knob"]').forEach((node) => {
            node.innerHTML = svrPaths.knobSvg;
          });
        });
      }

      if (
        !glCtrlRef.current &&
        (forceAll || Math.abs(cvp - prev.cvp) > 0.1 || Math.abs(aorticPressureMmHg - prev.aorticPressureMmHg) > 0.4)
      ) {
        prev.cvp = cvp;
        const fb = buildFallbackFluidPaths(cvp, aorticPressureMmHg, P);
        svg.querySelectorAll<SVGGElement>('[data-dyn="cvp-fluid-fallback"]').forEach((node) => {
          node.innerHTML = fb.cvpSvg;
        });
        svg.querySelectorAll<SVGGElement>('[data-dyn="dome-fluid-fallback"]').forEach((node) => {
          node.innerHTML = fb.domeSvg;
        });
      }

      prev.aorticPressureMmHg = aorticPressureMmHg;
    },
    [],
  );

  // Toggle data-gl attribute cleanly on parent .iso-plate for WebGL/SVG fallback styling
  useEffect(() => {
    const plate = stageAnchorRef.current?.closest('.iso-plate');
    if (!plate) return;
    if (glActive) {
      plate.setAttribute('data-gl', '1');
    } else {
      plate.removeAttribute('data-gl');
    }
  }, [glActive, stageAnchorRef]);

  // Synchronously restore dynamic paths, lit/dim attributes, viewBox & WebGL camera before browser paint when scene rotates
  useLayoutEffect(() => {
    const svg = svgRef.current;
    const overlaySvg = overlaySvgRef.current;
    if (svg && overlaySvg) {
      const vb = lastDynamicRef.current.viewBox;
      const vbStr = `${vb[0].toFixed(2)} ${vb[1].toFixed(2)} ${vb[2].toFixed(2)} ${vb[3].toFixed(2)}`;
      svg.setAttribute('viewBox', vbStr);
      overlaySvg.setAttribute('viewBox', vbStr);
    }
    const prev = lastDynamicRef.current;
    syncDynamicDom(scene, prev.lvVolumeMl, prev.aorticPressureMmHg, prev.effectiveSvr, prev.cvp, true);
    applyLitDimAttributes([svgRef.current, overlaySvgRef.current], hoveredRef.current, selectedRef.current);
    glCtrlRef.current?.updateCameraAndRoutes(scene);
  }, [scene, syncDynamicDom]);

  // Sync lit/dim highlight attributes cleanly on main & overlay SVG nodes
  useEffect(() => {
    applyLitDimAttributes([svgRef.current, overlaySvgRef.current], hoveredPart, selectedPart);
  }, [hoveredPart, selectedPart]);

  // Mount WebGL fluid layer once + run 60fps turntable/physics animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const svg = svgRef.current;
    const overlaySvg = overlaySvgRef.current;
    if (!svg || !overlaySvg) return;

    let glCtrl: HemodynamicGlController | null = null;
    if (canvas) {
      glCtrl = createHemodynamicGl(canvas, sceneRef.current);
      glCtrlRef.current = glCtrl;
      setGlActive(Boolean(glCtrl));
    }

    let currentVb: ViewBoxTuple = [...lastDynamicRef.current.viewBox];
    let lastTime = performance.now();
    let elapsedSim = 0;
    let lastReadoutMs = 0;
    let lastAngleUiMs = 0;
    let rafId = 0;
    const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const tick = (now: number) => {
      const calm = reduceQuery.matches;
      const rawDtSec = Math.max(0.001, (now - lastTime) / 1000);
      const dtSec = Math.min(0.05, rawDtSec);
      const camDtSec = Math.min(0.16, rawDtSec);
      lastTime = now;
      if (!calm) elapsedSim += dtSec;

      // Advance 360-degree turntable angle smoothly (or lock 1:1 while pointer-dragging)
      if (isDraggingRef.current || calm) {
        currentAngleRef.current = targetAngleRef.current;
      } else {
        currentAngleRef.current = follow(currentAngleRef.current, targetAngleRef.current, camDtSec, 0.08, false);
        if (Math.abs(targetAngleRef.current - currentAngleRef.current) < 0.25) {
          currentAngleRef.current = targetAngleRef.current;
        }
      }

      const residualDeg = Math.abs(targetAngleRef.current - currentAngleRef.current);
      const inMotion = !calm && (isDraggingRef.current || residualDeg > 0.25);
      const angleChanged = Math.abs(currentAngleRef.current - renderedAngleRef.current) >= (inMotion ? 0.35 : 0.08);
      const needsSettleRefine = !inMotion && lastSceneWasFastRef.current;

      if (angleChanged || needsSettleRefine) {
        if (!inMotion && residualDeg <= 0.25) {
          currentAngleRef.current = targetAngleRef.current;
        }
        const nextNorm = normalizeDeg(currentAngleRef.current);
        const nextScene = createRigScene(nextNorm, {
          spacing: inMotion ? 4.2 : 2.2,
          fast: inMotion,
        });
        lastSceneWasFastRef.current = inMotion;
        renderedAngleRef.current = currentAngleRef.current;
        sceneRef.current = nextScene;
        glCtrlRef.current?.updateCameraAndRoutes(nextScene);
        setScene(nextScene);
        if (now - lastAngleUiMs >= 45 || !inMotion) {
          lastAngleUiMs = now;
          setDisplayAngle(Math.round(nextNorm) % 360);
        }
      }

      const activeScene = sceneRef.current;
      const t = stepRef.current(calm ? 0 : dtSec);
      const curInputs = inputsRef.current;

      const targetVb = computeFocusViewBox(selectedRef.current, activeScene);
      currentVb = [
        follow(currentVb[0], targetVb[0], dtSec, 0.18, calm),
        follow(currentVb[1], targetVb[1], dtSec, 0.18, calm),
        follow(currentVb[2], targetVb[2], dtSec, 0.18, calm),
        follow(currentVb[3], targetVb[3], dtSec, 0.18, calm),
      ];
      lastDynamicRef.current.viewBox = currentVb;

      const vbStr = `${currentVb[0].toFixed(2)} ${currentVb[1].toFixed(2)} ${currentVb[2].toFixed(2)} ${currentVb[3].toFixed(2)}`;
      if (svg.getAttribute('viewBox') !== vbStr) {
        svg.setAttribute('viewBox', vbStr);
        overlaySvg.setAttribute('viewBox', vbStr);
      }

      syncDynamicDom(activeScene, t.lvVolumeMl, t.aorticPressureMmHg, t.effectiveSvr, curInputs.cvp, false);

      if (glCtrl) {
        glCtrl.draw(t, curInputs, currentVb, themeRef.current, elapsedSim);
      }

      if (now - lastReadoutMs >= 100) {
        lastReadoutMs = now;
        sayRef.current(
          `MAP ${t.map} mmHg · BP ${t.sbp}/${t.dbp} · CO ${t.coLMin.toFixed(2)} L/m · SVR ${t.effectiveSvr.toFixed(0)} WU`,
        );
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      glCtrl?.clear();
      glCtrlRef.current = null;
    };
  }, [syncDynamicDom]);

  const setTargetAngle = useCallback((nextAngleDeg: number, immediate = false) => {
    targetAngleRef.current = nextAngleDeg;
    const norm = normalizeDeg(nextAngleDeg);
    setDisplayAngle(Math.round(norm) % 360);
    if (immediate) {
      currentAngleRef.current = nextAngleDeg;
      renderedAngleRef.current = nextAngleDeg;
      lastSceneWasFastRef.current = false;
      const nextScene = createRigScene(norm, { spacing: 2.2 });
      sceneRef.current = nextScene;
      glCtrlRef.current?.updateCameraAndRoutes(nextScene);
      setScene(nextScene);
    }
  }, []);

  const rotateToPreset = useCallback(
    (presetDeg: number) => {
      const current = targetAngleRef.current;
      const delta = shortestDeltaDeg(normalizeDeg(current), presetDeg);
      setTargetAngle(current + delta);
    },
    [setTargetAngle],
  );

  const stepAngleBy = useCallback(
    (deltaDeg: number) => {
      setTargetAngle(targetAngleRef.current + deltaDeg);
    },
    [setTargetAngle],
  );

  const resolvePieceFromEvent = (target: EventTarget | null): AnatomyFocusId | null => {
    if (!(target instanceof Element)) return null;
    const holder = target.closest('[data-piece]');
    const id = holder?.getAttribute('data-piece') ?? null;
    return isInteractiveFocusId(id) ? id : null;
  };

  const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragMetaRef.current.active || e.pointerId !== dragMetaRef.current.pointerId) return;
    dragMetaRef.current.active = false;
    const moved = dragMetaRef.current.moved;
    isDraggingRef.current = false;
    setDraggingUi(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (moved > 5) {
      suppressNextClickRef.current = true;
      const norm = normalizeDeg(currentAngleRef.current);
      const refined = createRigScene(norm, { spacing: 2.2 });
      renderedAngleRef.current = currentAngleRef.current;
      lastSceneWasFastRef.current = false;
      sceneRef.current = refined;
      glCtrlRef.current?.updateCameraAndRoutes(refined);
      setScene(refined);
      setDisplayAngle(Math.round(norm) % 360);
    }
  }, []);

  const figLabel = `Fig 1 · ${displayAngle}°/${Math.round(scene.projection.elevation ?? 31)}°`;

  return (
    <Plate
      fig={figLabel}
      title="Windkessel Pump Rig"
      hint="Drag 360° · Click assembly · Esc reset"
      readout="MAP 68 mmHg · BP 84/56 · CO 5.04 L/m · SVR 12 WU"
      keys={[
        { mark: 'lit', label: 'Selected assembly' },
        { mark: 'red', label: 'Arterial pressure & 65 mmHg gauge mark' },
        { mark: 'blue', label: 'Venous return & CVP standpipe' },
        { mark: 'dashed', label: 'Section & 360° sight-glass ticks' },
      ]}
      caption="ชุดจำลอง Windkessel แบบกระบอกสูบไฮดรอลิก 4 ห้องเชื่อมต่อเนื่องหมุนได้รอบ 360°: มองทะลุกระบอกแก้วนิรภัยเห็นลูกสูบเคลื่อนตามค่า EDV/LVEF, Windkessel accumulator, วาล์วต้านทาน SVR และท่อวัด CVP จากทุกมุมมอง"
    >
      <div className="flex flex-col items-center gap-2">
        <div
          ref={stageAnchorRef}
          data-testid="cardio-isometric-stage"
          data-gl={glActive ? '1' : undefined}
          data-angle={displayAngle}
          tabIndex={0}
          aria-label="Rotatable 360-degree isometric hydraulic Windkessel pump rig"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            dragMetaRef.current = {
              active: true,
              pointerId: e.pointerId,
              startX: e.clientX,
              startY: e.clientY,
              startAngle: targetAngleRef.current,
              moved: 0,
              downTarget: e.target,
            };
          }}
          onPointerMove={(e) => {
            if (dragMetaRef.current.active && e.pointerId === dragMetaRef.current.pointerId) {
              const dx = e.clientX - dragMetaRef.current.startX;
              const dy = e.clientY - dragMetaRef.current.startY;
              const dist = Math.hypot(dx, dy);
              dragMetaRef.current.moved = Math.max(dragMetaRef.current.moved, dist);
              if (dragMetaRef.current.moved > 4) {
                if (!isDraggingRef.current) {
                  isDraggingRef.current = true;
                  setDraggingUi(true);
                  e.currentTarget.setPointerCapture(e.pointerId);
                }
                targetAngleRef.current = dragMetaRef.current.startAngle - dx * 0.45;
              }
              return;
            }
            const part = resolvePieceFromEvent(e.target);
            onHoverPart(part);
          }}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerLeave={() => {
            if (!isDraggingRef.current) onHoverPart(null);
          }}
          onClickCapture={(e) => {
            if (suppressNextClickRef.current) {
              suppressNextClickRef.current = false;
              e.stopPropagation();
              e.preventDefault();
            }
          }}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 5 : 15;
            if (e.key === 'ArrowLeft') {
              e.preventDefault();
              stepAngleBy(-step);
            } else if (e.key === 'ArrowRight') {
              e.preventDefault();
              stepAngleBy(step);
            } else if (e.key === 'Home' || e.key === '0') {
              e.preventDefault();
              rotateToPreset(0);
            }
          }}
          className={`iso-stage relative mx-auto w-full max-w-[820px] aspect-[700/420] overflow-hidden select-none outline-none focus-visible:ring-1 focus-visible:ring-[var(--anatomy-lit)] ${
            draggingUi ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          style={{ touchAction: 'none' }}
        >
          <svg
            ref={svgRef}
            className="iso-svg h-full w-full"
            viewBox={`0 0 ${RIG_VIEW_W} ${RIG_VIEW_H}`}
            role="img"
            aria-label="Interactive 360-degree isometric hydraulic Windkessel pump rig diagram"
            onClick={(e) => {
              const part = resolvePieceFromEvent(e.target);
              onSelectPart(part);
            }}
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

          {/* Foreground 0.6px linework & occluding front assemblies kept strictly above WebGL fluid */}
          <svg
            ref={overlaySvgRef}
            className="iso-svg pointer-events-none absolute inset-0 h-full w-full z-[3]"
            viewBox={`0 0 ${RIG_VIEW_W} ${RIG_VIEW_H}`}
            aria-hidden="true"
          >
            {overlayEntries.map((entry) => (
              <g
                key={entry.id}
                className="iso-item"
                data-piece={entry.piece}
                data-dyn={entry.dyn}
                dangerouslySetInnerHTML={{ __html: entry.html }}
              />
            ))}
          </svg>
        </div>

        {/* Square monochrome 360-degree turntable controls */}
        <div
          className="flex flex-wrap items-center justify-center gap-1 font-mono-tabular text-[11px]"
          role="group"
          aria-label="Orbit turntable view angle"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            data-testid="orbit-step-ccw"
            onClick={() => stepAngleBy(-45)}
            className="rounded-none border border-[var(--anatomy-rule)] bg-[var(--anatomy-surface-alt)] px-2 py-1 text-[var(--anatomy-text)] transition-colors hover:border-[var(--anatomy-mid)] hover:text-[var(--anatomy-strong)]"
            title="Rotate −45° (ArrowLeft)"
          >
            −45°
          </button>
          {ORBIT_PRESETS.map((deg) => {
            const active = Math.abs(shortestDeltaDeg(displayAngle, deg)) <= 6;
            return (
              <button
                key={deg}
                type="button"
                data-testid={`orbit-angle-${deg}`}
                aria-pressed={active}
                onClick={() => rotateToPreset(deg)}
                className={`rounded-none border px-2 py-1 transition-colors ${
                  active
                    ? 'border-[var(--anatomy-lit)] bg-[var(--anatomy-lit)] text-[var(--anatomy-card)]'
                    : 'border-[var(--anatomy-rule)] bg-[var(--anatomy-surface-alt)] text-[var(--anatomy-text)] hover:border-[var(--anatomy-mid)] hover:text-[var(--anatomy-strong)]'
                }`}
              >
                {deg}°
              </button>
            );
          })}
          <button
            type="button"
            data-testid="orbit-step-cw"
            onClick={() => stepAngleBy(45)}
            className="rounded-none border border-[var(--anatomy-rule)] bg-[var(--anatomy-surface-alt)] px-2 py-1 text-[var(--anatomy-text)] transition-colors hover:border-[var(--anatomy-mid)] hover:text-[var(--anatomy-strong)]"
            title="Rotate +45° (ArrowRight)"
          >
            +45°
          </button>
          <span
            data-testid="orbit-readout"
            className="ml-1.5 border border-[var(--anatomy-rule-soft)] px-2 py-1 text-[10.5px] text-[var(--anatomy-muted)]"
          >
            AZ {displayAngle}°
          </span>
        </div>
      </div>
    </Plate>
  );
}
