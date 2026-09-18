# Network Device Management UI - Final Report

Phase 1-6 Network Monitoring tidak diubah. Implementasi ini hanya menambahkan UI
management untuk entity Network Device yang sudah ada (Phase 2) dan reuse seluruh
komponen/design existing.

## 1. Ringkasan Implementasi

- Halaman baru `/network-devices` dengan list, search, filter (device type, status,
  room, active), pagination, empty state, dan tombol **Tambah Network Device**.
- Form tambah (`/network-devices/new`) dan edit (`/network-devices/:id/edit`)
  memakai React Hook Form + Zod, mengikuti validation backend Phase 2.
- Halaman detail (`/network-devices/:id`) menampilkan identitas, lokasi
  (Room/Site/Building/Floor), asset, dan seluruh field monitoring read-only.
- Activate/Deactivate via `PATCH /api/v1/network-devices/:id/status`, dengan
  confirmation dialog untuk deactivate.
- Sidebar diubah menjadi nested menu `Network` berisi `Network Monitoring` dan
  `Network Devices`.
- Tidak ada scheduler baru, tabel baru, entity baru, endpoint baru, tombol
  `Ping Now`, atau perubahan pada state machine / ICMP / runner / event bus /
  Socket.IO / incident. `assets.status` dan `assets.condition` tidak disentuh.

## 2. Route yang Ditambahkan

| Route | Permission | Halaman |
| --- | --- | --- |
| `/network-devices` | `network_device.read` | `NetworkDeviceListPage` |
| `/network-devices/new` | `network_device.manage` | `NetworkDeviceFormPage` (create) |
| `/network-devices/:id` | `network_device.read` | `NetworkDeviceDetailPage` |
| `/network-devices/:id/edit` | `network_device.manage` | `NetworkDeviceFormPage` (edit) |

Route lama `/network-monitoring` (Phase 1-6) tetap dengan permission
`network_device.read`.

## 3. Halaman/Component yang Dibuat

- `pages/NetworkDeviceListPage.tsx` - daftar, filter, pagination, action, empty state.
- `pages/NetworkDeviceFormPage.tsx` - wrapper create/edit + mutation + invalidation.
- `pages/NetworkDeviceDetailPage.tsx` - detail + monitoring read-only.
- `components/NetworkDeviceForm.tsx` - form (Device Information, Location, Asset).
- `components/NetworkDeviceFilters.tsx` - search + filter device type/status/room/active.
- `components/NetworkDeviceAssetSelect.tsx` - optional asset picker (search existing assets,
  mendukung pre-select saat edit).
- `components/ActiveStatusBadge.tsx` - badge `ACTIVE` / `INACTIVE`.
- `components/DeactivateDialog.tsx` - confirmation dialog deactivate.
- `utils/validation.ts` - schema + payload builder (hanya field editable).
- `utils/permissions.ts` - helper permission read/manage.

Komponen existing yang di-reuse: `ReportTable` (table + pagination + loading/error/empty),
`DeviceTypeBadge` dan `NetworkStatusBadge` (network-monitoring), `sonner` toast,
pola dialog dari `RetireDialog`/`DeleteDialog`, `useAuth().can`, `RequirePermission`.

## 4. API yang Digunakan (Existing Phase 2)

- `GET /api/v1/network-devices` (list + `page`, `limit`, `search`, `deviceType`, `status`, `roomId`, `isActive`)
- `GET /api/v1/network-devices/:id`
- `POST /api/v1/network-devices`
- `PUT /api/v1/network-devices/:id`
- `PATCH /api/v1/network-devices/:id/status`

Untuk lookups form/filter: `GET /master/rooms` dan `GET /assets` (existing).
Tidak ada endpoint baru yang dibuat.

## 5. File yang Diubah

- `apps/api/src/modules/network-devices/network-device.repository.ts`
  - Additive: expose `floorId/floorName`, `buildingId/buildingName`,
    `siteId/siteName` pada objek `room` (kolom sudah di-select sebelumnya, hanya
    belum di-map). Backward compatible, tidak menyentuh Network Monitoring.
- `apps/api/src/modules/network-devices/network-device.service.ts`
  - Fix kecil: optional field `hostname`, `macAddress`, `assetId` kini bisa
    dikosongkan (`null`) saat update (sebelumnya `undefined` sehingga tidak
    pernah ter-clear). Tidak mengubah state machine/monitoring.
- `apps/web/src/app/router/index.tsx` - tambah 4 route + lazy import.
- `apps/web/src/components/layout/AppLayout.tsx` - nested menu `Network`.

## 6. File yang Dibuat

Frontend (semua di `apps/web/src/features/network-devices/`):

- `api/network-devices.ts`
- `types/index.ts`
- `utils/validation.ts`, `utils/validation.test.ts`
- `utils/permissions.ts`, `utils/permissions.test.ts`
- `components/NetworkDeviceForm.tsx`
- `components/NetworkDeviceFilters.tsx`
- `components/NetworkDeviceAssetSelect.tsx`
- `components/ActiveStatusBadge.tsx`
- `components/DeactivateDialog.tsx`
- `pages/NetworkDeviceListPage.tsx`
- `pages/NetworkDeviceFormPage.tsx`
- `pages/NetworkDeviceDetailPage.tsx`

