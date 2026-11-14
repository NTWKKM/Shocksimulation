import * as THREE from 'three';

export const NETTER_INK_HEX = 0x2a1814;
export const NETTER_INK_CSS = '#2a1814';
export const NETTER_PARCHMENT_HEX = 0xf8f3e6;

export function detectSoftwareWebGL(): boolean {
  if (typeof document === 'undefined') return true;
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return true;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
  const gpu = String(gl.getParameter(param) ?? '');
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
}

export function createNetterToonGradient(): THREE.DataTexture {
  // Subtle 4-band anatomical atlas cel gradient
  const bands = new Uint8Array([115, 178, 224, 255]);
  const tex = new THREE.DataTexture(bands, 4, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

export function createMuscleStriationTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ba4a42';
    ctx.fillRect(0, 0, 256, 256);

    // Fine Netter-style oblique myocardial fiber striations
    for (let y = -64; y < 320; y += 9) {
      ctx.beginPath();
      for (let x = 0; x <= 256; x += 16) {
        const wave = Math.sin((x / 256) * Math.PI * 2 + y * 0.04) * 5;
        if (x === 0) ctx.moveTo(x, y + wave);
        else ctx.lineTo(x, y + wave);
      }
      ctx.strokeStyle = y % 18 === 0 ? 'rgba(62, 18, 16, 0.24)' : 'rgba(232, 138, 126, 0.20)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createParchmentWashTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 128);
    grad.addColorStop(0, 'rgba(235, 223, 198, 0.72)');
    grad.addColorStop(0.65, 'rgba(241, 232, 212, 0.36)');
    grad.addColorStop(1, 'rgba(248, 243, 230, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createPerfusionHaloTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 8, 128, 128, 124);
    grad.addColorStop(0, 'rgba(205, 52, 46, 0.56)');
    grad.addColorStop(0.45, 'rgba(216, 74, 62, 0.24)');
    grad.addColorStop(1, 'rgba(216, 74, 62, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface NetterMaterialLibrary {
  inkOutline: THREE.MeshBasicMaterial;
  myocardiumOuter: THREE.MeshToonMaterial;
  myocardiumCut: THREE.MeshToonMaterial;
  endocardiumWall: THREE.MeshToonMaterial;
  epicardialFat: THREE.MeshToonMaterial;
  coronaryArtery: THREE.MeshToonMaterial;
  lvBlood: THREE.MeshStandardMaterial;
  valveLeaflet: THREE.MeshStandardMaterial;
  chordaeLine: THREE.LineBasicMaterial;
  aortaOpaque: THREE.MeshToonMaterial;
  aortaGlass: THREE.MeshPhysicalMaterial;
  venousWall: THREE.MeshToonMaterial;
  atriumCut: THREE.MeshToonMaterial;
  arterioleVessel: THREE.MeshToonMaterial;
  rbcCell: THREE.MeshStandardMaterial;
  perfusionHalo: THREE.MeshBasicMaterial;
  dispose: () => void;
}

export function createNetterMaterials(maxAnisotropy: number, isSoftwareGl: boolean): NetterMaterialLibrary {
  const gradientMap = createNetterToonGradient();
  const striationTex = createMuscleStriationTexture(maxAnisotropy);
  const haloTex = createPerfusionHaloTexture();

  const inkOutline = new THREE.MeshBasicMaterial({
    color: NETTER_INK_HEX,
    side: THREE.BackSide,
  });

  const myocardiumOuter = new THREE.MeshToonMaterial({
    color: 0xffffff,
    map: striationTex,
    gradientMap,
    side: THREE.DoubleSide,
  });

  const myocardiumCut = new THREE.MeshToonMaterial({
    color: 0xc24942,
    gradientMap,
    side: THREE.DoubleSide,
  });

  const endocardiumWall = new THREE.MeshToonMaterial({
    color: 0x731817,
    gradientMap,
    side: THREE.DoubleSide,
  });

  const epicardialFat = new THREE.MeshToonMaterial({
    color: 0xd6b24d,
    gradientMap,
  });

  const coronaryArtery = new THREE.MeshToonMaterial({
    color: 0xba2f2a,
    gradientMap,
  });

  const lvBlood = new THREE.MeshStandardMaterial({
    color: 0x991719,
    emissive: 0x3b0608,
    emissiveIntensity: 0.45,
    roughness: 0.24,
    metalness: 0.05,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
  });

  const valveLeaflet = new THREE.MeshStandardMaterial({
    color: 0xf4ece1,
    roughness: 0.45,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });

  const chordaeLine = new THREE.LineBasicMaterial({
    color: 0xf2eadf,
    transparent: true,
    opacity: 0.92,
  });

  const aortaOpaque = new THREE.MeshToonMaterial({
    color: 0xc63f38,
    gradientMap,
    side: THREE.DoubleSide,
  });

  const aortaGlass = new THREE.MeshPhysicalMaterial({
    color: 0xdd6b63,
    roughness: 0.2,
    metalness: 0.02,
    transparent: true,
    opacity: isSoftwareGl ? 0.46 : 0.42,
    clearcoat: 0.65,
    clearcoatRoughness: 0.18,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const venousWall = new THREE.MeshToonMaterial({
    color: 0x4f739a,
    gradientMap,
    side: THREE.DoubleSide,
  });

  const atriumCut = new THREE.MeshToonMaterial({
    color: 0x345579,
    gradientMap,
    side: THREE.DoubleSide,
  });

  const arterioleVessel = new THREE.MeshToonMaterial({
    color: 0xb4322e,
    gradientMap,
  });

  const rbcCell = new THREE.MeshStandardMaterial({
    color: 0x9e181d,
    emissive: 0x4a080c,
    emissiveIntensity: 0.35,
    roughness: 0.35,
    metalness: 0.04,
  });

  const perfusionHalo = new THREE.MeshBasicMaterial({
    map: haloTex,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });

  const allMaterials: THREE.Material[] = [
    inkOutline,
    myocardiumOuter,
    myocardiumCut,
    endocardiumWall,
    epicardialFat,
    coronaryArtery,
    lvBlood,
    valveLeaflet,
    chordaeLine,
    aortaOpaque,
    aortaGlass,
    venousWall,
    atriumCut,
    arterioleVessel,
    rbcCell,
    perfusionHalo,
  ];
  const allTextures: THREE.Texture[] = [gradientMap, striationTex, haloTex];

  return {
    inkOutline,
    myocardiumOuter,
    myocardiumCut,
    endocardiumWall,
    epicardialFat,
    coronaryArtery,
    lvBlood,
    valveLeaflet,
    chordaeLine,
    aortaOpaque,
    aortaGlass,
    venousWall,
    atriumCut,
    arterioleVessel,
    rbcCell,
    perfusionHalo,
    dispose() {
      allMaterials.forEach((m) => m.dispose());
      allTextures.forEach((t) => t.dispose());
    },
  };
}
