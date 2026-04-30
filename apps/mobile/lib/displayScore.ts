/**
 * Compatibility-score display transform — keep in sync with the canonical
 * implementation in `packages/matching/src/index.ts` (toDisplayScore /
 * toDisplayPercent). Duplicated here so the mobile bundle doesn't pull in
 * Node-side matching dependencies.
 */
export const DISPLAY_SCORE_FLOOR = 0.72;
export const DISPLAY_SCORE_CEILING = 0.96;
export const RAW_SCORE_FLOOR = 0.35;
export const RAW_SCORE_CEILING = 1.0;

export function toDisplayScore(raw: number | null | undefined): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return DISPLAY_SCORE_FLOOR;
  const clamped = Math.max(RAW_SCORE_FLOOR, Math.min(RAW_SCORE_CEILING, raw));
  const t = (clamped - RAW_SCORE_FLOOR) / (RAW_SCORE_CEILING - RAW_SCORE_FLOOR);
  return DISPLAY_SCORE_FLOOR + t * (DISPLAY_SCORE_CEILING - DISPLAY_SCORE_FLOOR);
}

export function toDisplayPercent(raw: number | null | undefined): number {
  return Math.round(toDisplayScore(raw) * 100);
}
