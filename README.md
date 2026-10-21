# Office Inventory Management System

Aplikasi manajemen inventaris, pemeliharaan, tiket, monitoring jaringan, CCTV, laporan, dan audit untuk operasional kantor.

## Kegunaan

Aplikasi menjadi sumber data tunggal aset kantor. Tim dapat mengetahui aset apa yang tersedia, lokasi, pengguna/PIC, kondisi, riwayat perpindahan, biaya perawatan, dan tindakan yang pernah dilakukan.

Tujuan utama:

- Mengurangi aset hilang atau tidak tercatat.
- Mempercepat pencarian aset melalui kode aset atau QR code.
- Menjadwalkan perawatan sebelum aset rusak.
- Mencatat gangguan dan perbaikan secara terukur.
- Membantu keputusan perbaikan atau penggantian aset melalui analitik.
- Menjaga akuntabilitas lewat role, permission, dan audit log.

## Fitur

| Modul | Fungsi |
|---|---|
| Dashboard | Ringkasan aset, kondisi, maintenance, tiket, aktivitas, dan indikator operasional. |
| Inventaris aset | Daftar aset, kategori, subkategori, merek, vendor, serial number, pembelian, garansi, foto, dan dokumen. |
| Lokasi dan penugasan | Kelola site, gedung, lantai, ruangan, departemen, PIC, peminjaman, pengembalian, dan transfer aset. |
| QR code | Generate QR untuk aset; cari aset melalui pemindaian kamera atau input manual. |
| Kondisi aset | Catat kondisi dan riwayat perubahan: `GOOD`, `FAIR`, `NEED_ATTENTION`, `BROKEN`, `CRITICAL`, `RETIRED`. |
| Preventive maintenance | Jadwal berkala, pengingat, daftar pekerjaan jatuh tempo, dan kalender maintenance. |
| Corrective maintenance | Alur perbaikan, penugasan teknisi, spare part, biaya, dokumen, pengujian, selesai, atau batal. |
| Ticketing | Lapor gangguan, prioritas, komentar, penugasan, dan penyelesaian tiket. |
| Monitoring jaringan | Pantau perangkat jaringan aktif dan perubahan status koneksi. |
| CCTV | Simpan perangkat/channel CCTV, test koneksi RTSP, sinkron channel, dan Monitor CCTV melalui gateway internal. |
| Notifikasi | Notifikasi aplikasi, jumlah belum dibaca, dan pembaruan operasional. |
| Laporan | Laporan inventaris, kondisi, maintenance, biaya, aset rusak, perpindahan, garansi, umur aset, serta export XLSX. |
| Analytics | Health score, deteksi kegagalan berulang, MTBF/MTTR, tren, dan rekomendasi perbaikan atau penggantian. |
| Administrasi | User, role, permission, master data, dan pengaturan sistem. |
| Audit log | Riwayat aksi penting: siapa melakukan apa, kapan, dan pada data mana. |
| Backup | Backup database PostgreSQL dan file upload dengan retensi otomatis. |

## Arsitektur singkat

```text
Browser
  │ HTTPS
  ▼
Reverse Proxy / API Node.js ── PostgreSQL
  │
  ├── React SPA
  ├── storage/uploads, logs, backups
  └── CCTV: RTSP → FFmpeg → MediaMTX → WebRTC/HLS → Browser
```

| Bagian | Teknologi |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS, TanStack Query |
| Backend | Node.js 20+, Express 5, TypeScript |
| Database | PostgreSQL 14+, Drizzle ORM |
| Keamanan | JWT, argon2id, role-based access control |
| Laporan | ExcelJS |
| CCTV | FFmpeg dan MediaMTX |
| Test | Vitest, ESLint, TypeScript |

## Prasyarat production

- Node.js 20+.
- npm 9+.
- PostgreSQL 14+.
- `pg_dump` tersedia pada `PATH` untuk backup database.
- Akses internet saat menjalankan `npm run fetch:gateway` bila fitur CCTV dipakai.
- Domain dan sertifikat HTTPS, atau reverse proxy IIS/Nginx/Apache.

> Jangan commit file `.env`, password database, `JWT_SECRET`, atau `CCTV_CREDENTIAL_KEY` ke GitHub.

## Instalasi production dari GitHub

Contoh root aplikasi: `C:\Apps\office-inventory` di Windows atau `/opt/office-inventory` di Linux.

### 1. Clone source dan instal dependensi

```bash
git clone <repository-url> office-inventory
cd office-inventory
npm ci
```

Gunakan `npm install` bila `package-lock.json` tidak tersedia atau dependensi sedang diperbarui.

### 2. Buat database PostgreSQL

Masuk ke PostgreSQL sebagai administrator lalu buat user dan database:

```sql
CREATE USER office WITH PASSWORD 'GANTI_PASSWORD_DATABASE_KUAT';
CREATE DATABASE office_inventory OWNER office;
```

### 3. Buat `.env` production

Salin contoh konfigurasi:

**Windows PowerShell**

```powershell
Copy-Item .env.example .env
```

**Linux**

