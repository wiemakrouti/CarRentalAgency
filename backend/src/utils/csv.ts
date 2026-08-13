// Small RFC 4180-ish CSV builder — no dependency needed for the one or two
// export endpoints this app has. Semicolon delimiter (not comma) because
// Excel in French locales (this agency's) treats ';' as the default CSV
// list separator; comma is reserved for decimals.
const DELIMITER = ';';

function escapeCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (text.includes(DELIMITER) || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv<T>(
  rows: T[],
  columns: { header: string; value: (row: T) => unknown }[],
): string {
  const headerLine = columns.map((c) => escapeCell(c.header)).join(DELIMITER);
  const lines = rows.map((row) => columns.map((c) => escapeCell(c.value(row))).join(DELIMITER));
  // Leading BOM so Excel detects UTF-8 and renders accented characters
  // (é, è, à…) correctly instead of mojibake.
  return '﻿' + [headerLine, ...lines].join('\r\n');
}
