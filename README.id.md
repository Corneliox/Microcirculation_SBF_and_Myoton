# 🔬 Platform Analisis Mikrosirkulasi (SBF) & Myotonometer

🌐 **Bahasa:** [English](README.md) | **Bahasa Indonesia**

[![Build Status](https://github.com/Corneliox/06_Microcirculation_SBF_and_Myoton/actions/workflows/build-exe.yml/badge.svg)](https://github.com/Corneliox/06_Microcirculation_SBF_and_Myoton/actions/workflows/build-exe.yml)
[![Python Version](https://img.shields.io/badge/Python-3.10%20%7C%203.11%20%7C%203.12-blue)](https://www.python.org/)
[![UI Framework](https://img.shields.io/badge/Desktop%20%26%20Web-React%2019%20%7C%20Electron-indigo)](https://react.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Platform pemrosesan sinyal biomedis dan analitik biomekanika berperforma tinggi untuk menganalisis dinamika mikrosirkulasi **Skin Blood Flow (SBF)** dan **kekakuan jaringan (*tissue stiffness*)** melalui protokol klinis multimodal terintegrasi.

---

## 📌 Ringkasan & Konteks Penelitian

Aplikasi riset ini mengintegrasikan pengukuran mikrosirkulasi optik dengan diagnostik mekanis jaringan:

1. **Laser-Doppler Skin Blood Flow (SBF):** Pencatatan fluks perfusi kontinu berfrekuensi ~40 Hz (25 ms per sampel) untuk memantau vasodilatasi dan vasomotion mikrovaskular kulit akibat stimulasi getaran akustik (30 Hz, 50 Hz, 100 Hz).
2. **Biomekanika Jaringan Plantar Myotonometer:** Penilaian spasial grid 9 titik terhadap sifat mekanis dermal dan fasia plantar (Kekakuan Dinamis $S$, Frekuensi Osilasi $F$ [Hz], dan Dekremen Logaritmik $D$) pada koordinat anatomis telapak kaki.
3. **Konkordansi & Uji Statistik:** Analisis korelasi Spearman rank ($\rho$) dan Pearson linear ($r$), Repeated-Measures ANOVA ($F$, $p$, $\eta^2$), serta Paired Student's t-test dengan bracket signifikansi publikasi (`*`, `**`, `***`, `ns`).

---


---

## 🚀 Pembaruan Utama Versi 3.0.0 (v3.0.0)

Versi 3.0.0 menghadirkan perombakan arsitektur besar yang berfokus pada alur kerja klinis multi-subjek, pemodelan permukaan 3D berstandar publikasi, diagnosis format otomatis, dan ekspor bundel massal:

* **👥 Sesi Multi-Subjek & Unggah Massal (Bulk Ingestion):**
  * Mengelola banyak subjek klinis secara simultan dalam satu sesi tanpa pembagian kaki virtual buatan.
  * Unggah berkas tunggal via `[+ Add Participant]` atau banyak berkas sekaligus via `[Bulk Upload (.xlsx)]` dan fitur Drag-and-Drop.
  * Tombol hapus subjek individual untuk mengisolasi berkas rusak atau rekaman ganda.

* **📑 Antarmuka Akordion Bergaya iLovePDF:**
  * Tampilan kartu horizontal yang rapi dan ringkas untuk seluruh partisipan.
  * Kartu dropdown yang dapat diperluas untuk memeriksa protokol klinis (Protokol 1 s.d. 6), kartu metrik, peta panas, dan plot permukaan 3D.

* **🛡️ Validasi Format Real-Time & Taksonomi Diagnostik:**
  * Badge indikator status interaktif pada setiap kartu subjek:
    * `🟢 Standard Format Verified` (`PERFECT_MATCH`): 6 protokol utuh, 9 titik triplikat lengkap.
    * `🟡 Format Warning` (`INCOMPLETE_DATA`, `LEGACY_FORMAT`): Protokol parsial atau format tabel lama.
    * `🔴 Invalid / Corrupted Format` (`FORMULA_ERRORS`, `MISSING_PROTOCOLS`, `EMPTY_OR_UNREADABLE`): Kesalahan rumus Excel (`#VALUE!`), header hilang, atau file kosong.
    * `⚪ Unknown Format Issue` (`UNKNOWN_STRUCTURE`): Struktur data tidak dikenali.
  * Badge dapat diklik untuk membuka modal rincian masalah dan rekomendasi perbaikan.

* **⚖️ Estimator Triplikat: Arithmetic Mean vs. Median:**
  * Beralih instan antara **Mean (Average)** dan **Median (Nilai Tengah: $n > \min \ \& \ n < \max$)**.
  * Rekalkulasi dinamis pada nilai baseline, post-stimulus, delta, dan kepatuhan jaringan dengan sorotan visual `(Mid: X)`.

* **🏔️ Visualisator Permukaan 3D Kualitas Publikasi:**
  * Arsitektur Dual-Engine: Rendering Matplotlib 150-DPI asli (via IPC Python) dan kanvas matematis 3D di browser.
  * Mereplikasi spesifikasi visual acuan (`isolated_FLIR0207_m2_3_3d_surface.png`): Elevasi $28^\circ$, Azimut $-55^\circ$, kotak proyeksi 3D dengan dinding abu-abu, palet Viridis, kontur dasar 10-level, panah vektor gradien biru (`#0055ff`), dan 9 titik kompas merah (P1-P9).
  * Tombol unduh 1-klik `[Save 3D PNG]`.

* **📦 Ekspor Bundel Lengkap (.ZIP):**
  * `[📦 Export All (.ZIP: Excel + 3D PNGs)]`: Mengemas berkas Excel `FormatOutput.xlsx` (3 blok: Max, Min, Mean, Median, Gradient, Direction Modus hingga 15 subjek) DAN seluruh gambar PNG 3D Surface (Before & After) ke dalam satu file arsip `.zip`.
  * `[📊 Excel Only]` untuk ekspor cepat spreadsheet angka.

* **🌐 Standarisasi Bahasa Inggris & Penghilangan Satuan N/m:**
  * Antarmuka sepenuhnya menggunakan Bahasa Inggris standar riset medis.
  * Satuan `N/m` dihilangkan menyeluruh sesuai standar kekakuan dinamis tanpa satuan.

## ✨ Fitur & Kapabilitas Utama

### 🦶 Protokol B: Grid Multimodal Spasial Plantar (Fokus Aplikasi Utama)
* **Aplikasi Web & Desktop Interaktif (`webapp/`):** Berbasis React 19 + Vite dan desktop wrapper Electron.
* **Orientasi Grid Kompas 9 Titik ("Urutan Ular"):**
  1. **Barat Laut (NW)**: [Baris 1, Kolom 1] — Forefoot Anterolateral
  2. **Utara (N)**: [Baris 1, Kolom 2] — Bantalan Metatarsal Anterior
  3. **Timur Laut (NE)**: [Baris 1, Kolom 3] — Hallux / Forefoot Medial
  4. **Barat (W)**: [Baris 2, Kolom 1] — Lengkung Midfoot Lateral
  5. **Tengah (C)**: [Baris 2, Kolom 2] — Inti Plantar / Aponeurosis Pusat
  6. **Timur (E)**: [Baris 2, Kolom 3] — Lengkung Midfoot Medial
  7. **Barat Daya (SW)**: [Baris 3, Kolom 1] — Tumit Posterolateral
  8. **Selatan (S)**: [Baris 3, Kolom 2] — Tumit Posterior Pusat
  9. **Tenggara (SE)**: [Baris 3, Kolom 3] — Tumit Posteromedial
* **Konfigurasi Laju Sampling & Jendela Dwell:**
  * Laju sampling default: **40 Hz** (1 data = 0.025 detik / 25 ms).
  * Pemisahan jendela dwell dapat dikonfigurasi (default ~7.41 detik per titik dari 2.670 sampel).
* **Dual Peta Panas Spasial 3×3:** Visualisasi berdampingan $\Delta\text{Flux}$ (PU) vs $\Delta\text{Stiffness}$.
* **Fleksibilitas Subjek:**
  * **Single Subjek:** Analisis per individu secara mendalam.
  * **Multi-Subjek / Group Pooled (`🌐 Semua Subjek Bersamaan`):** Menggabungkan dan merata-ratakan seluruh subjek secara simultan untuk analisis kelompok.
* **Tab Analisis Mandiri / Terpisah (v2.4.0):**
  * **Tab Mandiri SBF:** Analisis sinyal Laser-Doppler saja (9 kinetika dwell, perubahan vasodilatasi %) tanpa memerlukan data Myoton.
  * **Tab Mandiri Myoton:** Analisis biomekanika jaringan saja (grid 3×3, kekakuan dinamis $S$, $T_1$, $M_1$) tanpa memerlukan data SBF.
* **Dukungan Format Baru Multi-Protokol & Triplikat (v2.5.0 - v3.0.0):**
  * Mendukung otomatis format baru `KYLE OCT.xlsx` / `NewFormat.xlsx` (*OCT Foot Measurement Record*).
  * Mengekstrak 6 protokol klinis (1 Hz, 50 Hz • Intensitas 30%, 50%, 80% • Kaki Kiri vs Kaki Kanan).
  * Mengagregasi pengukuran triplikat ($E_1, E_2, E_3$ Sebelum dan Sesudah) dengan metrik $\text{Mean} \pm \text{SD}$, perubahan kekakuan $\Delta S$, dan reliabilitas CV%.
* **Installer Desktop Mandiri 1-Klik & Template Resmi (v3.0.0):**
  * **Satu Installer Windows Desktop:** Installer mandiri NSIS (`Microcirculation & Myoton Suite Setup 3.0.0.exe`) yang memaketkan antarmuka Electron dan backend analitik Python bawaan (`analyzer.exe`) tanpa perlu instalasi Python terpisah.
  * **Template Resmi Kosong (`NewFormat.xlsx`):** Unduhan langsung template kosong standar siap isi di seluruh menu aplikasi.
* **Berkas Otomasi Pengujian 1-Klik (.bat):**
  * `test_kyle_dataset.bat`: Uji otomatis Python & Node.js untuk `KYLE OCT.xlsx` dengan tampilan tabel ringkasan 6 protokol lengkap di konsol.
  * `run_desktop_app.bat`: Peluncur 1-klik aplikasi GUI interaktif.
  * `run_all_tests.bat`: Rangkaian pengujian regresi menyeluruh.
* **IPC Python Backend Super Cepat (<1 detik):** Evaluasi memori langsung lewat stream JSON menghindari pembacaan ulang file Excel besar dari disk.
* **Estimator Jendela Dwell:** Pilihan P25 (persentil ke-25, tahan terhadap spike pergerakan probe), Median (P50), atau Mean aritmatika.

### 📊 Statistik Publikasi (ANOVA & Paired t-test)
* **Grafik Standar Publikasi Ilmiah:** Replikasi diagram batang ilmiah (Baseline vs Post-Stimulasi lintas frekuensi atau Upper Limb vs Lower Limb).
* **Bilah Kesalahan Mean ± SD:** Dilengkapi bracket signifikansi otomatis.
* **Uji Repeated Measures ANOVA:** Menghasilkan nilai $F$, $p$-value, dan ukuran efek ($\eta^2$).

### 📋 Generator Template Excel Baku (Siap Pakai)
Tersedia unduhan 1-klik untuk format template eksperimen baru:
1. **Template Microcirculation SBF (.xlsx):** Format blok horizontal 12 kolom per subjek (30Hz, 50Hz, 100Hz Before & After) dengan ~2.670 baris data sinyal.
2. **Template Myoton 9-Titik (.xlsx):** Format urutan ular kompas 9 titik (NW sampai SE) dengan kolom frekuensi dan parameter kekakuan dinamis.
3. **Template Unified Gabungan (.xlsx):** Workbook dual-sheet lengkap berisi lembar SBF, lembar Myoton, dan lembar panduan penggunaan.

---

## 🏛️ Arsitektur Sistem Hybrid (ThermalSight-Style)

```
06_Microcirculation_SBF_and_Myoton/
│
├── .github/workflows/
│   ├── deploy-pages.yml           # Deployment otomatis WebApp ke GitHub Pages
│   ├── build-electron.yml         # Compiler Desktop Windows (Electron + Python Backend)
│   └── build-exe.yml              # Compiler Python Standalone CLI
│
├── backend/                       # Python Scientific Core (SciPy, NumPy, Pandas)
│   ├── analyzer_cli.py            # CLI entrypoint & JSON IPC bridge untuk Electron
│   ├── analyzer.spec              # Spesifikasi PyInstaller backend
│   └── requirements.txt
│
├── core/                          # Modul Matematika & Pemrosesan Sinyal Murni
│   ├── sbf_core.py                # Hampel MAD, Savitzky-Golay, Butterworth, Bucketing
│   ├── sbf_multimodal.py          # Grid kompas 9 titik & registrasi Myoton
│   ├── sbf_statistics.py          # ANOVA, Paired t-test, simulasi Jackknife
│   └── sbf_horizontal.py          # Parser Excel multi-subjek horizontal
│
├── webapp/                        # Frontend UI & Desktop Shell
│   ├── electron/                  # Proses Main Electron & Native Bridge
│   │   ├── main.cjs               # Manajemen jendela & subproses Python IPC
│   │   └── preload.cjs            # Secure contextBridge (window.electronAPI)
│   ├── src/                       # React 19 UI
│   │   ├── components/            # ProtocolBView, PublicationBarChart, CompassHeatmap, HelpGuideModal
│   │   └── utils/                 # statistics.js, excelParser.js, templateGenerator.js
│   ├── package.json
│   └── vite.config.js
│
├── Example/Input_Real_ICha/       # Dataset klinis real (microcirculation & Myoton)
├── tests/test_pipeline.py         # Unit test otomatis (100% lulus)
└── README.md
```

---

## 🚀 Panduan Memulai & Menjalankan

### Cara 1: Menjalankan WebApp / Desktop (Rekomendasi)
Masuk ke direktori `webapp/`:
```bash
cd webapp
npm install
npm run dev
```
Buka browser di `http://localhost:5173`. Untuk menjalankan versi Desktop dengan Electron:
```bash
npm run dev:electron
```

### Cara 2: Menjalankan Backend Python Langsung
Instal dependensi Python:
```bash
pip install -r requirements.txt
python app_gui.py
```

### Menjalankan Pengujian Otomatis (Unit Test)
```bash
python tests/test_pipeline.py
```

---

## 📦 Mengunduh File Executable (.exe) Siap Pakai

Setiap commit atau rilis baru di GitHub secara otomatis memicu GitHub Actions untuk mem-build file instalasi Windows:
1. Buka tab **Releases** atau **Actions** di repositori GitHub: [Corneliox/Microcirculation_SBF_and_Myoton](https://github.com/Corneliox/Microcirculation_SBF_and_Myoton)
2. Unduh paket installer rilis terbaru (`.exe` atau `.zip`).
3. Ekstrak dan jalankan aplikasi secara langsung di Windows tanpa memerlukan instalasi Python atau Node.js manual.

---

## 🔬 Metodologi Ilmiah & Referensi

* **Hampel, F. R.** (1974). *The influence curve and its role in robust estimation.* Journal of the American Statistical Association, 69(346), 383-393.
* **Savitzky, A., & Golay, M. J.** (1964). *Smoothing and differentiation of data by simplified least squares procedures.* Analytical Chemistry, 36(8), 1627-1639.
* **Wilcoxon, F.** (1945). *Individual comparisons by ranking methods.* Biometrics Bulletin, 1(6), 80-83.

---

## 📄 Lisensi
Proyek ini bersifat sumber terbuka di bawah lisensi [MIT License](LICENSE).