```bash
cp .env.example .env
```

Edit `.env`. Nilai minimum production:

```env
NODE_ENV=production
APP_ENV=production
PORT=3000
DATABASE_URL=postgresql://office:GANTI_PASSWORD_DATABASE_KUAT@127.0.0.1:5432/office_inventory
JWT_SECRET=GANTI_DENGAN_RANDOM_SECRET_MINIMAL_32_KARAKTER
CORS_ORIGIN=https://inventory.example.com
BASE_URL=https://inventory.example.com
TRUST_PROXY=1
LOG_LEVEL=info
BACKUP_INTERVAL_MINUTES=1440
PROD_ADMIN_USERNAME=admin
PROD_ADMIN_PASSWORD=GANTI_PASSWORD_ADMIN_KUAT
VITE_API_URL=https://inventory.example.com/api/v1
```

Buat secret acak, contoh:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

`VITE_API_URL` harus sesuai URL publik API. Bila SPA dilayani API pada domain sama, gunakan `/api/v1`.

### 4. Siapkan runtime CCTV bila fitur CCTV dipakai

Binary `mediamtx` dan `ffmpeg` sengaja tidak disimpan di GitHub. Download di server production:

```bash
npm run fetch:gateway
```

Pastikan binary tersedia:

**Windows PowerShell**

```powershell
Test-Path apps/api/gateway/mediamtx.exe
Test-Path apps/api/gateway/ffmpeg.exe
```

Kedua perintah harus menghasilkan `True`.

**Linux**

```bash
test -x apps/api/gateway/mediamtx && echo MediaMTX-OK
test -x apps/api/gateway/ffmpeg && echo FFmpeg-OK
```

Tambahkan atau pastikan konfigurasi ini pada `.env`:

```env
CCTV_GATEWAY_ENABLED=true
CCTV_GATEWAY_MANAGED=true
CCTV_GATEWAY_INGEST_MODE=normalize
CCTV_RTSP_TIMEOUT_MS=8000
CCTV_RTSP_PROBE_DURATION_MS=2500
CCTV_LIVE_READY_TIMEOUT_MS=10000
```

Jika password CCTV sudah tersimpan di database, `CCTV_CREDENTIAL_KEY` harus memakai nilai lama yang sama. Mengganti nilainya membuat password CCTV lama tidak dapat didekripsi dan RTSP gagal autentikasi.

### 5. Migrasi database dan buat admin pertama

```bash
npm run db:migrate
npm run db:seed:prod
```

Admin dari `PROD_ADMIN_USERNAME` dan `PROD_ADMIN_PASSWORD` dibuat bila belum ada. Ganti password saat login pertama.

### 6. Build dan validasi

```bash
npm run build:prod
npm run check:prod
```

`check:prod` harus menampilkan artifact API, web, shared build, migration, dan metadata sebagai `[OK]`. Peringatan gateway berarti fitur Monitor CCTV belum siap.

### 7. Jalankan aplikasi

```bash
npm run start:prod
```

Cek kesehatan API dari server:

```bash
curl http://127.0.0.1:3000/api/v1/health/ready
```

Respons harus HTTP `200`.

Gunakan process manager agar API kembali berjalan setelah crash atau reboot:

- Windows: Task Scheduler, NSSM, atau PM2.
- Linux: systemd.

Contoh systemd Linux:

```ini
# /etc/systemd/system/office-inventory.service
[Unit]
Description=Office Inventory API
After=network.target postgresql.service

[Service]
WorkingDirectory=/opt/office-inventory
ExecStart=/usr/bin/npm run start:prod
Environment=NODE_ENV=production
Environment=APP_ENV=production
Restart=on-failure
User=office

[Install]
WantedBy=multi-user.target
```

