import type { HemodynamicInputs, HemodynamicTelemetry } from '../physics/hemodynamics';

export interface WaveformSample {
  pa: number;
  lvVol: number;
}

interface TelemetryHudProps {
  telemetry: HemodynamicTelemetry;
  inputs: HemodynamicInputs;
  waveform: WaveformSample[];
}

export function TelemetryHud({ telemetry, inputs, waveform }: TelemetryHudProps) {
  const statusStyles: Record<
    HemodynamicTelemetry['status'],
    { text: string; glyph: string; bar: string }
  > = {
    nominal: { text: 'text-emerald-700', glyph: '●', bar: 'text-emerald-700' },
    compensated: { text: 'text-blue-700', glyph: '▲', bar: 'text-blue-700' },
    warning: { text: 'text-amber-700', glyph: '▲', bar: 'text-amber-700' },
    critical: { text: 'text-red-700', glyph: '✖', bar: 'text-red-700' },
  };

  const st = statusStyles[telemetry.status];

  // Build SVG polyline paths for Arterial Pressure (20..160 mmHg) & LV Volume (20..180 mL)
  const w = 292;
  const h = 68;
  const count = Math.max(2, waveform.length);

  const paPoints = waveform
    .map((pt, idx) => {
      const x = (idx / (count - 1)) * w;
      const normY = Math.max(0, Math.min(1, (pt.pa - 20) / 140));
      const y = h - 4 - normY * (h - 8);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const lvPoints = waveform
    .map((pt, idx) => {
      const x = (idx / (count - 1)) * w;
      const normY = Math.max(0, Math.min(1, (pt.lvVol - 20) / 160));
      const y = h - 4 - normY * (h - 8);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <aside
      aria-label="Live hemodynamic telemetry"
      className="pointer-events-auto w-full max-w-[336px] rounded-lg border border-slate-200 bg-white/95 p-3 md:p-4 shadow-sm"
    >
      {/* Status line + Phase indicator */}
      <div className="flex items-center justify-between gap-2 pb-2 md:pb-3 border-b border-slate-100">
        <span className={`text-xs font-semibold tracking-tight ${st.text}`}>
          <span aria-hidden="true" className="mr-1.5">
            {st.glyph}
          </span>
          {telemetry.statusLabel}
        </span>
        <span className="font-mono-tabular text-[11px] font-medium text-slate-500">
          {telemetry.isSystole ? 'Systole · Ejection' : 'Diastole · Filling'}
        </span>
      </div>

      {/* Primary MAP + SBP/DBP Readout */}
      <div className="mt-3 flex items-baseline justify-between gap-4">
        <div>
          <div className="text-[11px] font-medium text-slate-500">Mean Arterial Pressure</div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span
              data-testid="map-readout"
              className={`font-mono-tabular text-4xl font-semibold tracking-tight ${st.bar}`}
            >
              {telemetry.map}
            </span>
            <span className="font-mono-tabular text-xs text-slate-400">mmHg</span>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[11px] font-medium text-slate-500">SBP / DBP</div>
          <div
            data-testid="bp-readout"
            className="mt-1 font-mono-tabular text-lg font-semibold text-slate-900"
          >
            {telemetry.sbp}/{telemetry.dbp}
          </div>
          <div className="font-mono-tabular text-[11px] text-slate-400">
            PP {telemetry.pulsePressure} mmHg
          </div>
        </div>
      </div>

      {/* Secondary Hemodynamic Indices */}
      <div className="mt-3 grid grid-cols-3 gap-2 pt-3 border-t border-slate-100">
        <div>
          <div className="text-[11px] text-slate-500">Cardiac Output</div>
          <div className="font-mono-tabular text-sm font-semibold text-slate-900">
            {telemetry.coLMin.toFixed(2)} <span className="text-[11px] font-normal text-slate-400">L/m</span>
          </div>
        </div>
        <div>
          <div className="text-[11px] text-slate-500">Stroke Vol</div>
          <div className="font-mono-tabular text-sm font-semibold text-slate-900">
            {telemetry.svMl.toFixed(0)} <span className="text-[11px] font-normal text-slate-400">mL</span>
          </div>
        </div>
        <div>
          <div className="text-[11px] text-slate-500">Eff. Preload</div>
          <div className="font-mono-tabular text-sm font-semibold text-slate-900">
            {telemetry.effectiveEdvMl.toFixed(0)}{' '}
            <span className="text-[11px] font-normal text-slate-400">mL</span>
          </div>
        </div>
      </div>

      {/* Real-time Windkessel Arterial & LV Volume Waveform Monitor */}
      <div className="mt-3 pt-3 border-t border-slate-100">
        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
          <span>Windkessel Waveform</span>
          <span className="font-mono-tabular text-[10px] text-slate-500">
            <span className="text-red-600 font-semibold">Pa</span> ·{' '}
            <span className="text-blue-600 font-semibold">LV Vol</span>
          </span>
        </div>
        <div className="rounded border border-slate-200 bg-slate-50/70 px-1.5 py-1">
          <svg
            viewBox={`0 0 ${w} ${h}`}
            className="w-full h-[46px] sm:h-[64px] overflow-visible"
            role="img"
            aria-label="Live arterial pressure and left ventricular volume waveforms"
          >
            {/* Reference 65 mmHg MAP threshold line */}
            <line
              x1="0"
              y1={(h - 4 - ((65 - 20) / 140) * (h - 8)).toFixed(1)}
              x2={w}
              y2={(h - 4 - ((65 - 20) / 140) * (h - 8)).toFixed(1)}
              stroke="#cbd5e1"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            {waveform.length > 1 && (
              <>
                <polyline
                  fill="none"
                  stroke="#0f62fe"
                  strokeWidth="1.5"
                  strokeOpacity="0.65"
                  points={lvPoints}
                />
                <polyline
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  points={paPoints}
                />
              </>
            )}
          </svg>
        </div>
      </div>

      {/* Live Equation Reference */}
      <div className="mt-2.5 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500">
        <div className="flex items-center justify-between">
          <span>Ref Formula</span>
          <span className="font-mono-tabular text-slate-700">
            ({telemetry.effectiveHr.toFixed(0)} × {inputs.lvef.toFixed(2)} × {inputs.edv.toFixed(2)} ×{' '}
            {telemetry.effectiveSvr.toFixed(0)}) + {inputs.cvp.toFixed(0)} ={' '}
            <strong className="text-slate-900">{telemetry.referenceMap.toFixed(0)}</strong>
          </span>
        </div>
      </div>
    </aside>
  );
}
