# 🔬 Microcirculation & Myoton Research WebApp (v2.2.0)

[![Framework](https://img.shields.io/badge/React-19.2-61dafb)](https://react.dev/)
[![Bundler](https://img.shields.io/badge/Vite-8.3-646cff)](https://vitejs.dev/)
[![Shell](https://img.shields.io/badge/Electron-44.3-47848f)](https://www.electronjs.org/)

[English](#english) | [Bahasa Indonesia](#bahasa-indonesia)

---

<a name="english"></a>
## 🌐 English Documentation

### Overview
This application is a specialized biomedical research frontend for analyzing **Laser-Doppler Skin Blood Flow (SBF)** microcirculation and **Myotonometer Plantar Biomechanics**. It runs both as a fast browser webapp and as a standalone Windows desktop executable via Electron.

### Key Capabilities
1. **Protocol B: Plantar & Tissue Multimodal Grid (Primary Tab)**
   - 9-point compass snake sequence: NW -> N -> NE -> W -> C -> E -> SW -> S -> SE.
   - Default sampling rate: 40 Hz (25 ms per sample).
   - Configurable dwell separation window (default ~7.41 s for ~296 samples per point).
   - Plateau estimators: P25 (spike-resistant plateau), Median, Mean.
   - Dual 3×3 heatmaps: $\Delta\text{Flux}$ (PU) and $\Delta\text{Stiffness}$ (N/m).
   - Single-subject vs **Group Pooled Mode** (`🌐 All Subjects Combined`).
   - Integrated **Workflow Manual & Help Guide** accessible anytime via the top bar.
2. **Publication Statistics Tab**
   - High-resolution SVG bar charts replicating scientific publication standards.
   - One-way Repeated Measures ANOVA and Paired Student's t-test with significance brackets (`*`, `**`, `***`, `ns`).
3. **Dataset Inspector & Standardized Template Generator**
   - 1-click download of standardized Excel templates for new experiments.
   - Drag-and-drop or upload custom `.xlsx` workbooks.

### Development Commands
```bash
# Run local Vite web server
npm run dev

# Run Electron desktop shell with hot-reloading
npm run dev:electron

# Build production client bundle
npm run build

# Package standalone Windows desktop app
npm run dist
```

---

<a name="bahasa-indonesia"></a>
## 🇮🇩 Dokumentasi Bahasa Indonesia

### Ringkasan
Aplikasi ini merupakan antarmuka analitik riset biomedis khusus untuk menganalisis mikrosirkulasi **Laser-Doppler Skin Blood Flow (SBF)** dan **Biomekanika Jaringan Myotonometer**. Dapat dijalankan langsung di peramban web maupun sebagai aplikasi desktop Windows (.exe) melalui Electron.

### Fitur Utama
1. **Tab Utama: Protokol B (Grid Multimodal Spasial Plantar)**
   - Orientasi urutan ular kompas 9 titik: NW -> N -> NE -> W -> C -> E -> SW -> S -> SE.
   - Laju sampling default: 40 Hz (25 ms per titik data).
   - Jendela pemisahan dwell fleksibel (default ~7.41 detik / ~296 sampel per titik).
   - Estimator plateau: P25 (tahan lonjakan spike alat), Median, Mean.
   - Peta panas ganda 3×3: $\Delta\text{Flux}$ (PU) dan $\Delta\text{Stiffness}$ (N/m).
   - Pilihan analisis Single Subjek maupun **Group Pooled** (`🌐 Semua Subjek Bersamaan`).
   - **Panduan Alur & Manual Pengguna (Help Guide)** terintegrasi dapat dibuka langsung dari bilah atas.
2. **Tab Statistik Publikasi**
   - Visualisasi diagram batang standar jurnal ilmiah beresolusi tinggi (SVG).
   - Repeated-Measures ANOVA dan Paired Student's t-test dengan bracket signifikansi.
3. **Inspektor & Generator Template Excel Baku**
   - Unduh template Excel terstandarisasi untuk subjek baru dalam 1 klik.
   - Upload file rekaman eksperimen kustom (.xlsx) untuk analisis instan.