Aktifkan:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now office-inventory
sudo systemctl status office-inventory
```

### 8. Pasang reverse proxy dan HTTPS

Reverse proxy melayani React SPA dari `apps/web/dist`, meneruskan `/api/v1` ke Node.js port `3000`, dan menangani HTTPS. Contoh siap pakai:

- Nginx: [`docs/proxy/nginx.conf.example`](docs/proxy/nginx.conf.example)
- Apache: [`docs/proxy/apache.conf.example`](docs/proxy/apache.conf.example)
- IIS: [`docs/proxy/iis.web.config.example`](docs/proxy/iis.web.config.example)

Jika memakai reverse proxy, gunakan:

```env
TRUST_PROXY=1
HTTPS_ENABLED=false
```

Jangan membuka port internal gateway CCTV ke internet. Default MediaMTX hanya untuk loopback:

```text
127.0.0.1:9997  Control API
127.0.0.1:8554  RTSP internal
127.0.0.1:8889  WebRTC internal
127.0.0.1:8888  HLS internal
```

## Deployment Windows desktop

Untuk distribusi aplikasi desktop Windows, buat release lengkap. Perintah ini melakukan build, mengunduh runtime CCTV, membuat launcher, dan merakit folder `release/`:

```powershell
npm run package:release
npm run check:prod
```

Opsional, buat installer dengan Inno Setup 6:

```powershell
npm run build:installer
```

Output installer ada di `dist-installer/`. Detail launcher: [`docs/LAUNCHER.md`](docs/LAUNCHER.md).

## Verifikasi setelah deploy

1. Buka URL aplikasi melalui HTTPS.
2. Login dengan admin production dan ganti password awal.
3. Buka Dashboard, Inventaris, dan satu laporan export XLSX.
4. Buat atau cek satu maintenance/ticket sesuai role.
5. Cek endpoint `GET /api/v1/health/ready` menghasilkan `200`.
6. Bila CCTV aktif, buka detail perangkat lalu jalankan **Test RTSP Connection**. Pastikan `Decoded Frames` lebih dari `0`.
7. Buka **Monitor CCTV** dan cek stream tampil.
8. Jalankan backup database dan uploads dari menu Backup. Pastikan file muncul di `storage/backups`.

## Troubleshooting CCTV

| Gejala | Pemeriksaan dan tindakan |
|---|---|
| `RTSP connection failed` | Jalankan **Test RTSP Connection** dari detail perangkat. Cek IP, port RTSP, username, password, channel, dan akses jaringan dari server API ke perangkat CCTV. |
| `Streaming gateway is unavailable` | Pastikan `mediamtx` ada di `apps/api/gateway/`, `CCTV_GATEWAY_ENABLED=true`, lalu restart API. |
| `The stream could not be opened` | Pastikan `ffmpeg` ada di `apps/api/gateway/`, Test RTSP berhasil, dan `CCTV_CREDENTIAL_KEY` sama dengan key saat password perangkat disimpan. |
| Gateway/FFmpeg tidak ada setelah clone GitHub | Jalankan `npm run fetch:gateway`; folder `apps/api/gateway/` memang masuk `.gitignore`. |
| Password CCTV gagal setelah pindah server | Gunakan `CCTV_CREDENTIAL_KEY` lama. Bila key lama hilang, masukkan ulang password setiap perangkat CCTV. |
| Monitor bekerja lokal tapi tidak dari LAN | Cek firewall, DNS/HTTPS, reverse proxy, dan `CORS_ORIGIN`. Untuk WebRTC, izinkan UDP port `CCTV_GATEWAY_MEDIA_UDP_PORT` bila browser mengakses dari LAN. |

Log production ada di `storage/logs` atau path `STORAGE_ROOT` yang dikonfigurasi.

## Update aplikasi

Sebelum update, backup database dan uploads.

```bash
git pull
npm ci
npm run fetch:gateway
npm run build:prod
npm run db:migrate
npm run check:prod
```

Restart service sesudah migrasi. Cek `/api/v1/health/ready`, login, dan fitur CCTV bila dipakai.

Untuk rollback, kembalikan source/release versi sebelumnya, restore database dari backup sebelum migrasi, lalu restart service. Panduan restore: [`docs/RESTORE.md`](docs/RESTORE.md).

## Backup

Data yang harus dibackup:

- Database PostgreSQL.
- `storage/uploads` untuk foto dan dokumen.
- File `.env` secara aman di lokasi terenkripsi, terutama `JWT_SECRET` dan `CCTV_CREDENTIAL_KEY`.

Atur backup terjadwal:

```env
BACKUP_INTERVAL_MINUTES=1440
BACKUP_DATABASE_RETENTION_DAYS=14
BACKUP_UPLOADS_RETENTION_DAYS=14
```

Panduan lengkap: [`docs/BACKUP.md`](docs/BACKUP.md).

## Pengembangan lokal

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

Frontend: `https://localhost:5173`.
API: `http://localhost:3000`.

## Perintah penting

| Perintah | Kegunaan |
|---|---|
| `npm run dev` | Jalankan frontend dan backend development. |
| `npm run db:migrate` | Terapkan migrasi database. |
| `npm run db:seed:prod` | Buat admin awal production. |
| `npm run fetch:gateway` | Download MediaMTX dan FFmpeg untuk CCTV. |
| `npm run build:prod` | Build frontend, backend, dan metadata production. |
| `npm run check:prod` | Validasi artifact sebelum rilis/deploy. |
| `npm run start:prod` | Jalankan backend production. |
| `npm run package:release` | Buat folder release Windows lengkap. |
| `npm run build:installer` | Buat installer Windows; butuh Inno Setup 6. |
| `npm run lint` | Jalankan ESLint. |
| `npm run typecheck` | Cek TypeScript. |
| `npm run test` | Jalankan test otomatis. |

## Dokumentasi lanjutan

- [Deployment](docs/DEPLOYMENT.md)
- [Environment variables](docs/ENVIRONMENT.md)
- [CCTV flow](docs/CCTV_FLOW.md)
- [Backup](docs/BACKUP.md)
- [Restore](docs/RESTORE.md)
- [Launcher](docs/LAUNCHER.md)
- [API](docs/API.md.txt)
- [Database](docs/DATABASE.md.txt)
- [Release checklist](docs/RELEASE_CHECKLIST.md)

## License

MIT. Lihat [LICENSE](LICENSE).
