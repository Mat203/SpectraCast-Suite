export type OutlierStrategyKey = 'clip_iqr' | 'mean' | 'median' | 'drop';

export const STRATEGY_DESCRIPTIONS: Record<OutlierStrategyKey, { title: string; math: string; when: string }> = {
  clip_iqr: {
    title: 'Soft Limits (IQR Clip)',
    math: 'Values that are far outside the usual range are brought back into a safe band, not removed.',
    when: 'Use this when the data is very skewed or has extreme spikes, and you still want to keep every row.',
  },
  mean: {
    title: 'Replace with Average',
    math: 'Outliers are replaced with the average value of the column.',
    when: 'Best when the data looks fairly balanced and you want a simple, stable fix.',
  },
  median: {
    title: 'Replace with Middle Value',
    math: 'Outliers are replaced with the middle value of the column (less sensitive to extremes).',
    when: 'Best when the data is a bit skewed and a few big spikes would distort the average.',
  },
  drop: {
    title: 'Remove Outlier Rows',
    math: 'Rows containing outliers are removed from the dataset.',
    when: 'Use this if you have plenty of data and prefer removing unusual points entirely.',
  },
};
