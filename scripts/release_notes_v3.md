# 🔬 Microcirculation (SBF) & Myoton Multimodal Research Platform — Release v3.0.0

**Official Release Version:** `v3.0.0`  
**License:** MIT License  
**Authors:** Cornelio / Richard AU Lab (Microcirculation & Biomechanics Research Group)  
**Target Environments:** Windows 10/11 x64 Desktop Application (Electron + Python SciPy Engine) & React 19 Web Platform

---

## 🚀 Major Release Overview (v3.0.0)

Version **3.0.0** is a major architectural milestone delivering an end-to-end clinical workflow upgrade for plantar biomechanics, multi-subject cohort analysis, dual-engine 3D spatial gradient modeling, automated Excel format diagnostic validation, and unified bundle exports.

---

## ✨ Key Features & Enhancements

### 1. 👥 Multi-Subject Cohort Sessions & Bulk Ingestion
* **Simultaneous Ingestion:** Process multiple participants in a single analytical session without virtual foot-splitting or key collisions.
* **Flexible Ingestion Methods:** Add single workbooks via `[+ Add Participant]` or batch-ingest multiple files via `[Bulk Upload (.xlsx)]` and native Drag-and-Drop.
* **Session Management:** Isolate or remove duplicate/corrupted records instantly with dedicated trash actions per card.

### 2. 📑 iLovePDF-Style Modular Accordion Interface
* **Clean Card-Based Overview:** Minimalist, compact horizontal card layout providing high-level metadata (Subject Name, File Name, Protocol Count, Date, and Format Health).
* **Dropdown Inspection:** Expand any participant card via chevron toggle to access clinical protocols (Protocols 1 to 6), statistical summary cards, 3D surface mesh views, and detailed 9-point coordinates.

### 3. 🛡️ Real-Time Format Validator & Diagnostic Taxonomy
* **Instant Visual Indicators:** Color-coded status badges on each participant card:
  - `🟢 Standard Format Verified` (`PERFECT_MATCH`): Full 6 bilateral protocols, complete 9 triplicate points within physiological ranges.
  - `🟡 Format Warning` (`INCOMPLETE_DATA`, `LEGACY_FORMAT`): Partial protocol counts or legacy table structures.
  - `🔴 Invalid / Corrupted Format` (`FORMULA_ERRORS`, `MISSING_PROTOCOLS`, `EMPTY_OR_UNREADABLE`): Excel formula errors (`#VALUE!`, `#REF!`), missing headers, or empty files.
  - `⚪ Unknown Format Issue` (`UNKNOWN_STRUCTURE`): Unrecognized workbook schemas.
* **Actionable Diagnostics Modal:** Click any status badge to open a detailed diagnostic breakdown identifying exact error cells, root causes, and one-click access to download the official `NewFormat.xlsx` template.

### 4. ⚖️ Dual Triplicate Estimators: Mean vs. Median
* **Analytical Flexibility:** Instant toggle between **Arithmetic Mean (Average)** and **Median (Middle Value: n > min & n < max)**.
* **Visual Middle-Value Highlight:** When Median mode is active, the middle triplicate value is highlighted in emerald `(Mid: X)` across tables and summary metrics.

### 5. 🏔️ Publication-Grade 3D Surface Mesh Visualizer
* **Dual-Engine Architecture:**
  - **Matplotlib Publication HD (Python IPC):** Generates 150-DPI publication figures matching the reference standard (`isolated_FLIR0207_m2_3_3d_surface.png`) with elevation 28°, azimuth -55°, 3D bounding box projection walls, continuous Viridis colormap, 10-level bottom-plane contours, blue gradient quiver vectors (`#0055ff`), and 9 red anatomical compass nodes (P1-P9).
  - **Interactive 3D Mathematical Canvas:** Client-side 3D rotation matrix fallback for zero-latency browser rendering.
* **1-Click Export:** Download individual high-resolution PNG plots per protocol and phase via `[Save 3D PNG]`.

### 6. 📦 Comprehensive Bundle Exporter
* **Single-Click Package:** `[📦 Export All (.ZIP: Excel + 3D PNGs)]` bundles:
  1. `FormatOutput.xlsx`: Exact 3-block structure (Stiffness Max/Min/Mean/Median, Gradient Max/Min/Mean/Median, Direction Modus across up to 15 subjects).
  2. `3D_Surfaces/[Participant_Name]/`: High-resolution Before & After 3D Surface PNG plots for every protocol.
* **Secondary Export Option:** `[📊 Excel Only]` for rapid numerical export.

### 7. 🌐 Full English Standardization & Unitless Stiffness
* **International Research Standard:** Unified all UI controls, toolbars, dialogs, badges, and tooltips into standard academic English.
* **Strict Unitless Conformance:** Universal elimination of `N/m` units across all UI components, summary metrics, and templates.

---

## 📜 Formal License & Attribution
* **License:** MIT License
* **Copyright:** © 2026 Cornelio / Richard AU Lab (Microcirculation & Myoton Research Group)
* **Citation:** If using this software in scientific publications, please cite the platform and reference repository: `https://github.com/Corneliox/Microcirculation_SBF_and_Myoton`.
