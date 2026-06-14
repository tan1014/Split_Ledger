/**
 * Robust CSV parser that parses a raw CSV string.
 * Handles quoted cells with commas, empty lines, and spaces.
 */
export function parseCSV(rawText) {
  if (!rawText) return [];

  const lines = [];
  let currentLine = [];
  let currentCell = '';
  let inQuotes = false;

  // Normalize newlines to standard UNIX style
  const normalizedText = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < normalizedText.length; i++) {
    const char = normalizedText[i];
    const nextChar = normalizedText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Double quotes inside a quote mean a literal double quote
          currentCell += '"';
          i++; // Skip next quote
        } else {
          // End of quoted cell
          inQuotes = false;
        }
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentLine.push(currentCell.trim());
        currentCell = '';
      } else if (char === '\n') {
        currentLine.push(currentCell.trim());
        lines.push(currentLine);
        currentLine = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
  }

  // Push final cell and line if text didn't end with a newline
  if (currentCell || currentLine.length > 0) {
    currentLine.push(currentCell.trim());
    lines.push(currentLine);
  }

  // Filter out completely empty lines
  const cleanLines = lines.filter(line => line.length > 0 && line.some(cell => cell !== ''));
  if (cleanLines.length === 0) return [];

  // Parse header
  const headers = cleanLines[0].map(h => h.toLowerCase().replace(/[\s_-]+/g, ''));
  const dataRows = cleanLines.slice(1);

  // Map header indexes
  const headerMap = {
    title: headers.indexOf('title'),
    amount: headers.indexOf('amount'),
    currency: headers.indexOf('currency'),
    paidBy: headers.indexOf('paidby') !== -1 ? headers.indexOf('paidby') : headers.indexOf('paid_by'),
    expenseDate: headers.indexOf('expensedate') !== -1 ? headers.indexOf('expensedate') : headers.indexOf('expense_date'),
    splitType: headers.indexOf('splittype') !== -1 ? headers.indexOf('splittype') : headers.indexOf('split_type'),
    participants: headers.indexOf('participants')
  };

  const results = [];
  dataRows.forEach((row, idx) => {
    // If a row has fewer cells than headers, pad it
    const paddedRow = [...row];
    while (paddedRow.length < headers.length) {
      paddedRow.push('');
    }

    const getValue = (field) => {
      const colIdx = headerMap[field];
      return colIdx !== -1 && colIdx < paddedRow.length ? paddedRow[colIdx] : '';
    };

    results.push({
      rowNumber: idx + 2, // 1-based, and row 1 is the header
      title: getValue('title'),
      amount: getValue('amount'),
      currency: getValue('currency') || 'INR',
      paidBy: getValue('paidBy'),
      expenseDate: getValue('expenseDate'),
      splitType: getValue('splitType') || 'EQUAL',
      participants: getValue('participants'),
      rawRowData: row
    });
  });

  return results;
}
