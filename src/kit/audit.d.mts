import type { Plan, Point3, Projection } from './iso-kit';
import type { Frame, MeridianPoint } from './lathe.mjs';

export type { Frame, MeridianPoint };

export interface AuditShape {
  kind: string;
  name?: string;
  ground?: boolean;
  [key: string]: unknown;
}

export interface AuditItem {
  piece: string;
  ride?: string;
  at: Point3;
  bias?: number;
  svg: string;
  move?: Point3;
  shapes?: AuditShape[];
  name?: string;
  route?: string;
  chunk?: number;
  key?: number;
}

export interface AuditRecorder {
  P: Projection;
  order: string[];
  spring: Record<string, unknown>;
  items: AuditItem[];
  nameFor: (base: string) => string;
  put: (item: AuditItem) => AuditItem;
  route: (
    id: string,
    points: Point3[],
    radius: number | ((t: number) => number),
    meta?: Record<string, unknown>,
  ) => void;
  solid: (shape: AuditShape) => AuditShape;
}

export function recorder(
  P: Projection,
  options?: { order?: string[]; spring?: Record<string, unknown>; ground?: (shape: AuditShape) => boolean },
): AuditRecorder;
export function solid(F: Frame, profile: MeridianPoint[], meta?: Record<string, unknown>): AuditShape;
export function slab(plan: Plan, z: number, height: number, meta?: Record<string, unknown>, steps?: number): AuditShape;
export function cylinder(
  cx: number,
  cy: number,
  r: number,
  z: number,
  height: number,
  meta?: Record<string, unknown>,
): AuditShape;
export function disc(F: Frame, s0: number, s1: number, r: number, meta?: Record<string, unknown>): AuditShape;
export function ring(
  F: Frame,
  s0: number,
  s1: number,
  rIn: number,
  rOut: number,
  meta?: Record<string, unknown>,
): AuditShape;
export function box(min: Point3, max: Point3, meta?: Record<string, unknown>): AuditShape;
export function ball(at: Point3, r: number, meta?: Record<string, unknown>): AuditShape;
export function tube(points: Point3[], radius: number | ((t: number) => number), meta?: Record<string, unknown>): AuditShape;
export function slide(F: Frame, from: number, to: number, r: number, meta?: Record<string, unknown>): AuditShape;
export function settle(R: AuditRecorder, P?: Projection, options?: Record<string, unknown>): unknown;
export function audit(
  R: AuditRecorder,
  P?: Projection,
  options?: { allow?: unknown[]; crowd?: unknown[]; cover?: unknown[]; apart?: boolean },
): {
  clearance: unknown[];
  depth: { problems: unknown[]; missing: unknown[] };
  terminals: unknown[];
  folds: unknown[];
  supports: { loose: unknown[]; sunk: unknown[] };
  loose: unknown[];
  apart: unknown[];
  flight: unknown[];
  crowding: unknown[];
  self: unknown[];
  wobble: unknown[];
  seats: unknown[];
  cover: unknown[];
};
export function failures(result: ReturnType<typeof audit>): number;
export function report(result: ReturnType<typeof audit>): string;
