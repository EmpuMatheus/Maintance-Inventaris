export interface BeritaAcaraTransferLike {
  id?: string | null;
  reason?: string | null;
  notes?: string | null;
  status?: string | null;
  fromSiteName?: string | null;
  fromBuildingName?: string | null;
  fromFloorName?: string | null;
  fromRoomName?: string | null;
  toSiteName?: string | null;
  toBuildingName?: string | null;
  toFloorName?: string | null;
  toRoomName?: string | null;
  requestedAt?: string | Date | null;
  createdAt?: string | Date | null;
  completedAt?: string | Date | null;
}

export interface BeritaAcaraAssetLike {
  assetName?: string | null;
  assetCode?: string | null;
  specification?: string | null;
  subcategoryName?: string | null;
  subcategoryCode?: string | null;
}

export interface BeritaAcaraComponentLike {
  componentName?: string | null;
  model?: string | null;
  serialNumber?: string | null;
}

function escHtml(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDateId(d: string | Date | null | undefined): string {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return String(d);
  }
}

function fmtDayId(d: string | Date | null | undefined): string {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleDateString('id-ID', { weekday: 'long' });
  } catch {
    return '-';
  }
}

function clean(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v).trim();
  return s;
}

function locationLine(site?: string | null, building?: string | null, floor?: string | null, room?: string | null): string {
  const parts = [clean(site), clean(building), clean(floor), clean(room)].filter(Boolean);
  return parts.length ? parts.map(escHtml).join(' / ') : '-';
}

