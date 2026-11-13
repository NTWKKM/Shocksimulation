import assert from 'node:assert/strict';
import test from 'node:test';
import * as A from '../kit/audit.mjs';
import {
  SHOCK_PRESETS,
  createHemodynamicIntegrator,
  getTelemetry,
  stepHemodynamics,
} from '../physics/hemodynamics';
import {
  buildDialNeedlePath,
  buildFallbackFluidPaths,
  buildLvDynamicPaths,
  buildSvrValveDynamicPaths,
  buildValveLeafletPaths,
  createRigScene,
} from './rigModel';

test('rigModel builds without NaN and passes geometric audit', () => {
  const scene = createRigScene();
  assert.ok(scene.items.length >= 20, 'should produce rig assembly items');
  assert.ok(scene.haloPath.length > 0 && !scene.haloPath.includes('NaN'), 'haloPath valid');
  assert.ok(scene.arterialArchGlRoute.length >= 6, 'arterialArchGlRoute populated');
  assert.ok(scene.arterialFeedGlRoute.length >= 4, 'arterialFeedGlRoute populated');
  assert.ok(scene.venousRoute.length >= 6, 'venousRoute populated');
  assert.equal(scene.capillaryRoutes.length, 4, '4 capillary branches populated');

  for (const item of scene.items) {
    assert.ok(!item.svg.includes('NaN'), `SVG for ${item.id} should not contain NaN`);
  }

  const res = A.audit(scene.auditRecorder, scene.projection);
  const summary = A.report(res);
  const count = A.failures(res);
  if (count > 0) {
    console.log(summary);
  }
  assert.equal(count, 0, `audit should pass with 0 failures:\n${summary}`);
});

test('dynamic rig helpers produce valid geometry across all 6 shock presets', () => {
  for (const preset of SHOCK_PRESETS) {
    const sim = createHemodynamicIntegrator({ ...preset.inputs, autoCompensate: false });
    stepHemodynamics(sim, { ...preset.inputs, autoCompensate: false }, 0.25);
    const tel = getTelemetry(sim, { ...preset.inputs, autoCompensate: false });

    const lv = buildLvDynamicPaths(tel.lvVolumeMl);
    assert.ok(lv.shellSvg.includes('<path') && !lv.shellSvg.includes('NaN'));
    assert.ok(lv.cavitySvg.includes('iso-cavity') && !lv.cavitySvg.includes('NaN'));
    assert.ok(lv.fluidFallbackSvg.includes('<path') && !lv.fluidFallbackSvg.includes('NaN'));

    const valves = buildValveLeafletPaths(tel.mitralOpen, tel.aorticOpen);
    assert.ok(valves.mitralD.startsWith('M') && !valves.mitralD.includes('NaN'));
    assert.ok(valves.aorticD.startsWith('M') && !valves.aorticD.includes('NaN'));

    const needle = buildDialNeedlePath(tel.map);
    assert.ok(needle.startsWith('M') && !needle.includes('NaN'));

    const svr = buildSvrValveDynamicPaths(tel.effectiveSvr);
    assert.ok(svr.stemSvg.includes('<path') && !svr.stemSvg.includes('NaN'));
    assert.ok(svr.knobSvg.includes('<path') && !svr.knobSvg.includes('NaN'));

    const fluids = buildFallbackFluidPaths(preset.inputs.cvp, tel.aorticPressureMmHg);
    assert.ok(fluids.cvpSvg.includes('<path') && !fluids.cvpSvg.includes('NaN'));
    assert.ok(fluids.domeSvg.includes('<path') && !fluids.domeSvg.includes('NaN'));
  }
});
