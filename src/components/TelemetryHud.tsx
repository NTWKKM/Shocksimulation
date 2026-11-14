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

  const w = 260;
  const h = 44;
  const count = Math.max(2, waveform.length);

  const paPoints = waveform
    .map((pt, idx) => {
      const x = (idx / (count - 1)) * w;
      const normY = Math.max(0, Math.min(1, (pt.pa - 20) / 140));
      const y = h - 3 - normY * (h - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const lvPoints = waveform
    .map((pt, idx) => {
      const x = (idx / (count - 1)) * w;
      const normY = Math.max(0, Math.min(1, (pt.lvVol - 20) / 160));
      const y = h - 3 - normY * (h - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <section
      aria-label="Live hemodynamic telemetry"
      className="w-full border border-[var(--anatomy-rule)] bg-[var(--anatomy-card)] px-4 py-3"
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 items-center">
        {/* Primary MAP + Status */}
        <div className="md:col-span-4 flex items-center justify-between md:justify-start gap-4 md:border-r md:border-[var(--anatomy-rule-soft)] md:pr-4">
          <div className="min-w-0">
            <div className={`font-mono-tabular text-[11px] font-semibold tracking-tight truncate ${st.color}`}>
              <span aria-hidden="true" className="mr-1.5">
                {st.glyph}
              </span>
              {telemetry.statusLabel}
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-mono-tabular text-[10px] uppercase tracking-[0.08em] text-[var(--anatomy-muted)] mr-1">
                MAP
              </span>
              <span
                data-testid="map-readout"
                className={`font-mono-tabular text-3xl font-semibold leading-none tracking-tight ${st.color}`}
              >
                {telemetry.map}
              </span>
              <span className="font-mono-tabular text-[11px] text-[var(--anatomy-muted)]">mmHg</span>
            </div>
          </div>

          <div className="text-right md:ml-auto shrink-0">
            <div className="font-mono-tabular text-[10px] uppercase tracking-[0.08em] text-[var(--anatomy-muted)]">
              {telemetry.isSystole ? 'SYSTOLE' : 'DIASTOLE'}
            </div>
            <div
              data-testid="bp-readout"
              className="mt-0.5 font-mono-tabular text-base font-semibold text-[var(--anatomy-strong)]"
            >
              {telemetry.sbp}/{telemetry.dbp}
            </div>
            <div className="font-mono-tabular text-[10.5px] text-[var(--anatomy-muted)]">
              PP {telemetry.pulsePressure}
            </div>
          </div>
        </div>

        {/* Secondary Hemodynamic Indices */}
        <div className="md:col-span-4 grid grid-cols-3 gap-2 pt-2 border-t border-[var(--anatomy-rule-soft)] md:pt-0 md:border-t-0 md:border-r md:border-[var(--anatomy-rule-soft)] md:pr-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.06em] font-mono-tabular text-[var(--anatomy-muted)]">
              CO
            </div>
            <div className="mt-0.5 font-mono-tabular text-sm font-semibold text-[var(--anatomy-strong)]">
              {telemetry.coLMin.toFixed(2)}{' '}
              <span className="text-[10.5px] font-normal text-[var(--anatomy-muted)]">L/m</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.06em] font-mono-tabular text-[var(--anatomy-muted)]">
              Stroke Vol
            </div>
            <div className="mt-0.5 font-mono-tabular text-sm font-semibold text-[var(--anatomy-strong)]">
              {telemetry.svMl.toFixed(0)}{' '}
              <span className="text-[10.5px] font-normal text-[var(--anatomy-muted)]">mL</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.06em] font-mono-tabular text-[var(--anatomy-muted)]">
              Preload
            </div>
            <div className="mt-0.5 font-mono-tabular text-sm font-semibold text-[var(--anatomy-strong)]">
              {telemetry.effectiveEdvMl.toFixed(0)}{' '}
              <span className="text-[10.5px] font-normal text-[var(--anatomy-muted)]">mL</span>
            </div>
          </div>
        </div>

        {/* Compact Windkessel Trace + Live Equation */}
        <div className="md:col-span-4 flex flex-col gap-1 pt-2 border-t border-[var(--anatomy-rule-soft)] md:pt-0 md:border-t-0">
          <div className="flex items-center justify-between text-[10px] text-[var(--anatomy-muted)]">
            <span className="font-mono-tabular uppercase tracking-[0.06em]">
              Trace <span className="text-[var(--anatomy-red)] font-semibold">Pa</span> ·{' '}
              <span className="text-[var(--anatomy-blue)] font-semibold">LV</span>
            </span>
            <span className="font-mono-tabular text-[10.5px] text-[var(--anatomy-text)] truncate max-w-[210px]">
              ({telemetry.effectiveHr.toFixed(0)}×{inputs.lvef.toFixed(2)}×{inputs.edv.toFixed(2)}×
              {telemetry.effectiveSvr.toFixed(0)})+{inputs.cvp.toFixed(0)}=
              <strong className="text-[var(--anatomy-strong)]">{telemetry.referenceMap.toFixed(0)}</strong>
            </span>
          </div>
          <div className="border border-[var(--anatomy-rule-soft)] bg-[var(--anatomy-surface-alt)] px-1.5 py-0.5">
            <svg
              viewBox={`0 0 ${w} ${h}`}
              className="w-full h-[36px] overflow-visible"
              role="img"
              aria-label="Live arterial pressure and left ventricular volume waveforms"
            >
              <line
                x1="0"
                y1={(h - 3 - ((65 - 20) / 140) * (h - 6)).toFixed(1)}
                x2={w}
                y2={(h - 3 - ((65 - 20) / 140) * (h - 6)).toFixed(1)}
                stroke="var(--anatomy-lo)"
                strokeWidth="0.8"
                strokeDasharray="3 3"
              />
              {waveform.length > 1 && (
                <>
                  <polyline
                    fill="none"
                    stroke="var(--anatomy-blue)"
                    strokeWidth="1.1"
                    strokeOpacity="0.8"
                    points={lvPoints}
                  />
                  <polyline
                    fill="none"
                    stroke="var(--anatomy-red)"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                    points={paPoints}
                  />
                </>
              )}
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
