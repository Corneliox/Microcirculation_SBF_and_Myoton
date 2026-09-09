# 🔬 Microcirculation (SBF) & Myotonometer Analysis Platform

[![Build Status](https://github.com/Corneliox/06_Microcirculation_SBF_and_Myoton/actions/workflows/build-exe.yml/badge.svg)](https://github.com/Corneliox/06_Microcirculation_SBF_and_Myoton/actions/workflows/build-exe.yml)
[![Python Version](https://img.shields.io/badge/Python-3.10%20%7C%203.11%20%7C%203.12-blue)](https://www.python.org/)
[![GUI Framework](https://img.shields.io/badge/GUI-CustomTkinter%20v5.2-teal)](https://github.com/TomSchimansky/CustomTkinter)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A high-performance biomedical signal processing and biomechanical analytics platform for studying **Skin Blood Flow (SBF)** microcirculation dynamics and **tissue stiffness** across multi-modal clinical protocols.

---

## 📌 Overview & Research Context

This research software integrates optical microcirculation measurements with mechanical tissue diagnostics:

1. **Laser-Doppler Skin Blood Flow (SBF):** Continuous ~40 Hz perfusion flux recordings monitoring microvascular vasodilation and vasomotion in response to acoustic/electrical stimulation (50 Hz vs 100 Hz).
2. **Myotonometer Plantar Tissue Biomechanics:** Spatial 9-point grid assessment of muscle/dermal mechanical properties (Oscillation Frequency $F$, Dynamic Stiffness $S$ [N/m], and Logarithmic Decrement $D$) across anatomical plantar coordinates (`[5, 2, 6, 8, 4, 3, 9, 7, 1]`).
3. **Statistical Robustness & Sensitivity Testing:** One-way repeated-measures ANOVA, effect sizes ($\eta^2$), paired Wilcoxon signed-rank / Student's t-tests, and Jackknife (leave-one-out) subject removal simulations.

---

## ✨ Features & Protocol Capabilities

### 📊 Protocol A: SBF Frequency Dynamics (50 Hz vs 100 Hz)
* **Multi-Format Input:** Ingests horizontal-block Excel workbooks (`[Name] [50Hz] [be] [af] [100Hz] [be] [af]`) or batch raw signal `.txt` folders.
* **DSP Conditioning:**
  * **Hampel Filter:** Adaptive $3\sigma$ Median Absolute Deviation (MAD) rejection for motion artifacts and sensor spikes.
  * **Savitzky-Golay Smoothing:** Polynomial curve fitting to preserve hemodynamic waveforms.
  * **Butterworth Lowpass:** Zero-phase filtering for high-frequency noise attenuation.
* **Hemodynamic Bucketing:** Segments post-stimulus signals into 30-second temporal windows (up to 5 minutes / 10 buckets) to quantify relative change % ($\Delta SBF$) and vasodilation kinetics (slope per second, $R^2$).
* **Paired Comparison:** Computes Shapiro-Wilk normality tests followed by paired Student's t-test and Wilcoxon signed-rank tests per time window.
* **Export:** One-click generation of formatted Excel workbooks containing condition tables, group statistics, and p-values.

### 🦶 Protocol B: Plantar Multimodal Grid (Flux + Myoton)
* **9-Point Dwell Segmentation:** Synchronizes ~40 Hz laser-Doppler flux signals with timestamp events from Myoton recordings across 9 anatomical grid sites:
  $$\text{Grid Sequence: } [5, 2, 6, 8, 4, 3, 9, 7, 1]$$
* **Artifact-Resistant Estimator:** Features a **25th-percentile (P25) resting dwell estimator** that systematically suppresses probe-placement upward spikes, outperforming simple window medians.
* **Dual Spatial Heatmaps:** Renders side-by-side $3 \times 3$ matrices displaying $\Delta\text{Flux}$ (PU) and $\Delta\text{Stiffness}$ (N/m).
* **Spatial Concordance:** Evaluates Spearman rank correlation ($\rho$) and Pearson ($r$) between microcirculation changes and biomechanical softening/stiffening.
* **Trace QC:** Generates detailed time-series traces highlighting coordinate window boundaries and dwell plateaus.

### 🧪 Protocol C: Statistical Robustness & Sensitivity
* **Jackknife Simulation:** Leave-one-out subject removal to verify whether group trends are driven by single outlier subjects.
* **ANOVA & Post-Hoc:** One-way ANOVA with effect sizes ($\eta^2$).

---

## 🏛️ Project Architecture

```
06_Microcirculation_SBF_and_Myoton/
│
├── .github/workflows/
│   └── build-exe.yml              # CI/CD: Automated unit testing & Windows .exe builder
│
├── core/                          # Modular Computational Engine (Pure DSP & Statistics)
│   ├── __init__.py
│   ├── sbf_core.py                # SBFConfig, Hampel, Savitzky-Golay, Butterworth, Bucketing
│   ├── sbf_horizontal.py          # Horizontal Excel parser (openpyxl & pandas)
│   ├── sbf_txt.py                 # Batch TXT signal discovery and loading
│   ├── sbf_multimodal.py          # 9-point plantar foot grid segmentation & Myoton joining
│   ├── sbf_statistics.py          # ANOVA, eta-squared, Jackknife leave-one-out simulation
│   └── sbf_viz.py                 # Reusable Matplotlib publication figure generators
│
├── app_gui.py                     # Standalone Desktop Application (CustomTkinter)
├── MicrocirculationApp.spec       # PyInstaller standalone executable specification
│
├── mock_data/                     # Realistic synthetic biomedical datasets for instant demo
│   ├── generate_mock_data.py      # Synthetic signal generator
│   ├── synthetic_horizontal_sbf.xlsx
│   └── synthetic_plantar_grid/    # Mock Before/After flux & Myoton text files
│
├── tests/
│   ├── __init__.py
│   └── test_pipeline.py           # Automated unit test suite (100% passing)
│
├── legacy_scripts/                # Original archived collection of analysis scripts
├── requirements.txt               # Python package dependencies
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
