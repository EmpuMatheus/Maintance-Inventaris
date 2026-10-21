import type { MaintenanceDetail, MaintenancePart } from '../types';

/** Escape user text before it is placed into the printable HTML document. */
export function escHtml(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Rupiah formatting without relying on ICU, so printed output is stable. */
export function formatCurrency(value: string | number | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 'Rp 0';
  const rounded = Math.round(n);
  const digits = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${rounded < 0 ? '-' : ''}Rp ${digits}`;
}

export function formatDateId(value?: string | Date | null): string {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return String(value);
  }
}

const PRINT_STYLES = `
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px; background: #f1f5f9; font-family: 'Segoe UI', Arial, sans-serif; color: #111827; }
  .doc { max-width: 210mm; margin: 0 auto; background: #ffffff; padding: 22mm 16mm; }
  .header { text-align: center; border-bottom: 2px solid #1f2937; padding-bottom: 10px; margin-bottom: 18px; }
  .header h1 { margin: 0; font-size: 16pt; letter-spacing: 1px; }
  .header h2 { margin: 4px 0 0; font-size: 11pt; font-weight: normal; color: #374151; }
  .meta { margin-bottom: 14px; }
  .meta table { font-size: 10.5pt; }
  .meta td { padding: 2px 0; vertical-align: top; }
  .meta td.label { width: 150px; color: #374151; }
  .meta td.sep { width: 10px; }
  h4.section { margin: 18px 0 8px; font-size: 11pt; border-bottom: 1px solid #9ca3af; padding-bottom: 3px; }
  table.data { width: 100%; border-collapse: collapse; font-size: 10.5pt; }
  table.data th, table.data td { border: 1px solid #4b5563; padding: 6px 8px; vertical-align: top; text-align: left; }
  table.data th { background: #eef1f5; text-align: center; }
  table.data td.num { text-align: right; white-space: nowrap; }
  table.data td.center { text-align: center; }
  .empty { color: #6b7280; font-style: italic; padding: 10px 0; }
  .signatures { width: 100%; border-collapse: collapse; margin-top: 34px; }
  .signatures td { width: 50%; text-align: center; vertical-align: top; padding: 8px; }
  .sign-title { margin-bottom: 4px; }
  .sign-area { height: 64px; }
  .sign-name { font-weight: bold; border-top: 1px solid #4b5563; display: inline-block; padding-top: 3px; min-width: 160px; }
  @media print {
    body { background: #ffffff; padding: 0; }
    .doc { padding: 0; max-width: 100%; }
    h4.section { break-after: avoid; }
    table.data tr { break-inside: avoid; }
  }
`;

function documentShell(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>${escHtml(title)}</title>
<style>${PRINT_STYLES}</style>
</head>
<body>
<div class="doc">
${bodyHtml}
</div>
</body>
</html>`;
}

/**
 * Parts request document. Prints only the selected Parts Used rows, with the
 * quantity and prices exactly as stored (no manual entry, no recomputation).
 */
export function buildPartsRequestHtml(
  record: MaintenanceDetail,
  parts: MaintenancePart[],
  selectedIds: string[],
  requestedAt?: string,
): string {
  const selected = new Set(selectedIds);
  const rows = parts.filter((p) => selected.has(p.id));

  const bodyRows = rows.length
    ? rows
        .map(
          (p, i) => `
        <tr>
          <td class="center">${i + 1}</td>
          <td>${escHtml(p.partName)}</td>
          <td>${escHtml(p.partNumber) || '-'}</td>
          <td class="center">${escHtml(p.quantity)}</td>
          <td class="num">${escHtml(formatCurrency(p.unitPrice))}</td>
          <td class="num">${escHtml(formatCurrency(p.totalPrice))}</td>
        </tr>`,
        )
        .join('')
    : '<tr><td class="empty" colspan="6">Tidak ada part dipilih.</td></tr>';

  const body = `
    <div class="header">
      <h1>PERMINTAAN PART</h1>
      <h2>Maintenance ${escHtml(record.maintenanceCode)}</h2>
    </div>

    <div class="meta">
      <table>
        <tr><td class="label">Kode Maintenance</td><td class="sep">:</td><td>${escHtml(record.maintenanceCode)}</td></tr>
        <tr><td class="label">Aset</td><td class="sep">:</td><td>${escHtml(record.asset?.assetCode) || '-'} — ${escHtml(record.asset?.assetName) || '-'}</td></tr>
        <tr><td class="label">Teknisi</td><td class="sep">:</td><td>${escHtml(record.technician?.name) || '-'}</td></tr>
        <tr><td class="label">Tanggal Permintaan</td><td class="sep">:</td><td>${escHtml(formatDateId(requestedAt))}</td></tr>
      </table>
    </div>

    <h4 class="section">Daftar Part</h4>
    <table class="data">
      <thead>
        <tr>
          <th style="width:40px">No</th>
          <th>Nama Part</th>
          <th>No. Part</th>
          <th style="width:60px">Qty</th>
          <th style="width:120px">Harga Satuan</th>
          <th style="width:130px">Total</th>
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>

    <table class="signatures">
      <tr>
        <td><div class="sign-title">Diminta Oleh</div><div class="sign-area"></div><div class="sign-name">${escHtml(record.technician?.name) || '________________'}</div></td>
        <td><div class="sign-title">Disetujui Oleh</div><div class="sign-area"></div><div class="sign-name">________________</div></td>
      </tr>
    </table>`;

  return documentShell(`Permintaan Part ${record.maintenanceCode}`, body);
}

/** Open a printable document in a new window and trigger the browser print dialog. */
export function printHtmlDocument(html: string): void {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.onload = () => w.print();
}
