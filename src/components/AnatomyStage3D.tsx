import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type {
  AnatomyFocusId,
  HemodynamicInputs,
  HemodynamicTelemetry,
} from '../physics/hemodynamics';
import { buildHeartRig } from '../scene/heartGeometry';
import {
  NETTER_PARCHMENT_HEX,
  createNetterMaterials,
  createParchmentWashTexture,
  detectSoftwareWebGL,
} from '../scene/netterMaterials';
import {
  FOCUS_CAMERA_PRESETS,
  OVERVIEW_CAMERA_PRESET,
  sampleCurveUniform,
} from '../scene/splineMath';

interface AnatomyStage3DProps {
  selectedPart: AnatomyFocusId | null;
  hoveredPart: AnatomyFocusId | null;
  inputs: HemodynamicInputs;
  onSelectPart: (partId: AnatomyFocusId | null) => void;
  onHoverPart: (partId: AnatomyFocusId | null) => void;
  onStepPhysics: (dtSec: number) => HemodynamicTelemetry;
}

interface CalloutConfig {
  id: AnatomyFocusId;
  label: string;
  offsetX: number;
  offsetY: number;
  elbowX: number;
  align: 'left' | 'right';
}

const CALLOUT_CONFIGS: CalloutConfig[] = [
  { id: 'venous-cvp', label: 'Left Atrium · CVP', offsetX: -120, offsetY: -54, elbowX: -36, align: 'right' },
  { id: 'aorta-map', label: 'Aortic Arch · MAP', offsetX: 118, offsetY: -34, elbowX: 38, align: 'left' },
  { id: 'lv-edv', label: 'LV Cavity · EDV', offsetX: 132, offsetY: -12, elbowX: 32, align: 'left' },
  { id: 'myocardium-lvef', label: 'Myocardium · LVEF', offsetX: 112, offsetY: 48, elbowX: 34, align: 'left' },
  { id: 'arterioles-svr', label: 'Arteriolar Bed · SVR', offsetX: 110, offsetY: -2, elbowX: 32, align: 'left' },
];

// Reusable math scratchpad outside render loop (Zero GC)
const _vPos = new THREE.Vector3();
const _vTan = new THREE.Vector3();
const _vProj = new THREE.Vector3();
const _vUp = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _camTargetPos = new THREE.Vector3();
const _camTargetLook = new THREE.Vector3();

