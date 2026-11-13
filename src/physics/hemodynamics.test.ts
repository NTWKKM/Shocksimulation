import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SHOCK_PRESETS,
  createHemodynamicIntegrator,
  stepHemodynamics,
  getTelemetry,
  computeEffectivePreloadAndEF,
  type HemodynamicInputs,
} from './hemodynamics';

test('normal physiology converges to realistic pulsatile SBP/DBP and MAP around 68 mmHg', () => {
  const inputs: HemodynamicInputs = {
    hr: 70,
    lvef: 0.6,
    edv: 0.12,
    svr: 12,
    cvp: 8,
    autoCompensate: false,
  };
  const sim = createHemodynamicIntegrator(inputs);

  for (let i = 0; i < 600; i++) {
    stepHemodynamics(sim, inputs, 0.01);
  }

  const telemetry = getTelemetry(sim, inputs);
  assert.ok(telemetry.sbp > telemetry.map, `Expected SBP (${telemetry.sbp}) > MAP (${telemetry.map})`);
  assert.ok(telemetry.map > telemetry.dbp, `Expected MAP (${telemetry.map}) > DBP (${telemetry.dbp})`);
  assert.ok(
    telemetry.map >= 64 && telemetry.map <= 75,
    `Expected normal MAP in 64-75 mmHg, got ${telemetry.map}`,
  );
  assert.equal(telemetry.status, 'nominal');
});

test('distributive shock preset drops MAP into critical hypoperfusion (<60 mmHg)', () => {
  const preset = SHOCK_PRESETS.find((p) => p.id === 'distributive')!;
  const inputs: HemodynamicInputs = { ...preset.inputs, autoCompensate: false };
  const sim = createHemodynamicIntegrator(inputs);

  for (let i = 0; i < 600; i++) {
    stepHemodynamics(sim, inputs, 0.01);
  }

  const telemetry = getTelemetry(sim, inputs);
  assert.ok(telemetry.map < 55, `Expected distributive shock MAP < 55, got ${telemetry.map}`);
  assert.equal(telemetry.status, 'critical');
  assert.equal(telemetry.svrContext.tone, 'low');
});

test('baroreceptor auto-compensation smoothly increases HR and SVR when preload drops', () => {
  const inputs: HemodynamicInputs = {
    hr: 70,
    lvef: 0.55,
    edv: 0.06,
    svr: 12,
    cvp: 2,
    autoCompensate: true,
  };
  const sim = createHemodynamicIntegrator(inputs);

  // Immediately after turning on compensation, it starts at 70 bpm / 12 WU and ramps up over time
  for (let i = 0; i < 400; i++) {
    stepHemodynamics(sim, inputs, 0.01);
  }

  const telemetry = getTelemetry(sim, inputs);
  assert.ok(telemetry.effectiveHr > 95, `Expected compensated HR > 95, got ${telemetry.effectiveHr}`);
  assert.ok(telemetry.effectiveSvr > 15, `Expected compensated SVR > 15, got ${telemetry.effectiveSvr}`);
});

test('severe tachycardia reduces diastolic filling efficiency and effective EDV', () => {
  const normalFill = computeEffectivePreloadAndEF(70, 0.6, 0.12);
  const tachyFill = computeEffectivePreloadAndEF(190, 0.6, 0.12);

  assert.ok(normalFill.effectiveEdv > 0.115, 'At 70 bpm LV fills almost completely');
  assert.ok(
    tachyFill.effectiveEdv < normalFill.effectiveEdv,
    `Expected tachycardia effectiveEdv (${tachyFill.effectiveEdv}) < normal (${normalFill.effectiveEdv})`,
  );
});

test('all 6 shock presets step cleanly without NaN or unstable pressures', () => {
  for (const preset of SHOCK_PRESETS) {
    const inputs: HemodynamicInputs = { ...preset.inputs, autoCompensate: false };
    const sim = createHemodynamicIntegrator(inputs);
    for (let i = 0; i < 300; i++) {
      stepHemodynamics(sim, inputs, 0.016);
    }
    const telemetry = getTelemetry(sim, inputs);
    assert.ok(Number.isFinite(telemetry.map), `${preset.id} MAP must be finite`);
    assert.ok(Number.isFinite(telemetry.sbp) && telemetry.sbp > telemetry.dbp, `${preset.id} SBP > DBP`);
    assert.ok(telemetry.coLMin > 0, `${preset.id} CO > 0`);
  }
});
