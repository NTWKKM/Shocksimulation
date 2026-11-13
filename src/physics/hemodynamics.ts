export type ShockPresetId =
  | 'normal'
  | 'hypovolemic'
  | 'cardiogenic'
  | 'distributive'
  | 'obstructive'
  | 'arrhythmia';

export type AnatomyFocusId =
  | 'lv-edv'
  | 'myocardium-lvef'
  | 'aorta-map'
  | 'arterioles-svr'
  | 'venous-cvp';

export type PerfusionStatus = 'nominal' | 'compensated' | 'warning' | 'critical';

export interface HemodynamicInputs {
  hr: number; // 30 - 220 bpm
  lvef: number; // 0.10 - 0.80
  edv: number; // 0.04 - 0.18 L
  svr: number; // 5 - 30 WU (mmHg*min/L)
  cvp: number; // 0 - 30 mmHg
  autoCompensate: boolean;
}

export interface HemodynamicIntegrator {
  phase: number; // [0, 1) cardiac cycle phase
  aorticPressure: number; // Pa(t) in mmHg
  lvVolume: number; // V_lv(t) in L
  lvPressure: number; // P_lv(t) in mmHg
  effectiveHr: number; // Baroreceptor-modulated HR (bpm)
  effectiveSvr: number; // Baroreceptor-modulated SVR (WU)
  beatPeakPa: number;
  beatTroughPa: number;
  sbp: number;
  dbp: number;
  map: number;
  elapsedSec: number;
  prevPhase: number;
  mitralOpen: number;
  aorticOpen: number;
  aorticFlowLMin: number;
  mitralFlowLMin: number;
}

export interface HemodynamicTelemetry {
  sbp: number;
  dbp: number;
  map: number;
  pulsePressure: number;
  referenceMap: number;
  effectiveHr: number;
  effectiveSvr: number;
  effectiveEdvMl: number;
  svMl: number;
  coLMin: number;
  lvVolumeMl: number;
  lvPressureMmHg: number;
  aorticPressureMmHg: number;
  mitralOpen: number;
  aorticOpen: number;
  aorticFlowLMin: number;
  mitralFlowLMin: number;
  isSystole: boolean;
  phase: number;
  status: PerfusionStatus;
  statusLabel: string;
  lvefContext: { text: string; tone: 'good' | 'moderate' | 'poor' };
  edvContext: { text: string; tone: 'normal' | 'low' | 'very-low' | 'high' };
  svrContext: { text: string; tone: 'normal' | 'low' | 'high' };
}

export interface ShockPreset {
  id: ShockPresetId;
  label: string;
  shortLabel: string;
  inputs: Omit<HemodynamicInputs, 'autoCompensate'>;
  summaryTh: string;
  mechanismTh: string;
}

