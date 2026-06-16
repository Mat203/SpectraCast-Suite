export const parseColumnsFromCsvFile = (
  file: File,
  onSuccess: (columns: string[]) => void,
  onError: (error?: unknown) => void,
  chunkSize = 64 * 1024,
): void => {
  const reader = new FileReader();
  reader.onload = () => {
    const text = typeof reader.result === 'string' ? reader.result : '';
    const firstLine = text.split(/\r?\n/)[0] ?? '';

    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < firstLine.length; i++) {
      const char = firstLine[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());

    const columns = result
      .map((field) => field.trim())
      .filter(Boolean);

    onSuccess(columns);
  };

  reader.onerror = (err) => {
    onError(err);
  };

  reader.readAsText(file.slice(0, chunkSize));
};
