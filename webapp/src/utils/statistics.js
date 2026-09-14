/**
 * Statistical routines for biomedical microcirculation & myotonometer analysis.
 * Includes Student's paired t-test, one-way ANOVA with eta-squared,
 * Pearson r, and Spearman rank correlation rho.
 */

export function mean(arr) {
  const valid = arr.filter(v => typeof v === 'number' && !isNaN(v));
  if (valid.length === 0) return 0;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}

export function std(arr, ddof = 1) {
  const valid = arr.filter(v => typeof v === 'number' && !isNaN(v));
  if (valid.length <= ddof) return 0;
  const m = mean(valid);
  const variance = valid.reduce((sum, v) => sum + (v - m) ** 2, 0) / (valid.length - ddof);
  return Math.sqrt(variance);
}

export function sem(arr) {
  const valid = arr.filter(v => typeof v === 'number' && !isNaN(v));
  if (valid.length <= 1) return 0;
  return std(valid) / Math.sqrt(valid.length);
}

export function percentile(arr, p) {
  const valid = arr.filter(v => typeof v === 'number' && !isNaN(v)).slice().sort((a, b) => a - b);
  if (valid.length === 0) return 0;
  const index = (p / 100) * (valid.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return valid[lower] * (1 - weight) + valid[upper] * weight;
}

export function median(arr) {
  return percentile(arr, 50);
}

/**
 * Robust dwell estimator for microcirculation flux:
 * - 'p25': 25th percentile (suppresses upward probe motion artifacts)
 * - 'median': 50th percentile
 * - 'mean': standard arithmetic average
 */
export function calculateDwellValue(samples, method = 'p25') {
  if (!samples || samples.length === 0) return 0;
  if (method === 'p25') return percentile(samples, 25);
  if (method === 'median') return median(samples);
  return mean(samples);
}

/**
 * Standard Normal Cumulative Distribution Function (approx)
 */
function normalCdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - prob : prob;
}

/**
 * Student's t-distribution p-value approximation (two-tailed)
 */
export function tDistributionPValue(t, df) {
  if (isNaN(t) || df <= 0) return 1.0;
  const absT = Math.abs(t);
  // Approximation using Hill / Peizer normal approximation for t-distribution
  const a = df - 0.5;
  const b = 48 * a * a;
  const z = Math.sqrt(a * Math.log(1 + (absT * absT) / df));
  const pOneTail = normalCdf(z);
  return Math.min(1.0, Math.max(0.0, 2 * (1 - pOneTail)));
}

/**
 * Paired Student's t-test between two paired arrays
 */
export function pairedTTest(a, b) {
  const n = Math.min(a.length, b.length);
  const diffs = [];
  for (let i = 0; i < n; i++) {
    if (typeof a[i] === 'number' && typeof b[i] === 'number' && !isNaN(a[i]) && !isNaN(b[i])) {
      diffs.push(b[i] - a[i]);
    }
  }
  if (diffs.length < 2) {
    return { t: 0, df: 0, p: 1.0, meanDiff: 0, stdDiff: 0, significant: false };
  }

  const dMean = mean(diffs);
  const dStd = std(diffs, 1);
  const df = diffs.length - 1;
  const se = dStd / Math.sqrt(diffs.length);
  const t = se > 1e-12 ? dMean / se : 0;
  const p = tDistributionPValue(t, df);

  return {
    t: Number(t.toFixed(4)),
    df,
    p: Number(p.toFixed(5)),
    meanDiff: Number(dMean.toFixed(2)),
    stdDiff: Number(dStd.toFixed(2)),
    significant: p < 0.05,
    stars: p < 0.001 ? '***' : p < 0.01 ? '**' : p < 0.05 ? '*' : 'ns'
  };
}

/**
 * One-Way ANOVA across multiple numeric groups
 */
export function oneWayAnova(groups) {
  const validGroups = groups.map(g => g.filter(v => typeof v === 'number' && !isNaN(v))).filter(g => g.length > 1);
  const k = validGroups.length;
  if (k < 2) {
    return { f: 0, dfBetween: 0, dfWithin: 0, p: 1.0, etaSquared: 0, significant: false };
  }

  const allVals = validGroups.flat();
  const N = allVals.length;
  const grandMean = mean(allVals);

  let ssTotal = 0;
  for (const v of allVals) {
    ssTotal += (v - grandMean) ** 2;
  }

  let ssBetween = 0;
  let ssWithin = 0;
  for (const group of validGroups) {
    const gMean = mean(group);
    ssBetween += group.length * (gMean - grandMean) ** 2;
    for (const v of group) {
      ssWithin += (v - gMean) ** 2;
    }
  }

  const dfBetween = k - 1;
  const dfWithin = N - k;
  const msBetween = ssBetween / dfBetween;
  const msWithin = dfWithin > 0 ? ssWithin / dfWithin : 1e-12;

  const f = msWithin > 1e-12 ? msBetween / msWithin : 0;
  // F-test p-value approximation via F-to-Z transform
  const z = (Math.pow(f, 1/3) * (1 - 2 / (9 * dfWithin)) - (1 - 2 / (9 * dfBetween))) /
            Math.sqrt((2 / (9 * dfWithin)) * Math.pow(f, 2/3) + (2 / (9 * dfBetween)));
  const p = 1 - normalCdf(z);
  const etaSquared = ssTotal > 1e-12 ? ssBetween / ssTotal : 0;

  return {
    ssBetween: Number(ssBetween.toFixed(2)),
    ssWithin: Number(ssWithin.toFixed(2)),
    ssTotal: Number(ssTotal.toFixed(2)),
    dfBetween,
    dfWithin,
    msBetween: Number(msBetween.toFixed(2)),
    msWithin: Number(msWithin.toFixed(2)),
    f: Number(f.toFixed(4)),
    p: Number(Math.max(0, Math.min(1, p)).toFixed(5)),
    etaSquared: Number(etaSquared.toFixed(4)),
    significant: p < 0.05
  };
}

/**
 * Pearson Correlation Coefficient
 */
export function pearsonCorrelation(x, y) {
  const n = Math.min(x.length, y.length);
  const validPairs = [];
  for (let i = 0; i < n; i++) {
    if (!isNaN(x[i]) && !isNaN(y[i])) {
      validPairs.push([x[i], y[i]]);
    }
  }
  if (validPairs.length < 3) return 0;

  const xVals = validPairs.map(p => p[0]);
  const yVals = validPairs.map(p => p[1]);
  const mx = mean(xVals);
  const my = mean(yVals);

  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < validPairs.length; i++) {
    const diffX = xVals[i] - mx;
    const diffY = yVals[i] - my;
    num += diffX * diffY;
    dx += diffX ** 2;
    dy += diffY ** 2;
  }
  const denom = Math.sqrt(dx * dy);
  return denom > 1e-12 ? Number((num / denom).toFixed(3)) : 0;
}

/**
 * Spearman Rank Correlation
 */
export function spearmanCorrelation(x, y) {
  function rankArray(arr) {
    const sorted = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    const ranks = new Array(arr.length);
    let i = 0;
    while (i < sorted.length) {
      let j = i;
      while (j + 1 < sorted.length && sorted[j + 1].v === sorted[i].v) {
        j++;
      }
      const avgRank = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) {
        ranks[sorted[k].i] = avgRank;
      }
      i = j + 1;
    }
    return ranks;
  }
  return pearsonCorrelation(rankArray(x), rankArray(y));
}