export const SHOCK_PRESETS: ShockPreset[] = [
  {
    id: 'normal',
    label: 'Normal Physiology',
    shortLabel: 'Normal',
    inputs: { hr: 70, lvef: 0.6, edv: 0.12, svr: 12, cvp: 8 },
    summaryTh: 'สมดุลการไหลเวียนเลือดปกติ (Euvolemia + Normal Tone)',
    mechanismTh:
      'Stroke Volume ~72 mL และ Cardiac Output ~5.0 L/min สร้างแรงดัน MAP ~68–72 mmHg เพียงพอต่อการเลี้ยงอวัยวะสำคัญ',
  },
  {
    id: 'hypovolemic',
    label: 'Hypovolemic Shock',
    shortLabel: 'Hypovolemic',
    inputs: { hr: 110, lvef: 0.55, edv: 0.07, svr: 14, cvp: 2 },
    summaryTh: 'ปริมาตรเลือดลดลง (Preload ต่ำมาก · CVP ต่ำ)',
    mechanismTh:
      'การเสียเลือดหรือขาดน้ำทำให้ Venous Return และ EDV ตกลงเหลือ 70 mL หัวใจบีบตัวเร็วขึ้นและหลอดเลือดหดตัวเพื่อประคอง MAP',
  },
  {
    id: 'cardiogenic',
    label: 'Cardiogenic Shock',
    shortLabel: 'Cardiogenic',
    inputs: { hr: 100, lvef: 0.2, edv: 0.16, svr: 15, cvp: 15 },
    summaryTh: 'กล้ามเนื้อหัวใจล้มเหลว (LVEF ต่ำ · น้ำคั่งในห้องหัวใจ)',
    mechanismTh:
      'Contractility ลดลงเหลือ 20% ทำให้เลือดคั่งใน LV (EDV สูง 160 mL) และ CVP พุ่งสูง 15 mmHg แต่ Cardiac Output ต่ำลงอย่างมาก',
  },
  {
    id: 'distributive',
    label: 'Distributive Shock',
    shortLabel: 'Distributive',
    inputs: { hr: 130, lvef: 0.5, edv: 0.1, svr: 6, cvp: 4 },
    summaryTh: 'หลอดเลือดขยายตัวทั่วร่างกาย (SVR ต่ำวิกฤต)',
    mechanismTh:
      'ภาวะ Septic หรือ Anaphylactic ทำให้หลอดเลือดส่วนปลายคลายตัว (SVR 6 WU) ความดัน Diastolic และ MAP ตกลงอย่างรวดเร็วแม้หัวใจเต้นเร็ว',
  },
  {
    id: 'obstructive',
    label: 'Obstructive Shock',
    shortLabel: 'Obstructive',
    inputs: { hr: 120, lvef: 0.6, edv: 0.04, svr: 15, cvp: 18 },
    summaryTh: 'มีการอุดกั้นการเติมเลือดเข้าหัวใจ (EDV ต่ำ · CVP สูง)',
    mechanismTh:
      'เช่น Cardiac Tamponade หรือ Tension Pneumothorax ทำให้แรงดันในช่องอกสูง (CVP 18 mmHg) ขัดขวางเลือดไหลเข้า LV จน EDV เหลือ 40 mL',
  },
  {
    id: 'arrhythmia',
    label: 'Arrhythmia Shock',
    shortLabel: 'Arrhythmia',
    inputs: { hr: 180, lvef: 0.6, edv: 0.04, svr: 12, cvp: 10 },
    summaryTh: 'หัวใจเต้นเร็วผิดจังหวะรุนแรง (Diastolic Filling Time สั้น)',
    mechanismTh:
      'ที่ HR 180 bpm ช่วง Diastole หดสั้นจนเลือดเติมเข้าห้องหัวใจไม่ทัน ส่งผลให้ EDV และ Stroke Volume ตกฮวบจนความดันโลหิตตก',
  },
];

export const BASE_HEALTHY_HR = 70;
export const BASE_HEALTHY_SVR = 12;
export const TARGET_COMPENSATION_MAP = 74;

/**
 * Clamp and sanitize raw user inputs to physiological simulation bounds.
 */
export function sanitizeInputs(inputs: HemodynamicInputs): HemodynamicInputs {
  return {
    hr: clamp(inputs.hr, 30, 220),
    lvef: clamp(inputs.lvef, 0.1, 0.8),
    edv: clamp(inputs.edv, 0.04, 0.18),
    svr: clamp(inputs.svr, 5, 30),
    cvp: clamp(Number.isFinite(inputs.cvp) ? inputs.cvp : 0, 0, 30),
    autoCompensate: Boolean(inputs.autoCompensate),
  };
}

/**
 * Compute diastolic filling efficiency penalty during severe tachycardia (>145 bpm)
 * and subtle Frank-Starling plateau at extreme preload (>0.16 L).
 */
export function computeEffectivePreloadAndEF(
  hr: number,
  lvef: number,
  edv: number,
): { effectiveEdv: number; effectiveEf: number; systolicFraction: number } {
  const cycleSec = 60 / hr;
  // Electromechanical systole shortens weakly with HR (Bazett-inspired)
  const systolicSec = clamp(0.38 - 0.00095 * hr, 0.16, 0.34);
  const systolicFraction = clamp(systolicSec / cycleSec, 0.22, 0.62);
  const diastolicSec = Math.max(0.05, cycleSec - systolicSec);

  // Ventricular filling time constant ~0.095s: below ~140 bpm filling completes (~97%+)
  const fillingEfficiency = clamp(1 - Math.exp(-diastolicSec / 0.095), 0.48, 1.0);
  const effectiveEdv = edv * fillingEfficiency;

  // Frank-Starling subtle overdistension roll-off above 0.16 L
  const overdistension = edv > 0.16 ? (edv - 0.16) * 0.45 : 0;
  const effectiveEf = clamp(lvef * (1 - overdistension), 0.08, 0.82);

  return { effectiveEdv, effectiveEf, systolicFraction };
}

/**
 * Create an initial integrator pre-converged near steady state for the given inputs.
 */
