import type { Flat, Plane, Point3, Projection, SolidPaths } from './iso-kit';

export interface Frame {
  o: Point3;
  a: Point3;
  u: Point3;
  v: Point3;
}

export type MeridianPoint = [number, number] | [number, number, 1];

export interface SmoothOptions {
  rows?: number;
  slope?: (s: number) => number;
  radius?: (s: number) => number;
}

export interface LatheOptions {
  steps?: number;
  smooth?: boolean | 'auto' | SmoothOptions;
  fill?: 'auto' | 'hull' | 'surface';
}

export function dot3(a: Point3, b: Point3): number;
export function add3(a: Point3, b: Point3): Point3;
export function sub3(a: Point3, b: Point3): Point3;
export function mul3(a: Point3, k: number): Point3;
export function len3(a: Point3): number;
export function unit3(a: Point3): Point3;
export function cross3(a: Point3, b: Point3): Point3;
export function lerp3(a: Point3, b: Point3, t: number): Point3;

export function viewOf(P: Projection): Point3;
export function lightOf(P: Projection): Point3;
export function scaleOf(P: Projection): number;
export function bandOf(score: number): number;
export function toneOf(normal: Point3, P: Projection): number;

export function frameAlong(o: Point3, a: Point3): Frame;
export function frameOf(o: Point3, a: Point3, u: Point3, v: Point3): Frame;
export function pointOf(F: Frame, s: number, r: number, angle: number): Point3;
export function radialOf(F: Frame, angle: number): Point3;
export function tangentOf(F: Frame, angle: number): Point3;
export function angleToward(F: Frame, direction: Point3): number;

export function solidOf(profile: MeridianPoint[], F: Frame, P: Projection, options?: LatheOptions): SolidPaths;
export function disc(s0: number, s1: number, r: number, F: Frame, P: Projection, steps?: number): SolidPaths;
export function ringBand(F: Frame, s0: number, s1: number, rIn: number, rOut: number, P: Projection, steps?: number): SolidPaths;
export function sphereOf(center: Point3, r: number, P: Projection, steps?: number): SolidPaths;
export function arcOf(
  F: Frame,
  s: number,
  r: number,
  P: Projection,
  options?: { slope?: number; inward?: boolean; least?: number; steps?: number; from?: number; to?: number },
): string;
export function circleOf(F: Frame, s: number, r: number, P: Projection, steps?: number): string;
export function dotsOf(
  F: Frame,
  s: number,
  r: number,
  count: number,
  P: Projection,
  options?: { phase?: number; slope?: number; least?: number; all?: boolean; fade?: [number, number] },
): Array<Flat | [number, number, number]>;
export function ribsOf(
  F: Frame,
  s0: number,
  s1: number,
  r0: number,
  r1: number,
  count: number,
  P: Projection,
  options?: { phase?: number; fade?: [number, number]; seams?: boolean; radius?: (s: number) => number },
): Array<{ d: string; alpha: number }>;
export function spokesOf(
  F: Frame,
  s: number,
  r0: number,
  r1: number,
  count: number,
  P: Projection,
  options?: { phase?: number; sweep?: number; from?: number; to?: number },
): string;
export function rodOut(
  F: Frame,
  from: number,
  to: number,
  r: number,
  stroke: number,
  P: Projection,
  steps?: number,
): { paths: SolidPaths; clip: string; from: number; to: number; stroke: number; reach: number };

export function fillet(
  points: Point3[],
  radius: number,
  perArc?: number,
  options?: { P?: Projection; tube?: number; margin?: number },
): Point3[];
export function resample(points: Point3[], spacing: number): Point3[];
export function pathLength(points: Point3[]): number;
export function cut(points: Point3[], from: number, to: number): Point3[];
export function pointAlong(points: Point3[], at: number): Point3;
export function tangentAlong(points: Point3[], at: number): Point3;
export function spiral(F: Frame, s: number, r0: number, r1: number, a0: number, a1: number, steps?: number): Point3[];
export function arcPoints(F: Frame, s: number, r: number, a0: number, a1: number, steps?: number): Point3[];
export function fadeOf(value: number, range: [number, number]): number;
export function facingOf(F: Frame, angle: number, P: Projection, slope?: number): number;
