export const recentDatasetsEmpty = {
  datasets: [],
};

export const recentDatasetsSample = {
  datasets: [
    {
      file_id: 'file-123',
      original_filename: 'macro_snapshot.csv',
      is_modified: false,
    },
  ],
};

export const rateLimitError = {
  detail: 'Rate limit exceeded. Please try again later.',
};

export const visualStylesResponse = {
  styles: ['Corporate', 'Dark'],
};

export const leadingIndicatorsResult = {
  status: 'success',
  queries_generated: ['consumer confidence index', 'retail sales growth'],
  trends_file: 'trends.csv',
  correlations_file: 'correlations.csv',
  top_results: [
    {
      indicator: 'consumer confidence index',
      correlation: 0.82,
    },
  ],
};