export function createHemodynamicIntegrator(rawInputs: HemodynamicInputs): HemodynamicIntegrator {
  const inputs = sanitizeInputs(rawInputs);
  const { effectiveEdv, effectiveEf } = computeEffectivePreloadAndEF(
    inputs.hr,
    inputs.lvef,
    inputs.edv,
  );
  const svL = effectiveEdv * effectiveEf;
  const coLMin = inputs.hr * svL;
  const steadyMap = coLMin * inputs.svr + inputs.cvp;

  const state: HemodynamicIntegrator = {
    phase: 0,
    aorticPressure: steadyMap,
    lvVolume: effectiveEdv,
    lvPressure: inputs.cvp + 2,
    effectiveHr: inputs.hr,
    effectiveSvr: inputs.svr,
    beatPeakPa: steadyMap + 16,
    beatTroughPa: Math.max(inputs.cvp + 4, steadyMap - 12),
    sbp: steadyMap + 16,
    dbp: Math.max(inputs.cvp + 4, steadyMap - 12),
    map: steadyMap,
    elapsedSec: 0,
    prevPhase: 0,
    mitralOpen: 0.8,
    aorticOpen: 0,
    aorticFlowLMin: 0,
    mitralFlowLMin: 0,
  };

  // Warm up 2.4 seconds so SBP/DBP and Windkessel waveform start cleanly settled
  const warmDt = 0.004;
  for (let i = 0; i < 600; i++) {
    stepHemodynamics(state, inputs, warmDt);
  }
  return state;
}

/**
 * Advance the coupled Cardiac + 2-Element Windkessel + Baroreceptor ODE by dt seconds.
 * Internally sub-steps at <= 0.004s for unconditional numerical stability.
 */