Backend test:

- `apps/api/tests/network-device-management.test.ts`

Laporan:

- `NETWORK_DEVICE_MANAGEMENT_REPORT.md`

## 7. Permission yang Digunakan

- `network_device.read` - list dan detail (route guard `RequirePermission`).
  Backend memakai `authorizeAny('network_device.read', 'network_device.manage')`.
- `network_device.manage` - create, edit, activate, deactivate. Tombol-tombol
  management hanya dirender jika `can('network_device.manage')`.
- Helper `canReadNetworkDevices` mengikuti aturan backend (`read` OR `manage`).

## 8. Validation

Frontend (`utils/validation.ts`) mirror schema backend:

- `name` wajib, max 150.
- `deviceType` wajib, enum `COMPUTER` | `SWITCH`.
- `ipAddress` wajib dan harus IPv4 valid (`z.string().ip({ version: 'v4' })`).
- `hostname` optional, max 150.
- `macAddress` optional, max 100.
- `roomId` wajib.
- `assetId` optional.

Error ditampilkan inline per-field dengan styling existing. Error API (mis.
409 IP conflict, 400 room/asset not found) ditampilkan via toast.

Field monitoring (`status`, `consecutiveFailures`, `lastPingAt`, `lastSuccessAt`,
`lastStatusChangeAt`, `offlineStartedAt`) tidak ada di form dan tidak pernah
dikirim oleh payload builder (diuji).

## 9. Testing

Frontend unit tests (Vitest):

- `validation.test.ts` (10 test): required fields, IPv4 invalid, optional fields,
  payload hanya berisi field editable, payload tidak pernah memuat monitoring
  fields, normalisasi blank ke `null`, trimming.
- `permissions.test.ts` (4 test): read via `read`/`manage`, deny tanpa permission,
  manage hanya via `manage`.

Backend test (`network-device-management.test.ts`, 8 test):

- create default `UNKNOWN` + `consecutiveFailures=0` dan mengabaikan monitoring
  fields yang dikirim client.
- detail mengekspos room site/building/floor.
- search & filter list (search/room/deviceType).
- update hanya mengubah field editable; monitoring state (`status`,
  `consecutive_failures`, `last_ping_at`, `offline_started_at`, `is_active`)
  tidak berubah.
- clear optional hostname/MAC/asset.
- activate & deactivate.
- conflict IP aktif (409) tapi memperbolehkan device inactive.
- create/update/activate/deactivate tidak mengubah `assets.status` /
  `assets.condition`.

Catatan: item UAT berbasis browser (mis. klik tombol, toast, redirect) tidak
memiliki test runner komponen di project (tidak ada jsdom/Testing Library), jadi
diverifikasi secara manual + lewat typecheck/build. Logic murni yang mendasari
perilaku tersebut (validation, payload, permission) diuji.

## 10. Hasil Typecheck

- `npm run typecheck` (shared + web + api): **PASS** (0 error).

## 11. Hasil Lint

- `npm run lint`: **0 error**, 224 warning. Seluruh warning adalah `no-explicit-any`
  dan satu `react-hooks/exhaustive-deps` yang sudah ada sebelumnya. Tidak ada
  warning baru dari file network-devices frontend.

## 12. Hasil Test

- `npm run test -w apps/web`: **3 files / 21 tests passed** (14 test baru
  network-devices + 7 test lama network-monitoring).
- `npm run test -w apps/api`: **43 files / 285 tests passed** (termasuk 8 test
  baru network-device-management).

## 13. Hasil Build

- `npm run build`: **PASS**
  - `packages/shared`: OK
  - `apps/web` (tsc + vite build): OK (chunk `NetworkDeviceListPage`,
    `NetworkDeviceFormPage`, dll terbentuk)
  - `apps/api` (`tsc --noEmit` + bundle `dist/server.cjs`): OK

## 14. UAT Flow (didukung)

1. `/network-devices` -> **Tambah Network Device**.
2. Isi Name `PC Produksi 01`, Type `COMPUTER`, IP PC nyata, pilih Room -> Save.
3. Device muncul di list sebagai `UNKNOWN` (default backend) tanpa mengirim field
   monitoring.
4. Runner 2 menit ICMP ping -> status berubah `ONLINE`/`OFFLINE` dan tampil di
   Network Monitoring.
5. Device `ACTIVE` -> **Nonaktifkan** -> konfirmasi -> `INACTIVE`.
6. Runner tidak memonitor device `INACTIVE`.

Tidak ada tombol `Ping Now`; monitoring tetap dijalankan backend runner.

## 15. Blocker/Issue

- Tidak ada blocker.
- Catatan kecil: schema Room/Asset picker mengambil data dari endpoint existing
  (`/master/rooms`, `/assets`). Bila jumlah asset sangat besar, picker asset
  memakai pencarian server-side (`search` + `limit 20`), sedangkan daftar Room
  memakai pola existing `listMaster` (limit 100), sama seperti halaman
  Network Monitoring yang sudah ada.
