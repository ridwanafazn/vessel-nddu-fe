# Vessel NDDU — Frontend

Frontend **Navigational Data Display Unit (NDDU)** untuk simulator sensor kapal.
Aplikasi React + Vite (opsional desktop Tauri) yang mengonsumsi backend Rust
(Actix-web) milik **vessel-nddu**.

> **Kredit**
> - UI/UX & komponen awal: **Crystal ITENAS** dan **Rully UPI Cibiru**.
> - Backend Rust, kontrak API/WebSocket, serta refaktor & integrasi frontend ini:
>   **Ridwan Afazn** (magang di **PT LEN Industri**).
> - Repositori ini adalah hasil refactor untuk kebutuhan integrasi, bukan klaim
>   atas karya pihak lain.

---

## 🔗 Tautan

| Item | URL |
|---|---|
| Backend live | https://vessel-nddu.onrender.com |
| Health | https://vessel-nddu.onrender.com/health |
| Swagger | https://vessel-nddu.onrender.com/swagger-ui/ |
| OpenAPI | https://vessel-nddu.onrender.com/api-docs/openapi.json |
| WebSocket | wss://vessel-nddu.onrender.com/ws |
| Frontend live | _(isi setelah deploy Cloudflare Pages)_ |

Login demo: **admin / admin** (hardcoded di backend, belum ada JWT).

---

## ✨ Fitur

- 6 halaman: Login, GPS, Gyroscope, Weather, Speed & Depth, Magnetic Compass.
- **WebSocket realtime** (`gps_update`, `gyro_update`, `weather_update`,
  `compass_update`, `speed_update`, `depth_update`) + **polling fallback**
  berbasis recursive `setTimeout` (tidak menumpuk request).
- **Cold start handling**: banner “Menghubungkan ke server…”, timeout 90 detik,
  retry otomatis untuk GET, tombol coba lagi.
- **Empty state 404**: tombol *Create* state per halaman.
- **409**: pesan jelas (config belum lengkap / instance sudah ada).
- Konfigurasi MQTT via modal (IP, port, username, password, topics, update rate).
  Default cloud: `127.0.0.1:1883`, **`tcp_enabled: false`** (tidak spam MQTT/TCP).
- Dark/Light mode, notifikasi toast, dialog konfirmasi.
- Responsive (desktop & mobile web).

---

## 🧱 Stack

- React 19 + Vite 7
- Axios (timeout 90s, error normalization)
- Tauri 2 (desktop shell, tidak di-deploy ke web)
- Cloudflare Pages (deploy web)
- WebSocket API native browser

---

## 📁 Struktur penting

```
src/
├── api/
│   ├── client.js       # axios instance, baseURL env, retry GET, ApiError
│   ├── endpoints.js    # fungsi per domain + mapping config FE <-> BE
│   └── ws.js           # WebSocket singleton + reconnect backoff
├── hooks/
│   ├── usePolling.js       # recursive setTimeout, pause saat tab hidden
│   ├── useRealtime.js      # subscribe pesan WS per tipe
│   └── useBackendHealth.js # ping /health, status cold start/offline
├── components/
│   ├── LOGIN/ GPS/ GYRO/ WEATHER/ SPEED&DEPTH/ COMPASS/
│   └── web-logic/          # ConnectionBanner, EmptyState, ConfigPopup, dll.
└── App.jsx                 # navigasi berbasis state (tanpa router)
```

---

## ⚙️ Environment

| Variabel | Dev | Production |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8080` | `https://vessel-nddu.onrender.com` |
| `VITE_WS_URL` | `ws://localhost:8081/ws` | `wss://vessel-nddu.onrender.com/ws` |

- `.env.development.local` → dipakai `npm run dev` (tidak di-commit).
- `.env.production` → dipakai `npm run build` (aman di-commit, tanpa secret).
- `.env.example` → dokumentasi.

> Catatan: WebSocket backend berjalan di port internal `8081`, diproxy nginx
> container ke path `/ws` pada port publik. Jangan memakai `:8081` di production.

---

## 🚀 Menjalankan

```bash
npm install
npm run dev        # http://localhost:1420
npm run build      # output dist/
npm run preview    # cek hasil build
npm run tauri dev  # opsional desktop
```

---

## ☁️ Deploy Cloudflare Pages (CLI)

