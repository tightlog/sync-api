export type ConfusionCounts = {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  trueNegatives: number;
};

export type Rate = {
  value: number;
  low: number;
  high: number;
  n: number;
};

export type DetectionMetrics = {
  precision: Rate | null;
  recall: Rate | null;
  falsePositiveRate: Rate | null;
};

// z for a two-sided 95% interval.
const Z_95 = 1.959964;

/**
 * Wilson score interval. The normal approximation collapses to [1, 1] at
 * 20/20, which reads as certainty from a sample of twenty.
 */
export function wilsonRate(hits: number, n: number): Rate | null {
  if (n <= 0) {
    return null;
  }

  const p = hits / n;
  const z2 = Z_95 * Z_95;
  const denominator = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denominator;
  const margin =
    (Z_95 * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denominator;

  return {
    value: p,
    low: Math.max(0, centre - margin),
    high: Math.min(1, centre + margin),
    n,
  };
}

export function detectionMetrics(counts: ConfusionCounts): DetectionMetrics {
  const { truePositives, falsePositives, falseNegatives, trueNegatives } =
    counts;

  return {
    precision: wilsonRate(truePositives, truePositives + falsePositives),
    recall: wilsonRate(truePositives, truePositives + falseNegatives),
    falsePositiveRate: wilsonRate(
      falsePositives,
      falsePositives + trueNegatives,
    ),
  };
}

export function confusionOf(
  cases: readonly { expected: boolean; predicted: boolean }[],
): ConfusionCounts {
  const counts: ConfusionCounts = {
    truePositives: 0,
    falsePositives: 0,
    falseNegatives: 0,
    trueNegatives: 0,
  };
  for (const { expected, predicted } of cases) {
    if (expected && predicted) {
      counts.truePositives++;
    } else if (predicted) {
      counts.falsePositives++;
    } else if (expected) {
      counts.falseNegatives++;
    } else {
      counts.trueNegatives++;
    }
  }

  return counts;
}
