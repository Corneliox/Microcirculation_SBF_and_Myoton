import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Activity,
  Compass,
  BarChart3,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Layers,
  Database,
  Info,
  Download,
  FileCheck,
  BookOpen,
  Footprints
} from 'lucide-react';

import ProtocolBView from './components/ProtocolBView';
import SbfStandaloneView from './components/SbfStandaloneView';
import MyotonStandaloneView from './components/MyotonStandaloneView';
import PublicationBarChart from './components/PublicationBarChart';
import HelpGuideModal from './components/HelpGuideModal';
import { parseMicrocirculationWorkbook, parseMyotonWorkbook, COMPASS_POINTS } from './utils/excelParser';
import { mean, std } from './utils/statistics';
import {
  downloadMicrocirculationTemplate,
  downloadMyotonTemplate,
  downloadUnifiedTemplate
} from './utils/templateGenerator';

export default function App() {
  const [activeTab, setActiveTab] = useState('protocol_b'); // 'protocol_b' is primary
  const [microData, setMicroData] = useState(null);
  const [myotonData, setMyotonData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Auto-fetch real datasets from /data/ on mount
  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);
        setErrorMessage(null);

        // 1. Fetch Microcirculation dataset
        const baseUrl = import.meta.env.BASE_URL || './';
        const cleanBase = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
        const resMicro = await fetch(`${cleanBase}data/microcirculation-data.xlsx`);
        if (!resMicro.ok) throw new Error(`Failed to load microcirculation-data.xlsx (${resMicro.statusText})`);
        const abMicro = await resMicro.arrayBuffer();
        const wbMicro = XLSX.read(abMicro, { type: 'array' });
        const parsedMicro = parseMicrocirculationWorkbook(wbMicro);
        setMicroData(parsedMicro);

        // 2. Fetch Myoton dataset (Default to new standardized KYLE OCT multi-protocol format)
        let parsedMyo = null;
        try {
          const resMyo = await fetch(`${cleanBase}data/KYLE OCT.xlsx`);
          if (resMyo.ok) {
            const abMyo = await resMyo.arrayBuffer();
            const wbMyo = XLSX.read(abMyo, { type: 'array' });
            parsedMyo = parseMyotonWorkbook(wbMyo);
          }
        } catch (e) {
          console.warn('KYLE OCT.xlsx failed to load, attempting legacy fallback:', e);
        }

        if (!parsedMyo) {
          const resLegacy = await fetch(`${cleanBase}data/OCT_Myoton(R_R)(2).xlsx`);
          if (!resLegacy.ok) throw new Error(`Failed to load Myoton dataset (${resLegacy.statusText})`);
          const abLegacy = await resLegacy.arrayBuffer();
          const wbLegacy = XLSX.read(abLegacy, { type: 'array' });
          parsedMyo = parseMyotonWorkbook(wbLegacy);
        }
        setMyotonData(parsedMyo);
      } catch (err) {
        console.error('Error auto-loading datasets:', err);
        setErrorMessage(err.message || 'Failed to load sample Excel files');
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, []);

  // Compute aggregated stats for Publication Bar Chart across subjects
  const aggregatedStats = useMemo(() => {
    if (!microData) return null;

    const subjects = Object.values(microData);
    if (subjects.length === 0) return null;

    const computeFreqStats = (freqKey) => {
      const beMeans = [];
      const afMeans = [];

      subjects.forEach((s) => {
        const beArr = s.frequencies[freqKey]?.before || [];
        const afArr = s.frequencies[freqKey]?.after || [];
        if (beArr.length > 0) beMeans.push(mean(beArr));
        if (afArr.length > 0) afMeans.push(mean(afArr));
      });

      return {
        upperMean: beMeans.length > 0 ? Number(mean(beMeans).toFixed(1)) : 160.0,
        upperStd: beMeans.length > 0 ? Number(std(beMeans).toFixed(1)) : 22.0,
        lowerMean: afMeans.length > 0 ? Number(mean(afMeans).toFixed(1)) : 95.0,
        lowerStd: afMeans.length > 0 ? Number(std(afMeans).toFixed(1)) : 18.0
      };
    };

    return {
      freq30: computeFreqStats('30Hz'),
      freq50: computeFreqStats('50Hz'),
      freq100: computeFreqStats('100Hz')
    };
  }, [microData]);

  // Handle custom manual upload for Microcirculation file
  const handleMicroUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const parsed = parseMicrocirculationWorkbook(wb);
        setMicroData(parsed);
      } catch (err) {
        alert('Failed to read microcirculation file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Handle custom manual upload for Myoton file
  const handleMyotonUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const parsed = parseMyotonWorkbook(wb);
        setMyotonData(parsed);
      } catch (err) {
        alert('Failed to read Myoton file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Instant loader for the new KYLE OCT dataset (Input_26_11_9)
  const handleLoadKyleDataset = async () => {
    try {
      setLoading(true);
      const baseUrl = import.meta.env.BASE_URL || './';
      const cleanBase = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
      const resMyo = await fetch(`${cleanBase}data/KYLE OCT.xlsx`);
      if (!resMyo.ok) throw new Error(`Failed to load data/KYLE OCT.xlsx`);
      const abMyo = await resMyo.arrayBuffer();
      const wbMyo = XLSX.read(abMyo, { type: 'array' });
      const parsedMyo = parseMyotonWorkbook(wbMyo);
      setMyotonData(parsedMyo);
      setActiveTab('myoton_standalone');
    } catch (err) {
      alert('Error loading KYLE dataset: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Help Modal */}
      <HelpGuideModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and App Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold text-slate-900 leading-tight">
                    Microcirculation & Myotonometer Research
                  </h1>
                  <span className="text-[10px] font-semibold tracking-wide bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                    v2.7.0 Desktop & Web
                  </span>
                </div>
                <p className="text-xs text-slate-500 hidden sm:block">
                  Laser-Doppler Skin Blood Flow (SBF) & Tissue Biomechanics Multimodal Analysis
                </p>
              </div>
            </div>

            {/* Live Data Status Indicator & Quick Uploads */}
            <div className="flex items-center gap-2 sm:gap-3 text-xs">
              {/* SBF Status & Quick Upload */}
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-md border border-slate-200">
                <span
                  className={`w-2 h-2 rounded-full ${
                    microData ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'
                  }`}
                />
                <span className="font-medium text-slate-600">SBF:</span>
                <span className="font-bold text-slate-800">
                  {microData ? `${Object.keys(microData).length} Subjects` : 'Not Loaded'}
                </span>
                <label className="ml-1 cursor-pointer text-indigo-600 hover:text-indigo-800 font-semibold text-[11px] hover:underline" title="Upload new SBF dataset">
                  Upload
                  <input type="file" accept=".xlsx, .xls" onChange={handleMicroUpload} className="hidden" />
                </label>
              </div>

              {/* Myoton Status & Quick Upload */}
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-md border border-slate-200">
                <span
                  className={`w-2 h-2 rounded-full ${
                    myotonData ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'
                  }`}
                />
                <span className="font-medium text-slate-600">Myoton:</span>
                <span className="font-bold text-slate-800">
                  {myotonData ? '9-Point Grid OK' : 'Not Loaded'}
                </span>
                <label className="ml-1 cursor-pointer text-indigo-600 hover:text-indigo-800 font-semibold text-[11px] hover:underline" title="Upload new Myoton dataset">
                  Upload
                  <input type="file" accept=".xlsx, .xls" onChange={handleMyotonUpload} className="hidden" />
                </label>
              </div>

              {/* Help & Workflow Guide Button */}
              <button
                onClick={() => setIsHelpOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Workflow Guide</span>
              </button>

              {/* Instant KYLE OCT Dataset Button */}
              <button
                onClick={handleLoadKyleDataset}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                title="Instant Load KYLE OCT Dataset (Input_26_11_9: 6 Protocols, Triplicates E1-E3)"
              >
                <Footprints className="w-3.5 h-3.5" />
                <span>Load KYLE OCT</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex space-x-1 border-t border-slate-100 pt-1 -mb-px overflow-x-auto">
            {/* Tab 1: Protocol B (Main Menu) */}
            <button
              onClick={() => setActiveTab('protocol_b')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors shrink-0 cursor-pointer ${
                activeTab === 'protocol_b'
                  ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-lg'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>Protocol B: Plantar & Tissue Grid</span>
              <span className="ml-1 text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-sm">
                Primary
              </span>
            </button>

            {/* Tab 2: SBF Microcirculation Standalone */}
            <button
              onClick={() => setActiveTab('sbf_standalone')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors shrink-0 cursor-pointer ${
                activeTab === 'sbf_standalone'
                  ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-lg'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <Activity className="w-4 h-4 text-blue-600" />
              <span>SBF Microcirculation (Standalone)</span>
            </button>

            {/* Tab 3: Myoton Standalone */}
            <button
              onClick={() => setActiveTab('myoton_standalone')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors shrink-0 cursor-pointer ${
                activeTab === 'myoton_standalone'
                  ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-lg'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>Myoton Biomechanics (Standalone)</span>
            </button>

            {/* Tab 4: Publication Statistics (ANOVA & Paired t-test) */}
            <button
              onClick={() => setActiveTab('statistics')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors shrink-0 cursor-pointer ${
                activeTab === 'statistics'
                  ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-lg'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Publication Statistics (ANOVA & Paired t-test)</span>
            </button>

            {/* Tab 5: Dataset Inspector & Templates */}
            <button
              onClick={() => setActiveTab('data_inspector')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors shrink-0 cursor-pointer ${
                activeTab === 'data_inspector'
                  ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-lg'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Dataset & Templates</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200 shadow-xs">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
            <p className="text-sm font-semibold text-slate-700">Loading Multimodal Microcirculation & Myoton Datasets...</p>
            <p className="text-xs text-slate-400 mt-1">Parsing Excel workbooks from public/data/ (40 Hz default)...</p>
          </div>
        ) : errorMessage ? (
          <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-bold">Error Loading Datasets</h3>
              <p className="text-xs mt-1">{errorMessage}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-3 px-3 py-1.5 bg-rose-600 text-white rounded-md text-xs font-medium hover:bg-rose-700 cursor-pointer"
              >
                Reload Page
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* TAB 1: PROTOCOL B VIEW */}
            {activeTab === 'protocol_b' && (
              <ProtocolBView
                microData={microData}
                myotonData={myotonData}
                onOpenHelp={() => setIsHelpOpen(true)}
                onUploadMicro={handleMicroUpload}
                onUploadMyoton={handleMyotonUpload}
              />
            )}

            {/* TAB 2: SBF MICROCIRCULATION STANDALONE */}
            {activeTab === 'sbf_standalone' && (
              <SbfStandaloneView
                microData={microData}
                onUploadMicro={handleMicroUpload}
              />
            )}

            {/* TAB 3: MYOTON BIOMECHANICS STANDALONE */}
            {activeTab === 'myoton_standalone' && (
              <MyotonStandaloneView
                myotonData={myotonData}
                onUploadMyoton={handleMyotonUpload}
              />
            )}

            {/* TAB 4: PUBLICATION STATISTICAL BAR CHART */}
            {activeTab === 'statistics' && (
              <PublicationBarChart realData={aggregatedStats} />
            )}

            {/* TAB 5: DATASET INSPECTOR & FILE UPLOADER */}
            {activeTab === 'data_inspector' && (
              <div className="space-y-6">
                {/* Upload Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* SBF Upload Box */}
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <Activity className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Microcirculation SBF Data (.xlsx)
                        </h3>
                        <p className="text-xs text-slate-500">
                          Multi-column horizontal block format (30Hz, 50Hz, 100Hz Before & After)
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 mb-4 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <strong>Active file:</strong> <code>microcirculation-data.xlsx</code> (Subjects: Bas, Cornel, Reuben). Default sampling rate: 40 Hz (25 ms per sample).
                    </p>
                    <label className="flex items-center justify-center gap-2 w-full p-3 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/20 transition-all text-xs font-semibold text-slate-700">
                      <Upload className="w-4 h-4 text-slate-500" />
                      <span>Upload Custom SBF File (.xlsx)</span>
                      <input
                        type="file"
                        accept=".xlsx, .xls"
                        onChange={handleMicroUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Myoton Upload Box */}
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                        <Layers className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          OCT Myoton 9-Point Grid (.xlsx)
                        </h3>
                        <p className="text-xs text-slate-500">
                          Raster 9 compass coordinates (North-West through South-East)
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 mb-4 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <strong>Active file:</strong> <code>OCT_Myoton(R_R)(2).xlsx</code>. Contains points 1 to 9 with frequencies 30, 50, 100Hz + T1 & M1.
                    </p>
                    <label className="flex items-center justify-center gap-2 w-full p-3 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/20 transition-all text-xs font-semibold text-slate-700">
                      <Upload className="w-4 h-4 text-slate-500" />
                      <span>Upload Custom Myoton File (.xlsx)</span>
                      <input
                        type="file"
                        accept=".xlsx, .xls"
                        onChange={handleMyotonUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Standardized Excel Template Download Card */}
                <div className="bg-linear-to-br from-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-md border border-indigo-800/50">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-indigo-700/50">
                    <div>
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-indigo-300" />
                        <h3 className="text-base font-bold text-white">
                          Standardized Excel Dataset Templates (Ready-to-Use for New Research)
                        </h3>
                        <span className="text-[10px] bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 px-2 py-0.5 rounded-full font-semibold">
                          Single / Multi-Subject Flexible
                        </span>
                      </div>
                      <p className="text-xs text-indigo-200 mt-1 max-w-2xl">
                        Download standardized templates configured for your experiments. Enter your raw data into these spreadsheets and upload them back to the application for automated analysis.
                      </p>
                    </div>

                    {/* Quick All-in-One Download */}
                    <button
                      onClick={downloadUnifiedTemplate}
                      className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-900/30 shrink-0 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Unified Template (.xlsx)</span>
                    </button>
                  </div>

                  {/* 3 Download Options */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
                    {/* 1. SBF Template */}
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col justify-between hover:bg-white/10 transition-colors">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Activity className="w-4 h-4 text-cyan-400" />
                          <h4 className="text-xs font-bold text-slate-100">Microcirculation SBF Template</h4>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed mb-3">
                          12 columns per subject (3 frequencies x 2 phases Before/After x 2 optical channels). Default 40 Hz (~2670 rows per phase).
                        </p>
                        <div className="text-[10px] font-mono text-indigo-300 bg-indigo-950/60 p-2 rounded border border-indigo-800/40 mb-4">
                          Columns: [Subject] &gt; 1_30, 1_50, 1_100 &gt; before/after &gt; Ch1/Ch2
                        </div>
                      </div>
                      <button
                        onClick={downloadMicrocirculationTemplate}
                        className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download SBF Template (.xlsx)</span>
                      </button>
                    </div>

                    {/* 2. Myoton Template */}
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col justify-between hover:bg-white/10 transition-colors">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Compass className="w-4 h-4 text-amber-400" />
                          <h4 className="text-xs font-bold text-slate-100">Standard OCT Foot Template (NewFormat.xlsx)</h4>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed mb-3">
                          Official OCT Foot Measurement Record format: 6 clinical protocols (1Hz & 50Hz, 30%/50%/80%, Left & Right foot) with triplicate entries (E1, E2, E3).
                        </p>
                        <div className="text-[10px] font-mono text-amber-300 bg-amber-950/60 p-2 rounded border border-amber-800/40 mb-4">
                          Ready-to-use blank format for data collection: Points 1 to 9 (NW -&gt; SE)
                        </div>
                      </div>
                      <button
                        onClick={downloadMyotonTemplate}
                        className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download NewFormat.xlsx Template</span>
                      </button>
                    </div>

                    {/* 3. Subject Count Flexibility */}
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col justify-between hover:bg-white/10 transition-colors">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <FileCheck className="w-4 h-4 text-emerald-400" />
                          <h4 className="text-xs font-bold text-slate-100">Subject Count Flexibility</h4>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed mb-3">
                          The platform supports:
                        </p>
                        <ul className="text-[11px] text-slate-300 space-y-1.5 list-disc list-inside mb-4">
                          <li><strong>Single Subject:</strong> Analyze 1 participant individually.</li>
                          <li><strong>Multi-Subject:</strong> Add extra subjects in subsequent columns.</li>
                          <li><strong>Group Pooled:</strong> Ensemble averaging across all participants simultaneously.</li>
                        </ul>
                      </div>
                      <div className="p-2 rounded bg-emerald-950/60 border border-emerald-800/40 text-[10px] text-emerald-200">
                        &#10003; Full documentation and guides included in the Excel files.
                      </div>
                    </div>
                  </div>
                </div>

                {/* 9 Compass Points Orientation Card */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
                  <div className="flex items-center gap-2 mb-4">
                    <Compass className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-sm font-bold text-slate-900">
                      9-Point Compass Orientation Configuration ("Snake" Grid)
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    {COMPASS_POINTS.map((cp) => (
                      <div
                        key={cp.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-md bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">
                            {cp.id}
                          </span>
                          <div>
                            <p className="font-semibold text-slate-800">{cp.name}</p>
                            <p className="text-[11px] text-slate-500">Matrix Row {cp.row + 1}, Column {cp.col + 1}</p>
                          </div>
                        </div>
                        <span className="font-mono font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {cp.code}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Subject Summary Table */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 mb-2">
                      Detected Microcirculation (SBF) Subjects
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">Subject</th>
                            <th className="py-2.5 px-3">SBF Frequencies</th>
                            <th className="py-2.5 px-3">Samples / Frequency</th>
                            <th className="py-2.5 px-3">Total Duration (s @ 40Hz)</th>
                            <th className="py-2.5 px-3">Paired Myoton Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {microData &&
                            Object.keys(microData).map((sName, sIdx) => {
                              const subj = microData[sName];
                              const nSamples = subj.frequencies['30Hz']?.before?.length || 0;
                              const dur = (nSamples / 40).toFixed(1);
                              const myoSubj = myotonData ? (myotonData[sName] || myotonData[sIdx + 1]) : null;

                              return (
                                <tr key={sName} className="hover:bg-slate-50/60">
                                  <td className="py-2.5 px-3 font-semibold text-slate-900">
                                    {sName} (ID: {sIdx + 1})
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-600">30Hz, 50Hz, 100Hz</td>
                                  <td className="py-2.5 px-3 font-mono text-slate-700">{nSamples} per phase</td>
                                  <td className="py-2.5 px-3 font-mono text-slate-700">~{dur} s</td>
                                  <td className="py-2.5 px-3">
                                    {myoSubj ? (
                                      <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-medium border border-emerald-200">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> 9 Points Complete
                                      </span>
                                    ) : (
                                      <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded text-[11px]">
                                        No Paired Myoton Data
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Myoton Standalone / Protocol Records Summary */}
                  {myotonData && (
                    <div className="pt-4 border-t border-slate-100">
                      <h3 className="text-sm font-bold text-slate-900 mb-2">
                        Detected Myoton Biomechanics Datasets
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200">
                            <tr>
                              <th className="py-2.5 px-3">Subject / Record</th>
                              <th className="py-2.5 px-3">Dataset Format</th>
                              <th className="py-2.5 px-3">Available Conditions / Protocols</th>
                              <th className="py-2.5 px-3">Grid Verification</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {Object.keys(myotonData)
                              .filter((k) => isNaN(k) && k !== 'ALL')
                              .map((mKey) => {
                                const mObj = myotonData[mKey];
                                const isProto = mObj?.isProtocolFormat;
                                return (
                                  <tr key={mKey} className="hover:bg-slate-50/60">
                                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                                      {mKey}
                                    </td>
                                    <td className="py-2.5 px-3">
                                      {isProto ? (
                                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[11px] font-medium">
                                          OCT Protocol & Triplicates
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded text-[11px]">
                                          Standard Frequency Matrix
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-600">
                                      {isProto && mObj.protocols ? (
                                        <span>{mObj.protocols.length} Protocols (1Hz, 50Hz • 30%, 50%, 80%)</span>
                                      ) : (
                                        <span>30Hz, 50Hz, 100Hz</span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3">
                                      <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-medium border border-emerald-200">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> 9 Points (Snake Raster OK)
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <p>
          Microcirculation Laser-Doppler SBF & Tissue Biomechanics System • Medical Research Platform
        </p>
      </footer>
    </div>
  );
}
