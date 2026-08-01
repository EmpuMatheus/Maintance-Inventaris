import ExcelJS from 'exceljs';

export interface ExcelColumn {
  header: string;
  key: string;
}

export interface ExcelRow {
  [key: string]: string | number | null | boolean | undefined;
}

export interface ExcelSummaryItem {
  label: string;
  value: string | number;
}

export interface ExcelFilterItem {
  label: string;
  value: string;
}

export interface ExcelSheet {
  name: string;
  columns: ExcelColumn[];
  rows: ExcelRow[];
}

export interface ExcelSpec {
  title: string;
  filters: ExcelFilterItem[];
  summary: ExcelSummaryItem[];
  sheets: ExcelSheet[];
}

function autoWidth(rows: ExcelRow[], columns: ExcelColumn[]): number[] {
  return columns.map((col) => {
    const header = col.header.length;
    const max = Math.max(
      header,
      ...rows.map((row) => {
        const v = row[col.key];
        return v == null ? 0 : String(v).length;
      }),
    );
    return Math.min(60, max + 2);
  });
}

/**
 * Generates a formatted XLSX buffer with a summary sheet and detail sheets
 * (bold headers, auto column widths, title, filters and generated date).
 */
export async function generateExcelBuffer(spec: ExcelSpec): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const summarySheet = workbook.addWorksheet('Summary');

  summarySheet.mergeCells('A1:B1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = spec.title;
  titleCell.font = { bold: true, size: 14 };
  summarySheet.getRow(1).height = 24;

  summarySheet.addRow([]);
  summarySheet.addRow(['Generated', new Date().toLocaleString('en-GB')]);

  if (spec.filters.length > 0) {
    summarySheet.addRow([]);
    summarySheet.addRow(['Filters', '']).font = { bold: true };
    for (const f of spec.filters) {
      summarySheet.addRow([f.label, f.value]);
    }
  }

  if (spec.summary.length > 0) {
    summarySheet.addRow([]);
    summarySheet.addRow(['Summary', '']).font = { bold: true };
    const headerRow = summarySheet.addRow(['Metric', 'Value']);
    headerRow.font = { bold: true };
    for (const s of spec.summary) {
      summarySheet.addRow([s.label, s.value]);
    }
  }

  summarySheet.getColumn(1).width = 30;
  summarySheet.getColumn(2).width = 30;

  for (const sheet of spec.sheets) {
    const ws = workbook.addWorksheet(sheet.name.slice(0, 31));
    ws.addRow(sheet.columns.map((c) => c.header)).font = { bold: true };
    for (const row of sheet.rows) {
      ws.addRow(sheet.columns.map((c) => row[c.key] ?? ''));
    }
    const widths = autoWidth(sheet.rows, sheet.columns);
    sheet.columns.forEach((_c, i) => {
      ws.getColumn(i + 1).width = widths[i];
    });
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
