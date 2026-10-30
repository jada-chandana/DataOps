
const EMPTY_VALUES = new Set([
  "",
  "null",
  "undefined",
  "n/a",
  "na",
]);

export function isMissing(value) {
  return (
    value === null ||
    value === undefined ||
    EMPTY_VALUES.has(String(value).trim().toLowerCase())
  );
}

function normalizeNumber(value) {
  let text = String(value).trim();

  text = text.replace(/[₹$€£,]/g, "").trim();

  // Support accounting-style negative values: (1200)
  if (/^\(.*\)$/.test(text)) {
    text = `-${text.slice(1, -1)}`;
  }

  return text;
}

function isValidDate(value) {
  const text = String(value).trim();
  let match;

  // YYYY-MM-DD or YYYY/MM/DD
  match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);

  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const date = new Date(Date.UTC(year, month - 1, day));

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }

  // MM-DD-YYYY, MM/DD/YYYY, DD-MM-YYYY, DD/MM/YYYY
  match = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);

  if (match) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    const year = Number(match[3]);

    const candidates = [];

    // Interpret as MM-DD-YYYY.
    if (first >= 1 && first <= 12) {
      candidates.push({ month: first, day: second });
    }

    // Interpret as DD-MM-YYYY.
    if (second >= 1 && second <= 12) {
      candidates.push({ month: second, day: first });
    }

    return candidates.some(({ month, day }) => {
      const date = new Date(Date.UTC(year, month - 1, day));

      return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
      );
    });
  }

  return false;
}

export function detectValueType(value) {
  if (isMissing(value)) return "empty";

  const text = String(value).trim();
  const lower = text.toLowerCase();

  if (lower === "true" || lower === "false") {
    return "boolean";
  }

  if (isValidDate(text)) {
    return "date";
  }

  // Preserve leading-zero identifiers such as 00125.
  if (/^[+-]?0\d+$/.test(text)) {
    return "string";
  }

  const normalized = normalizeNumber(text);

  if (/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(normalized)) {
    return normalized.includes(".") ? "number" : "integer";
  }

  return "string";
}

export function inferColumnType(values) {
  const types = values
    .filter((value) => !isMissing(value))
    .map(detectValueType);

  if (types.length === 0) return "empty";

  const counts = {};

  for (const type of types) {
    counts[type] = (counts[type] || 0) + 1;
  }

  const integerCount = counts.integer || 0;
  const numberCount = counts.number || 0;
  const numericCount = integerCount + numberCount;

  if (numericCount === types.length) {
    return numberCount > 0 ? "number" : "integer";
  }

  if (counts.boolean === types.length) return "boolean";
  if (counts.date === types.length) return "date";

  const candidates = [
    { type: "boolean", count: counts.boolean || 0 },
    { type: "date", count: counts.date || 0 },
    { type: "integer", count: integerCount },
    { type: "number", count: numberCount },
  ].sort((a, b) => b.count - a.count);

  const best = candidates[0];

  if (best.count > types.length / 2) {
    if (best.type === "integer" || best.type === "number") {
      return "number";
    }

    return best.type;
  }

  return "string";
}

export function matchesExpectedType(value, expectedType) {
  if (isMissing(value)) return true;

  const actualType = detectValueType(value);

  if (expectedType === "number") {
    return actualType === "integer" || actualType === "number";
  }

  if (expectedType === "integer") {
    return actualType === "integer";
  }

  return actualType === expectedType;
}

console.log("DATE DETECTOR TEST:", {
  usDate: detectValueType("01-28-2025"),
  anotherUsDate: detectValueType("04-16-2026"),
  invalidDate: detectValueType("02-30-2025"),
});
