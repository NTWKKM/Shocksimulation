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
import { IsometricRigStage } from './components/IsometricRigStage';
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
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
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

  // Keyboard shortcuts: H toggles control dock, Escape closes drawer/zoom focus
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
      className="iso relative flex h-screen w-screen flex-col overflow-hidden"
      data-theme={theme}
      data-status={telemetry.status}
    >
      <TopBar
        selectedPart={selectedPart}
        onSelectAnatomy={handleSelectAnatomy}
        onOpenReference={() => setDrawerOpen((prev) => !prev)}
      />

      {/* Main Isometric Plate Workspace + Side Reference Drawer */}
      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
          <main className="flex flex-1 flex-col lg:flex-row gap-3.5 p-3.5 md:p-4 min-h-0 overflow-y-auto lg:overflow-hidden">
            {/* Left Rail Telemetry & Active Focus Summary */}
            <div className="w-full lg:w-[308px] shrink-0 flex flex-col gap-3 lg:overflow-y-auto">
              <TelemetryHud telemetry={telemetry} inputs={inputs} waveform={waveform} />

              {activeCallout && !drawerOpen && (
                <div className="border border-[var(--anatomy-rule)] bg-[var(--anatomy-card)] p-3.5">
                  <div className="font-mono-tabular text-[10.5px] font-semibold text-[var(--anatomy-red)]">
                    {activeCallout.parameterTag}
                  </div>
                  <div className="mt-0.5 text-base font-bold text-[var(--anatomy-strong)] leading-snug">
                    {activeCallout.titleEn}
                  </div>
                  <p className="mt-1 text-xs text-[var(--anatomy-text)] line-clamp-3">
                    {activeCallout.summaryTh}
                  </p>
                  <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-[var(--anatomy-rule-soft)]">
                    <span className="font-mono-tabular text-[11px] text-[var(--anatomy-muted)]">
                      {activeCallout.normalRange}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDrawerOpen(true)}
                      className="font-mono-tabular text-[11px] font-semibold text-[var(--anatomy-strong)] hover:underline whitespace-nowrap"
                    >
                      Read Details
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Primary Fixed-Angle Isometric Rig Plate */}
            <div className="flex-1 min-w-0 min-h-[300px] sm:min-h-[360px] lg:min-h-0 flex">
              <IsometricRigStage
                selectedPart={selectedPart}
                hoveredPart={hoveredPart}
                theme={theme}
                inputs={inputs}
                onSelectPart={handleSelectAnatomy}
                onHoverPart={setHoveredPart}
                onStepPhysics={handleStepPhysics}
              />
            </div>
          </main>

          {/* Bottom Hemodynamic Control Dock */}
          <ControlDock
            inputs={inputs}
            telemetry={telemetry}
            activePreset={activePreset}
            collapsed={dockCollapsed}
            theme={theme}
            onToggleCollapse={() => setDockCollapsed((prev) => !prev)}
            onToggleTheme={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
            onSelectPreset={handleSelectPreset}
            onChangeInput={handleChangeInput}
            onReset={handleReset}
          />
        </div>

        {/* Slide-over Clinical Reference Drawer */}
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
