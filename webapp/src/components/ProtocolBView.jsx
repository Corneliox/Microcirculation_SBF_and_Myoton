import React, { useState, useMemo } from 'react';
import {
  Compass,
  Sliders,
  Activity,
  Layers,
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle,
  HelpCircle,
  TrendingDown,
  TrendingUp,
  RotateCcw,
  Cpu,
  Terminal,
  Play,
  BookOpen
} from 'lucide-react';
import CompassHeatmap from './CompassHeatmap';
import { segmentMicrocirculationSignal, computeMultimodalGridResults, COMPASS_POINTS } from '../utils/excelParser';
import { downloadMicrocirculationTemplate, downloadMyotonTemplate, downloadUnifiedTemplate } from '../utils/templateGenerator';
import { mean } from '../utils/statistics';

export default function ProtocolBView({ microData, myotonData, onOpenHelp, onUploadMicro, onUploadMyoton }) {
  // Discovered subject names from uploaded or auto-loaded data
  const subjectList = useMemo(() => (microData ? Object.keys(microData) : []), [microData]);

  // Configurable Parameters ('ALL' for group pooled, or individual subject name)
  const [selectedSubjectKey, setSelectedSubjectKey] = useState('ALL');
  const [selectedFreq, setSelectedFreq] = useState('30Hz'); // '30Hz', '50Hz', '100Hz'

  // User revised inputs:
  const [samplingRateHz, setSamplingRateHz] = useState(40.0); // 40 Hz = 25 ms
  const [dwellDurationSec, setDwellDurationSec] = useState(7.41); // default ~7.41s for 9 points from 2670 samples
  const [dwellEstimator, setDwellEstimator] = useState('p25'); // 'p25', 'median', 'mean'

  // Python Backend IPC State (when running in Electron desktop)
  const [pythonResult, setPythonResult] = useState(null);
  const [isPythonRunning, setIsPythonRunning] = useState(false);
  const [pythonError, setPythonError] = useState(null);
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI?.isElectron;

  // Compute 9-point dwells and correlations (Single Subject OR Group Average)
  const analysisResult = useMemo(() => {
    if (!microData || !myotonData || subjectList.length === 0) return null;

    const isGroup = selectedSubjectKey === 'ALL';

    if (isGroup) {
      // Group Average Mode: average dwells across all subjects
      const allDwellsBe = [];
      const allDwellsAf = [];

      subjectList.forEach((sName) => {
        const sMicro = microData[sName];
        if (sMicro && sMicro.frequencies[selectedFreq]) {
          const be = sMicro.frequencies[selectedFreq].before || [];
          const af = sMicro.frequencies[selectedFreq].after || [];
          allDwellsBe.push(segmentMicrocirculationSignal(be, samplingRateHz, dwellDurationSec, dwellEstimator));
          allDwellsAf.push(segmentMicrocirculationSignal(af, samplingRateHz, dwellDurationSec, dwellEstimator));
        }
      });

      if (allDwellsBe.length === 0) return null;

      // Average 9 dwells across subjects
      const groupDwellsBe = [];
      const groupDwellsAf = [];

      for (let i = 0; i < 9; i++) {
        const cp = COMPASS_POINTS[i];
        const beVals = allDwellsBe.map((dw) => (dw[i] ? dw[i].value : 0)).filter((v) => v > 0);
        const afVals = allDwellsAf.map((dw) => (dw[i] ? dw[i].value : 0)).filter((v) => v > 0);

        const mBe = beVals.length > 0 ? Number(mean(beVals).toFixed(2)) : 0;
        const mAf = afVals.length > 0 ? Number(mean(afVals).toFixed(2)) : 0;

        groupDwellsBe.push({
          dwellIndex: i + 1,
          compassName: cp.name,
          compassCode: cp.code,
          gridRow: cp.row,
          gridCol: cp.col,
          value: mBe
        });
        groupDwellsAf.push({
          dwellIndex: i + 1,
          compassName: cp.name,
          compassCode: cp.code,
          gridRow: cp.row,
          gridCol: cp.col,
          value: mAf
        });
      }

      // Myoton points for group average
      const groupMyoton = myotonData['ALL'] || myotonData[1] || Object.values(myotonData)[0];
      const multimodal = computeMultimodalGridResults(groupDwellsBe, groupDwellsAf, groupMyoton.points, selectedFreq);

      return {
        subjectName: `All Subjects (Group Pooled, N = ${subjectList.length})`,
        isGroup: true,
        subjectCount: subjectList.length,
        dwellsBefore: groupDwellsBe,
        dwellsAfter: groupDwellsAf,
        ...multimodal
      };
    } else {
      // Single Subject Mode
      const sName = selectedSubjectKey;
      const subjMicro = microData[sName];
      // Lookup Myoton by name, or by numeric index
      const sIdx = subjectList.indexOf(sName);
      const subjMyoton = myotonData[sName] || myotonData[sIdx + 1] || Object.values(myotonData)[0];

      if (!subjMicro || !subjMyoton) return null;

      const beSamples = subjMicro.frequencies[selectedFreq]?.before || [];
      const afSamples = subjMicro.frequencies[selectedFreq]?.after || [];

      const dwellsBefore = segmentMicrocirculationSignal(beSamples, samplingRateHz, dwellDurationSec, dwellEstimator);
      const dwellsAfter = segmentMicrocirculationSignal(afSamples, samplingRateHz, dwellDurationSec, dwellEstimator);

      const multimodal = computeMultimodalGridResults(dwellsBefore, dwellsAfter, subjMyoton.points, selectedFreq);

      return {
        subjectName: sName,
        isGroup: false,
        subjectCount: 1,
        dwellsBefore,
        dwellsAfter,
        ...multimodal
      };
    }
  }, [microData, myotonData, subjectList, selectedSubjectKey, selectedFreq, samplingRateHz, dwellDurationSec, dwellEstimator]);

  const handleRunPythonBackend = async () => {
    if (!window.electronAPI?.runPythonAnalysis) return;
    setIsPythonRunning(true);
    setPythonError(null);
    try {
      // Build in-memory fast payload directly from current analysis result
      const payload = {
        subject: selectedSubjectKey,
        freq: selectedFreq,
        fs: samplingRateHz,
        dwellDuration: dwellDurationSec,
        estimator: dwellEstimator,
        dwellsBefore: analysisResult?.dwellsBefore || [],
        dwellsAfter: analysisResult?.dwellsAfter || [],
        myotonPoints: analysisResult?.cells
          ? analysisResult.cells.map((c) => ({
              id: c.id,
              stiffBefore: c.stiffBefore,
              stiffAfter: c.stiffAfter
            }))
          : []
      };

      const res = await window.electronAPI.runPythonAnalysis({
        task: 'fast_grid',
        payload
      });
      setPythonResult(res);
    } catch (err) {
      console.error('Python execution failed:', err);
      setPythonError(err.message || 'Python execution failed');
    } finally {
      setIsPythonRunning(false);
    }
  };

  const rho = analysisResult?.correlations?.deltaSpearman ?? 0;
  const pearsonR = analysisResult?.correlations?.deltaPearson ?? 0;

  return (
    <div className="space-y-6">
      {/* Parameter Controls Bar */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-5">
        <div className="flex flex-wrap items-center justify-between pb-4 mb-4 border-b border-gray-100 gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-base">
                Protocol B: Plantar 9-Point Multimodal Spatial Grid
              </h2>
              <p className="text-xs text-gray-500">
                Spatial co-registration of Laser-Doppler Flux & Myotonometer Tissue Stiffness (3×3 Compass Grid)
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Upload Buttons for Microcirculation & Myoton */}
            {onUploadMicro && (
              <label className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-2xs">
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                <span>Upload SBF</span>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={onUploadMicro}
                  className="hidden"
                />
              </label>
            )}

            {onUploadMyoton && (
              <label className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-2xs">
                <Upload className="w-3.5 h-3.5 text-emerald-600" />
                <span>Upload Myoton</span>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={onUploadMyoton}
                  className="hidden"
                />
              </label>
            )}

            {/* Help / Manual Trigger Button */}
            {onOpenHelp && (
              <button
                onClick={onOpenHelp}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                title="Open full workflow and experimental protocol guide"
              >
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                <span>Workflow Manual</span>
              </button>
            )}

            {/* Download Template Buttons Group */}
            <div className="relative inline-flex items-center rounded-lg border border-slate-300 bg-white shadow-2xs">
              <button
                onClick={() => downloadUnifiedTemplate()}
                title="Download Standard Unified Excel Template (SBF & Myoton Combined)"
                className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all rounded-l-lg cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>Unified Template</span>
              </button>
              <button
                onClick={() => downloadMicrocirculationTemplate()}
                title="Download SBF Template alone"
                className="px-2 py-1.5 border-l border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium cursor-pointer"
              >
                SBF
              </button>
              <button
                onClick={() => downloadMyotonTemplate()}
                title="Download Myoton 9-Point Template alone"
                className="px-2 py-1.5 border-l border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium rounded-r-lg cursor-pointer"
              >
                Myoton
              </button>
            </div>

            {isElectron ? (
              <button
                onClick={handleRunPythonBackend}
                disabled={isPythonRunning}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                {isPythonRunning ? (
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>{isPythonRunning ? 'Running Python...' : 'Run Python Backend (Fast IPC)'}</span>
              </button>
            ) : (
              <span className="text-[11px] font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5" />
                JS Engine (Web Mode)
              </span>
            )}
            
            <span className="text-xs font-semibold px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Main Protocol Active
            </span>
          </div>
        </div>

        {/* Python IPC Result Banner if executed */}
        {pythonResult && (
          <div className="mb-4 p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-lg text-xs text-emerald-950 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="p-1 bg-emerald-600 text-white rounded-md">
                <CheckCircle className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold flex items-center gap-2">
                  <span>Python SciPy Core Execution Verified</span>
                  {pythonResult.executionTimeMs != null && (
                    <span className="font-mono text-[10px] bg-emerald-200/90 text-emerald-950 px-2 py-0.5 rounded font-semibold border border-emerald-300">
                      ⚡ {pythonResult.executionTimeMs} ms
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-emerald-800">
                  Spearman &rho; = {pythonResult.correlations.deltaSpearman} (p = {pythonResult.correlations.deltaSpearmanPValue}), Pearson r = {pythonResult.correlations.deltaPearson} (p = {pythonResult.correlations.deltaPearsonPValue})
                </p>
              </div>
            </div>
            <span className="font-mono text-[10px] bg-emerald-100/70 border border-emerald-300 text-emerald-900 px-2 py-0.5 rounded">
              Backend Engine: {pythonResult.engine}
            </span>
          </div>
        )}

        {pythonError && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
            <span className="font-bold">Python IPC Error:</span> {pythonError}
          </div>
        )}

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs">
          {/* Subject Selector (Single vs Group Pooled) */}
          <div>
            <label className="block text-gray-700 font-semibold mb-1">
              Subject / Participant
              <span className="text-[10px] text-indigo-600 font-bold ml-1">
                ({selectedSubjectKey === 'ALL' ? 'Group Mode' : 'Single Mode'})
              </span>
            </label>
            <select
              value={selectedSubjectKey}
              onChange={(e) => setSelectedSubjectKey(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg p-2 font-medium focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
            >
              {subjectList.length > 1 && (
                <option value="ALL">
                  🌐 All Subjects Combined (Group Pooled, N = {subjectList.length})
                </option>
              )}
              {subjectList.map((sName, sIdx) => (
                <option key={sName} value={sName}>
                  Subject {sIdx + 1}: {sName}
                </option>
              ))}
            </select>
          </div>

          {/* Frequency Selector */}
          <div>
            <label className="block text-gray-700 font-semibold mb-1">Stimulation Frequency</label>
            <select
              value={selectedFreq}
              onChange={(e) => setSelectedFreq(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg p-2 font-medium focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
            >
              <option value="30Hz">30 Hz (1_30)</option>
              <option value="50Hz">50 Hz (1_50)</option>
              <option value="100Hz">100 Hz (1_100)</option>
            </select>
          </div>

          {/* Sampling Rate Input (default 40Hz = 25ms) */}
          <div>
            <label className="block text-gray-700 font-semibold mb-1">
              Sampling Rate (Hz)
              <span className="text-[10px] text-gray-400 font-normal ml-1">
                ({(1000 / samplingRateHz).toFixed(1)} ms)
              </span>
            </label>
            <input
              type="number"
              step="1"
              min="1"
              max="1000"
              value={samplingRateHz}
              onChange={(e) => setSamplingRateHz(Math.max(1, parseFloat(e.target.value) || 40))}
              className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg p-2 font-medium focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Dwell Separation Input */}
          <div>
            <label className="block text-gray-700 font-semibold mb-1">
              Dwell Window (s)
              <span className="text-[10px] text-gray-400 font-normal ml-1">
                ({Math.round(dwellDurationSec * samplingRateHz)} samples)
              </span>
            </label>
            <input
              type="number"
              step="0.5"
              min="1"
              max="60"
              value={dwellDurationSec}
              onChange={(e) => setDwellDurationSec(Math.max(0.5, parseFloat(e.target.value) || 7.41))}
              className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg p-2 font-medium focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Estimator Method */}
          <div>
            <label className="block text-gray-700 font-semibold mb-1">Dwell Plateau Estimator</label>
            <select
              value={dwellEstimator}
              onChange={(e) => setDwellEstimator(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg p-2 font-medium focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
            >
              <option value="p25">P25 (Plateau - Spike Resistant)</option>
              <option value="median">Median (P50)</option>
              <option value="mean">Mean (Arithmetic Average)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Spatial Concordance & Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Concordance Metric Card */}
        <div className="bg-linear-to-br from-indigo-900 to-indigo-950 text-white rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-semibold text-indigo-300">
                Spatial Concordance
              </span>
              <Compass className="w-4 h-4 text-indigo-300" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black">{rho >= 0 ? `+${rho.toFixed(2)}` : rho.toFixed(2)}</span>
              <span className="text-xs text-indigo-200">Spearman &rho;</span>
            </div>
            <div className="text-xs text-indigo-300 mt-1">
              Pearson r = {pearsonR >= 0 ? `+${pearsonR.toFixed(2)}` : pearsonR.toFixed(2)}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-indigo-800 text-[11px] text-indigo-200">
            {rho < 0 ? (
              <span className="flex items-center gap-1 text-emerald-300 font-semibold">
                <TrendingDown className="w-3.5 h-3.5" />
                Negative Correlation: Vasodilation coincides with reduced tissue stiffness (biomechanical softening).
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-300 font-semibold">
                <TrendingUp className="w-3.5 h-3.5" />
                Positive Correlation: Perfusion elevation coincides with increased tissue tension.
              </span>
            )}
          </div>
        </div>

        {/* Flux Summary Card */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-xs uppercase tracking-wider font-semibold text-gray-500">
              Mean Microcirculation Flux
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-rose-600">
                {analysisResult.means.fluxDeltaMean >= 0 ? `+${analysisResult.means.fluxDeltaMean}` : analysisResult.means.fluxDeltaMean}
              </span>
              <span className="text-xs text-gray-500">PU (Mean &Delta;)</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between text-xs text-gray-600">
            <span>Before: <strong className="text-gray-900">{analysisResult.means.fluxBeforeMean} PU</strong></span>
            <span>After: <strong className="text-gray-900">{analysisResult.means.fluxAfterMean} PU</strong></span>
          </div>
        </div>

        {/* Stiffness Summary Card */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-xs uppercase tracking-wider font-semibold text-gray-500">
              Mean Myoton Tissue Stiffness
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-600">
                {analysisResult.means.stiffDeltaMean >= 0 ? `+${analysisResult.means.stiffDeltaMean}` : analysisResult.means.stiffDeltaMean}
              </span>
              <span className="text-xs text-gray-500">(Mean &Delta;)</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between text-xs text-gray-600">
            <span>Before: <strong className="text-gray-900">{analysisResult.means.stiffBeforeMean}</strong></span>
            <span>After: <strong className="text-gray-900">{analysisResult.means.stiffAfterMean}</strong></span>
          </div>
        </div>
      </div>

      {/* Dual Side-by-Side 3x3 Compass Heatmaps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CompassHeatmap
          title="&Delta; Laser-Doppler Blood Flow"
          subtitle="Microvascular perfusion change per compass site (After - Before)"
          metricName="Flux"
          unit="PU"
          dataCells={analysisResult.cells}
          isStiffness={false}
        />

        <CompassHeatmap
          title="&Delta; Myoton Tissue Stiffness"
          subtitle="Biomechanical dynamic stiffness change per compass site (After - Before)"
          metricName="Stiffness"
          unit=""
          dataCells={analysisResult.cells}
          isStiffness={true}
        />
      </div>

      {/* 9-Point Compass Data Table */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900 text-sm">
              9-Point Compass Spatial Measurements Table (Sites 1-9)
            </h3>
            <p className="text-xs text-gray-500">
              1: North-West | 2: North | 3: North-East | 4: West | 5: Center | 6: East | 7: South-West | 8: South | 9: South-East
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-100 text-gray-700 font-semibold border-b">
              <tr>
                <th className="py-2.5 px-4">Site (#)</th>
                <th className="py-2.5 px-4">Compass Direction</th>
                <th className="py-2.5 px-4 text-right">Flux Before (PU)</th>
                <th className="py-2.5 px-4 text-right">Flux After (PU)</th>
                <th className="py-2.5 px-4 text-right font-bold">&Delta; Flux (PU)</th>
                <th className="py-2.5 px-4 text-right">Flux &Delta; %</th>
                <th className="py-2.5 px-4 text-right">Stiff Before</th>
                <th className="py-2.5 px-4 text-right">Stiff After</th>
                <th className="py-2.5 px-4 text-right font-bold">&Delta; Stiff</th>
                <th className="py-2.5 px-4 text-right">Stiff &Delta; %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {analysisResult.cells.map((c) => (
                <tr key={c.id} className="hover:bg-indigo-50/40 transition-colors">
                  <td className="py-2 px-4 font-bold text-gray-900">#{c.id}</td>
                  <td className="py-2 px-4 font-medium text-gray-800">
                    <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[11px] font-semibold mr-1.5">
                      {c.code}
                    </span>
                    {c.name}
                  </td>
                  <td className="py-2 px-4 text-right text-gray-600">{c.fluxBefore}</td>
                  <td className="py-2 px-4 text-right text-gray-600">{c.fluxAfter}</td>
                  <td className="py-2 px-4 text-right font-bold text-rose-600">
                    {c.fluxDelta >= 0 ? `+${c.fluxDelta}` : c.fluxDelta}
                  </td>
                  <td className="py-2 px-4 text-right font-medium">
                    {c.fluxChangePct >= 0 ? `+${c.fluxChangePct}%` : `${c.fluxChangePct}%`}
                  </td>
                  <td className="py-2 px-4 text-right text-gray-600">{c.stiffBefore}</td>
                  <td className="py-2 px-4 text-right text-gray-600">{c.stiffAfter}</td>
                  <td className="py-2 px-4 text-right font-bold text-amber-600">
                    {c.stiffDelta >= 0 ? `+${c.stiffDelta}` : c.stiffDelta}
                  </td>
                  <td className="py-2 px-4 text-right font-medium">
                    {c.stiffChangePct >= 0 ? `+${c.stiffChangePct}%` : `${c.stiffChangePct}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
