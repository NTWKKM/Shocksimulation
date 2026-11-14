import { ChevronDown, ChevronUp, Moon, RotateCcw, Sun } from 'lucide-react';
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
  theme: 'dark' | 'light';
  onToggleCollapse: () => void;
  onToggleTheme: () => void;
  onSelectPreset: (presetId: ShockPresetId) => void;
  onChangeInput: <K extends keyof HemodynamicInputs>(key: K, value: HemodynamicInputs[K]) => void;
  onReset: () => void;
}

export function ControlDock({
  inputs,
  telemetry,
  activePreset,
  collapsed,
  theme,
  onToggleCollapse,
  onToggleTheme,
  onSelectPreset,
  onChangeInput,
  onReset,
}: ControlDockProps) {
  const toneClass: Record<string, string> = {
    good: 'text-[var(--anatomy-green)]',
    normal: 'text-[var(--anatomy-green)]',
    moderate: 'text-[var(--anatomy-amber)]',
    low: 'text-[var(--anatomy-amber)]',
    poor: 'text-[var(--anatomy-red)]',
    'very-low': 'text-[var(--anatomy-red)]',
    high: 'text-[var(--anatomy-blue)]',
  };

  return (
    <section
      aria-label="Hemodynamic controls dock"
      className="relative z-10 border border-[var(--anatomy-rule)] bg-[var(--anatomy-card)] px-4 py-3 md:px-5"
    >
      {/* Dock Header Bar: Collapse Tab + Presets + Theme Toggle + Auto-Compensate + Reset */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-expanded={!collapsed}
            className="inline-flex items-center gap-1.5 border border-[var(--anatomy-rule)] bg-[var(--anatomy-surface-alt)] px-2.5 py-1 font-mono-tabular text-[11px] font-medium text-[var(--anatomy-strong)] hover:border-[var(--anatomy-mid)] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[var(--anatomy-lit)]"
          >
            {collapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                Controls (H)
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                Hide (H)
              </>
            )}
          </button>

          <div
            role="group"
            aria-label="Shock physiology presets"
            className="flex flex-wrap items-center gap-1 border border-[var(--anatomy-rule-soft)] bg-[var(--anatomy-surface-alt)] p-0.5"
          >
            {SHOCK_PRESETS.map((preset) => {
              const isSelected = activePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onSelectPreset(preset.id)}
                  className={`px-2.5 py-1 text-xs transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[var(--anatomy-lit)] ${
                    isSelected
                      ? 'bg-[var(--anatomy-strong)] text-[var(--anatomy-card)] font-semibold'
                      : 'text-[var(--anatomy-text)] hover:text-[var(--anatomy-strong)] hover:bg-[var(--anatomy-surface-sub)]'
                  }`}
                >
                  {preset.shortLabel}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} plate theme`}
            data-testid="theme-toggle"
            className="inline-flex items-center gap-1.5 border border-[var(--anatomy-rule)] bg-[var(--anatomy-surface-alt)] px-2.5 py-1 font-mono-tabular text-[11px] font-medium text-[var(--anatomy-strong)] hover:border-[var(--anatomy-mid)] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[var(--anatomy-lit)]"
          >
            {theme === 'light' ? (
              <>
                <Moon className="w-3.5 h-3.5" aria-hidden="true" />
                Dark
              </>
            ) : (
              <>
                <Sun className="w-3.5 h-3.5" aria-hidden="true" />
                Light
              </>
            )}
          </button>

          <label className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--anatomy-strong)] cursor-pointer select-none whitespace-nowrap">
            <input
              type="checkbox"
              checked={inputs.autoCompensate}
              onChange={(e) => onChangeInput('autoCompensate', e.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--anatomy-red)]"
            />
            Auto-Compensate
          </label>

          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 border border-[var(--anatomy-rule)] bg-[var(--anatomy-surface-alt)] px-2.5 py-1 font-mono-tabular text-[11px] font-medium text-[var(--anatomy-strong)] hover:border-[var(--anatomy-mid)] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[var(--anatomy-lit)]"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            Reset
          </button>
        </div>
      </div>

      {/* 5 Physiological Sliders */}
      {!collapsed && (
        <div className="mt-2.5 pt-2.5 border-t border-[var(--anatomy-rule-soft)] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* HR */}
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2 whitespace-nowrap">
              <label
                htmlFor="slider-hr"
                className={`text-xs font-semibold ${inputs.autoCompensate ? 'text-[var(--anatomy-muted)]' : 'text-[var(--anatomy-strong)]'}`}
              >
                HR <span className="font-normal text-[var(--anatomy-muted)]">(60–100)</span>
              </label>
              <span className="font-mono-tabular text-xs font-semibold text-[var(--anatomy-strong)]">
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
            <div className="text-[11px] text-[var(--anatomy-muted)] truncate">
              {inputs.autoCompensate ? 'Baroreceptor Driven' : 'Chronotropy'}
            </div>
          </div>

          {/* LVEF */}
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-baseline justify-between gap-1.5 min-w-0">
              <label htmlFor="slider-lvef" className="text-xs font-semibold text-[var(--anatomy-strong)] truncate">
                LVEF <span className="font-normal text-[var(--anatomy-muted)]">(55–70%)</span>
              </label>
              <span className="font-mono-tabular text-xs font-semibold text-[var(--anatomy-strong)] shrink-0">
                {Math.round(inputs.lvef * 100)}%
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
            <div className="flex items-baseline justify-between gap-1.5 min-w-0">
              <label htmlFor="slider-edv" className="text-xs font-semibold text-[var(--anatomy-strong)] truncate">
                EDV <span className="font-normal text-[var(--anatomy-muted)]">(100–150)</span>
              </label>
              <span className="font-mono-tabular text-xs font-semibold text-[var(--anatomy-strong)] shrink-0">
                {Math.round(inputs.edv * 1000)} mL
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
                className={`text-xs font-semibold ${inputs.autoCompensate ? 'text-[var(--anatomy-muted)]' : 'text-[var(--anatomy-strong)]'}`}
              >
                SVR <span className="font-normal text-[var(--anatomy-muted)]">(8–15)</span>
              </label>
              <span className="font-mono-tabular text-xs font-semibold text-[var(--anatomy-strong)]">
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
              <label htmlFor="input-cvp" className="text-xs font-semibold text-[var(--anatomy-strong)]">
                CVP <span className="font-normal text-[var(--anatomy-muted)]">(2–8)</span>
              </label>
              <span className="font-mono-tabular text-xs font-semibold text-[var(--anatomy-strong)]">
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
                className="w-11 shrink-0 border border-[var(--anatomy-rule)] bg-[var(--anatomy-surface-alt)] px-1 py-0.5 text-center font-mono-tabular text-xs text-[var(--anatomy-strong)] focus:border-[var(--anatomy-lit)] focus:outline-none"
              />
            </div>
            <div className="text-[11px] text-[var(--anatomy-muted)] truncate">
              {inputs.cvp > 12 ? 'Venous Congestion' : inputs.cvp < 2 ? 'Low Filling Pressure' : 'Normal Venous Tone'}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
