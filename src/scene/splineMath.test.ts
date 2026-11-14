import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  FOCUS_CAMERA_PRESETS,
  OVERVIEW_CAMERA_PRESET,
  computeArteriolarCages,
  createCardiovascularSplines,
  sampleCurveUniform,
} from './splineMath';

test('cardiovascular splines sample smoothly without NaN along arterial, venous, and coronary paths', () => {
  const splines = createCardiovascularSplines();
  const pos = new THREE.Vector3();
  const tan = new THREE.Vector3();

  for (const curve of [
    splines.arterialCurve,
    splines.venousCurve,
    splines.coronaryMainCurve,
    ...splines.coronaryBranchCurves,
  ]) {
    assert.ok(curve.getLength() > 0.2, 'curve should have non-zero arc length');
    for (let i = 0; i <= 10; i++) {
      sampleCurveUniform(curve, i / 10, pos, tan);
      assert.ok(Number.isFinite(pos.x) && Number.isFinite(pos.y) && Number.isFinite(pos.z));
      assert.ok(Math.abs(tan.length() - 1) < 0.05, 'tangent should be near unit length');
    }
  }
});

test('arteriolar cage curves scale monotonically with dilationFactor', () => {
  const tight = computeArteriolarCages(5, 0.72);
  const dilated = computeArteriolarCages(5, 1.32);
  assert.equal(tight.length, 5);
  assert.equal(dilated.length, 5);

  const pTight = tight[0]!.getPointAt(0.5);
  const pDilated = dilated[0]!.getPointAt(0.5);
  const centerX = 2.42;
  assert.ok(Math.abs(pDilated.x - centerX) > Math.abs(pTight.x - centerX));
});

test('all camera focus presets and overview preset stay finite and separated from target', () => {
  const all = [OVERVIEW_CAMERA_PRESET, ...Object.values(FOCUS_CAMERA_PRESETS)];
  for (const preset of all) {
    const cam = new THREE.Vector3(...preset.position);
    const tgt = new THREE.Vector3(...preset.target);
    assert.ok(cam.distanceTo(tgt) > 2.0, 'camera should maintain clear focal distance');
  }
});