```bash
npx wrangler login
npm run deploy
# sama dengan:
# npm run build && wrangler pages deploy dist --project-name vessel-nddu-fe --branch main
```

Konfigurasi ada di `wrangler.toml` (`pages_build_output_dir = "dist"`).
SPA fallback: `public/_redirects` (`/* /index.html 200`).

Set env produksi di dashboard Cloudflare Pages (atau andalkan `.env.production`):

```
VITE_API_URL=https://vessel-nddu.onrender.com
VITE_WS_URL=wss://vessel-nddu.onrender.com/ws
```

Tauri **tidak** di-deploy ke web. Untuk desktop: `npm run tauri build`.

---

## 🔌 Kontrak API yang dipakai

Semua response (kecuali auth) berbentuk `{ "message": string, "data": object }`.

| Domain | Data | Config |
|---|---|---|
| GPS | `GET/POST/PATCH/DELETE /api/gps` | `/api/gps/config` |
| Gyro | `/api/gyro` | `/api/gyro/config` |
| Weather | `/api/weather` | `/api/weather/config` |
| Compass | `/api/compass` | `/api/compass/config` |
| Speed | `/api/speed` | — |
| Depth | `/api/depth` | — |
| Speed & Depth config | — | `/api/navigation/config` |
| MQTT global | — | `GET/PATCH /api/mqtt/config` |
| Health | `GET /health` | — |

**GPS penting:**

- `GET /api/gps` → **NMEA text/plain** (`$GPRMC,...`).
- `GET /api/gps?format=json` → `{ message, data: {...} }`.
- Frontend **selalu** memakai `?format=json` untuk data; NMEA tersedia lewat
  `gpsApi.getNmea()` bila dibutuhkan.

**Status:** `404` = state belum dibuat, `409` = config belum lengkap/instance
sudah ada, `401` = login gagal, `400` = config compass belum lengkap.

**WebSocket:**

```jsonc
{ "type": "gps_update", "json": { ... }, "gprmc": "...", "gpgll": "...", "gpvtg": "...", "gpzda": "..." }
{ "type": "gyro_update", "data": { ... } }
{ "type": "weather_update", "data": { ... } }
{ "type": "compass_update", "data": { ... } }
{ "type": "speed_update", "data": { ... } }
{ "type": "depth_update", "data": { ... } }
```

Backend hanya broadcast saat `is_running = true`. Karena itu frontend tetap
melakukan HTTP initial load dan polling fallback.

---

## ✅ Verifikasi (bukti)

Diuji terhadap backend live pada **1 Nov 2026**:

| Uji | Hasil |
|---|---|
| `GET /health` | 200, `mqtt_connected: true` |
| Login admin/admin | 200 `success:true` |
| Login password salah | 401 |
| GPS config + create + default + start | 200/201, data tampil |
| GPS `?format=json` vs NMEA | JSON 200, `text/plain` `$GPRMC,...` |
| WebSocket `wss://.../ws` | handshake **101**, menerima `gps_update` |
| Gyro / Weather / Compass / Speed / Depth | create 201, patch 200, delete 200 |
| 404 state belum dibuat | tampil EmptyState + tombol Create |
| 409 instance ganda | pesan `instance already exists` |
| Cold start | banner muncul saat request pending, retry tersedia |

---

## ⚠️ Keterbatasan

- **Render free**: cold start ±60 detik setelah 15 menit idle; request pertama
  bisa lambat (timeout frontend 90 detik).
- **State in-memory**: restart/redeploy backend menghapus semua config & state.
- **Auth demo**: belum ada JWT/token; login hanya hardcoded `admin/admin`.
- **TCP/MQTT publish tidak diaktifkan dari frontend** (`tcp_enabled: false`).
- **Compass** memakai `last_update` berupa string lokal, bukan RFC3339.
- **Config compass kosong** mengembalikan `data: null` (sudah ditangani).
- Dashboard masih placeholder.
- Screenshot UI belum disertakan di repo; silakan tambahkan setelah deploy.

---

## 📜 Lisensi & atribusi

Kode UI awal milik Crystal ITENAS & Rully UPI Cibiru. Refactor integrasi dan
backend Rust oleh Ridwan Afazn. Gunakan dengan mencantumkan atribusi tersebut.