export function buildBeritaAcaraHtml(
  transfer: BeritaAcaraTransferLike | null | undefined,
  asset: BeritaAcaraAssetLike | null | undefined,
  components?: BeritaAcaraComponentLike[] | null,
): string {
  const at = transfer ?? {};
  const a = asset ?? {};

  const creationDate = at.requestedAt ?? at.createdAt ?? null;
  const nomor = clean(at.id) || '-';
  const tanggal = fmtDateId(creationDate);
  const hari = fmtDayId(creationDate);
  const tempat = 'PT. Bahana Bhumipala Persada';

  const lokasiAsal = locationLine(at.fromSiteName, at.fromBuildingName, at.fromFloorName, at.fromRoomName);
  const lokasiTujuan = locationLine(at.toSiteName, at.toBuildingName, at.toFloorName, at.toRoomName);

  const subkategori = a.subcategoryCode && a.subcategoryName
    ? `${escHtml(a.subcategoryCode)} - ${escHtml(a.subcategoryName)}`
    : escHtml(a.subcategoryName || '-');

  const componentList = (components ?? []).filter((c) => clean(c?.componentName));
  const componentTableHtml = componentList.length
    ? `
    <h4 class="section">Component Asset</h4>
    <table class="data">
      <thead>
        <tr>
          <th style="width:34px;">No</th>
          <th>Nama Component</th>
          <th>Model</th>
          <th style="width:72px;">Keterangan</th>
        </tr>
      </thead>
      <tbody>
        ${componentList.map((c, i) => `<tr>
          <td style="text-align:center;">${i + 1}</td>
          <td>${escHtml(c.componentName || '-')}</td>
          <td>${escHtml(c.model || '-')}</td>
          <td style="text-align:center;">1 Unit</td>
        </tr>`).join('')}
      </tbody>
    </table>`
    : '';

  const reason = clean(at.reason);

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Berita Acara Transfer Aset</title>
  <style>
    @page { size: A4; margin: 18mm 16mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: 'Times New Roman', 'Georgia', serif;
      color: #111827;
      font-size: 11.5pt;
      line-height: 1.5;
      background: #ffffff;
    }
    .doc { max-width: 760px; margin: 0 auto; padding: 24px 28px; }
    .header { text-align: center; border-bottom: 3px double #1f2937; padding-bottom: 10px; margin-bottom: 4px; }
    .header h1 { margin: 0; font-size: 17pt; letter-spacing: 1.5px; }
    .header h2 { margin: 2px 0 0; font-size: 14pt; letter-spacing: 1px; }
    .header h3 { margin: 6px 0 0; font-size: 12pt; font-weight: normal; }
    .meta { margin: 14px 0 18px; font-size: 11pt; }
    .meta table { border-collapse: collapse; }
    .meta td { padding: 1px 0; vertical-align: top; }
    .meta td.label { width: 92px; }
    .meta td.sep { width: 12px; }
    p.opening { margin: 0 0 14px; text-align: justify; }
    h4.section {
      font-size: 11.5pt;
      margin: 18px 0 8px;
      padding-bottom: 3px;
      border-bottom: 1.5px solid #1f2937;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    table.data { width: 100%; border-collapse: collapse; font-size: 10.5pt; }
    table.data th, table.data td {
      border: 1px solid #4b5563;
      padding: 6px 8px;
      vertical-align: top;
      text-align: left;
    }
    table.data th { background: #eef1f5; font-weight: bold; text-align: center; }
    table.locations td { width: 50%; }
    .loc-title { font-weight: bold; display: block; margin-bottom: 2px; }
    .component-list { margin: 4px 0 0; padding-left: 16px; font-size: 9.5pt; color: #374151; }
    .component-list li { margin: 0; }
    .reason-table td { width: 50%; }
    .statement { margin-top: 18px; text-align: justify; }
    .statement p { margin: 0 0 10px; }
    .signatures { width: 100%; border-collapse: collapse; margin-top: 30px; }
    .signatures td { width: 33.33%; text-align: center; vertical-align: top; padding: 8px; border: 1px solid #4b5563; }
    .sign-title { font-weight: bold; margin-bottom: 4px; }
    .sign-area { height: 68px; }
    .sign-line { margin-top: 2px; }
    .knowing { width: 100%; border-collapse: collapse; margin-top: 0; }
    .knowing td { width: 50%; text-align: center; vertical-align: top; padding: 8px; border: 1px solid #4b5563; }
    .knowing-title { font-weight: bold; margin: 12px 0 10px; }
    @media print {
      body { background: #ffffff; }
      .doc { padding: 0; max-width: 100%; }
      h4.section { break-after: avoid; }
      table.data tr, .signatures tr, .knowing tr { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="doc">
    <div class="header">
      <h1>BERITA ACARA</h1>
      <h2>TRANSFER ASET</h2>
      <h3>PT. BAHANA BHUMIPALA PERSADA</h3>
    </div>

    <div class="meta">
      <table>
        <tr><td class="label">Nomor</td><td class="sep">:</td><td>${escHtml(nomor)}</td></tr>
        <tr><td class="label">Tanggal</td><td class="sep">:</td><td>${escHtml(tanggal)}</td></tr>
        <tr><td class="label">Tempat</td><td class="sep">:</td><td>${escHtml(tempat)}</td></tr>
      </table>
    </div>

    <p class="opening">Pada hari ini, ${escHtml(hari)}, tanggal ${escHtml(tanggal)}, telah dilakukan transfer aset perusahaan dengan rincian sebagai berikut:</p>

    <h4 class="section">Lokasi Transfer</h4>
    <table class="data locations">
      <thead>
        <tr><th>Lokasi Asal</th><th>Lokasi Tujuan</th></tr>
      </thead>
      <tbody>
        <tr>
          <td><span class="loc-title">Lokasi Asal:</span>${lokasiAsal}</td>
          <td><span class="loc-title">Lokasi Tujuan:</span>${lokasiTujuan}</td>
        </tr>
      </tbody>
    </table>

    <h4 class="section">Daftar Inventaris yang Ditransfer</h4>
    <table class="data">
      <thead>
        <tr>
          <th style="width:34px;">No</th>
          <th>Nama Inventaris</th>
          <th>Spesifikasi</th>
          <th>Subkategori</th>
          <th style="width:72px;">Keterangan</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="text-align:center;">1</td>
          <td>${escHtml(a.assetName || '-')}</td>
          <td>${escHtml(a.specification || '-')}</td>
          <td>${subkategori}</td>
          <td style="text-align:center;">1 Unit</td>
        </tr>
      </tbody>
    </table>
${componentTableHtml}

    <h4 class="section">Tujuan / Reason</h4>
    <table class="data reason-table">
      <tbody>
        <tr>
          <td><strong>Tujuan / Reason</strong></td>
          <td>${reason ? escHtml(reason) : '-'}</td>
        </tr>
      </tbody>
    </table>

    <div class="statement">
      <p>Dengan ditandatanganinya berita acara ini, pihak yang menerima menyatakan bahwa seluruh aset tersebut telah diterima dan menjadi tanggung jawab penerima untuk digunakan, dijaga, serta dirawat sesuai dengan ketentuan perusahaan.</p>
      <p>Demikian Berita Acara Transfer Aset ini dibuat dengan sebenarnya agar dapat dipergunakan sebagaimana mestinya.</p>
    </div>

    <table class="signatures">
      <tbody>
        <tr>
          <td>
            <div class="sign-title">Yang Menyerahkan</div>
            <div class="sign-area"></div>
            <div class="sign-line">(________________)</div>
            <div class="sign-line">__________________</div>
          </td>
          <td>
            <div class="sign-title">Checker</div>
            <div class="sign-area"></div>
            <div class="sign-line">(________________)</div>
            <div class="sign-line">__________________</div>
          </td>
          <td>
            <div class="sign-title">Yang Menerima</div>
            <div class="sign-area"></div>
            <div class="sign-line">(________________)</div>
            <div class="sign-line">__________________</div>
          </td>
        </tr>
      </tbody>
    </table>

    <p class="knowing-title">Mengetahui</p>
    <table class="knowing">
      <tbody>
        <tr>
          <td>
            <div class="sign-title">HRD</div>
            <div class="sign-area"></div>
            <div class="sign-line">(________________)</div>
            <div class="sign-line">__________________</div>
          </td>
          <td>
            <div class="sign-title">Manager Supporting</div>
            <div class="sign-area"></div>
            <div class="sign-line">(________________)</div>
            <div class="sign-line">__________________</div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</body>
</html>`;
}
