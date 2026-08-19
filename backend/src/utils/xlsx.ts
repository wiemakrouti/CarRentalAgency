import ExcelJS from 'exceljs';

// Excel export builder — unlike toCsv (utils/csv.ts) this needs a real
// library: XLSX is a zip of XML parts, not something worth hand-rolling.
// exceljs lets us keep numbers/dates as native typed cells (so totals and
// date filters work directly in Excel) instead of formatted text.
type XlsxColumn<T> = {
  header: string;
  value: (row: T) => string | number | Date | null;
  width?: number;
  numFmt?: string;
};

export async function toXlsxBuffer<T>(
  sheetName: string,
  rows: T[],
  columns: XlsxColumn<T>[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = columns.map((c) => ({ header: c.header, width: c.width ?? 16 }));
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    const addedRow = sheet.addRow(columns.map((c) => c.value(row) ?? null));
    columns.forEach((c, i) => {
      if (c.numFmt) addedRow.getCell(i + 1).numFmt = c.numFmt;
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
