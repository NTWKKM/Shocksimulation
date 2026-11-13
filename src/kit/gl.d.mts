import type { Projection } from './iso-kit';

export const GLSL_ISO: string;
export const GLSL_TURN: string;

export interface GlCamera {
  origin: [number, number];
  k: number;
  cam: [number, number, number, number];
}

export interface GlLayerOptions {
  canvas: HTMLCanvasElement;
  fragment: string;
  view: [number, number];
  camera: GlCamera;
  uniforms?: string[];
  fixed?: Record<string, number | number[] | Float32Array>;
  extensions?: string[];
  maxRatio?: number;
  onError?: (message: string) => void;
}

export interface GlLayerHandle {
  gl: WebGLRenderingContext;
  extensions: string[];
  set: (values?: Record<string, number | number[] | Float32Array>) => void;
  draw: (values?: Record<string, number | number[] | Float32Array>, time?: number) => void;
  clear: () => void;
}

export function glCamera(projection: Projection): GlCamera;
export function glLayer(options: GlLayerOptions): GlLayerHandle | null;
export function smooth(a: number, b: number, x: number): number;
export function burst(age: number, rise: number, fall: number): number;
export function settle(
  state: { x: number; v: number },
  target: number,
  dt: number,
  seconds: number,
  calm?: boolean,
): boolean;
