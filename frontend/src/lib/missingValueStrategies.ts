export type MissingStrategyKey = '1' | '2' | '3' | '5' | '6' | '7';

export const MISSING_VALUES_DESCRIPTIONS: Record<
  MissingStrategyKey,
  { title: string; what: string; when: string }
> = {
  '1': {
    title: 'Linear Interpolation',
    what: 'Draws a straight line between two known points and fills the gaps in between.',
    when: 'Best for macro indicators (GDP, inflation) that move smoothly over time.',
  },
  '2': {
    title: 'Spline Interpolation',
    what: 'Uses smooth curves to fit the data and fill missing values.',
    when: 'Best for cyclical series where a straight line is too rough; watch for edge artifacts.',
  },
  '3': {
    title: 'Forward Fill',
    what: 'Copies the last known value forward until a new value appears.',
    when: 'Best for prices and FX rates where the value is assumed unchanged between updates.',
  },
  '5': {
    title: 'Seasonal Mean Fill',
    what: 'Fills with the average from the same season or period in past years.',
    when: 'Best for energy, agriculture, and other seasonal domains.',
  },
  '6': {
    title: 'KNN Imputer (Auto)',
    what: 'Finds similar rows using other columns and averages their values.',
    when: 'Best for multi-feature datasets where variables explain each other.',
  },
  '7': {
    title: 'Do Nothing',
    what: 'Leaves missing values as they are.',
    when: 'Use if your downstream model can handle NaNs directly.',
  },
};
