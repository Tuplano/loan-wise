/**
 * Generates ascending "nice" round tick values covering [min, max] — steps snap to
 * 1/2/5 * 10^n (the same convention d3/most charting libraries use), so ticks read as
 * 0, 250, 500, 750, 1000 or 0, 2, 4, 6, 8 rather than awkward fractions of the raw range.
 * Always includes 0 when min <= 0 <= max, since balances never go negative.
 */
export function niceTicks(min: number, max: number, targetCount = 4): number[] {
  if (max <= min) max = min + 1;

  const rawStep = (max - min) / targetCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;
  const niceResidual = residual >= 5 ? 10 : residual >= 2 ? 5 : residual >= 1 ? 2 : 1;
  const step = niceResidual * magnitude;

  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const count = Math.round((niceMax - niceMin) / step);

  // Round off binary-float noise (e.g. 0.30000000000000004) at a precision tied to `step`
  // itself, not a fixed decimal count — a fixed 2dp rounding collapses distinct ticks into
  // duplicates whenever step is smaller than 0.01 (e.g. a near-fully-paid loan's balance range).
  const decimals = Math.max(-Math.floor(Math.log10(step)) + 6, 0);
  const roundTick = (value: number) => Math.round(value * 10 ** decimals) / 10 ** decimals;

  const ticks: number[] = [];
  for (let i = 0; i <= count; i++) {
    ticks.push(roundTick(niceMin + i * step));
  }
  return ticks;
}
