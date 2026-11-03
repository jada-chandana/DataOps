
function getExpectedType(columnName) {
  const name = columnName.toLowerCase();

  if (name.includes("date")) return "date";

  if (name === "age" || name.endsWith("_age")) {
    return "integer";
  }

  if (name.includes("salary") || name.includes("amount")) {
    return "number";
  }

  if (name === "id" || name.endsWith("_id")) {
    return "string";
  }

  return "string";
}

function isMissingValue(value) {
  const v = String(value ?? "").trim().toLowerCase();

  return [
    "",
    "n/a",
    "na",
    "n.a.",
    "null",
    "none",
    "unknown",
    "not available",
  ].includes(v);
}

function isValidDate(value) {
  const v = String(value ?? "").trim();

  let year, month, day;
  let match;

  match = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (match) {
    [, year, month, day] = match;
  } else {
    match = v.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);

    if (!match) return false;

    const first = Number(match[1]);
    const second = Number(match[2]);

    if (first > 12) {
      day = first;
      month = second;
    } else {
      month = first;
      day = second;
    }

    year = match[3];
  }

  year = Number(year);
  month = Number(month);
  day = Number(day);

  if (
    !Number.isInteger(year) ||
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1
  ) {
    return false;
  }

  const daysInMonth = new Date(year, month, 0).getDate();

  return day <= daysInMonth;
}

function getActualType(value) {
  const v = String(value ?? "").trim();

  if (v === "") return "missing";

  if (/^-?\d+$/.test(v)) return "integer";

  if (/^-?(?:\d+\.\d+|\.\d+)$/.test(v)) {
    return "number";
  }

  if (isValidDate(v)) return "date";

  return "string";
}

function normalizeNumericValue(value, expectedType) {
  const v = String(value ?? "").trim();

  if (expectedType !== "number") return v;

  const currencyPattern =
    /^₹\s*-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/;

  if (currencyPattern.test(v)) {
    return v.replace(/₹/g, "").replace(/,/g, "").trim();
  }

  return v;
}

function isTypeCompatible(expected, actual) {
  if (actual === "missing") return true;

  if (expected === "string") return true;

  if (expected === "number") {
    return actual === "integer" || actual === "number";
  }

  if (expected === "integer") {
    return actual === "integer";
  }

  if (expected === "date") {
    return actual === "date";
  }

  return false;
}

export function profileCSVData(headers, rows, fileName = "uploaded.csv") {
  if (!headers || headers.length === 0) {
    throw new Error("CSV headers are missing");
  }

  if (!rows || rows.length === 0) {
    throw new Error("CSV file must contain at least one data row");
  }

  if (
    headers.some((h) => !String(h).trim()) ||
    new Set(headers).size !== headers.length
  ) {
    throw new Error("Headers must be non-empty and unique");
  }

  const columnCount = headers.length;
  const totalCells = rows.length * columnCount;

  let totalMissing = 0;
  let totalTypeIssues = 0;

  const columns = headers.map((name, index) => {
    const values = rows.map((row) =>
      String(row[index] ?? "").trim()
    );

    const nonMissing = values.filter(
      (value) => !isMissingValue(value)
    );

    const expectedType = getExpectedType(name);

    const invalidValues = nonMissing.filter((value) => {
      const normalizedValue = normalizeNumericValue(
        value,
        expectedType
      );

      return !isTypeCompatible(
        expectedType,
        getActualType(normalizedValue)
      );
    });

    const missingValues = values.filter(
      (value) => isMissingValue(value)
    ).length;

    const uniqueValues = new Set(nonMissing);

    const duplicateValues =
      nonMissing.length - uniqueValues.size;

    const typeIssues = invalidValues.length;

    totalMissing += missingValues;
    totalTypeIssues += typeIssues;

    return {
      column: name,
      detectedType: expectedType,
      missingValues,
      uniqueValues: uniqueValues.size,
      duplicateValues,
      typeIssues,
    };
  });

  // Detect duplicate rows
const seen = new Set();
let duplicateRows = 0;

for (const row of rows) {
  const key = JSON.stringify(
    row.map((value) => String(value ?? "").trim())
  );

  if (seen.has(key)) {
    duplicateRows++;
  } else {
    seen.add(key);
  }
}

  // Calculate completeness
  const completeness = Number(
    (((totalCells - totalMissing) / totalCells) * 100).toFixed(2)
  );

  // Initial quality rules
  const status =
    totalMissing === 0 &&
    duplicateRows === 0 &&
    totalTypeIssues === 0
      ? "PASS"
      : "FAIL";

  return {
    success: true,
    fileName,
    rowCount: rows.length,
    columnCount,
    totalCells,
    missingValues: totalMissing,
    duplicateRows,
    typeIssues: totalTypeIssues,
    completeness,
    status,
    columns,
  };
}
