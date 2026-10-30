
import {
  isMissing,
  inferColumnType,
  matchesExpectedType,
  detectValueType,
} from "../utils/typeDetection.js";

function normalizeForComparison(value) {
  return String(value ?? "").trim();
}

function parseNumericValue(value) {
  let text = String(value ?? "").trim();

  // Remove common currency symbols and grouping commas.
  text = text.replace(/[₹$€£,]/g, "");

  // Convert accounting-style negatives, e.g. (1200).
  if (/^\(.*\)$/.test(text)) {
    text = `-${text.slice(1, -1)}`;
  }

  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(text)) {
    return NaN;
  }

  return Number(text);
}

function getDuplicateRowNumbers(records) {
  const seen = new Set();
  const duplicates = [];

  records.forEach((row, index) => {
    const key = JSON.stringify(row);

    if (seen.has(key)) {
      duplicates.push(index + 2);
    } else {
      seen.add(key);
    }
  });

  return duplicates;
}

function findOutliers(values) {
  const numericEntries = values
    .map((value, index) => ({
      value,
      number: parseNumericValue(value),
      rowNumber: index + 2,
    }))
    .filter(
      (entry) => !isMissing(entry.value) && Number.isFinite(entry.number)
    );

  const sorted = numericEntries
    .map((entry) => entry.number)
    .sort((a, b) => a - b);

  if (sorted.length < 4) return [];

  function percentile(p) {
    const position = (sorted.length - 1) * p;
    const lower = Math.floor(position);
    const fraction = position - lower;

    return (
      sorted[lower] +
      (sorted[Math.min(lower + 1, sorted.length - 1)] -
        sorted[lower]) *
        fraction
    );
  }

  const q1 = percentile(0.25);
  const q3 = percentile(0.75);
  const iqr = q3 - q1;

  if (iqr === 0) return [];

  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  return numericEntries
    .filter(
      (entry) =>
        entry.number < lowerBound || entry.number > upperBound
    )
    .map(({ rowNumber, value }) => ({ rowNumber, value }));
}

function getDuplicateHeaders(headers) {
  const counts = new Map();

  for (const header of headers) {
    const normalized = String(header).trim().toLowerCase();
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }

  const seen = new Set();

  return headers.filter((header) => {
    const normalized = String(header).trim().toLowerCase();

    if (counts.get(normalized) <= 1 || seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);
    return true;
  });
}

export function validateDataset(headers, records) {
  const duplicateRows = getDuplicateRowNumbers(records);
  const duplicateHeaders = getDuplicateHeaders(headers);
  const columnResults = [];

  for (let columnIndex = 0; columnIndex < headers.length; columnIndex++) {
    const columnName = headers[columnIndex];
    const values = records.map((row) => row[columnIndex] ?? "");

    const missingRows = [];

    values.forEach((value, index) => {
      if (isMissing(value)) {
        missingRows.push(index + 2);
      }
    });

    const nonMissingValues = values.filter((value) => !isMissing(value));
    const inferredType = inferColumnType(values);

    const typeIssues = values
      .map((value, index) => ({
        value,
        rowNumber: index + 2,
      }))
      .filter(({ value }) => {
        if (isMissing(value) || inferredType === "empty") {
          return false;
        }

        return !matchesExpectedType(value, inferredType);
      })
      .map(({ value, rowNumber }) => ({
        rowNumber,
        value,
        detectedType: detectValueType(value),
        expectedType: inferredType,
      }));

    const normalizedValues = nonMissingValues.map(normalizeForComparison);
    const uniqueValues = new Set(normalizedValues);

    const frequency = new Map();

    for (const value of normalizedValues) {
      frequency.set(value, (frequency.get(value) || 0) + 1);
    }

    const duplicateValueCount = [...frequency.values()].reduce(
      (sum, count) => sum + Math.max(0, count - 1),
      0
    );

    const outliers =
      inferredType === "integer" || inferredType === "number"
        ? findOutliers(values)
        : [];

    columnResults.push({
      column: columnName,
      inferredType,
      totalValues: values.length,
      missingValues: missingRows.length,
      missingRows,
      uniqueValues: uniqueValues.size,
      duplicateValueCount,
      typeIssueCount: typeIssues.length,
      typeIssues,
      outlierCount: outliers.length,
      outliers,
    });
  }

  const totalMissingValues = columnResults.reduce(
    (sum, column) => sum + column.missingValues,
    0
  );

  const totalCells = headers.length * records.length;

  const completenessPercentage = totalCells
    ? Number(
        (((totalCells - totalMissingValues) / totalCells) * 100).toFixed(2)
      )
    : 100;

  return {
    success: true,
    rowCount: records.length,
    columnCount: headers.length,
    totalCells,
    totalMissingValues,
    duplicateRowCount: duplicateRows.length,
    duplicateRows,
    duplicateHeaders,
    completenessPercentage,
    columns: columnResults,
  };
}
