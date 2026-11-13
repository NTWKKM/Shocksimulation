import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SHOCK_PRESETS,
  createHemodynamicIntegrator,
  getTelemetry,
  stepHemodynamics,
  type AnatomyFocusId,
  type HemodynamicInputs,
  type HemodynamicTelemetry,
  type ShockPresetId,
} from './physics/hemodynamics';
import { ANATOMY_REFERENCES } from './data/clinicalReference';
import { AnatomyStage25D } from './components/AnatomyStage25D';
import { TopBar } from './components/TopBar';
import { TelemetryHud, type WaveformSample } from './components/TelemetryHud';
import { ControlDock } from './components/ControlDock';
import { ReferenceDrawer } from './components/ReferenceDrawer';

const INITIAL_INPUTS: HemodynamicInputs = {
  ...SHOCK_PRESETS[0].inputs,
  autoCompensate: false,
};

const MAX_WAVEFORM_POINTS = 100;

function seedWaveformSamples(inputs: HemodynamicInputs): WaveformSample[] {
  const sim = createHemodynamicIntegrator(inputs);
  const samples: WaveformSample[] = [];
  for (let i = 0; i < MAX_WAVEFORM_POINTS; i++) {
    stepHemodynamics(sim, inputs, 0.035);
    samples.push({
      pa: sim.aorticPressure,
      lvVol: sim.lvVolume * 1000,
    });
  }
  return samples;
}

