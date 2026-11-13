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
    { color: string; glyph: string }
  > = {
    nominal: { color: 'text-[var(--anatomy-green)]', glyph: '●' },
    compensated: { color: 'text-[var(--anatomy-blue)]', glyph: '▲' },
    warning: { color: 'text-[var(--anatomy-amber)]', glyph: '▲' },
    critical: { color: 'text-[var(--anatomy-red)]', glyph: '■' },
  };

  const st = statusStyles[telemetry.status];

  const w = 280;
  const h = 64;
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
      className="w-full border border-[var(--anatomy-rule)] bg-[var(--anatomy-card)] p-3.5"
    >
      {/* Status line + Phase */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[var(--anatomy-rule-soft)]">
        <span className={`font-mono-tabular text-[11px] font-semibold tracking-tight ${st.color}`}>
          <span aria-hidden="true" className="mr-1.5">
            {st.glyph}
          </span>
          {telemetry.statusLabel}
        </span>
        <span className="font-mono-tabular text-[10.5px] text-[var(--anatomy-muted)]">
          {telemetry.isSystole ? 'SYSTOLE' : 'DIASTOLE'}
        </span>
      </div>

      {/* Primary MAP + SBP/DBP Readout */}
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <div>
          <div className="font-mono-tabular text-[10px] uppercase tracking-[0.08em] text-[var(--anatomy-muted)]">
            Mean Arterial Pressure
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span
              data-testid="map-readout"
              className={`font-mono-tabular text-4xl font-semibold tracking-tight ${st.color}`}
            >
              {telemetry.map}
            </span>
            <span className="font-mono-tabular text-[11px] text-[var(--anatomy-muted)]">mmHg</span>
          </div>
        </div>

        <div className="text-right">
          <div className="font-mono-tabular text-[10px] uppercase tracking-[0.08em] text-[var(--anatomy-muted)]">
            SBP / DBP
          </div>
          <div
            data-testid="bp-readout"
            className="mt-0.5 font-mono-tabular text-lg font-semibold text-[var(--anatomy-strong)]"
          >
            {telemetry.sbp}/{telemetry.dbp}
          </div>
          <div className="font-mono-tabular text-[10.5px] text-[var(--anatomy-muted)]">
            PP {telemetry.pulsePressure} mmHg
          </div>
        </div>
      </div>

      {/* Secondary Hemodynamic Indices */}
      <div className="mt-3 grid grid-cols-3 gap-2 pt-2.5 border-t border-[var(--anatomy-rule-soft)]">
        <div>
          <div className="text-[10.5px] text-[var(--anatomy-muted)]">Cardiac Output</div>
          <div className="font-mono-tabular text-sm font-semibold text-[var(--anatomy-strong)]">
            {telemetry.coLMin.toFixed(2)}{' '}
            <span className="text-[10.5px] font-normal text-[var(--anatomy-muted)]">L/m</span>
          </div>
        </div>
        <div>
          <div className="text-[10.5px] text-[var(--anatomy-muted)]">Stroke Vol</div>
          <div className="font-mono-tabular text-sm font-semibold text-[var(--anatomy-strong)]">
            {telemetry.svMl.toFixed(0)}{' '}
            <span className="text-[10.5px] font-normal text-[var(--anatomy-muted)]">mL</span>
          </div>
        </div>
        <div>
          <div className="text-[10.5px] text-[var(--anatomy-muted)]">Eff. Preload</div>
          <div className="font-mono-tabular text-sm font-semibold text-[var(--anatomy-strong)]">
            {telemetry.effectiveEdvMl.toFixed(0)}{' '}
            <span className="text-[10.5px] font-normal text-[var(--anatomy-muted)]">mL</span>
          </div>
        </div>
      </div>

      {/* Real-time Windkessel Waveform */}
      <div className="mt-3 pt-2.5 border-t border-[var(--anatomy-rule-soft)]">
        <div className="flex items-center justify-between text-[10.5px] text-[var(--anatomy-muted)] mb-1.5">
          <span className="font-mono-tabular uppercase tracking-[0.06em]">Windkessel Trace</span>
          <span className="font-mono-tabular">
            <span className="text-[var(--anatomy-red)] font-semibold">Pa</span> ·{' '}
            <span className="text-[var(--anatomy-blue)] font-semibold">LV</span>
          </span>
        </div>
        <div className="border border-[var(--anatomy-rule-soft)] bg-[var(--anatomy-surface-alt)] px-1.5 py-1">
          <svg
            viewBox={`0 0 ${w} ${h}`}
            className="w-full h-[54px] overflow-visible"
            role="img"
            aria-label="Live arterial pressure and left ventricular volume waveforms"
          >
            <line
              x1="0"
              y1={(h - 4 - ((65 - 20) / 140) * (h - 8)).toFixed(1)}
              x2={w}
              y2={(h - 4 - ((65 - 20) / 140) * (h - 8)).toFixed(1)}
              stroke="var(--anatomy-lo)"
              strokeWidth="0.8"
              strokeDasharray="3 3"
            />
            {waveform.length > 1 && (
              <>
                <polyline
                  fill="none"
                  stroke="var(--anatomy-blue)"
                  strokeWidth="1.2"
                  strokeOpacity="0.8"
                  points={lvPoints}
                />
                <polyline
                  fill="none"
                  stroke="var(--anatomy-red)"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                  points={paPoints}
                />
              </>
            )}
          </svg>
        </div>
      </div>

      {/* Live Equation Reference */}
      <div className="mt-2.5 pt-2 border-t border-[var(--anatomy-rule-soft)] text-[10.5px] text-[var(--anatomy-muted)]">
        <div className="flex items-center justify-between gap-2">
          <span>Ref MAP</span>
          <span className="font-mono-tabular text-[var(--anatomy-text)] truncate">
            ({telemetry.effectiveHr.toFixed(0)} × {inputs.lvef.toFixed(2)} × {inputs.edv.toFixed(2)} ×{' '}
            {telemetry.effectiveSvr.toFixed(0)}) + {inputs.cvp.toFixed(0)} ={' '}
            <strong className="text-[var(--anatomy-strong)]">{telemetry.referenceMap.toFixed(0)}</strong>
          </span>
        </div>
      </div>
    </aside>
  );
}