export function stepHemodynamics(
  state: HemodynamicIntegrator,
  rawInputs: HemodynamicInputs,
  dtSec: number,
): void {
  const inputs = sanitizeInputs(rawInputs);
  const clampedDt = clamp(dtSec, 0, 0.1);
  if (clampedDt === 0) return;

  const subSteps = Math.max(1, Math.ceil(clampedDt / 0.004));
  const h = clampedDt / subSteps;

  for (let step = 0; step < subSteps; step++) {
    // 1. Baroreceptor Reflex ODE (autonomic damping tau ~ 1.6s)
    let targetHr = inputs.hr;
    let targetSvr = inputs.svr;
    if (inputs.autoCompensate) {
      const { effectiveEdv, effectiveEf } = computeEffectivePreloadAndEF(
        state.effectiveHr,
        inputs.lvef,
        inputs.edv,
      );
      const currentCoFactor = effectiveEf * effectiveEdv;
      const baseCoFactor = 0.6 * 0.12;
      const deficitRatio = currentCoFactor / baseCoFactor;
      const pressureDeficit = Math.max(0, TARGET_COMPENSATION_MAP - state.map);

      if (deficitRatio < 1.0 || pressureDeficit > 1.5) {
        const deficit = Math.max(1.0 - deficitRatio, pressureDeficit / 75);
        targetHr = clamp(BASE_HEALTHY_HR + deficit * 105, 30, 220);
        targetSvr = clamp(BASE_HEALTHY_SVR + deficit * 21, 5, 30);
      } else {
        targetHr = BASE_HEALTHY_HR;
        targetSvr = BASE_HEALTHY_SVR;
      }
    }

    const autonomicRate = inputs.autoCompensate ? 1.8 : 8.5;
    const alphaAutonomic = 1 - Math.exp(-autonomicRate * h);
    state.effectiveHr += (targetHr - state.effectiveHr) * alphaAutonomic;
    state.effectiveSvr += (targetSvr - state.effectiveSvr) * alphaAutonomic;

    // 2. Cardiac Cycle Phase Progression
    const cycleSec = 60 / state.effectiveHr;
    const { effectiveEdv, effectiveEf, systolicFraction } = computeEffectivePreloadAndEF(
      state.effectiveHr,
      inputs.lvef,
      inputs.edv,
    );
    const esvL = effectiveEdv * (1 - effectiveEf);
    const svL = Math.max(0.002, effectiveEdv - esvL);

    state.prevPhase = state.phase;
    state.phase = (state.phase + h / cycleSec) % 1;
    state.elapsedSec += h;

    // Detect beat wrap-around to latch true SBP & DBP
    if (state.phase < state.prevPhase) {
      const nextSbp = Math.max(state.beatPeakPa, state.beatTroughPa + 4);
      const nextDbp = Math.min(state.beatTroughPa, nextSbp - 4);
      state.sbp += (nextSbp - state.sbp) * 0.65;
      state.dbp += (nextDbp - state.dbp) * 0.65;
      state.beatPeakPa = state.aorticPressure;
      state.beatTroughPa = state.aorticPressure;
    }

    // 3. Ventricular Volume V_lv(t) & Instantaneous Flows Q_aortic(t), Q_mitral(t)
    // Systole: [0, systolicFraction), Diastole: [systolicFraction, 1)
    const isSystole = state.phase < systolicFraction;
    let aorticFlowLMin = 0;
    let mitralFlowLMin = 0;

    if (isSystole) {
      const u = state.phase / systolicFraction; // 0..1 within systole
      // Smooth ejection curve: brief isovolumetric contraction (0..0.12), peak ejection (~0.42), closure (1.0)
      if (u < 0.12) {
        state.lvVolume = effectiveEdv;
        aorticFlowLMin = 0;
      } else {
        const ejU = (u - 0.12) / 0.88;
        // Normalized smooth ejection velocity pulse whose integral over [0,1] equals 1
        const pulseShape = Math.sin(Math.PI * ejU) * (1 + 0.35 * Math.cos(Math.PI * ejU));
        // Integral of sin(pi*x)*(1 + 0.35*cos(pi*x)) over [0,1] = 2/pi
        const normFactor = Math.PI / 2;
        const ejectionDurationMin = (systolicFraction * 0.88 * cycleSec) / 60;
        aorticFlowLMin = (svL / ejectionDurationMin) * normFactor * Math.max(0, pulseShape);

        // Smoothly track remaining LV volume using cosine integral
        const ejectedFrac = 0.5 * (1 - Math.cos(Math.PI * ejU));
        state.lvVolume = effectiveEdv - svL * ejectedFrac;
      }
      mitralFlowLMin = 0;
    } else {
      const u = (state.phase - systolicFraction) / (1 - systolicFraction); // 0..1 within diastole
      // Brief isovolumetric relaxation (0..0.08), rapid E-wave filling, late A-wave atrial kick
      if (u < 0.08) {
        state.lvVolume = esvL;
        mitralFlowLMin = 0;
      } else {
        const fillU = (u - 0.08) / 0.92;
        const eWave = 0.72 * Math.sin(Math.PI * Math.min(1, fillU * 1.65)) * (fillU < 0.6 ? 1 : 0);
        const aWave = 0.32 * Math.sin(Math.PI * Math.max(0, (fillU - 0.65) / 0.35)) * (fillU > 0.65 ? 1 : 0);
        const fillDurationMin = ((1 - systolicFraction) * 0.92 * cycleSec) / 60;
        mitralFlowLMin = (svL / fillDurationMin) * 1.45 * (eWave + aWave);

        const filledFrac = clamp(
          0.76 * (1 - Math.exp(-fillU * 4.2)) + 0.24 * Math.pow(fillU, 2.2),
          0,
          1,
        );
        state.lvVolume = esvL + svL * filledFrac;
      }
      aorticFlowLMin = 0;
    }

    state.aorticFlowLMin = aorticFlowLMin;
    state.mitralFlowLMin = mitralFlowLMin;

    // 4. Windkessel 2-Element Arterial Compliance ODE:
    // C_a * dP_a/dt = Q_aortic(t) - (P_a(t) - CVP) / R_svr
    // Note: Q is in L/min -> L/sec = Q / 60; R_svr in mmHg*min/L -> mmHg*s/L = R_svr * 60
    // Arterial compliance C_a decreases slightly during intense vasoconstriction (stiffer vessels)
    const svrRatio = state.effectiveSvr / BASE_HEALTHY_SVR;
    const arterialComplianceLPerMmHg = clamp(0.00145 / Math.pow(svrRatio, 0.25), 0.0008, 0.0022);
    const qInLSec = aorticFlowLMin / 60;
    const rSvrSec = state.effectiveSvr * 60;
    const qOutLSec = (state.aorticPressure - inputs.cvp) / rSvrSec;

    const dPaDt = (qInLSec - qOutLSec) / arterialComplianceLPerMmHg;
    state.aorticPressure = clamp(state.aorticPressure + dPaDt * h, inputs.cvp, 260);

    // Track beat extremes
    if (state.aorticPressure > state.beatPeakPa) state.beatPeakPa = state.aorticPressure;
    if (state.aorticPressure < state.beatTroughPa) state.beatTroughPa = state.aorticPressure;

    // 5. Instantaneous LV Pressure & Valve Opening Kinematics
    if (isSystole) {
      const u = state.phase / systolicFraction;
      const contractionEnvelope = Math.sin(Math.PI * Math.pow(u, 0.85));
      const peakPressure = state.aorticPressure + 14 * inputs.lvef + 4;
      state.lvPressure = inputs.cvp + (peakPressure - inputs.cvp) * contractionEnvelope;
    } else {
      const u = (state.phase - systolicFraction) / (1 - systolicFraction);
      state.lvPressure = inputs.cvp + Math.max(0, 6 * (1 - u * 4));
    }

    const targetAorticOpen = isSystole && aorticFlowLMin > 0.2 ? clamp(aorticFlowLMin / 18, 0.25, 1) : 0;
    const targetMitralOpen = !isSystole && mitralFlowLMin > 0.2 ? clamp(mitralFlowLMin / 14, 0.25, 1) : 0;
    const valveAlpha = 1 - Math.exp(-32 * h);
    state.aorticOpen += (targetAorticOpen - state.aorticOpen) * valveAlpha;
    state.mitralOpen += (targetMitralOpen - state.mitralOpen) * valveAlpha;

    // 6. Smooth Mean Arterial Pressure (MAP) integration (~1.2s EMA + steady-state convergence)
    const mapAlpha = 1 - Math.exp(-1.6 * h);
    state.map += (state.aorticPressure - state.map) * mapAlpha;
  }
}