export default function App() {
  const [inputs, setInputs] = useState<HemodynamicInputs>(INITIAL_INPUTS);
  const inputsRef = useRef<HemodynamicInputs>(INITIAL_INPUTS);
  const integratorRef = useRef(createHemodynamicIntegrator(INITIAL_INPUTS));

  const [telemetry, setTelemetry] = useState<HemodynamicTelemetry>(() =>
    getTelemetry(integratorRef.current, INITIAL_INPUTS),
  );
  const initialSamplesRef = useRef<WaveformSample[] | null>(null);
  if (!initialSamplesRef.current) {
    initialSamplesRef.current = seedWaveformSamples(INITIAL_INPUTS);
  }
  const [waveform, setWaveform] = useState<WaveformSample[]>(initialSamplesRef.current);
  const waveformBufferRef = useRef<WaveformSample[]>(initialSamplesRef.current);

  const [activePreset, setActivePreset] = useState<ShockPresetId | null>('normal');
  const [selectedPart, setSelectedPart] = useState<AnatomyFocusId | null>(null);
  const [hoveredPart, setHoveredPart] = useState<AnatomyFocusId | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  );

  const lastHudSyncRef = useRef(0);

  const handleStepPhysics = useCallback((dtSec: number): HemodynamicTelemetry => {
    const currentInputs = inputsRef.current;
    const integrator = integratorRef.current;
    stepHemodynamics(integrator, currentInputs, dtSec);

    const nextTelemetry = getTelemetry(integrator, currentInputs);

    const now = performance.now();
    if (now - lastHudSyncRef.current >= 100) {
      lastHudSyncRef.current = now;
      const buf = waveformBufferRef.current;
      buf.push({
        pa: nextTelemetry.aorticPressureMmHg,
        lvVol: nextTelemetry.lvVolumeMl,
      });
      if (buf.length > MAX_WAVEFORM_POINTS) {
        buf.shift();
      }
      setTelemetry(nextTelemetry);
      setWaveform([...buf]);
    }

    return nextTelemetry;
  }, []);

  // Keyboard shortcuts: H toggles bottom dock, Escape closes drawer/zoom focus
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      } else if (e.key === 'Escape') {
        setDrawerOpen(false);
        setSelectedPart(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Keep mobile viewport unobstructed when resizing across the md breakpoint
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = (e: MediaQueryListEvent) => {
      setDockCollapsed(e.matches);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const handleSelectPreset = useCallback((presetId: ShockPresetId) => {
    const preset = SHOCK_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const next: HemodynamicInputs = {
      ...preset.inputs,
      autoCompensate: false,
    };
    inputsRef.current = next;
    setInputs(next);
    setActivePreset(presetId);
    const seeded = seedWaveformSamples(next);
    waveformBufferRef.current = seeded;
    setWaveform(seeded);
    integratorRef.current = createHemodynamicIntegrator(next);
    setTelemetry(getTelemetry(integratorRef.current, next));
  }, []);

  const handleChangeInput = useCallback(
    <K extends keyof HemodynamicInputs>(key: K, value: HemodynamicInputs[K]) => {
      setActivePreset(null);
      const next: HemodynamicInputs = {
        ...inputsRef.current,
        [key]: value,
      };
      inputsRef.current = next;
      setInputs(next);
    },
    [],
  );

  const handleReset = useCallback(() => {
    handleSelectPreset('normal');
    setSelectedPart(null);
  }, [handleSelectPreset]);

  const handleSelectAnatomy = useCallback((partId: AnatomyFocusId | null) => {
    setSelectedPart(partId);
    if (partId) {
      setDrawerOpen(true);
    }
  }, []);

  const handleResetCamera = useCallback(() => {
    setSelectedPart(null);
  }, []);

  const activeCallout = hoveredPart
    ? ANATOMY_REFERENCES[hoveredPart]
    : selectedPart
      ? ANATOMY_REFERENCES[selectedPart]
      : null;

  return (
    <div
      className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#F6EFE0] text-[#231A15]"
      data-status={telemetry.status}
    >
      <TopBar
        selectedPart={selectedPart}
        onSelectAnatomy={handleSelectAnatomy}
        onOpenReference={() => setDrawerOpen((prev) => !prev)}
      />

      {/* Main 2D Netter Anatomical Plate Stage + Side Reference Drawer */}
      <div className="relative flex flex-1 overflow-hidden">
        <main className="relative flex-1 overflow-hidden">
        <div data-testid="cardio-25d-stage" className="absolute inset-0 h-full w-full">
          <AnatomyStage25D
            selectedPart={selectedPart}
            hoveredPart={hoveredPart}
            drawerOpen={drawerOpen}
            onSelectPart={handleSelectAnatomy}
            onHoverPart={setHoveredPart}
            onStepPhysics={handleStepPhysics}
          />
        </div>

        {/* Semantic HUD Overlays */}
        <div className="pointer-events-none relative z-10 flex h-full w-full flex-col justify-between p-4 md:p-5">
          <div className="flex items-start justify-between gap-4">
            <TelemetryHud telemetry={telemetry} inputs={inputs} waveform={waveform} />

            {/* Contextual Anatomical Callout */}
            {activeCallout && !drawerOpen && (
              <div className="pointer-events-auto hidden sm:block w-[290px] rounded-sm border border-[#B8A68B] bg-[#FBF7EC]/95 p-3.5 shadow-[0_2px_10px_rgba(35,26,21,0.08)]">
                <div className="text-[11px] font-semibold text-[#9E2A2B]">
                  {activeCallout.parameterTag}
                </div>
                <div className="font-atlas-serif mt-0.5 text-lg font-bold text-[#231A15] leading-snug">
                  {activeCallout.titleEn}
                </div>
                <p className="mt-1 text-xs text-[#5C4D42] line-clamp-3">
                  {activeCallout.summaryTh}
                </p>
                <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-[#E3D8C2]">
                  <span className="font-mono-tabular text-[11px] text-[#7C6D60]">
                    {activeCallout.normalRange}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(true)}
                    className="text-xs font-semibold text-[#9E2A2B] hover:underline whitespace-nowrap"
                  >
                    Read Details
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Collapsible Bottom Control Dock */}
        <ControlDock
          inputs={inputs}
          telemetry={telemetry}
          activePreset={activePreset}
          collapsed={dockCollapsed}
          drawerOpen={drawerOpen}
          onToggleCollapse={() => setDockCollapsed((prev) => !prev)}
          onSelectPreset={handleSelectPreset}
          onChangeInput={handleChangeInput}
          onReset={handleReset}
        />

        </main>

        {/* Slide-over Reference Drawer */}
        <ReferenceDrawer
          open={drawerOpen}
          selectedPart={selectedPart}
          activePreset={activePreset}
          onClose={() => setDrawerOpen(false)}
          onSelectPart={handleSelectAnatomy}
          onSelectPreset={handleSelectPreset}
          onResetCamera={handleResetCamera}
        />
      </div>
    </div>
  );
}
