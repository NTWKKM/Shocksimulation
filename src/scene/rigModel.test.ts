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
  buildPumpDynamicPaths,
  buildSvrValveDynamicPaths,
  createRigScene,
  projectionForAngle,
} from './rigModel';

const ORBIT_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

test('rigModel builds without NaN and passes geometric audit across 360 degrees', () => {
  const failuresByAngle: string[] = [];
  for (const angle of ORBIT_ANGLES) {
    const scene = createRigScene(angle, { audit: true });
    assert.equal(scene.angleDeg, angle, `angle ${angle} recorded`);
    assert.ok(scene.items.length >= 20, `angle ${angle}: should produce rig assembly items`);
    assert.ok(scene.haloPath.length > 0 && !scene.haloPath.includes('NaN'), `angle ${angle}: haloPath valid`);
    assert.ok(scene.arterialArchGlRoute.length >= 6, `angle ${angle}: arterialArchGlRoute populated`);
    assert.ok(scene.arterialFeedGlRoute.length >= 4, `angle ${angle}: arterialFeedGlRoute populated`);
    assert.ok(scene.venousRoute.length >= 6, `angle ${angle}: venousRoute populated`);
    assert.equal(scene.capillaryRoutes.length, 4, `angle ${angle}: 4 capillary branches populated`);
    assert.ok(!scene.overlays.pumpGlassSvg.includes('NaN'), `angle ${angle}: pumpGlassSvg valid`);
    assert.ok(!scene.overlays.domeGlassSvg.includes('NaN'), `angle ${angle}: domeGlassSvg valid`);
    assert.ok(!scene.overlays.cvpGlassSvg.includes('NaN'), `angle ${angle}: cvpGlassSvg valid`);

    for (const item of scene.items) {
      assert.ok(!item.svg.includes('NaN'), `angle ${angle}: SVG for ${item.id} should not contain NaN`);
    }

    const res = A.audit(scene.auditRecorder!, scene.projection);
    const summary = A.report(res);
    const count = A.failures(res);
    if (count > 0) {
      failuresByAngle.push(`=== Angle ${angle} deg (${count} failures) ===\n${summary}`);
    }
  }
  if (failuresByAngle.length > 0) {
    console.log(failuresByAngle.join('\n\n'));
  }
  assert.equal(failuresByAngle.length, 0, failuresByAngle.join('\n\n'));
});

test('dynamic rig helpers produce valid geometry across all 6 shock presets and rotated angles', () => {
  const testAngles = [0, 90, 180, 270];
  for (const angle of testAngles) {
    const P = projectionForAngle(angle);
    for (const preset of SHOCK_PRESETS) {
      const sim = createHemodynamicIntegrator({ ...preset.inputs, autoCompensate: false });
      stepHemodynamics(sim, { ...preset.inputs, autoCompensate: false }, 0.25);
      const tel = getTelemetry(sim, { ...preset.inputs, autoCompensate: false });

      const pump = buildPumpDynamicPaths(tel.lvVolumeMl, P);
      assert.ok(pump.shellSvg.includes('<path') && !pump.shellSvg.includes('NaN'));
      assert.ok(pump.frontOverlaySvg.includes('<path') && !pump.frontOverlaySvg.includes('NaN'));
      assert.ok(pump.fluidFallbackSvg.includes('<path') && !pump.fluidFallbackSvg.includes('NaN'));

      const needle = buildDialNeedlePath(tel.map, P);
      assert.ok(needle.startsWith('M') && !needle.includes('NaN'));

      const svr = buildSvrValveDynamicPaths(tel.effectiveSvr, P);
      assert.ok(svr.stemSvg.includes('<path') && !svr.stemSvg.includes('NaN'));
      assert.ok(svr.knobSvg.includes('<path') && !svr.knobSvg.includes('NaN'));

      const fluids = buildFallbackFluidPaths(preset.inputs.cvp, tel.aorticPressureMmHg, P);
      assert.ok(fluids.cvpSvg.includes('<path') && !fluids.cvpSvg.includes('NaN'));
      assert.ok(fluids.domeSvg.includes('<path') && !fluids.domeSvg.includes('NaN'));
    }
  }
});
