import React, { useState } from 'react';
import {
  X,
  BookOpen,
  Compass,
  Activity,
  BarChart3,
  FileSpreadsheet,
  CheckCircle2,
  ChevronRight,
  Info,
  Sliders,
  TrendingDown,
  TrendingUp,
  Download
} from 'lucide-react';
import { downloadUnifiedTemplate, downloadMicrocirculationTemplate, downloadMyotonTemplate } from '../utils/templateGenerator';

export default function HelpGuideModal({ isOpen, onClose }) {
  const [activeSection, setActiveSection] = useState('overview');

  if (!isOpen) return null;

  const sections = [
    { id: 'overview', title: '1. Platform Overview', icon: BookOpen },
    { id: 'compass_grid', title: '2. 9-Point Compass Grid', icon: Compass },
    { id: 'dsp_dwell', title: '3. Sampling & Dwell Analysis', icon: Sliders },
    { id: 'data_formats', title: '4. Excel Formats & Templates', icon: FileSpreadsheet },
    { id: 'statistics', title: '5. Statistical & Correlation Analysis', icon: BarChart3 }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 text-white rounded-lg">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Microcirculation & Myotonometer Research Manual
              </h2>
              <p className="text-xs text-slate-300">
                Complete experimental protocol, 9-point compass snake sequence, and statistical workflow guide
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body with Sidebar Navigation */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Navigation Sidebar */}
          <div className="w-full md:w-64 bg-slate-50 border-r border-slate-200 p-3 space-y-1 shrink-0 overflow-y-auto">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 py-1.5">
              Workflow Guide
            </div>
            {sections.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => setActiveSection(sec.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  <span className="truncate">{sec.title}</span>
                </button>
              );
            })}

            {/* Quick Template Download inside Help */}
            <div className="mt-6 pt-4 border-t border-slate-200 px-2 space-y-2">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Quick Download
              </div>
              <button
                onClick={downloadUnifiedTemplate}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-semibold transition-colors cursor-pointer shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unified Template (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* Section Content Display */}
          <div className="flex-1 p-6 overflow-y-auto space-y-6 text-slate-700 text-xs leading-relaxed">
            {/* 1. OVERVIEW */}
            {activeSection === 'overview' && (
              <div className="space-y-4">
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-indigo-600" />
                    1. Multimodal Research System Overview
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Dual-modality assessment combining optical microcirculation and mechanical tissue diagnostics.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-2">
                    <h4 className="font-bold text-indigo-950 text-sm flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-indigo-600" />
                      Laser-Doppler Skin Blood Flow (SBF)
                    </h4>
                    <p className="text-slate-600">
                      Measures microvascular red blood cell velocity and concentration, reported in <strong>Perfusion Units (PU)</strong>. Continuous recordings evaluate cutaneous vasodilation, vasoconstriction, and vasomotion during vibrational/electrical stimulation.
                    </p>
                  </div>

                  <div className="p-4 bg-amber-50/70 border border-amber-100 rounded-xl space-y-2">
                    <h4 className="font-bold text-amber-950 text-sm flex items-center gap-1.5">
                      <Compass className="w-4 h-4 text-amber-600" />
                      Myotonometer Plantar Biomechanics
                    </h4>
                    <p className="text-slate-600">
                      Applies controlled mechanical micro-impulses to quantify non-invasive tissue viscoelastic properties: <strong>Dynamic Stiffness (S, in N/m)</strong>, Oscillation Frequency (F, in Hz), and Logarithmic Decrement (D).
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                  <h4 className="font-bold text-slate-900 text-sm">Research Hypothesis & Core Clinical Question</h4>
                  <p>
                    Does localized acoustic/vibrational stimulation at specific frequencies (<strong>30 Hz, 50 Hz, 100 Hz</strong>) induce coupled physiological responses between microvascular perfusion (ΔFlux) and mechanical plantar tissue compliance (ΔStiffness)?
                  </p>
                </div>
              </div>
            )}

            {/* 2. 9-POINT COMPASS GRID */}
            {activeSection === 'compass_grid' && (
              <div className="space-y-4">
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Compass className="w-5 h-5 text-indigo-600" />
                    2. Anatomical 9-Point Compass Grid ("Snake" Sequence)
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Spatial registration protocol matching 9 sequential SBF dwell periods with 9 physical Myotonometer measurement sites.
                  </p>
                </div>

                <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 text-amber-900 flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <strong>Standard Snake Trajectory:</strong> Measurements always follow a contiguous raster order: Top row from Left to Right (1, 2, 3), Middle row from Left to Right (4, 5, 6), and Bottom row from Left to Right (7, 8, 9).
                  </div>
                </div>

                {/* 3x3 Visual Grid Diagram */}
                <div className="grid grid-cols-3 gap-3 p-3 bg-slate-100 rounded-xl border border-slate-200 max-w-lg mx-auto">
                  {[
                    { id: 1, code: 'NW', name: 'North-West', desc: 'Anterolateral Forefoot' },
                    { id: 2, code: 'N', name: 'North', desc: 'Anterior Metatarsal Pad' },
                    { id: 3, code: 'NE', name: 'North-East', desc: 'Anteromedial Hallux' },
                    { id: 4, code: 'W', name: 'West', desc: 'Lateral Midfoot Arch' },
                    { id: 5, code: 'C', name: 'Center', desc: 'Plantar Core / Center' },
                    { id: 6, code: 'E', name: 'East', desc: 'Medial Midfoot Arch' },
                    { id: 7, code: 'SW', name: 'South-West', desc: 'Posterolateral Heel' },
                    { id: 8, code: 'S', name: 'South', desc: 'Posterior Central Heel' },
                    { id: 9, code: 'SE', name: 'South-East', desc: 'Posteromedial Heel' }
                  ].map((pt) => (
                    <div
                      key={pt.id}
                      className={`p-3 rounded-lg border bg-white flex flex-col justify-between ${
                        pt.id === 5 ? 'ring-2 ring-indigo-500' : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200">
                          #{pt.id} {pt.code}
                        </span>
                      </div>
                      <div className="mt-1 font-bold text-slate-800 text-[11px]">{pt.name}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{pt.desc}</div>
                    </div>
                  ))}
                </div>

                <p className="text-slate-600">
                  This standardized coordinate layout ensures that perfusion gains (ΔFlux) can be directly overlaid onto tissue stiffness changes (ΔStiffness) in identical 3x3 matrices.
                </p>
              </div>
            )}

            {/* 3. SAMPLING & DWELL */}
            {activeSection === 'dsp_dwell' && (
              <div className="space-y-4">
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-indigo-600" />
                    3. Sampling Frequency & Dwell Segmentation
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Temporal windowing parameters converting continuous raw signals into 9 discrete point values.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <h4 className="font-bold text-slate-900 mb-1">Sampling Rate Configuration</h4>
                    <p>
                      <strong>Default: 40 Hz</strong> (corresponds to 25 ms per sample interval). If your recording hardware outputs at another rate (e.g., 10 Hz or 100 Hz), adjust the <code>Sampling Rate (Hz)</code> input field on the top control bar.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <h4 className="font-bold text-slate-900 mb-1">Dwell Window Duration (Seconds)</h4>
                    <p>
                      In the standard 2,670-sample trial (~66.75 seconds total), dividing by 9 compass points produces approximately <strong>7.41 seconds</strong> per dwell (~296 samples per dwell point). You can customize this window duration as needed.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <h4 className="font-bold text-slate-900 mb-1">Dwell Plateau Estimator Methods</h4>
                    <ul className="list-disc list-inside space-y-1.5 mt-1 text-slate-600">
                      <li>
                        <strong>P25 (25th Percentile Plateau - Recommended):</strong> Filters out probe transition artifacts and placement spikes, extracting the steady resting baseline of each dwell.
                      </li>
                      <li>
                        <strong>Median (P50):</strong> Robust non-parametric central tendency measure.
                      </li>
                      <li>
                        <strong>Mean:</strong> Arithmetic average across all samples within the dwell window.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* 4. DATA FORMATS & TEMPLATES */}
            {activeSection === 'data_formats' && (
              <div className="space-y-4">
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                    4. Supported Excel Formats & Template Generator
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Standardized data structure supporting single-subject analysis and group-pooled batch processing.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <h4 className="font-bold text-slate-900 mb-1">1. Microcirculation SBF Workbook</h4>
                    <p className="text-slate-600 mb-2">
                      Organized horizontally with <strong>12 columns per subject</strong>:
                    </p>
                    <div className="font-mono text-[11px] bg-white p-2.5 rounded border border-slate-200 text-slate-800 space-y-1">
                      <div>Row 1: Subject Name (e.g., 'Bas', 'Cornel', 'Subject_1')</div>
                      <div>Row 2: Frequency Codes ('1_30', '1_50', '1_100')</div>
                      <div>Row 3: Phase ('before', 'after')</div>
                      <div>Row 4: Channel ('Channel 1', 'Channel 2')</div>
                      <div>Row 5+: Continuous numeric Perfusion Unit (PU) timeseries</div>
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <h4 className="font-bold text-slate-900 mb-1">2. OCT Myoton 9-Point Grid Workbook</h4>
                    <p className="text-slate-600 mb-2">
                      Organized in blocks of 9 rows per subject corresponding to points 1 through 9:
                    </p>
                    <div className="font-mono text-[11px] bg-white p-2.5 rounded border border-slate-200 text-slate-800 space-y-1">
                      <div>Columns: Point ID (1..9), before1_30, after1_30, before1_50, after1_50, before1_100, after1_100, T1, M1</div>
                      <div>Values: Dynamic Stiffness (S, in N/m)</div>
                    </div>
                  </div>

                  <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl">
                    <h4 className="font-bold text-indigo-950 mb-1">Single vs. Multi-Subject Group Analysis</h4>
                    <p className="text-slate-700">
                      You can analyze an individual subject or select <strong>"🌐 All Subjects (Group Pooled)"</strong> to compute cross-subject ensemble averages for all 9 points, global ΔFlux, global ΔStiffness, and pooled correlation metrics.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    onClick={downloadMicrocirculationTemplate}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download SBF Template</span>
                  </button>
                  <button
                    onClick={downloadMyotonTemplate}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                    title="Download official blank NewFormat.xlsx file for Myoton data collection"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Myoton (NewFormat.xlsx)</span>
                  </button>
                  <button
                    onClick={downloadUnifiedTemplate}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Unified (SBF + Myoton)</span>
                  </button>
                </div>
              </div>
            )}

            {/* 5. STATISTICAL & CORRELATION */}
            {activeSection === 'statistics' && (
              <div className="space-y-4">
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-indigo-600" />
                    5. Statistical Rigor & Spatial Concordance
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Interpretation of correlation metrics, ANOVA between conditions, and paired t-tests.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <h4 className="font-bold text-slate-900 mb-1">Spatial Concordance (ΔFlux vs ΔStiffness)</h4>
                    <p className="text-slate-600">
                      Calculates non-parametric <strong>Spearman rank correlation (ρ)</strong> and linear <strong>Pearson correlation (r)</strong> across the 9 spatial coordinates:
                    </p>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-950">
                        <strong className="text-emerald-800 block">Negative Correlation (ρ &lt; 0):</strong>
                        Hypothesis confirmed: vasodilation (increased SBF flux) coincides with reduced tissue stiffness (biomechanical relaxation/softening).
                      </div>
                      <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-950">
                        <strong className="text-amber-800 block">Positive Correlation (ρ &gt; 0):</strong>
                        Tissue stiffening occurs concurrently with hyperemic perfusion elevation.
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <h4 className="font-bold text-slate-900 mb-1">Publication Figure Standards (Tab 2)</h4>
                    <p className="text-slate-600">
                      Replicates publication-grade grouped bar charts featuring:
                    </p>
                    <ul className="list-disc list-inside space-y-1 mt-1 text-slate-600">
                      <li>Upper Limb vs Lower Limb (or Baseline vs Post-Stimulation) across frequencies.</li>
                      <li>Mean ± Standard Deviation (SD) error bars.</li>
                      <li>Repeated-measures One-Way ANOVA (F-statistic, p-value, effect size η²).</li>
                      <li>Paired Student's t-test with significance brackets (<code>*</code> p &lt; 0.05, <code>**</code> p &lt; 0.01, <code>***</code> p &lt; 0.001, <code>ns</code> not significant).</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500">
            Microcirculation (SBF) & Myotonometer Research Platform • Version 2.7.0
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
}