export function getTelemetry(
  state: HemodynamicIntegrator,
  rawInputs: HemodynamicInputs,
): HemodynamicTelemetry {
  const inputs = sanitizeInputs(rawInputs);
  const { effectiveEdv, effectiveEf, systolicFraction } = computeEffectivePreloadAndEF(
    state.effectiveHr,
    inputs.lvef,
    inputs.edv,
  );
  const svL = effectiveEdv * effectiveEf;
  const svMl = svL * 1000;
  const coLMin = state.effectiveHr * svL;
  const referenceMap =
    state.effectiveHr * inputs.lvef * inputs.edv * state.effectiveSvr + inputs.cvp;

  const sbp = Math.round(state.sbp);
  const dbp = Math.round(state.dbp);
  const map = Math.round(state.map);
  const pulsePressure = Math.max(0, sbp - dbp);

  let status: PerfusionStatus = 'nominal';
  let statusLabel = 'Nominal Perfusion';
  if (map < 60) {
    status = 'critical';
    statusLabel = 'Critical Hypoperfusion';
  } else if (map < 65) {
    status = 'warning';
    statusLabel = 'Borderline Perfusion';
  } else if (inputs.autoCompensate && state.effectiveHr > BASE_HEALTHY_HR + 8) {
    status = 'compensated';
    statusLabel = 'Compensated State';
  }

  const lvefContext: HemodynamicTelemetry['lvefContext'] =
    inputs.lvef < 0.3
      ? { text: 'Poor Contractility', tone: 'poor' }
      : inputs.lvef < 0.45
        ? { text: 'Moderate Dysfunction', tone: 'moderate' }
        : { text: 'Preserved EF', tone: 'good' };

  const edvContext: HemodynamicTelemetry['edvContext'] =
    inputs.edv < 0.08
      ? { text: 'Severe Hypovolemia', tone: 'very-low' }
      : inputs.edv < 0.1
        ? { text: 'Mild Hypovolemia', tone: 'low' }
        : inputs.edv > 0.15
          ? { text: 'Hypervolemia / Overload', tone: 'high' }
          : { text: 'Euvolemia', tone: 'normal' };

  const svrContext: HemodynamicTelemetry['svrContext'] =
    state.effectiveSvr < 8
      ? { text: 'Vasodilation', tone: 'low' }
      : state.effectiveSvr > 15
        ? { text: 'Vasoconstriction', tone: 'high' }
        : { text: 'Normal Vascular Tone', tone: 'normal' };

  return {
    sbp,
    dbp,
    map,
    pulsePressure,
    referenceMap,
    effectiveHr: state.effectiveHr,
    effectiveSvr: state.effectiveSvr,
    effectiveEdvMl: effectiveEdv * 1000,
    svMl,
    coLMin,
    lvVolumeMl: state.lvVolume * 1000,
    lvPressureMmHg: state.lvPressure,
    aorticPressureMmHg: state.aorticPressure,
    mitralOpen: state.mitralOpen,
    aorticOpen: state.aorticOpen,
    aorticFlowLMin: state.aorticFlowLMin,
    mitralFlowLMin: state.mitralFlowLMin,
    isSystole: state.phase < systolicFraction,
    phase: state.phase,
    status,
    statusLabel,
    lvefContext,
    edvContext,
    svrContext,
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
