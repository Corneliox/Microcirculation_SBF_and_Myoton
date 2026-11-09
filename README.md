# 🔬 Microcirculation (SBF) & Myotonometer Analysis Platform

🌐 **Language:** **English** | [Bahasa Indonesia](README.id.md)

[![Build Status](https://github.com/Corneliox/06_Microcirculation_SBF_and_Myoton/actions/workflows/build-exe.yml/badge.svg)](https://github.com/Corneliox/06_Microcirculation_SBF_and_Myoton/actions/workflows/build-exe.yml)
[![Python Version](https://img.shields.io/badge/Python-3.10%20%7C%203.11%20%7C%203.12-blue)](https://www.python.org/)
[![UI Framework](https://img.shields.io/badge/Desktop%20%26%20Web-React%2019%20%7C%20Electron-indigo)](https://react.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A high-performance biomedical signal processing and biomechanical analytics platform for studying **Skin Blood Flow (SBF)** microcirculation dynamics and **tissue stiffness** across multi-modal clinical protocols.

---

## 📌 Overview & Research Context

This research software integrates optical microcirculation measurements with mechanical tissue diagnostics:

1. **Laser-Doppler Skin Blood Flow (SBF):** Continuous ~40 Hz perfusion flux recordings monitoring microvascular vasodilation and vasomotion in response to acoustic/electrical stimulation (30 Hz, 50 Hz, 100 Hz).
2. **Myotonometer Plantar Tissue Biomechanics:** Spatial 9-point grid assessment of muscle/dermal mechanical properties (Oscillation Frequency $F$, Dynamic Stiffness $S$ [N/m], and Logarithmic Decrement $D$) across anatomical plantar coordinates.
3. **Statistical Robustness & Sensitivity Testing:** One-way repeated-measures ANOVA, effect sizes ($\eta^2$), paired Wilcoxon signed-rank / Student's t-tests, and Jackknife (leave-one-out) subject removal simulations.

---

## ✨ Features & Capabilities

### 🦶 Protocol B: Plantar & Tissue Multimodal Grid (Main Application Focus)
* **Interactive React WebApp (`webapp/`):** Instant browser-based and desktop (Electron) multimodal analytics with one-click real data loading.
* **Integrated Interactive Workflow Manual:** In-app manual with step-by-step guidance on hardware setup, signal dwell extraction, and data formatting.
* **9-Point Anatomical Compass Grid ("Snake" Sequence):**
  1. **North-West (NW)**: [Row 1, Col 1] — Anterolateral Forefoot
  2. **North (N)**: [Row 1, Col 2] — Anterior Metatarsal Pad
  3. **North-East (NE)**: [Row 1, Col 3] — Anteromedial Hallux
  4. **West (W)**: [Row 2, Col 1] — Lateral Midfoot Arch
  5. **Center (C)**: [Row 2, Col 2] — Plantar Core / Center
  6. **East (E)**: [Row 2, Col 3] — Medial Midfoot Arch
  7. **South-West (SW)**: [Row 3, Col 1] — Posterolateral Heel
  8. **South (S)**: [Row 3, Col 2] — Posterior Central Heel
  9. **South-East (SE)**: [Row 3, Col 3] — Posteromedial Heel
* **Sampling Rate & Dwell Configuration:**
  * Default sampling frequency: **40 Hz** (1 sample = 0.025 s / 25 ms).
  * Fully configurable sampling rate ($f_s$) and dwell separation window duration (seconds).
* **Dual Spatial Heatmaps:** Side-by-side $3 \times 3$ interactive matrix of $\Delta\text{Flux}$ (PU) vs $\Delta\text{Stiffness}$ (N/m).
* **Single & Multi-Subject Group Pooling:** Analyze single participants or pool all subjects simultaneously (`🌐 All Subjects Combined`).
* **Standalone Modality Analysis Tabs (v2.4.0):**
  * **SBF Standalone Tab:** Process Laser-Doppler perfusion signals alone (9 dwell kinetics, plateau estimators, % vasodilation) without requiring Myoton data.
  * **Myoton Standalone Tab:** Process tissue biomechanics alone (9-point spatial matrix, dynamic stiffness $S$, $T_1$, $M_1$, % softening) without requiring SBF data.
* **Multi-Protocol & Triplicates Support (v2.5.0):**
  * Automatic detection of new multi-protocol format (`KYLE OCT.xlsx` / OCT Foot Measurement Record).
  * Ingests 6 clinical protocols (1 Hz, 50 Hz • 30%, 50%, 80% • Left Foot vs Right Foot).
  * Automatically aggregates triplicate measurements ($E_1, E_2, E_3$ Before and After) with Mean $\pm$ SD, $\Delta S$, and CV% reliability tracking.
* **One-Click Batch Test Runners (.bat):**
  * `test_kyle_dataset.bat`: Automated Python & Node.js verification test for `KYLE OCT.xlsx` displaying full 6-protocol summary tables.
  * `run_desktop_app.bat`: 1-click launcher for the interactive application GUI.
  * `run_all_tests.bat`: Comprehensive regression testing suite.
* **Fast Python Backend IPC (<1s):** Direct in-memory JSON stream evaluation avoiding redundant disk I/O for instantaneous numerical validation.
* **Standardized Excel Template Generator:** Download standard, publication-ready Excel workbooks for SBF, Myoton 9-point grid, or Unified datasets with 1 click.
* **Spatial Concordance Metrics:** Automatic computation of Spearman rank correlation ($\rho$) and Pearson ($r$) between vascular perfusion and biomechanical stiffness.
* **Artifact-Resistant Estimators:** Choice of 25th-percentile (P25) resting dwell plateau, Median, or Mean.

### 📊 Statistical Comparison (ANOVA & Paired t-test)
* **Publication-Grade Visualization:** Replicates scientific publication standards (Upper Limb vs Lower Limb / Baseline vs Post-Stimulation across frequencies).
* **Statistical Rigor:** One-way repeated measures ANOVA ($F$-statistic, $p$-value, effect size $\eta^2$) and paired Student's t-test with significance brackets (`*`, `**`, `***`, `ns`).
* **Mean ± SD Error Bars:** Clean scientific bar charts with high-resolution SVG export.

### 📊 Protocol A: SBF Frequency Dynamics (50 Hz vs 100 Hz)
* **Multi-Format Input:** Ingests horizontal-block Excel workbooks (`[Name] [50Hz] [be] [af] [100Hz] [be] [af]`) or batch raw signal `.txt` folders.
* **DSP Conditioning:**
  * **Hampel Filter:** Adaptive $3\sigma$ Median Absolute Deviation (MAD) rejection for motion artifacts and sensor spikes.
  * **Savitzky-Golay Smoothing:** Polynomial curve fitting to preserve hemodynamic waveforms.
  * **Butterworth Lowpass:** Zero-phase filtering for high-frequency noise attenuation.
* **Hemodynamic Bucketing:** Segments post-stimulus signals into 30-second temporal windows (up to 5 minutes / 10 buckets) to quantify relative change % ($\Delta SBF$) and vasodilation kinetics (slope per second, $R^2$).
* **Paired Comparison:** Computes Shapiro-Wilk normality tests followed by paired Student's t-test and Wilcoxon signed-rank tests per time window.
* **Export:** One-click generation of formatted Excel workbooks containing condition tables, group statistics, and p-values.

---

## 🏛️ System Architecture (ThermalSight-Style Hybrid)

```
06_Microcirculation_SBF_and_Myoton/
│
├── .github/workflows/
│   ├── deploy-pages.yml           # Web Edition: Automatic deployment to GitHub Pages
│   ├── build-electron.yml         # Desktop Edition: Windows Setup.exe builder (Electron + Python)
│   └── build-exe.yml              # Python Standalone CLI/Tkinter builder
│
├── backend/                       # Python Scientific Core (SciPy, NumPy, Pandas)
│   ├── analyzer_cli.py            # Headless CLI entrypoint & JSON IPC bridge for Electron
│   ├── analyzer.spec              # PyInstaller specification for backend sidecar
│   └── requirements.txt
│
├── core/                          # Modular Pure DSP & Statistical Routines
│   ├── sbf_core.py                # Hampel MAD, Savitzky-Golay, Butterworth, Bucketing
│   ├── sbf_multimodal.py          # 9-point compass grid & Myoton registration
│   ├── sbf_statistics.py          # ANOVA, Paired t-test, Jackknife simulation
│   └── sbf_horizontal.py          # Multi-subject horizontal Excel parser
│
├── webapp/                        # Frontend Application & Desktop Shell
│   ├── electron/                  # Electron Main Process & Native Bridge
│   │   ├── main.cjs               # Window management & Python subprocess IPC
│   │   └── preload.cjs            # Secure contextBridge (window.electronAPI)
│   ├── src/                       # React 19 UI
│   │   ├── components/            # ProtocolBView, PublicationBarChart, CompassHeatmap
│   │   └── utils/                 # statistics.js, excelParser.js (Fast client-side engine)
│   ├── package.json               # Scripts: dev, dev:electron, build, dist
│   └── vite.config.js
│
├── Example/Input_Real_ICha/       # Real clinical datasets (microcirculation & Myoton)
├── tests/test_pipeline.py         # Automated verification suite (100% passing)
├── .gitignore
└── README.md
```

---

## 🚀 Getting Started

### 1. Prerequisites
* Python 3.10, 3.11, or 3.12 (64-bit)
* Windows 10/11 (or Linux/macOS for Python execution)

### 2. Installation
Clone this repository and install dependencies:

```bash
git clone https://github.com/Corneliox/06_Microcirculation_SBF_and_Myoton.git
cd 06_Microcirculation_SBF_and_Myoton
pip install -r requirements.txt
```

### 3. Running the Desktop Application
Launch the GUI directly:

```bash
python app_gui.py
```

* **Demo Testing:** In the application, click **"⚡ Load Demo Excel Dataset"** in Protocol A or **"⚡ Load Demo Plantar Grid Data"** in Protocol B to immediately test the platform with realistic sample data.
* **Theme:** Use the toggle switch in the top-right corner to switch between Dark and Light modes.

### 4. Running Automated Tests
Run the unit test suite to verify mathematical and parsing routines:

```bash
python tests/test_pipeline.py
```

---

## 📦 Building Standalone Windows Executable (.exe)

### Option A: Automatic Build via GitHub Actions (Recommended)
Every push to `main` or `master` triggers the **Build Windows Standalone Executable** workflow:
1. Go to the **Actions** tab on GitHub: [GitHub Actions Workflow](https://github.com/Corneliox/06_Microcirculation_SBF_and_Myoton/actions/workflows/build-exe.yml)
2. Click on the latest workflow run.
3. Download the pre-compiled **`MicrocirculationApp-Windows-x64`** zip artifact.
4. Extract and double-click `MicrocirculationApp.exe` to run on any Windows machine without installing Python!

### Option B: Local Build with PyInstaller
To compile the single-file `.exe` locally on your Windows machine:

```powershell
pip install pyinstaller
pyinstaller MicrocirculationApp.spec
```

The compiled binary will be located in the `dist/` directory:
```
dist/MicrocirculationApp.exe
```

---

## 🔬 Scientific Methodology & Citations

* **Hampel, F. R.** (1974). *The influence curve and its role in robust estimation.* Journal of the American Statistical Association, 69(346), 383-393.
* **Savitzky, A., & Golay, M. J.** (1964). *Smoothing and differentiation of data by simplified least squares procedures.* Analytical Chemistry, 36(8), 1627-1639.
* **Wilcoxon, F.** (1945). *Individual comparisons by ranking methods.* Biometrics Bulletin, 1(6), 80-83.

---

## 📄 License
This project is open-source under the [MIT License](LICENSE).
