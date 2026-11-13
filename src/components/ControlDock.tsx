import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import {
  SHOCK_PRESETS,
  type HemodynamicInputs,
  type HemodynamicTelemetry,
  type ShockPresetId,
} from '../physics/hemodynamics';

interface ControlDockProps {
  inputs: HemodynamicInputs;
  telemetry: HemodynamicTelemetry;
  activePreset: ShockPresetId | null;
  collapsed: boolean;
  drawerOpen: boolean;
  onToggleCollapse: () => void;
  onSelectPreset: (presetId: ShockPresetId) => void;
  onChangeInput: <K extends keyof HemodynamicInputs>(key: K, value: HemodynamicInputs[K]) => void;
  onReset: () => void;
}

export function ControlDock({
  inputs,
  telemetry,
  activePreset,
  collapsed,
  drawerOpen,
  onToggleCollapse,
  onSelectPreset,
  onChangeInput,
  onReset,
}: ControlDockProps) {
  const toneClass: Record<string, string> = {
    good: 'text-emerald-700',
    normal: 'text-emerald-700',
    moderate: 'text-amber-700',
    low: 'text-amber-700',
    poor: 'text-red-700',
    'very-low': 'text-red-700',
    high: 'text-violet-700',
  };

  return (
    <section
      aria-label="Hemodynamic controls dock"
      className="pointer-events-none absolute bottom-3 left-3 right-3 z-20 flex justify-center"
    >
      <div
        className={`flex flex-col items-center w-full ${
          drawerOpen ? 'max-w-[920px]' : 'max-w-[1040px]'
        }`}
      >
        {/* Collapse / Expand tab attached to top edge of dock */}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          className="pointer-events-auto mb-1.5 inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          {collapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
              Show Controls (H)
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
              Hide Controls (H)
            </>
          )}
        </button>

        {!collapsed && (
          <div className="pointer-events-auto w-full max-h-[38vh] overflow-y-auto md:max-h-none md:overflow-visible rounded-xl border border-slate-200 bg-white p-3.5 md:p-4 shadow-md">
          {/* Top row: Presets + Auto-Compensate + Reset */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
            <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100">
              {SHOCK_PRESETS.map((preset) => {
                const isSelected = activePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onSelectPreset(preset.id)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-blue-600 ${
                      isSelected
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {preset.shortLabel}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer select-none whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={inputs.autoCompensate}
                  onChange={(e) => onChangeInput('autoCompensate', e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                />
                Auto-Compensate
              </label>

              <button
                type="button"
                onClick={onReset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                Reset
              </button>
            </div>
          </div>

          {/* Bottom row: 5 Physiological Parameter Sliders */}
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* Heart Rate */}
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2 whitespace-nowrap">
                <label
                  htmlFor="slider-hr"
                  className={`text-xs font-semibold ${inputs.autoCompensate ? 'text-slate-400' : 'text-slate-800'}`}
                >
                  HR <span className="font-normal text-slate-400">(60–100)</span>
                </label>
                <span className="font-mono-tabular text-xs font-semibold text-slate-900">
                  {telemetry.effectiveHr.toFixed(0)} bpm
                </span>
              </div>
              <input
                id="slider-hr"
                type="range"
                min={30}
                max={220}
                step={1}
                disabled={inputs.autoCompensate}
                value={Math.round(telemetry.effectiveHr)}
                onChange={(e) => onChangeInput('hr', Number(e.target.value))}
                className="clinical-slider"
              />
              <div className="text-[11px] text-slate-500 truncate">
                {inputs.autoCompensate ? 'Baroreceptor Driven' : 'Chronotropy'}
              </div>
            </div>

            {/* LVEF */}
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2 whitespace-nowrap">
                <label htmlFor="slider-lvef" className="text-xs font-semibold text-slate-800">
                  LVEF <span className="font-normal text-slate-400">(55–70%)</span>
                </label>
                <span className="font-mono-tabular text-xs font-semibold text-slate-900">
                  {inputs.lvef.toFixed(2)} ({Math.round(inputs.lvef * 100)}%)
                </span>
              </div>
              <input
                id="slider-lvef"
                type="range"
                min={0.1}
                max={0.8}
                step={0.01}
                value={inputs.lvef}
                onChange={(e) => onChangeInput('lvef', Number(e.target.value))}
                className="clinical-slider"
              />
              <div className={`text-[11px] font-medium truncate ${toneClass[telemetry.lvefContext.tone]}`}>
                {telemetry.lvefContext.text}
              </div>
            </div>

            {/* EDV */}
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2 whitespace-nowrap">
                <label htmlFor="slider-edv" className="text-xs font-semibold text-slate-800">
                  EDV <span className="font-normal text-slate-400">(100–150)</span>
                </label>
                <span className="font-mono-tabular text-xs font-semibold text-slate-900">
                  {inputs.edv.toFixed(2)} L · {Math.round(inputs.edv * 1000)}
                </span>
              </div>
              <input
                id="slider-edv"
                type="range"
                min={0.04}
                max={0.18}
                step={0.01}
                value={inputs.edv}
                onChange={(e) => onChangeInput('edv', Number(e.target.value))}
                className="clinical-slider"
              />
              <div className={`text-[11px] font-medium truncate ${toneClass[telemetry.edvContext.tone]}`}>
                {telemetry.edvContext.text}
              </div>
            </div>

            {/* SVR */}
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2 whitespace-nowrap">
                <label
                  htmlFor="slider-svr"
                  className={`text-xs font-semibold ${inputs.autoCompensate ? 'text-slate-400' : 'text-slate-800'}`}
                >
                  SVR <span className="font-normal text-slate-400">(8–15)</span>
                </label>
                <span className="font-mono-tabular text-xs font-semibold text-slate-900">
                  {telemetry.effectiveSvr.toFixed(0)} WU
                </span>
              </div>
              <input
                id="slider-svr"
                type="range"
                min={5}
                max={30}
                step={1}
                disabled={inputs.autoCompensate}
                value={Math.round(telemetry.effectiveSvr)}
                onChange={(e) => onChangeInput('svr', Number(e.target.value))}
                className="clinical-slider"
              />
              <div className={`text-[11px] font-medium truncate ${toneClass[telemetry.svrContext.tone]}`}>
                {telemetry.svrContext.text}
              </div>
            </div>

            {/* CVP */}
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2 whitespace-nowrap">
                <label htmlFor="input-cvp" className="text-xs font-semibold text-slate-800">
                  CVP <span className="font-normal text-slate-400">(2–8)</span>
                </label>
                <span className="font-mono-tabular text-xs font-semibold text-slate-900">
                  {inputs.cvp} mmHg
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="input-cvp"
                  type="range"
                  min={0}
                  max={30}
                  step={1}
                  value={inputs.cvp}
                  onChange={(e) => onChangeInput('cvp', Number(e.target.value))}
                  className="clinical-slider"
                />
                <input
                  aria-label="CVP numeric value"
                  type="number"
                  min={0}
                  max={30}
                  step={1}
                  value={inputs.cvp}
                  onChange={(e) => {
                    const parsed = Number(e.target.value);
                    onChangeInput('cvp', Number.isNaN(parsed) ? 0 : Math.max(0, Math.min(30, parsed)));
                  }}
                  className="w-11 shrink-0 rounded border border-slate-200 px-1 py-0.5 text-center font-mono-tabular text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {inputs.cvp > 12 ? 'Venous Congestion' : inputs.cvp < 2 ? 'Low Filling Pressure' : 'Normal Venous Tone'}
              </div>
            </div>
          </div>
        </div>
        )}
      </div>
    </section>
  );
}