export function AnatomyStage3D({
  selectedPart,
  hoveredPart,
  inputs,
  onSelectPart,
  onHoverPart,
  onStepPhysics,
}: AnatomyStage3DProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const calloutOverlayRef = useRef<SVGSVGElement>(null);

  const selectedRef = useRef(selectedPart);
  selectedRef.current = selectedPart;
  const hoveredRef = useRef(hoveredPart);
  hoveredRef.current = hoveredPart;
  const inputsRef = useRef(inputs);
  inputsRef.current = inputs;
  const onSelectRef = useRef(onSelectPart);
  onSelectRef.current = onSelectPart;
  const onHoverRef = useRef(onHoverPart);
  onHoverRef.current = onHoverPart;
  const stepRef = useRef(onStepPhysics);
  stepRef.current = onStepPhysics;

  // Trigger camera preset interpolation only when selectedPart explicitly changes
  const cameraTransitionActiveRef = useRef(false);
  useEffect(() => {
    cameraTransitionActiveRef.current = true;
  }, [selectedPart]);

  // Mount Three.js scene once
  useEffect(() => {
    const container = stageRef.current;
    const mount = mountRef.current;
    if (!container || !mount) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: true,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(NETTER_PARCHMENT_HEX, 0);

    const initW = Math.max(300, mount.clientWidth);
    const initH = Math.max(240, mount.clientHeight);
    renderer.setSize(initW, initH);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(34, initW / initH, 0.1, 45);
    camera.position.set(...OVERVIEW_CAMERA_PRESET.position);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...OVERVIEW_CAMERA_PRESET.target);
    controls.enablePan = false;
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.minDistance = 3.2;
    controls.maxDistance = 10.5;
    controls.minPolarAngle = Math.PI * 0.34;
    controls.maxPolarAngle = Math.PI * 0.64;
    controls.minAzimuthAngle = -Math.PI * 0.24;
    controls.maxAzimuthAngle = Math.PI * 0.24;
    controls.update();

    const stopAutoCamera = () => {
      cameraTransitionActiveRef.current = false;
    };
    controls.addEventListener('start', stopAutoCamera);

    // Warm Netter studio 3-point lighting
    const hemiLight = new THREE.HemisphereLight(0xfff7e6, 0x8f7a68, 1.35);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1dc, 1.75);
    keyLight.position.set(-3.5, 4.5, 6.2);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xdfe8f6, 0.72);
    rimLight.position.set(4.5, 2.2, -4.0);
    scene.add(rimLight);

    // Soft radial parchment glow disc behind anatomical rig
    const washTex = createParchmentWashTexture();
    const washGeo = new THREE.PlaneGeometry(8.8, 6.8);
    const washMat = new THREE.MeshBasicMaterial({
      map: washTex,
      transparent: true,
      depthWrite: false,
    });
    const washPlane = new THREE.Mesh(washGeo, washMat);
    washPlane.position.set(0.45, 0.1, -1.65);
    scene.add(washPlane);

    const maxAniso = isSoftwareGl ? 1 : Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const mats = createNetterMaterials(maxAniso, isSoftwareGl);
    const rig = buildHeartRig(mats);
    scene.add(rig.root);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Raycasting setup
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const pickables: THREE.Object3D[] = rig.interactiveParts.flatMap((entry) => entry.meshes);
    let pointerDownPos = { x: 0, y: 0 };
    let lastHoverMs = 0;

    const pickAtClient = (clientX: number, clientY: number): AnatomyFocusId | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(pickables, false);
      if (hits.length === 0) return null;
      return (hits[0]!.object.userData.anatomyId as AnatomyFocusId) ?? null;
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > 6) return;
      const hitId = pickAtClient(e.clientX, e.clientY);
      onSelectRef.current(hitId);
    };
    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverMs < 48) return;
      lastHoverMs = now;
      const hitId = pickAtClient(e.clientX, e.clientY);
      if (hitId !== hoveredRef.current) {
        onHoverRef.current(hitId);
      }
      renderer.domElement.style.cursor = hitId ? 'pointer' : 'grab';
    };
    const onPointerLeave = () => {
      if (hoveredRef.current !== null) {
        onHoverRef.current(null);
      }
      renderer.domElement.style.cursor = 'grab';
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);

    // Resize observer keeping canvas crisp across desktop, drawer open, and mobile
    let viewW = initW;
    let viewH = initH;
    const handleResize = () => {
      const w = Math.max(260, mount.clientWidth);
      const h = Math.max(220, mount.clientHeight);
      if (w === viewW && h === viewH) return;
      viewW = w;
      viewH = h;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const ro = new ResizeObserver(handleResize);
    ro.observe(mount);

    // Animation loop + Software-WebGL afterDraw pacing
    let frameId = 0;
    let isDisposed = false;
    let lastTime = performance.now();
    let arterialFlowOffset = 0;
    let venousFlowOffset = 0;
    const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const chordaePosAttr = rig.chordaeLines.geometry.getAttribute('position') as THREE.BufferAttribute;

    const updateCalloutOverlay = (activeId: AnatomyFocusId | null) => {
      const svg = calloutOverlayRef.current;
      if (!svg) return;
      svg.setAttribute('viewBox', `0 0 ${viewW} ${viewH}`);

      const compactScale = viewW < 520 ? 0.68 : 1.0;

      for (const cfg of CALLOUT_CONFIGS) {
        const g = svg.querySelector<SVGGElement>(`[data-callout="${cfg.id}"]`);
        if (!g) continue;
        const worldPt = rig.calloutsWorld[cfg.id];
        _vProj.copy(worldPt).project(camera);
        const sx = (_vProj.x * 0.5 + 0.5) * viewW;
        const sy = (-_vProj.y * 0.5 + 0.5) * viewH;

        const ex = Math.max(76, Math.min(viewW - 76, sx + cfg.offsetX * compactScale));
        const ey = Math.max(28, Math.min(viewH - 36, sy + cfg.offsetY * compactScale));
        const elbowX = sx + cfg.elbowX * compactScale;

        const path = g.querySelector<SVGPathElement>('path');
        const dot = g.querySelector<SVGCircleElement>('circle');
        const text = g.querySelector<SVGTextElement>('text');
        if (path) {
          path.setAttribute('d', `M ${sx.toFixed(1)} ${sy.toFixed(1)} L ${elbowX.toFixed(1)} ${ey.toFixed(1)} L ${ex.toFixed(1)} ${ey.toFixed(1)}`);
        }
        if (dot) {
          dot.setAttribute('cx', sx.toFixed(1));
          dot.setAttribute('cy', sy.toFixed(1));
        }
        if (text) {
          const pad = cfg.align === 'left' ? 6 : -6;
          text.setAttribute('x', (ex + pad).toFixed(1));
          text.setAttribute('y', (ey + 3.5).toFixed(1));
          text.setAttribute('text-anchor', cfg.align === 'left' ? 'start' : 'end');
        }
        if (activeId === cfg.id) {
          g.setAttribute('data-active', '1');
        } else {
          g.removeAttribute('data-active');
        }
      }
    };

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (isDisposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (isDisposed) return;
      const now = performance.now();
      const calm = reduceQuery.matches;
      const dtSec = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      const t = stepRef.current(calm ? 0 : dtSec);
      const curInputs = inputsRef.current;
      const activeFocus = hoveredRef.current ?? selectedRef.current;

      // 1. Damped camera focus preset glide
      if (cameraTransitionActiveRef.current) {
        const preset = selectedRef.current
          ? FOCUS_CAMERA_PRESETS[selectedRef.current]
          : OVERVIEW_CAMERA_PRESET;
        _camTargetPos.set(...preset.position);
        _camTargetLook.set(...preset.target);

        const dampAlpha = calm ? 1 : 1 - Math.exp(-6.5 * dtSec);
        camera.position.lerp(_camTargetPos, dampAlpha);
        controls.target.lerp(_camTargetLook, dampAlpha);

        if (
          camera.position.distanceTo(_camTargetPos) < 0.015 &&
          controls.target.distanceTo(_camTargetLook) < 0.015
        ) {
          camera.position.copy(_camTargetPos);
          controls.target.copy(_camTargetLook);
          cameraTransitionActiveRef.current = false;
        }
      }
      controls.update();

      // 2. LV volume pool + systolic myocardial contraction
      const volFrac = THREE.MathUtils.clamp((t.lvVolumeMl - 20) / 150, 0.14, 1.0);
      const beatCompression = t.isSystole ? t.aorticOpen * 0.055 : 0;
      rig.lvOuterGroup.scale.set(
        1 - beatCompression * 0.7,
        1 - beatCompression * 0.35,
        1 - beatCompression * 0.7,
      );
      rig.lvBloodMesh.scale.set(
        0.78 + volFrac * 0.24,
        0.35 + volFrac * 0.72,
        0.78 + volFrac * 0.24,
      );

      // 3. Hinged Mitral & Aortic Valve Leaflets + dynamic Chordae Tendineae
      rig.mitralAnteriorPivot.rotation.z = -t.mitralOpen * 0.58 - 0.08;
      rig.mitralPosteriorPivot.rotation.z = t.mitralOpen * 0.55 + 0.08;
      rig.aorticLeftPivot.rotation.z = t.aorticOpen * 0.56 + 0.06;
      rig.aorticRightPivot.rotation.z = -t.aorticOpen * 0.56 - 0.06;

      const tipOffsetX = t.mitralOpen * 0.14;
      const tipY = 0.35 + t.mitralOpen * 0.06;
      // Papillary 1 -> anterior mitral
      chordaePosAttr.setXYZ(0, -0.18, -0.42, 0.16);
      chordaePosAttr.setXYZ(1, -0.26 - tipOffsetX, tipY, 0.18);
      chordaePosAttr.setXYZ(2, -0.15, -0.43, 0.16);
      chordaePosAttr.setXYZ(3, -0.18 - tipOffsetX * 0.6, tipY + 0.02, 0.17);
      // Papillary 2 -> posterior mitral
      chordaePosAttr.setXYZ(4, 0.15, -0.44, 0.22);
      chordaePosAttr.setXYZ(5, -0.04 + tipOffsetX, tipY, 0.14);
      chordaePosAttr.setXYZ(6, 0.12, -0.45, 0.22);
      chordaePosAttr.setXYZ(7, -0.12 + tipOffsetX * 0.6, tipY + 0.02, 0.15);
      chordaePosAttr.needsUpdate = true;

      // 4. Arteriolar SVR vascular tone constriction / dilation + perfusion halo
      const svrScale = THREE.MathUtils.clamp(Math.pow(12 / Math.max(5, t.effectiveSvr), 0.32), 0.72, 1.32);
      rig.arteriolarRibMeshes.forEach((m) => {
        m.scale.set(svrScale, 1, svrScale);
        // Scale around cage center (x = 2.42) cleanly via offset
        m.position.x = 2.42 * (1 - svrScale);
      });
      const perfNorm = THREE.MathUtils.clamp((t.map - 35) / 50, 0.08, 1.0);
      mats.perfusionHalo.opacity = 0.18 + 0.48 * perfNorm + (t.isSystole ? 0.1 : 0);
      rig.perfusionHaloMesh.scale.setScalar(0.84 + perfNorm * 0.32);

      // 5. Flowing biconcave 3D RBC corpuscles along arterial & venous curves
      const artSpeed = THREE.MathUtils.clamp((t.coLMin / 5.0) * (0.28 + 0.72 * t.aorticOpen + 0.22), 0.04, 0.65);
      const venSpeed = THREE.MathUtils.clamp((t.coLMin / 5.0) * (0.16 + 0.06 * (curInputs.cvp / 15)), 0.04, 0.35);
      if (!calm) {
        arterialFlowOffset = (arterialFlowOffset + dtSec * artSpeed) % 1;
        venousFlowOffset = (venousFlowOffset + dtSec * venSpeed) % 1;
      }

      for (let i = 0; i < rig.rbcArterialCount; i++) {
        const u = (i / rig.rbcArterialCount + arterialFlowOffset) % 1;
        sampleCurveUniform(rig.splines.arterialCurve, u, _vPos, _vTan);
        const radialSpread = 0.082 * ((i % 3) - 1);
        _vPos.x += Math.sin(i * 2.1 + u * 8) * radialSpread;
        _vPos.z += Math.cos(i * 1.7 + u * 6) * radialSpread;
        _quat.setFromUnitVectors(_vUp, _vTan);
        _scale.setScalar(0.9 + (i % 3) * 0.1);
        _mat4.compose(_vPos, _quat, _scale);
        rig.rbcArterialInstanced.setMatrixAt(i, _mat4);
      }
      rig.rbcArterialInstanced.instanceMatrix.needsUpdate = true;

      for (let i = 0; i < rig.rbcVenousCount; i++) {
        const u = (i / rig.rbcVenousCount + venousFlowOffset) % 1;
        sampleCurveUniform(rig.splines.venousCurve, u, _vPos, _vTan);
        const radialSpread = 0.05 * ((i % 3) - 1);
        _vPos.z += Math.sin(i * 1.9 + u * 7) * radialSpread;
        _quat.setFromUnitVectors(_vUp, _vTan);
        _scale.setScalar(0.86 + (i % 2) * 0.12);
        _mat4.compose(_vPos, _quat, _scale);
        rig.rbcVenousInstanced.setMatrixAt(i, _mat4);
      }
      rig.rbcVenousInstanced.instanceMatrix.needsUpdate = true;

      // 6. Render WebGL + sync Netter 2D leader-line overlay
      renderer.render(scene, camera);
      updateCalloutOverlay(activeFocus);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    if (isSoftwareGl) {
      frameId = window.setTimeout(tick, 16);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      ro.disconnect();
      controls.removeEventListener('start', stopAutoCamera);
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      rig.dispose();
      mats.dispose();
      washGeo.dispose();
      washMat.dispose();
      washTex.dispose();
      envRT.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  const activeCalloutId = hoveredPart ?? selectedPart;

  return (
    <div
      ref={stageRef}
      data-testid="cardio-3d-stage"
      className="netter-stage relative flex-1 w-full h-full overflow-hidden select-none"
    >
      {/* Dedicated WebGL Mount Container */}
      <div ref={mountRef} className="absolute inset-0" />

      {/* Plate I Editorial Caption (Top-Right over Illustration Canvas) */}
      <div className="pointer-events-none absolute top-4 right-5 hidden md:block text-right">
        <span className="font-serif italic text-[12px] tracking-[0.01em] text-[#5e4d41]">
          Plate I · Left Ventricular Cutaway, Windkessel Arch &amp; Arteriolar Bed
        </span>
      </div>

      {/* Projected Dark-Ink Leader Line Callouts */}
      <svg
        ref={calloutOverlayRef}
        className="pointer-events-none absolute inset-0 w-full h-full overflow-visible"
        aria-hidden="true"
      >
        {CALLOUT_CONFIGS.map((cfg) => (
          <g
            key={cfg.id}
            data-callout={cfg.id}
            data-active={activeCalloutId === cfg.id ? '1' : undefined}
            className="netter-callout pointer-events-auto cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onSelectPart(selectedPart === cfg.id ? null : cfg.id);
            }}
            onPointerEnter={() => onHoverPart(cfg.id)}
            onPointerLeave={() => onHoverPart(null)}
          >
            <path className="netter-leader-line" fill="none" />
            <circle className="netter-leader-dot" r="2.6" />
            <text className="netter-leader-text">{cfg.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
