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
    nominal: { text: 'text-[#2D6A4F]', glyph: '●', bar: 'text-[#2D6A4F]' },
    compensated: { text: 'text-[#1E4E79]', glyph: '▲', bar: 'text-[#1E4E79]' },
    warning: { text: 'text-[#A65A17]', glyph: '▲', bar: 'text-[#A65A17]' },
    critical: { text: 'text-[#9E2A2B]', glyph: '✖', bar: 'text-[#9E2A2B]' },
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
      className="pointer-events-auto w-full max-w-[336px] rounded-sm border border-[#B8A68B] bg-[#FBF7EC]/95 p-3 md:p-4 shadow-[0_2px_10px_rgba(35,26,21,0.08)]"
    >
      {/* Status line + Phase indicator */}
      <div className="flex items-center justify-between gap-2 pb-2 md:pb-3 border-b border-[#E3D8C2]">
        <span className={`text-xs font-semibold tracking-tight ${st.text}`}>
          <span aria-hidden="true" className="mr-1.5">
            {st.glyph}
          </span>
          {telemetry.statusLabel}
        </span>
        <span className="font-mono-tabular text-[11px] font-medium text-[#5C4D42]">
          {telemetry.isSystole ? 'Systole · Ejection' : 'Diastole · Filling'}
        </span>
      </div>

      {/* Primary MAP + SBP/DBP Readout */}
      <div className="mt-3 flex items-baseline justify-between gap-4">
        <div>
          <div className="text-[11px] font-medium text-[#5C4D42]">Mean Arterial Pressure</div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span
              data-testid="map-readout"
              className={`font-mono-tabular text-4xl font-semibold tracking-tight ${st.bar}`}
            >
              {telemetry.map}
            </span>
            <span className="font-mono-tabular text-xs text-[#7C6D60]">mmHg</span>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[11px] font-medium text-[#5C4D42]">SBP / DBP</div>
          <div
            data-testid="bp-readout"
            className="mt-1 font-mono-tabular text-lg font-semibold text-[#231A15]"
          >
            {telemetry.sbp}/{telemetry.dbp}
          </div>
          <div className="font-mono-tabular text-[11px] text-[#7C6D60]">
            PP {telemetry.pulsePressure} mmHg
          </div>
        </div>
      </div>

      {/* Secondary Hemodynamic Indices */}
      <div className="mt-3 grid grid-cols-3 gap-2 pt-3 border-t border-[#E3D8C2]">
        <div>
          <div className="text-[11px] text-[#5C4D42]">Cardiac Output</div>
          <div className="font-mono-tabular text-sm font-semibold text-[#231A15]">
            {telemetry.coLMin.toFixed(2)}{' '}
            <span className="text-[11px] font-normal text-[#7C6D60]">L/m</span>
          </div>
        </div>
        <div>
          <div className="text-[11px] text-[#5C4D42]">Stroke Vol</div>
          <div className="font-mono-tabular text-sm font-semibold text-[#231A15]">
            {telemetry.svMl.toFixed(0)}{' '}
            <span className="text-[11px] font-normal text-[#7C6D60]">mL</span>
          </div>
        </div>
        <div>
          <div className="text-[11px] text-[#5C4D42]">Eff. Preload</div>
          <div className="font-mono-tabular text-sm font-semibold text-[#231A15]">
            {telemetry.effectiveEdvMl.toFixed(0)}{' '}
            <span className="text-[11px] font-normal text-[#7C6D60]">mL</span>
          </div>
        </div>
      </div>

      {/* Real-time Windkessel Arterial & LV Volume Waveform Monitor */}
      <div className="mt-3 pt-3 border-t border-[#E3D8C2]">
        <div className="flex items-center justify-between text-[11px] text-[#5C4D42] mb-1.5">
          <span>Windkessel Waveform</span>
          <span className="font-mono-tabular text-[10px] text-[#5C4D42]">
            <span className="text-[#9E2A2B] font-semibold">Pa</span> ·{' '}
            <span className="text-[#1E4E79] font-semibold">LV Vol</span>
          </span>
        </div>
        <div className="rounded-sm border border-[#D4C6AE] bg-[#F4ECDA]/85 px-1.5 py-1">
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
              stroke="#B8A68B"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            {waveform.length > 1 && (
              <>
                <polyline
                  fill="none"
                  stroke="#1E4E79"
                  strokeWidth="1.5"
                  strokeOpacity="0.72"
                  points={lvPoints}
                />
                <polyline
                  fill="none"
                  stroke="#9E2A2B"
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
      <div className="mt-2.5 pt-2.5 border-t border-[#E3D8C2] text-[11px] text-[#5C4D42]">
        <div className="flex items-center justify-between">
          <span>Ref Formula</span>
          <span className="font-mono-tabular text-[#3F3128]">
            ({telemetry.effectiveHr.toFixed(0)} × {inputs.lvef.toFixed(2)} × {inputs.edv.toFixed(2)} ×{' '}
            {telemetry.effectiveSvr.toFixed(0)}) + {inputs.cvp.toFixed(0)} ={' '}
            <strong className="text-[#231A15]">{telemetry.referenceMap.toFixed(0)}</strong>
          </span>
        </div>
      </div>
    </aside>
  );
}
