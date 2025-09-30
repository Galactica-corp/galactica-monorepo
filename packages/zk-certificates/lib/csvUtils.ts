// Helper function to encode holders list using pipe separator to avoid CSV comma issues
export function encodeHolders(holders: string[]): string {
  return holders.join('|');
}

// Helper function to decode holders list from pipe-separated string
export function decodeHolders(encoded: string): string[] {
  if (!encoded || encoded.trim() === '') return [];
  return encoded.split('|').filter(holder => holder.trim() !== '');
}

// Helper function to parse CSV line properly handling quoted fields
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

// Helper function to remove empty columns from CSV data
export function removeEmptyColumns(lines: string[]): string[] {
  if (lines.length === 0) return lines;

  // Parse all lines properly
  const parsedLines = lines.map(line => parseCsvLine(line));

  // Find the maximum number of columns across all lines
  const maxColumns = Math.max(...parsedLines.map(columns => columns.length));

  // Check which columns are empty across all lines
  const columnHasData = new Array(maxColumns).fill(false);

  for (const columns of parsedLines) {
    if (columns.every(col => col.trim() === '')) continue; // Skip lines where all columns are empty
    for (let i = 0; i < columns.length; i++) {
      if (columns[i].trim() !== '') {
        columnHasData[i] = true;
      }
    }
  }


  // Filter out empty columns
  return parsedLines.map(columns => {
    // Pad columns to maxColumns length if needed
    while (columns.length < maxColumns) {
      columns.push('');
    }
    return columns.filter((_, index) => columnHasData[index]).join(',');
  });
}
